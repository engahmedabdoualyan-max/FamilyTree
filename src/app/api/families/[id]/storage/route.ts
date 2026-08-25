import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMembership } from "@/lib/family";
import { getFamilyUsage, formatBytes } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// GET storage usage (owner/admin only)
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await ctx.params;

  const membership = await getMembership(id, userId);
  if (!membership) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!["OWNER", "ADMIN"].includes(membership.role))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const usage = await getFamilyUsage(id);
  return NextResponse.json({
    ...usage,
    usedFormatted: formatBytes(usage.usedBytes),
    limitFormatted: formatBytes(usage.limitBytes),
  });
}
