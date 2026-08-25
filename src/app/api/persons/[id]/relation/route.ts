import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";
import { findRelationPath } from "@/lib/relation";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/persons/[id]/relation?familyId=...&from=... → path steps
export async function GET(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id: targetId } = await ctx.params;

  const url = new URL(req.url);
  const familyId = url.searchParams.get("familyId");
  const fromId = url.searchParams.get("from");
  if (!familyId || !fromId)
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const membership = await getMembership(familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const persons = await prisma.person.findMany({
    where: { familyId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      fatherId: true,
      motherId: true,
    },
  });
  const spouseLinks = await prisma.spouseLink.findMany({
    where: {
      OR: [
        { a: { familyId } },
        { b: { familyId } },
      ],
    },
  });

  const path = findRelationPath(fromId, targetId, persons as never, spouseLinks);
  if (!path) return NextResponse.json({ path: null });
  return NextResponse.json({ path });
}
