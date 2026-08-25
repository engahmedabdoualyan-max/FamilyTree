import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

async function guard(ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  const { id } = await ctx.params;
  const person = await prisma.person.findUnique({ where: { id } });
  if (!person)
    return { error: NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }) };
  // Commenting allowed for members of the person's family
  const membership = await getMembership(person.familyId, userId);
  if (!membership) {
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }
  return { person, userId };
}

export async function GET(_req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const comments = await prisma.comment.findMany({
    where: { personId: g.person!.id },
    include: { user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return NextResponse.json({ comments });
}

export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const text = String(body?.text ?? "").trim().slice(0, 1000);
  if (!text) return NextResponse.json({ error: "EMPTY_TEXT" }, { status: 400 });

  const comment = await prisma.comment.create({
    data: { personId: g.person!.id, userId: g.userId!, text },
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  return NextResponse.json({ comment }, { status: 201 });
}
