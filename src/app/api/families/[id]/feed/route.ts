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
      where: {
        familyId: id,
        kind: "PHOTO",
        OR: [{ visibility: "FAMILY" }, { uploadedById: userId }],
      },
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

  const statsPersons = await prisma.person.findMany({
    where: { familyId: id, status: "APPROVED" },
    select: {
      gender: true,
      isDeceased: true,
      birthDate: true,
      firstName: true,
      lastName: true,
    },
  });
  const males = statsPersons.filter((p) => p.gender === "MALE").length;
  const females = statsPersons.filter((p) => p.gender === "FEMALE").length;
  const deceased = statsPersons.filter((p) => p.isDeceased).length;
  const withYear = statsPersons
    .map((p) => ({ p, y: Number((p.birthDate ?? "").match(/(\d{4})/)?.[1] ?? 9999) }))
    .filter((x) => x.y !== 9999)
    .sort((a, b) => a.y - b.y);
  const oldest = withYear[0]
    ? `${withYear[0].p.firstName} ${withYear[0].p.lastName ?? ""} (${withYear[0].y})`
    : null;
  const nameCount = new Map<string, number>();
  for (const p of statsPersons) {
    if (!p.firstName) continue;
    nameCount.set(p.firstName, (nameCount.get(p.firstName) ?? 0) + 1);
  }
  let topName: string | null = null;
  let topN = 0;
  for (const [n, c] of nameCount) {
    if (c > topN) {
      topN = c;
      topName = n;
    }
  }

  const stats = {
    total: statsPersons.length,
    males,
    females,
    deceased,
    oldest,
    topName: topName ? `${topName} ×${topN}` : null,
  };

  // On This Day: photos uploaded on same month/day in PREVIOUS years
  const nowD = new Date();
  const mm = String(nowD.getMonth() + 1).padStart(2, "0");
  const dd = String(nowD.getDate()).padStart(2, "0");
  const yearStart = `${nowD.getFullYear()}-01-01`;
  const onThisDayRaw = await prisma.$queryRaw<{ id: string; fileData: string; title: string | null; createdAt: Date }[]>`
    SELECT id, "fileData", title, "createdAt" FROM "MediaAsset"
    WHERE "familyId"=${id} AND kind='PHOTO'
      AND "createdAt" < ${yearStart}::timestamp
      AND EXTRACT(MONTH FROM "createdAt")=${Number(mm)}
      AND EXTRACT(DAY FROM "createdAt")=${Number(dd)}
    ORDER BY "createdAt" DESC LIMIT 6`;
  const onThisDay = onThisDayRaw.map((m) => ({
    id: m.id,
    fileData: m.fileData,
    title: m.title,
    year: new Date(m.createdAt).getFullYear(),
  }));

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const birthdays = allPersons
    .filter((p) => monthOf(p.birthDate) === thisMonth)
    .map((p) => ({ ...p, day: dayOf(p.birthDate) ?? 31 }))
    .sort((a, b) => a.day - b.day);

  return NextResponse.json({
    stats,
    onThisDay,
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
