import { prisma } from "@/lib/prisma";

export type PersonDTO = {
  id: string;
  familyId: string;
  familyName?: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  gender: string;
  photo: string | null;
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
  occupation: string | null;
  bio: string | null;
  isDeceased: boolean;
  isRoot: boolean;
  fatherId: string | null;
  motherId: string | null;
  commentCount: number;
};

export type SpouseLinkDTO = {
  id: string;
  aId: string;
  bId: string;
  status: string;
};

export type FamilyTreeData = {
  family: {
    id: string;
    name: string;
    description: string | null;
    photo: string | null;
    inviteCode: string;
    createdById: string;
  };
  persons: PersonDTO[];
  spouseLinks: SpouseLinkDTO[];
};

export const MAX_PHOTO_LENGTH = 900_000;

export function isValidPhoto(photo: unknown): photo is string {
  return (
    typeof photo === "string" &&
    (photo === "" || (photo.startsWith("data:image/") && photo.length <= MAX_PHOTO_LENGTH))
  );
}

/**
 * Loads everything needed to render a family tree:
 * all persons of the family plus "external" spouses (persons from other
 * families connected through marriage) so families can bridge together.
 */
export async function getFamilyTreeData(familyId: string): Promise<FamilyTreeData | null> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      id: true,
      name: true,
      description: true,
      photo: true,
      inviteCode: true,
      createdById: true,
    },
  });
  if (!family) return null;

  const persons = await prisma.person.findMany({
    where: { familyId },
    include: {
      spouseLinksA: { select: { id: true, aId: true, bId: true, status: true } },
      spouseLinksB: { select: { id: true, aId: true, bId: true, status: true } },
      _count: { select: { comments: true } },
    },
  });

  const linkMap = new Map<string, SpouseLinkDTO>();
  for (const p of persons) {
    for (const l of p.spouseLinksA) linkMap.set(l.id, l);
    for (const l of p.spouseLinksB) linkMap.set(l.id, l);
  }
  const linkDTOs = [...linkMap.values()];

  // Collect external spouses referenced by links but belonging to other families
  const internalIds = new Set(persons.map((p) => p.id));
  const externalIds = new Set<string>();
  for (const l of linkDTOs) {
    if (!internalIds.has(l.aId)) externalIds.add(l.aId);
    if (!internalIds.has(l.bId)) externalIds.add(l.bId);
  }

  const externals = externalIds.size
    ? await prisma.person.findMany({
        where: { id: { in: [...externalIds] } },
        include: { family: { select: { name: true } }, _count: { select: { comments: true } } },
      })
    : [];

  const toDTO = (p: (typeof persons)[number] | (typeof externals)[number], familyName?: string): PersonDTO => ({
    id: p.id,
    familyId: p.familyId,
    familyName,
    firstName: p.firstName,
    lastName: p.lastName,
    nickname: p.nickname,
    gender: p.gender,
    photo: p.photo,
    birthDate: p.birthDate,
    deathDate: p.deathDate,
    birthPlace: p.birthPlace,
    occupation: p.occupation,
    bio: p.bio,
    isDeceased: p.isDeceased,
    isRoot: p.isRoot,
    fatherId: p.fatherId,
    motherId: p.motherId,
    commentCount: p._count.comments,
  });

  return {
    family,
    persons: [
      ...persons.map((p) => toDTO(p)),
      ...externals.map((p) => toDTO(p, p.family.name)),
    ],
    spouseLinks: linkDTOs,
  };
}
