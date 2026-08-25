import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });

  const family = await prisma.family.findUnique({ where: { inviteCode: code } });
  if (!family) return NextResponse.json({ error: "FAMILY_NOT_FOUND" }, { status: 404 });

  const existing = await prisma.membership.findUnique({
    where: { userId_familyId: { userId, familyId: family.id } },
  });
  if (!existing) {
    await prisma.membership.create({
      data: { userId, familyId: family.id, role: "MEMBER" },
    });
  }
  return NextResponse.json({ family });
}
