import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, makeInviteCode } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await requireRole(id, userId, ["OWNER", "ADMIN"]);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const data: Record<string, string | null> = {};
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 80)
      return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
    data.name = name;
  }
  if (typeof body?.description === "string")
    data.description = body.description.trim().slice(0, 500) || null;
  if (typeof body?.photo === "string" && (body.photo === "" || body.photo.startsWith("data:image/")))
    data.photo = body.photo || null;
  if (!Object.keys(data).length)
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });

  const family = await prisma.family.update({ where: { id }, data });
  return NextResponse.json({ family });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await requireRole(id, userId, ["OWNER"]);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.family.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function POST(_req: Request, ctx: Ctx) {
  // Rotate invite code
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await requireRole(id, userId, ["OWNER", "ADMIN"]);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  let inviteCode = makeInviteCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.family.findUnique({ where: { inviteCode } });
    if (!exists) break;
    inviteCode = makeInviteCode();
  }
  const family = await prisma.family.update({ where: { id }, data: { inviteCode } });
  return NextResponse.json({ family });
}
