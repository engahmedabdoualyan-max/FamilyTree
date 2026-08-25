import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };
const MAX_VOICE = 2_000_000; // ~1.5MB binary

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  const person = await prisma.person.findUnique({ where: { id }, select: { familyId: true } });
  if (!person) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!(await getMembership(person.familyId, session.user.id)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const voices = await prisma.personVoice.findMany({
    where: { personId: id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      recordedBy: { select: { name: true } },
    },
  });
  return NextResponse.json({
    voices: voices.map((v) => ({
      id: v.id,
      dataUrl: v.dataUrl,
      durationSec: v.durationSec,
      recordedBy: v.recordedBy.name,
      createdAt: v.createdAt,
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  const person = await prisma.person.findUnique({ where: { id }, select: { familyId: true } });
  if (!person) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!(await getMembership(person.familyId, userId)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const count = await prisma.personVoice.count({ where: { personId: id } });
  if (count >= 5)
    return NextResponse.json({ error: "MAX_VOICES" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl : "";
  if (!dataUrl.startsWith("data:audio/") || dataUrl.length > MAX_VOICE)
    return NextResponse.json({ error: "TOO_LARGE" }, { status: 400 });

  const voice = await prisma.personVoice.create({
    data: {
      personId: id,
      dataUrl,
      durationSec: Math.max(0, Math.min(300, Number(body?.durationSec ?? 0))),
      createdById: userId,
    },
  });
  return NextResponse.json(
    { voice: { id: voice.id, durationSec: voice.durationSec, createdAt: voice.createdAt } },
    { status: 201 }
  );
}

export async function DELETE(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const voiceId = url.searchParams.get("voiceId");
  if (!voiceId) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const person = await prisma.person.findUnique({ where: { id }, select: { familyId: true } });
  if (!person) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const voice = await prisma.personVoice.findUnique({ where: { id: voiceId } });
  if (!voice || voice.personId !== id)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const membership = await getMembership(person.familyId, userId);
  const isStaff = membership && ["OWNER", "ADMIN"].includes(membership.role);
  if (!isStaff && voice.createdById !== userId)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.personVoice.delete({ where: { id: voiceId } });
  return NextResponse.json({ ok: true });
}
