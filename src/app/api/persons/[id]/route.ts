import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership, requireRole } from "@/lib/family";
import { isValidPhoto } from "@/lib/tree-data";

type Ctx = { params: Promise<{ id: string }> };

const GENDERS = ["MALE", "FEMALE", "OTHER"];

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const membership = await getMembership(person.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const str = (v: unknown, max: number) => {
    const s = typeof v === "string" ? v.trim() : null;
    return s ? s.slice(0, max) : null;
  };

  const data: Record<string, unknown> = {};
  if ("firstName" in body) {
    const firstName = String(body.firstName ?? "").trim().slice(0, 60);
    if (!firstName) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
    data.firstName = firstName;
  }
  if ("lastName" in body) data.lastName = str(body.lastName, 60);
  if ("nickname" in body) data.nickname = str(body.nickname, 60);
  if ("gender" in body) {
    const gender = String(body.gender ?? "").toUpperCase();
    if (!GENDERS.includes(gender))
      return NextResponse.json({ error: "INVALID_GENDER" }, { status: 400 });
    data.gender = gender;
  }
  if ("photo" in body && isValidPhoto(body.photo)) data.photo = body.photo || null;
  if ("birthDate" in body) data.birthDate = str(body.birthDate, 20);
  if ("deathDate" in body) data.deathDate = str(body.deathDate, 20);
  if ("birthPlace" in body) data.birthPlace = str(body.birthPlace, 120);
  if ("occupation" in body) data.occupation = str(body.occupation, 120);
  if ("bio" in body) data.bio = str(body.bio, 2000);
  if ("source" in body) data.source = str(body.source, 300);
  if ("isDeceased" in body) data.isDeceased = Boolean(body.isDeceased);
  if ("isRoot" in body) data.isRoot = Boolean(body.isRoot);

  // Parent attachment: parent must exist in the same family
  for (const key of ["fatherId", "motherId"] as const) {
    if (!(key in body)) continue;
    const val = body[key];
    if (val === null) {
      data[key] = null;
      continue;
    }
    if (typeof val !== "string") continue;
    const parent = await prisma.person.findUnique({ where: { id: val } });
    if (!parent || parent.familyId !== person.familyId || parent.id === id)
      return NextResponse.json({ error: "PARENT_NOT_IN_FAMILY" }, { status: 400 });
    data[key] = val;
  }

  if (!Object.keys(data).length)
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });

  const updated = await prisma.person.update({ where: { id }, data });
  return NextResponse.json({ person: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const person = await prisma.person.findUnique({
    where: { id },
    include: { childrenAsFather: true, childrenAsMother: true },
  });
  if (!person) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const membership = await requireRole(person.familyId, userId, ["OWNER", "ADMIN"]);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  if (person.childrenAsFather.length || person.childrenAsMother.length) {
    return NextResponse.json(
      { error: "HAS_CHILDREN", count: person.childrenAsFather.length + person.childrenAsMother.length },
      { status: 400 }
    );
  }

  await prisma.person.delete({ where: { id } }); // spouse links & comments cascade
  return NextResponse.json({ ok: true });
}
