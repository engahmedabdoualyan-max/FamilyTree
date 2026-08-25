import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

const MAX_FILE_LENGTH = 7_000_000; // ~5MB binary as base64
const KINDS = ["PHOTO", "DOC"];
const DOC_TYPES = [
  "BIRTH_CERT",
  "MARRIAGE_CERT",
  "DEATH_CERT",
  "ID_CARD",
  "EDUCATION",
  "PROPERTY",
  "OTHER",
];

type MediaRow = {
  id: string;
  familyId: string;
  albumId: string | null;
  kind: string;
  docType: string | null;
  title: string | null;
  caption: string | null;
  mime: string;
  uploadedById: string;
  createdAt: Date;
  personTags?: { personId: string }[];
  _count?: { likes: number; comments: number };
  likes?: { userId: string }[];
};

function mediaDTO(m: MediaRow, meId?: string) {
  return {
    id: m.id,
    familyId: m.familyId,
    albumId: m.albumId,
    kind: m.kind,
    docType: m.docType,
    title: m.title,
    caption: m.caption,
    mime: m.mime,
    uploadedById: m.uploadedById,
    createdAt: m.createdAt,
    personIds: (m.personTags ?? []).map((t) => t.personId),
    likesCount: m._count?.likes ?? m.likes?.length ?? 0,
    commentsCount: m._count?.comments ?? 0,
    likedByMe: meId ? (m.likes?.some((l) => l.userId === meId) ?? false) : false,
  };
}

// GET ?albumId=... | ?personId=... | ?kind=DOC
export async function GET(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(req.url);
  const albumId = url.searchParams.get("albumId");
  const personId = url.searchParams.get("personId");
  const kind = url.searchParams.get("kind");

  if (personId) {
    const media = await prisma.mediaAsset.findMany({
      where: { familyId: id, personTags: { some: { personId } } },
      include: {
        personTags: { select: { personId: true } },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId }, select: { userId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json({ media: media.map((m) => mediaDTO(m, userId)) });
  }

  const media = await prisma.mediaAsset.findMany({
    where: {
      familyId: id,
      ...(albumId ? { albumId } : {}),
      ...(kind === "DOC" || kind === "PHOTO" ? { kind } : {}),
    },
    include: {
      personTags: { select: { personId: true } },
      _count: { select: { likes: true, comments: true } },
      likes: { where: { userId }, select: { userId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ media: media.map((m) => mediaDTO(m, userId)) });
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

  const fileData = typeof body.fileData === "string" ? body.fileData : "";
  if (!fileData.startsWith("data:") || fileData.length > MAX_FILE_LENGTH)
    return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });

  const mime = fileData.slice(5, fileData.indexOf(";"));
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  if (!isImage && !isPdf)
    return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 400 });

  const kind = String(body.kind ?? "PHOTO").toUpperCase();
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "BAD_KIND" }, { status: 400 });

  let docType: string | null = null;
  if (kind === "DOC") {
    docType = String(body.docType ?? "OTHER").toUpperCase();
    if (!DOC_TYPES.includes(docType)) docType = "OTHER";
  }

  let albumId: string | null =
    typeof body.albumId === "string" && body.albumId ? body.albumId : null;
  if (albumId) {
    const album = await prisma.album.findUnique({ where: { id: albumId } });
    if (!album || album.familyId !== id) albumId = null;
  }

  const personIds = Array.isArray(body.personIds)
    ? body.personIds.filter((x): x is string => typeof x === "string").slice(0, 20)
    : [];
  if (personIds.length) {
    const valid = await prisma.person.count({
      where: { id: { in: personIds }, familyId: id },
    });
    if (valid !== [...new Set(personIds)].length)
      return NextResponse.json({ error: "INVALID_PERSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) || null : null;
  const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, 300) || null : null;

  const created = await prisma.mediaAsset.create({
    data: {
      familyId: id,
      albumId,
      kind,
      docType,
      title,
      caption,
      fileData,
      mime: isPdf ? "application/pdf" : mime,
      uploadedById: userId,
      ...(personIds.length
        ? { personTags: { create: [...new Set(personIds)].map((pid) => ({ personId: pid })) } }
        : {}),
    },
    include: { personTags: { select: { personId: true } } },
  });
  return NextResponse.json({ media: mediaDTO(created) }, { status: 201 });
}
