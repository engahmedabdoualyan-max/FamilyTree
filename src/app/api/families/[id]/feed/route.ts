import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

function monthOf(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const m = birthDate.match(/(?:^\d{4}[-/])?(\d{1,2})[-/]/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) return n;
  }
  return null;
}

function dayOf(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const m = birthDate.match(/\d{1,2}$/);
  return m ? Number(m[0]) : null;
}

// Family news feed: recent photos, new members, upcoming occasions, birthdays this month
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const [media, newPersons, occasions, allPersons] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { familyId: id, kind: "PHOTO" },
      include: {
        personTags: { select: { personId: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.person.findMany({
      where: { familyId: id, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, firstName: true, lastName: true, photo: true, createdAt: true },
    }),
    prisma.occasion.findMany({
      where: { familyId: id },
      orderBy: { date: "asc" },
      take: 6,
    }),
    prisma.person.findMany({
      where: { familyId: id, birthDate: { not: null }, isDeceased: false },
      select: { id: true, firstName: true, lastName: true, photo: true, birthDate: true },
    }),
  ]);

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const birthdays = allPersons
    .filter((p) => monthOf(p.birthDate) === thisMonth)
    .map((p) => ({ ...p, day: dayOf(p.birthDate) ?? 31 }))
    .sort((a, b) => a.day - b.day);

  return NextResponse.json({
    media: media.map((m) => ({
      id: m.id,
      fileData: m.fileData,
      title: m.title,
      createdAt: m.createdAt,
      uploadedById: m.uploadedById,
      personIds: m.personTags.map((t) => t.personId),
      likesCount: m._count.likes,
      commentsCount: m._count.comments,
    })),
    newPersons,
    occasions,
    birthdays,
  });
}
