import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

// GET invites of an occasion
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const occasion = await prisma.occasion.findUnique({ where: { id } });
  if (!occasion) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const membership = await getMembership(occasion.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const invites = await prisma.occasionInvite.findMany({
    where: { occasionId: id },
    include: {
      person: { select: { id: true, firstName: true, lastName: true, linkedUserId: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ invites });
}

// POST send invites: { personIds: [...] } (empty = whole tree)
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const occasion = await prisma.occasion.findUnique({ where: { id } });
  if (!occasion) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const membership = await getMembership(occasion.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  let personIds: string[] = Array.isArray(body?.personIds)
    ? (body!.personIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  if (body?.all === true) {
    const all = await prisma.person.findMany({
      where: { familyId: occasion.familyId },
      select: { id: true },
    });
    personIds = all.map((p) => p.id);
  }
  if (!personIds.length)
    return NextResponse.json({ error: "NO_PERSONS" }, { status: 400 });

  // dedupe against existing invites
  const existing = await prisma.occasionInvite.findMany({
    where: { occasionId: id, personId: { in: personIds } },
    select: { personId: true },
  });
  const existingSet = new Set(existing.map((e) => e.personId));
  const fresh = [...new Set(personIds)].filter((pid) => !existingSet.has(pid));

  if (fresh.length) {
    await prisma.occasionInvite.createMany({
      data: fresh.map((pid) => ({ occasionId: id, personId: pid })),
    });

    // notify users linked to invited persons
    const linked = await prisma.person.findMany({
      where: { id: { in: fresh }, linkedUserId: { not: null } },
      select: { linkedUserId: true, firstName: true },
    });
    for (const p of linked) {
      if (p.linkedUserId && p.linkedUserId !== userId) {
        notify(
          p.linkedUserId,
          "INVITE",
          `دعوة لمناسبة «${occasion.title}» 🎉 بتاريخ ${occasion.date}`,
          `/family/${occasion.familyId}/occasions`
        );
      }
    }
  }

  return NextResponse.json({ invited: fresh.length, skipped: personIds.length - fresh.length });
}
