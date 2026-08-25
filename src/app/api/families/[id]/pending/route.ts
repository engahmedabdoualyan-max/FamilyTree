import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

// GET pending persons (approver / admins / owner only)
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const family = await prisma.family.findUnique({
    where: { id },
    select: { requireApproval: true, approverUserId: true },
  });
  const isStaff =
    ["OWNER", "ADMIN"].includes(membership.role) || family?.approverUserId === userId;
  if (!isStaff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const persons = await prisma.person.findMany({
    where: { familyId: id, status: "PENDING" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      birthDate: true,
      photo: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ persons });
}

// POST approve or reject: { personId, action: APPROVE | REJECT }
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const family = await prisma.family.findUnique({
    where: { id },
    select: { approverUserId: true },
  });
  const isStaff =
    ["OWNER", "ADMIN"].includes(membership.role) || family?.approverUserId === userId;
  if (!isStaff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const personId = typeof body?.personId === "string" ? body.personId : "";
  const action = String(body?.action ?? "").toUpperCase();
  if (!personId || !["APPROVE", "REJECT"].includes(action))
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person || person.familyId !== id)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (action === "APPROVE") {
    await prisma.person.update({ where: { id: personId }, data: { status: "APPROVED" } });
    notify(
      person.createdById,
      "APPROVAL",
      `تمت الموافقة على إضافة «${person.firstName}» للشجرة ✅`,
      `/family/${id}`
    );
  } else {
    await prisma.person.delete({ where: { id: personId } });
    notify(
      person.createdById,
      "APPROVAL",
      `لم تتم الموافقة على إضافة «${person.firstName}»`,
      `/family/${id}`
    );
  }
  return NextResponse.json({ ok: true });
}
