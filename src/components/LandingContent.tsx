"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { TreeLogo } from "./Navbar";

function MiniTree() {
  return (
    <div className="relative mx-auto w-full max-w-md select-none" dir="ltr">
      <svg viewBox="0 0 400 240" className="w-full drop-shadow-sm" fill="none">
        {/* connectors */}
        <path d="M200 70 v20 M120 120 h160 M120 120 v20 M280 120 v20" stroke="#8ad1ab" strokeWidth="3" />
        <path d="M60 190 v-40 a10 10 0 0 1 10 -10 h50 M340 190 v-40 a10 10 0 0 0 -10 -10 h-50" stroke="#b9e5cc" strokeWidth="3" />
        {/* grandparents */}
        <g>
          <rect x="150" y="30" width="100" height="40" rx="12" fill="#1f6445" />
          <circle cx="170" cy="50" r="11" fill="#dcf2e4" />
          <rect x="188" y="42" width="52" height="7" rx="3.5" fill="#dcf2e4" opacity="0.85" />
          <rect x="188" y="53" width="36" height="6" rx="3" fill="#dcf2e4" opacity="0.55" />
        </g>
        {/* parents */}
        <g>
          <rect x="65" y="140" width="110" height="38" rx="12" fill="#349c69" />
          <circle cx="85" cy="159" r="10" fill="#eafaf0" />
          <rect x="101" y="151" width="56" height="6" rx="3" fill="#eafaf0" opacity="0.9" />
        </g>
        <g>
          <rect x="225" y="140" width="110" height="38" rx="12" fill="#55b685" />
          <circle cx="245" cy="159" r="10" fill="#f0faf4" />
          <rect x="261" y="151" width="56" height="6" rx="3" fill="#f0faf4" opacity="0.9" />
        </g>
      </svg>
    </div>
  );
}

export default function LandingContent({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n();

  const features = [
    { title: t("landing_feature1_title"), desc: t("landing_feature1_desc"), icon: "🌳" },
    { title: t("landing_feature2_title"), desc: t("landing_feature2_desc"), icon: "📸" },
    { title: t("landing_feature3_title"), desc: t("landing_feature3_desc"), icon: "💬" },
    { title: t("landing_feature4_title"), desc: t("landing_feature4_desc"), icon: "🤝" },
  ];

  const steps = [t("landing_how1"), t("landing_how2"), t("landing_how3"), t("landing_how4")];

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-leaf-100 px-4 py-1.5 text-sm font-semibold text-leaf-800">
              <TreeLogo size={18} /> {t("appName")}
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-tight text-bark-900 sm:text-5xl">
              {t("tagline")}
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-bark-800/80">
              {t("landing_feature1_desc")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={signedIn ? "/dashboard" : "/signin"}
                className="rounded-xl bg-leaf-600 px-6 py-3 text-base font-bold text-white shadow-lg shadow-leaf-600/25 transition hover:bg-leaf-700"
              >
                {t("landing_cta")}
              </Link>
              <a
                href="#how"
                className="rounded-xl border border-leaf-300 bg-white px-6 py-3 text-base font-bold text-leaf-700 transition hover:bg-leaf-50"
              >
                {t("landing_learn")}
              </a>
            </div>
          </div>
          <MiniTree />
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-leaf-100 bg-white/60 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-leaf-100 bg-white p-6 shadow-sm"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 text-lg font-bold text-bark-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-bark-800/75">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-center text-3xl font-extrabold text-bark-900">
          {t("landing_how_title")}
        </h2>
        <ol className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-leaf-100">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-600 font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-1.5 font-medium text-bark-800">{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-12 text-center">
          <Link
            href={signedIn ? "/dashboard" : "/signin"}
            className="inline-block rounded-xl bg-leaf-600 px-8 py-3.5 text-lg font-bold text-white shadow-lg shadow-leaf-600/25 transition hover:bg-leaf-700"
          >
            {t("landing_cta")}
          </Link>
        </div>
      </section>

      <footer className="border-t border-leaf-100 bg-white/70 py-6 text-center text-sm text-bark-800/60">
        {t("appName")} — {t("landing_footer")}
      </footer>
    </div>
  );
}
