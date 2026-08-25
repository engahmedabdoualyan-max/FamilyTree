import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  const name = String(body.name ?? "").trim().slice(0, 80);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (name.length < 2)
    return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
  if (!EMAIL_RE.test(email))
    return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return NextResponse.json({ error: "ACCOUNT_EXISTS" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { name, email, passwordHash } });

  return NextResponse.json({ ok: true }, { status: 201 });
}
