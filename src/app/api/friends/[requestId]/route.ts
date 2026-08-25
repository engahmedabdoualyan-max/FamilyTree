import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

type Ctx = RouteContext<"/api/friends/[requestId]">;

// POST respond to a friend request: { status: ACCEPTED | DECLINED }
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { requestId: id } = await ctx.params;

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship || friendship.addresseeId !== userId)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const status = String(body?.status ?? "").toUpperCase();
  if (!["ACCEPTED", "DECLINED"].includes(status))
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });

  await prisma.friendship.update({ where: { id }, data: { status } });
  if (status === "ACCEPTED") {
    notify(
      friendship.requesterId,
      "FRIEND",
      `${session.user.name ?? "أحد الأقارب"} قبل طلب الصداقة 🎉`,
      "/friends"
    );
  }
  return NextResponse.json({ ok: true });
}

// DELETE remove friendship entirely (either side)
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { requestId: id } = await ctx.params;

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (friendship.requesterId !== userId && friendship.addresseeId !== userId)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.friendship.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
