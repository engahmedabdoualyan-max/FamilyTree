"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

type FamilyCard = {
  id: string;
  name: string;
  description: string | null;
  photo: string | null;
  role: string;
  personCount: number;
  memberCount: number;
};

const roleColors: Record<string, string> = {
  OWNER: "bg-leaf-100 text-leaf-800",
  ADMIN: "bg-amber-100 text-amber-800",
  MEMBER: "bg-gray-100 text-gray-600",
};

export default function DashboardContent({
  families,
}: {
  user: { id: string; name?: string | null };
  families: FamilyCard[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createFamily(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setBusy(false);
    if (res.ok) {
      const { family } = await res.json();
      router.push(`/family/${family.id}`);
    } else {
      setError(t("error_generic"));
    }
  }

  async function joinFamily(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch("/api/families/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode }),
    });
    setBusy(false);
    if (res.ok) {
      const { family } = await res.json();
      router.push(`/family/${family.id}`);
    } else if (res.status === 404) {
      setError(t("dash_join_code") + ": ?"); // code not found
    } else {
      setError(t("error_generic"));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-bark-900">{t("dashboard_title")}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="rounded-xl bg-leaf-600 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-700"
          >
            + {t("dashboard_create")}
          </button>
        </div>
      </div>

      {/* Create panel */}
      {showCreate && (
        <form
          onSubmit={createFamily}
          className="mt-5 grid gap-4 rounded-2xl border border-leaf-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto]"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("dash_create_name")}
              required
              minLength={2}
              maxLength={80}
              className="rounded-lg border border-leaf-200 px-3 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("dash_create_desc")}
              maxLength={500}
              className="rounded-lg border border-leaf-200 px-3 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200"
            />
          </div>
          <button
            disabled={busy}
            className="rounded-lg bg-leaf-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-leaf-700 disabled:opacity-60 sm:self-end"
          >
            {t("dash_create_btn")}
          </button>
        </form>
      )}

      {/* Join by code */}
      <form onSubmit={joinFamily} className="mt-4 flex flex-wrap gap-2">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder={`${t("dash_join_code")} (ABC12345)`}
          dir="ltr"
          className="w-56 rounded-lg border border-leaf-200 bg-white px-3 py-2.5 text-sm tracking-widest uppercase outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200"
        />
        <button
          disabled={busy || !joinCode.trim()}
          className="rounded-lg border border-leaf-300 bg-white px-5 py-2.5 text-sm font-bold text-leaf-700 hover:bg-leaf-50 disabled:opacity-50"
        >
          {t("dash_join_btn")}
        </button>
        {error && <p className="w-full pt-1 text-sm font-semibold text-red-600">{error}</p>}
      </form>

      {/* Families grid */}
      <div className="mt-8">
        {families.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-leaf-200 bg-white/60 p-14 text-center">
            <div className="text-4xl">🌳</div>
            <p className="mt-3 font-semibold text-bark-800">{t("dashboard_empty")}</p>
            <p className="mt-1 text-sm text-bark-800/60">{t("landing_how1")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {families.map((f) => (
              <Link
                key={f.id}
                href={`/family/${f.id}`}
                className="group rounded-2xl border border-leaf-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-leaf-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-bark-900 group-hover:text-leaf-700">
                      {f.name}
                    </h3>
                    <p className="mt-0.5 line-clamp-2 text-xs text-bark-800/60">
                      {f.description || ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${roleColors[f.role] ?? roleColors.MEMBER}`}>
                    {t(f.role.toLowerCase() as "owner" | "admin" | "member")}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs font-semibold text-bark-800/70">
                  <span>👥 {f.memberCount} {t("members")}</span>
                  <span>🌿 {f.personCount} {t("persons")}</span>
                  <span className="ms-auto font-bold text-leaf-700 group-hover:underline">
                    {t("open")} →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
