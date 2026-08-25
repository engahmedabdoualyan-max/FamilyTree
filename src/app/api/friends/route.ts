import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// GET my friends + pending lists
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const all = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: {
      requester: { select: { id: true, name: true, image: true } },
      addressee: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const friends = all
    .filter((f) => f.status === "ACCEPTED")
    .map((f) => ({
      id: f.requesterId === userId ? f.addressee.id : f.requester.id,
      name: (f.requesterId === userId ? f.addressee.name : f.requester.name) ?? "?",
      image: f.requesterId === userId ? f.addressee.image : f.requester.image,
      since: f.createdAt,
    }));
  const incoming = all
    .filter((f) => f.status === "PENDING" && f.addresseeId === userId)
    .map((f) => ({ requestId: f.id, user: f.requester, createdAt: f.createdAt }));
  const outgoing = all
    .filter((f) => f.status === "PENDING" && f.requesterId === userId)
    .map((f) => ({ requestId: f.id, user: f.addressee, createdAt: f.createdAt }));

  return NextResponse.json({ friends, incoming, outgoing });
}

// POST send a friend request: { userId }
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const targetId = typeof body?.userId === "string" ? body.userId : "";
  if (!targetId || targetId === userId)
    return NextResponse.json({ error: "INVALID_USER" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // reverse request? auto-accept
  const reverse = await prisma.friendship.findUnique({
    where: { requesterId_addresseeId: { requesterId: targetId, addresseeId: userId } },
  });
  if (reverse) {
    if (reverse.status === "PENDING") {
      await prisma.friendship.update({
        where: { id: reverse.id },
        data: { status: "ACCEPTED" },
      });
      notify(targetId, "FRIEND", `${session.user.name ?? "أحد الأقارب"} قبل طلب الصداقة 🎉`, "/friends");
      return NextResponse.json({ status: "ACCEPTED" }, { status: 201 });
    }
    return NextResponse.json({ status: reverse.status });
  }

  const existing = await prisma.friendship.findUnique({
    where: { requesterId_addresseeId: { requesterId: userId, addresseeId: targetId } },
  });
  if (existing)
    return NextResponse.json({ status: existing.status });

  await prisma.friendship.create({
    data: { requesterId: userId, addresseeId: targetId, status: "PENDING" },
  });
  notify(
    targetId,
    "FRIEND",
    `${session.user.name ?? "أحد الأقارب"} أرسل لك طلب صداقة 👋`,
    "/friends"
  );
  return NextResponse.json({ status: "PENDING" }, { status: 201 });
}
