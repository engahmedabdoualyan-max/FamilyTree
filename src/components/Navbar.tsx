"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import NotifBell from "./NotifBell";

export function TreeLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="7" r="4.5" fill="#1f6445" />
      <circle cx="8" cy="21" r="4" fill="#349c69" />
      <circle cx="24" cy="21" r="4" fill="#55b685" />
      <path
        d="M16 11.5V15M16 15L9 17.5M16 15L23 17.5"
        stroke="#1c5038"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Navbar({
  user,
}: {
  user: { id: string; name?: string | null; image?: string | null } | null;
}) {
  const { t, locale, setLocale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-leaf-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-bark-900">
          <TreeLogo />
          <span>{t("appName")}</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            className="rounded-lg border border-leaf-200 px-3 py-1.5 text-sm font-semibold text-leaf-700 hover:bg-leaf-50"
            aria-label="Switch language"
          >
            {t("language")}
          </button>
          {user ? (
            <>
              <NotifBell />
              <Link
                href="/dashboard"
                className="hidden rounded-lg px-3 py-1.5 text-sm font-semibold text-bark-800 hover:bg-leaf-50 sm:block"
              >
                {t("nav_families")}
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-leaf-600 text-sm font-bold text-white ring-2 ring-leaf-200"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    initials
                  )}
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div
                      className="absolute z-50 mt-2 w-44 rounded-xl border border-leaf-100 bg-white p-2 shadow-xl end-0"
                      role="menu"
                    >
                      <div className="px-3 py-2 text-sm font-semibold text-bark-800">
                        {user.name}
                      </div>
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="w-full rounded-lg px-3 py-2 text-start text-sm text-red-600 hover:bg-red-50"
                        role="menuitem"
                      >
                        {t("nav_signOut")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <Link
              href="/signin"
              className="rounded-lg bg-leaf-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-leaf-700"
            >
              {t("nav_signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
