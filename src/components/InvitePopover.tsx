"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export default function InvitePopover({
  familyId,
  inviteCode,
  canRotate,
  onClose,
  onRotated,
}: {
  familyId: string;
  inviteCode: string;
  canRotate: boolean;
  onClose: () => void;
  onRotated: (newCode: string) => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${inviteCode}`
      : `/join/${inviteCode}`;

  async function copy(value: string, what: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  async function rotate() {
    setBusy(true);
    const res = await fetch(`/api/families/${familyId}`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const { family } = await res.json();
      onRotated(family.inviteCode);
    }
  }

  return (
    <div className="absolute inset-x-0 top-0 z-40 flex justify-center px-4 pt-2">
      <div className="w-full max-w-xl rounded-2xl border border-leaf-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-bark-900">✉️ {t("invite_title")}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-bark-800/60 hover:bg-leaf-50">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-bark-800/70">{t("invite_desc")}</p>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <div
            dir="ltr"
            className="rounded-xl border-2 border-dashed border-leaf-300 bg-leaf-50 px-4 py-2 text-center font-mono text-xl font-bold tracking-[0.3em] text-leaf-800"
          >
            {inviteCode}
          </div>
          <div dir="ltr" className="truncate rounded-xl bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 ring-1 ring-gray-200">
            {link}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => copy(inviteCode, "code")}
              className="rounded-lg bg-leaf-600 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-700"
            >
              {copied === "code" ? `✓ ${t("copied")}` : t("copy")}
            </button>
            <button
              onClick={() => copy(link, "link")}
              className="rounded-lg border border-leaf-300 px-4 py-2 text-sm font-bold text-leaf-700 hover:bg-leaf-50"
            >
              {copied === "link" ? `✓ ${t("copied")}` : t("copy")}
            </button>
          </div>
        </div>

        {canRotate && (
          <button
            onClick={rotate}
            disabled={busy}
            className="mt-3 text-xs font-semibold text-red-500 hover:text-red-600 hover:underline disabled:opacity-50"
          >
            ⟳ {t("settings_invite_rotate")}
          </button>
        )}
      </div>
    </div>
  );
}
