import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET my DND state
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dndEnabled: true },
  });
  return NextResponse.json({ dndEnabled: user?.dndEnabled ?? false });
}

// POST toggle DND: { enabled }
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const enabled = Boolean(body?.enabled);
  await prisma.user.update({ where: { id: userId }, data: { dndEnabled: enabled } });
  return NextResponse.json({ dndEnabled: enabled });
}
