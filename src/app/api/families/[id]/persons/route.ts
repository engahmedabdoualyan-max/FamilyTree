import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";
import { getFamilyTreeData, isValidPhoto } from "@/lib/tree-data";

type Ctx = { params: Promise<{ id: string }> };

const GENDERS = ["MALE", "FEMALE", "OTHER"];

// GET: full tree data (persons + spouse links + external bridged spouses)
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const data = await getFamilyTreeData(id);
  if (!data) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(data);
}

function cleanPersonInput(body: Record<string, unknown>) {
  const str = (v: unknown, max: number) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s.slice(0, max) : null;
  };
  const gender = String(body.gender ?? "").toUpperCase();
  return {
    firstName: String(body.firstName ?? "").trim().slice(0, 60),
    lastName: str(body.lastName, 60),
    nickname: str(body.nickname, 60),
    gender: GENDERS.includes(gender) ? gender : null,
    photo: isValidPhoto(body.photo) ? body.photo || null : undefined,
    birthDate: str(body.birthDate, 20),
    deathDate: str(body.deathDate, 20),
    birthPlace: str(body.birthPlace, 120),
    occupation: str(body.occupation, 120),
    bio: str(body.bio, 2000),
    isDeceased: Boolean(body.isDeceased),
  };
}

// POST: create a person in this family
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id: familyId } = await ctx.params;

  const membership = await getMembership(familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const data = cleanPersonInput(body);
  if (!data.firstName || !data.gender)
    return NextResponse.json({ error: "NAME_AND_GENDER_REQUIRED" }, { status: 400 });
  const gender: string = data.gender;
  delete (data as { gender?: string | null }).gender;

  const fatherId = typeof body.fatherId === "string" && body.fatherId ? body.fatherId : null;
  const motherId = typeof body.motherId === "string" && body.motherId ? body.motherId : null;
  const spouseOfId = typeof body.spouseOfId === "string" && body.spouseOfId ? body.spouseOfId : null;

  for (const relId of [fatherId, motherId]) {
    if (!relId) continue;
    const rel = await prisma.person.findUnique({ where: { id: relId } });
    if (!rel || rel.familyId !== familyId)
      return NextResponse.json({ error: "PARENT_NOT_IN_FAMILY" }, { status: 400 });
  }

  if (spouseOfId && (spouseOfId === fatherId || spouseOfId === motherId))
    return NextResponse.json({ error: "INVALID_RELATION" }, { status: 400 });

  let spouseOfPerson: Awaited<ReturnType<typeof prisma.person.findUnique>> = null;
  if (spouseOfId) {
    spouseOfPerson = await prisma.person.findUnique({ where: { id: spouseOfId } });
    if (!spouseOfPerson)
      return NextResponse.json({ error: "SPOUSE_NOT_FOUND" }, { status: 400 });
    if (spouseOfPerson.familyId !== familyId) {
      // Cross-family marriage bridge: allowed only if user belongs to the other family
      const otherMembership = await getMembership(spouseOfPerson.familyId, userId);
      if (!otherMembership)
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  // Approval workflow: pending if family requires it and user is not staff
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { requireApproval: true, approverUserId: true },
  });
  const isStaff =
    ["OWNER", "ADMIN"].includes(membership.role) ||
    (family?.approverUserId && family.approverUserId === userId);
  const needsApproval = !!family?.requireApproval && !isStaff;

  const person = await prisma.person.create({
    data: {
      ...data,
      gender,
      status: needsApproval ? "PENDING" : "APPROVED",
      familyId,
      createdById: userId,
      isRoot: Boolean(body.isRoot) && !fatherId && !motherId,
      ...(fatherId ? { fatherId } : {}),
      ...(motherId ? { motherId } : {}),
    },
  });

  if (spouseOfPerson) {
    // canonical order satisfies @@unique([aId, bId])
    const [aId, bId] = [spouseOfId!, person.id].sort();
    await prisma.spouseLink.upsert({
      where: { aId_bId: { aId, bId } },
      update: {},
      create: { aId, bId },
    });
  }

  if (needsApproval) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const { notify } = await import("@/lib/notify");
    const targetApprover = family?.approverUserId ?? null;
    if (targetApprover) {
      notify(
        targetApprover,
        "APPROVAL",
        `${me?.name ?? "أحد الأقارب"} أضاف «${person.firstName}» — يحتاج موافقتك`,
        `/family/${familyId}`
      );
    } else {
      const admins = await prisma.membership.findMany({
        where: { familyId, role: { in: ["OWNER", "ADMIN"] }, userId: { not: userId } },
        select: { userId: true },
      });
      for (const a of admins)
        notify(a.userId, "APPROVAL", `إضافة جديدة تحتاج موافقتكم: «${person.firstName}»`, `/family/${familyId}`);
    }
    return NextResponse.json({ person: { ...person, status: "PENDING" }, pendingReview: true }, { status: 201 });
  }

  return NextResponse.json({ person }, { status: 201 });
}
