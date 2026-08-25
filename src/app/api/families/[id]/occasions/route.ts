import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";
import { notifyFamily } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

const TYPES = [
  "BIRTHDAY",
  "WEDDING",
  "ENGAGEMENT",
  "BIRTH",
  "GRADUATION",
  "EID",
  "GATHERING",
  "OTHER",
];

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const mePerson = await prisma.person.findFirst({
    where: { familyId: id, linkedUserId: userId },
    select: { id: true },
  });

  const occasions = await prisma.occasion.findMany({
    where: { familyId: id },
    include: {
      _count: { select: { albums: true, invites: true } },
      invites: { where: { person: { linkedUserId: userId } }, select: { id: true, status: true } },
    },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({
    myPersonId: mePerson?.id ?? null,
    occasions: occasions.map((o) => ({
      ...o,
      inviteCount: o._count.invites,
      albumCount: o._count.albums,
      myInvite: o.invites[0] ?? null,
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const title = String(body.title ?? "").trim().slice(0, 120);
  const type = String(body.type ?? "OTHER").toUpperCase();
  const date = String(body.date ?? "").trim();
  const notes = String(body.notes ?? "").trim().slice(0, 500) || null;

  if (title.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "INVALID" }, { status: 400 });

  const occasion = await prisma.occasion.create({
    data: {
      familyId: id,
      title,
      type: TYPES.includes(type) ? type : "OTHER",
      date,
      notes,
      createdById: userId,
    },
  });
  notifyFamily(
    id,
    userId,
    "OCCASION",
    `مناسبة جديدة: ${occasion.title} 🎉 (${occasion.date})`,
    `/family/${id}/occasions`
  );
  return NextResponse.json({ occasion }, { status: 201 });
}
