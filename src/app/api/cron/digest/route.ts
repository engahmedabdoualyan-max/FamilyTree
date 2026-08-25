import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Weekly family digest — triggered by Vercel Cron (see vercel.json)
// Requires RESEND_API_KEY + EMAIL_FROM env vars to actually send emails.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ skipped: "RESEND_API_KEY not set" });

  const families = await prisma.family.findMany({
    select: { id: true, name: true, memberships: { select: { user: { select: { email: true } } } } },
  });

  let emailsSent = 0;
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const thisMonth = now.getMonth() + 1;

  for (const fam of families) {
    const [birthdays, occasions] = await Promise.all([
      prisma.person.findMany({
        where: {
          familyId: fam.id,
          status: "APPROVED",
          isDeceased: false,
          birthDate: { not: null },
        },
        select: { firstName: true, lastName: true, birthDate: true },
      }),
      prisma.occasion.findMany({
        where: { familyId: fam.id, date: { gte: now.toISOString().slice(0, 10), lte: in7.toISOString().slice(0, 10) } },
        select: { title: true, date: true },
      }),
    ]);

    const monthBirthdays = birthdays
      .filter((p) => {
        const m = p.birthDate?.match(/(?:\d{4}[-/])?(\d{1,2})[-/]/);
        return m && Number(m[1]) === thisMonth;
      })
      .slice(0, 6);

    if (!birthdays.length && !occasions.length) continue;

    const rows = [
      occasions.length
        ? `<h3>🎉 مناسبات قربت</h3>` +
          occasions.map((o) => `<p>• ${o.title} — ${o.date}</p>`).join("")
        : "",
      monthBirthdays.length
        ? `<h3>🎂 أعياد ميلاد الشهر</h3>` +
          monthBirthdays.map((p) => `<p>• ${p.firstName} ${p.lastName ?? ""} (${p.birthDate})</p>`).join("")
        : "",
    ].join("");

    const html = `
      <div style="font-family:sans-serif;direction:rtl;text-align:right;max-width:520px;margin:auto">
        <h2 style="color:#1f6445">🌳 شجرتنا — أخبار عيلة ${fam.name}</h2>
        ${rows || "<p>مفيش أخبار الأسبوع ده.</p>"}
        <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://family-tree-two-ashen.vercel.app"}" style="background:#257d53;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">افتح الموقع</a></p>
      </div>`;

    for (const m of fam.memberships) {
      const email = m.user.email;
      if (!email) continue;
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM ?? "Shajaratna <onboarding@resend.dev>",
            to: email,
            subject: `🌳 أخبار عيلة ${fam.name}`,
            html,
          }),
        });
        emailsSent += 1;
      } catch {}
    }
  }

  return NextResponse.json({ ok: true, emailsSent });
}
