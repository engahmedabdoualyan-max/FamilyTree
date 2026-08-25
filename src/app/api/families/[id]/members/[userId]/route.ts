import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership, requireRole } from "@/lib/family";

type Ctx = { params: Promise<{ id: string; userId: string }> };

// Change member role (owner only)
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  const myId = session?.user?.id;
  if (!myId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id, userId } = await ctx.params;

  const me = await requireRole(id, myId, ["OWNER"]);
  if (!me) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const role = String(body?.role ?? "");
  if (!["ADMIN", "MEMBER"].includes(role))
    return NextResponse.json({ error: "INVALID_ROLE" }, { status: 400 });
  if (userId === myId)
    return NextResponse.json({ error: "CANNOT_CHANGE_SELF" }, { status: 400 });

  try {
    const membership = await prisma.membership.update({
      where: { userId_familyId: { userId, familyId: id } },
      data: { role },
    });
    return NextResponse.json({ membership });
  } catch {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
}

// Remove member (self-leave or admin/owner removal)
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  const myId = session?.user?.id;
  if (!myId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id, userId } = await ctx.params;

  const family = await prisma.family.findUnique({ where: { id } });
  if (!family) return NextResponse.json({ error: "FAMILY_NOT_FOUND" }, { status: 404 });
  if (userId === family.createdById)
    return NextResponse.json({ error: "CANNOT_REMOVE_OWNER" }, { status: 400 });

  const me = await getMembership(id, myId);
  if (!me) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const isSelf = userId === myId;
  const isAdmin = ["OWNER", "ADMIN"].includes(me.role);
  if (!isSelf && !isAdmin)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.membership.delete({
    where: { userId_familyId: { userId, familyId: id } },
  });
  return NextResponse.json({ ok: true });
}
