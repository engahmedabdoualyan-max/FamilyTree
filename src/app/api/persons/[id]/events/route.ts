import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  const person = await prisma.person.findUnique({ where: { id }, select: { familyId: true } });
  if (!person) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!(await getMembership(person.familyId, session.user.id)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const events = await prisma.lifeEvent.findMany({
    where: { personId: id },
    orderBy: [{ year: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ events });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  const person = await prisma.person.findUnique({ where: { id }, select: { familyId: true } });
  if (!person) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!(await getMembership(person.familyId, session.user.id)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const title = String(body?.title ?? "").trim().slice(0, 120);
  if (title.length < 2) return NextResponse.json({ error: "INVALID" }, { status: 400 });
  const year = String(body?.year ?? "").trim().slice(0, 10) || null;
  const place = String(body?.place ?? "").trim().slice(0, 120) || null;

  const event = await prisma.lifeEvent.create({
    data: { personId: id, title, year, place },
  });
  return NextResponse.json({ event }, { status: 201 });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const person = await prisma.person.findUnique({ where: { id }, select: { familyId: true } });
  if (!person) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!(await getMembership(person.familyId, session.user.id)))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  await prisma.lifeEvent.delete({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}
