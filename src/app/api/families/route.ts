import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { makeInviteCode } from "@/lib/family";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const families = await prisma.family.findMany({
    where: { memberships: { some: { userId: session.user.id } } },
    include: {
      _count: { select: { persons: true, memberships: true } },
      memberships: { where: { userId: session.user.id }, select: { role: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ families });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
  }
  const description = String(body?.description ?? "").trim().slice(0, 500) || null;

  let inviteCode = makeInviteCode();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.family.findUnique({ where: { inviteCode } });
    if (!exists) break;
    inviteCode = makeInviteCode();
  }

  const family = await prisma.family.create({
    data: {
      name,
      description,
      inviteCode,
      createdById: userId,
      memberships: { create: { userId, role: "OWNER" } },
    },
  });
  return NextResponse.json({ family }, { status: 201 });
}
