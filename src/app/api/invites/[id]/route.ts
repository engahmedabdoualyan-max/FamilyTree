import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

const STATUSES = ["PENDING", "GOING", "MAYBE", "DECLINED"];

// PATCH /api/invites/[id] — RSVP (must be the linked user of the person)
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const invite = await prisma.occasionInvite.findUnique({
    where: { id },
    include: {
      occasion: true,
      person: { select: { id: true, linkedUserId: true } },
    },
  });
  if (!invite) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // allowed: linked user of invitee, or family admins
  let allowed = false;
  if (invite.person.linkedUserId === userId) allowed = true;
  if (!allowed) {
    const membership = await getMembership(invite.occasion.familyId, userId);
    allowed = !!membership && ["OWNER", "ADMIN"].includes(membership.role);
  }
  if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const status = String(body?.status ?? "").toUpperCase();
  if (!STATUSES.includes(status))
    return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });

  const updated = await prisma.occasionInvite.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json({ invite: updated });
}
