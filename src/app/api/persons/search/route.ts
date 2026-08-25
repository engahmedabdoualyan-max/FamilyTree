import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Search persons across all families the current user belongs to.
// Used to link existing relatives (e.g. cross-family marriage bridging).
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const excludeFamily = url.searchParams.get("excludeFamily");

  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { familyId: true },
  });
  const familyIds = memberships
    .map((m) => m.familyId)
    .filter((fid) => fid !== excludeFamily);

  if (!familyIds.length) return NextResponse.json({ persons: [] });

  const persons = await prisma.person.findMany({
    where: {
      familyId: { in: familyIds },
      ...(q
        ? {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { nickname: { contains: q } },
            ],
          }
        : {}),
    },
    include: { family: { select: { id: true, name: true } } },
    orderBy: [{ firstName: "asc" }],
    take: 30,
  });

  return NextResponse.json({
    persons: persons.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      gender: p.gender,
      photo: p.photo,
      birthDate: p.birthDate,
      familyName: p.family.name,
    })),
  });
}
