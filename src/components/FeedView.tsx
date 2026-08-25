"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Stats = {
  total: number;
  males: number;
  females: number;
  deceased: number;
  oldest: string | null;
  topName: string | null;
};

type FeedData = {
  onThisDay?: { id: string; fileData: string; title: string | null; year: number }[];
  stats?: Stats;
  media: {
    id: string;
    fileData: string;
    title: string | null;
    createdAt: string;
    likesCount: number;
    commentsCount: number;
  }[];
  newPersons: { id: string; firstName: string; lastName: string | null; photo: string | null }[];
  occasions: { id: string; title: string; type: string; date: string }[];
  birthdays: { id: string; firstName: string; lastName: string | null; photo: string | null; day: number }[];
};

export default function FeedView({ familyId }: { familyId: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<FeedData | null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/families/${familyId}/feed`);
      if (!cancelled && res.ok) setData(await res.json());
      const me = await fetch("/api/families/" + familyId + "/set-me");
      void me;
    })();
    return () => {
      cancelled = true;
    };
  }, [familyId]);

  // greeting name from session via /api/auth/session-like endpoint is overkill;
  // use navbar name instead — skip API, read from document? keep simple:
  void userName;
  void setUserName;

  if (!data) {
    return <p className="p-6 text-sm text-bark-800/50">{t("loading")}</p>;
  }

  const now = new Date();

  return (
    <div className="flex-1 overflow-y-auto p-4 scroll-thin">
      {/* On This Day */}
      {data.onThisDay && data.onThisDay.length > 0 && (
        <section className="mb-7 overflow-hidden rounded-3xl bg-gradient-to-l from-violet-600 to-indigo-600 p-5 text-white shadow-lg">
          <h3 className="font-extrabold">🕰️ في مثل هذا اليوم</h3>
          <p className="mt-0.5 text-xs text-white/80">ذكريات العيلة من سنوات فاتت</p>
          <div className="scroll-thin mt-3 flex gap-2.5 overflow-x-auto pb-1">
            {data.onThisDay.map((m) => (
              <div key={m.id} className="w-28 shrink-0">
                <div className="h-28 w-28 overflow-hidden rounded-2xl ring-2 ring-white/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.fileData} alt="" className="h-full w-full object-cover" />
                </div>
                <p className="mt-1 text-center text-[11px] font-black">{m.year}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Weekly question */}
      <WeeklyQuestion familyId={familyId} />

      {/* Stats */}
      {data.stats && (
        <section className="mb-7 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {[
            { v: data.stats.total, l: t("persons"), icon: "🌳" },
            { v: data.stats.males, l: t("male"), icon: "👨" },
            { v: data.stats.females, l: t("female"), icon: "👩" },
            { v: data.stats.deceased, l: t("deceased"), icon: "🕊️" },
          ].map((c) => (
            <div key={c.l} className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-leaf-100">
              <div className="text-xl">{c.icon}</div>
              <div className="text-lg font-black text-bark-900">{c.v}</div>
              <div className="text-[10px] font-bold text-bark-800/50">{c.l}</div>
            </div>
          ))}
          {data.stats.oldest && (
            <div className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-amber-200">
              <div className="text-xl">🕰️</div>
              <div className="truncate text-[11px] font-bold text-bark-900">{data.stats.oldest}</div>
              <div className="text-[10px] font-bold text-bark-800/50">الأقدم</div>
            </div>
          )}
          {data.stats.topName && (
            <div className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-sky-200">
              <div className="text-xl">⭐</div>
              <div className="truncate text-[11px] font-bold text-bark-900">{data.stats.topName}</div>
              <div className="text-[10px] font-bold text-bark-800/50">أشهر اسم</div>
            </div>
          )}
        </section>
      )}

      {/* Birthdays */}
      <Section title={`🎂 ${t("birthdays_month")}`}>
        {data.birthdays.length === 0 ? (
          <Empty />
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {data.birthdays.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pe-4 ps-1.5 shadow-sm ring-1 ring-leaf-100"
              >
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-leaf-200 text-sm font-bold text-leaf-800">
                  {b.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    b.firstName[0]
                  )}
                </span>
                <span>
                  <span className="block text-xs font-bold text-bark-900">
                    {b.firstName} {b.lastName ?? ""}
                  </span>
                  <span className="block text-[10px] font-semibold text-pink-600">
                    {b.day} {t("day_short")}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Upcoming occasions */}
      <Section title={`🎉 ${t("upcoming_occasions")}`}>
        {data.occasions.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {data.occasions.slice(0, 4).map((o) => (
              <a
                key={o.id}
                href={`/family/${familyId}/occasions`}
                className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-leaf-100 transition hover:shadow-md"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-bark-900">{o.title}</span>
                  <span className="text-[11px] text-bark-800/50">📅 {o.date}</span>
                </span>
                <span className="text-xl">🎉</span>
              </a>
            ))}
          </div>
        )}
      </Section>

      {/* Recent photos */}
      <Section title={`📸 ${t("recent_photos")}`}>
        {data.media.length === 0 ? (
          <Empty />
        ) : (
          <div className="scroll-thin flex gap-2.5 overflow-x-auto pb-2">
            {data.media.map((m) => (
              <div key={m.id} className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl shadow-sm ring-1 ring-leaf-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.fileData} alt={m.title ?? ""} className="h-full w-full object-cover" />
                <span className="absolute bottom-1 start-1 flex gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                  ❤️ {m.likesCount} 💬 {m.commentsCount}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* New members */}
      <Section title={`👋 ${t("new_members")}`}>
        {data.newPersons.length === 0 ? (
          <Empty />
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {data.newPersons.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-full bg-white py-1.5 pe-4 ps-1.5 shadow-sm ring-1 ring-leaf-100">
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-leaf-200 text-xs font-bold text-leaf-800">
                  {p.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    p.firstName[0]
                  )}
                </span>
                <span className="text-xs font-bold text-bark-900">
                  {p.firstName} {p.lastName ?? ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <p className="pb-6 pt-2 text-center text-[11px] text-bark-800/30">
        {now.getFullYear()} © {t("appName")}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h3 className="mb-2.5 text-base font-extrabold text-bark-900">{title}</h3>
      {children}
    </section>
  );
}

function Empty() {
  const { t } = useI18n();
  return <p className="rounded-xl border border-dashed border-leaf-200 p-4 text-center text-xs text-bark-800/40">{t("noMediaYet")}</p>;
}


const WEEKLY_QUESTIONS = [
  "احكي لنا أول يوم في شغلك كان إزاي؟ 💼",
  "أطبل مطبخ شفت حاجة في طفولتك؟ 🍲",
  "إيه أغنية كانت بتشتغل زمان؟ 🎵",
  "احكي لنا عن أول بيت سكنته 🏠",
  "مين المعلم اللي اتعلمت منه أكتر حاجة؟ 📖",
  "إيه أحلى عيد عدّيته وأنت صغير؟ 🌙",
  "أول موبايل أو تلفون شفته كان إزاي؟ ☎️",
];

function WeeklyQuestion({ familyId }: { familyId: string }) {
  const [q] = useState(() => {
    const week = Math.floor(Date.now() / (7 * 86400000));
    return WEEKLY_QUESTIONS[week % WEEKLY_QUESTIONS.length];
  });
  return (
    <section className="mb-7 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-leaf-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-leaf-100 px-3 py-1 text-[11px] font-black text-leaf-800">
            💬 سؤال الأسبوع
          </span>
          <p className="mt-2.5 text-lg font-extrabold leading-snug text-bark-900">{q}</p>
        </div>
        <a
          href={`/family/${familyId}/chat`}
          className="shrink-0 self-center rounded-xl bg-leaf-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-leaf-700"
        >
          جاوب في الدردشة ←
        </a>
      </div>
    </section>
  );
}
