import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const media = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!media) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const membership = await getMembership(media.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if ("title" in body) data.title = String(body.title ?? "").trim().slice(0, 120) || null;
  if ("caption" in body) data.caption = String(body.caption ?? "").trim().slice(0, 300) || null;

  // Visibility update
  if (typeof body.visibility === "string" && ["FAMILY", "PRIVATE", "CUSTOM"].includes(body.visibility.toUpperCase())) {
    await prisma.mediaAsset.update({
      where: { id },
      data: { visibility: body.visibility.toUpperCase() },
    });
  }

  if (Array.isArray(body.viewerIds)) {
    const viewerIds = body.viewerIds
      .filter((x): x is string => typeof x === "string")
      .slice(0, 50);
    const validCount = viewerIds.length
      ? await prisma.membership.count({
          where: { familyId: media.familyId, userId: { in: viewerIds } },
        })
      : 0;
    if (validCount !== [...new Set(viewerIds)].length)
      return NextResponse.json({ error: "INVALID_VIEWER" }, { status: 400 });
    await prisma.$transaction([
      prisma.mediaViewer.deleteMany({ where: { mediaId: id } }),
      ...(viewerIds.length
        ? [
            prisma.mediaViewer.createMany({
              data: [...new Set(viewerIds)].map((uid) => ({ mediaId: id, userId: uid })),
            }),
          ]
        : []),
    ]);
  }

  // Replace person tags
  if (Array.isArray(body.personIds)) {
    const personIds = body.personIds
      .filter((x): x is string => typeof x === "string")
      .slice(0, 20);
    const valid = personIds.length
      ? await prisma.person.count({ where: { id: { in: personIds }, familyId: media.familyId } })
      : 0;
    if (valid !== [...new Set(personIds)].length)
      return NextResponse.json({ error: "INVALID_PERSON" }, { status: 400 });
    await prisma.$transaction([
      prisma.personTag.deleteMany({ where: { mediaId: id } }),
      ...(personIds.length
        ? [
            prisma.personTag.createMany({
              data: [...new Set(personIds)].map((pid) => ({ mediaId: id, personId: pid })),
            }),
          ]
        : []),
    ]);
  }

  if (Object.keys(data).length) {
    await prisma.mediaAsset.update({ where: { id }, data });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const media = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!media) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const membership = await getMembership(media.familyId, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const isAdmin = ["OWNER", "ADMIN"].includes(membership.role);
  if (!isAdmin && media.uploadedById !== userId)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.mediaAsset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
