"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export type FamilyTab = "tree" | "feed" | "club" | "market" | "photos" | "docs" | "occasions" | "chat";

export default function FamilyPageHeader({
  familyId,
  familyName,
  active,
  isAdmin,
}: {
  familyId: string;
  familyName: string;
  active: FamilyTab;
  isAdmin: boolean;
}) {
  const { t } = useI18n();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!inviteOpen || inviteCode) return;
    (async () => {
      const res = await fetch(`/api/families/${familyId}/persons`);
      if (res.ok) {
        const data = await res.json();
        setInviteCode(data.family?.inviteCode ?? null);
      }
    })();
  }, [inviteOpen, inviteCode, familyId]);

  async function rotate() {
    const res = await fetch(`/api/families/${familyId}`, { method: "POST" });
    if (res.ok) {
      const { family } = await res.json();
      setInviteCode(family.inviteCode);
    }
  }

  const tabs: { key: FamilyTab; href: string; label: string; icon: string }[] = [
    { key: "tree", href: `/family/${familyId}`, label: t("tab_tree"), icon: "🌳" },
    { key: "feed", href: `/family/${familyId}/feed`, label: t("feed_tab"), icon: "📰" },
    { key: "club", href: `/family/${familyId}/club`, label: t("club_tab"), icon: "🎮" },
    { key: "market", href: `/family/${familyId}/market`, label: t("market_tab"), icon: "🛍️" },
    { key: "photos", href: `/family/${familyId}/gallery`, label: t("tab_photos"), icon: "📸" },
    { key: "docs", href: `/family/${familyId}/documents`, label: t("tab_docs"), icon: "📜" },
    { key: "occasions", href: `/family/${familyId}/occasions`, label: t("tab_occasions"), icon: "🎉" },
    { key: "chat", href: `/family/${familyId}/chat`, label: t("tab_chat"), icon: "💬" },
  ];

  const link =
    typeof window !== "undefined" && inviteCode
      ? `${window.location.origin}/join/${inviteCode}`
      : "";

  return (
    <div className="z-30 border-b border-leaf-100 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <Link
          href="/dashboard"
          className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-leaf-700 hover:bg-leaf-50"
        >
          ←
        </Link>
        <h1 className="truncate text-lg font-extrabold text-bark-900">{familyName}</h1>
        <div className="ms-auto flex items-center gap-2">
          <button
            onClick={() => setInviteOpen(!inviteOpen)}
            className="rounded-lg border border-leaf-300 bg-white px-3 py-1.5 text-sm font-bold text-leaf-700 hover:bg-leaf-50"
          >
            ✉️ <span className="hidden sm:inline">{t("invite_title").split(" ")[0]}</span>
          </button>
          <Link
            href={`/family/${familyId}/settings`}
            className="rounded-lg border border-leaf-200 px-3 py-1.5 text-sm font-semibold text-bark-800 hover:bg-leaf-50"
            title={t("settings")}
          >
            ⚙️
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 overflow-x-auto px-3 pb-0 text-sm font-bold scroll-thin">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`whitespace-nowrap rounded-t-lg px-4 py-2 transition ${
              active === tab.key
                ? "bg-leaf-50 text-leaf-800 shadow-[inset_0_-2px_0_#257d53]"
                : "text-bark-800/60 hover:bg-leaf-50/60 hover:text-bark-900"
            }`}
          >
            {tab.icon} {tab.label}
          </Link>
        ))}
      </nav>

      {inviteOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setInviteOpen(false)} />
          <div className="absolute inset-x-0 z-50 mt-2 flex justify-center px-4">
            <div className="w-full max-w-xl rounded-2xl border border-leaf-200 bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-bark-900">✉️ {t("invite_title")}</h3>
                <button onClick={() => setInviteOpen(false)} className="rounded-lg p-1.5 text-bark-800/60 hover:bg-leaf-50">✕</button>
              </div>
              <p className="mt-1 text-sm text-bark-800/70">{t("invite_desc")}</p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <div dir="ltr" className="rounded-xl border-2 border-dashed border-leaf-300 bg-leaf-50 px-4 py-2 text-center font-mono text-xl font-bold tracking-[0.25em] text-leaf-800">
                  {inviteCode ?? "…"}
                </div>
                <div dir="ltr" className="truncate rounded-xl bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 ring-1 ring-gray-200">
                  {link}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteCode ?? "");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1400);
                      } catch {}
                    }}
                    className="rounded-lg bg-leaf-600 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-700"
                  >
                    {copied ? `✓ ${t("copied")}` : t("copy")}
                  </button>
                  {isAdmin && (
                    <button onClick={rotate} className="rounded-lg border border-leaf-300 px-3 py-2 text-xs font-bold text-leaf-700 hover:bg-leaf-50">
                      ⟳
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
