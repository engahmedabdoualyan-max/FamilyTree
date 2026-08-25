"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Occasion = {
  id: string;
  title: string;
  type: string;
  date: string;
  notes: string | null;
  createdById: string;
  albumCount?: number;
};

const TYPES = [
  "BIRTHDAY",
  "WEDDING",
  "ENGAGEMENT",
  "BIRTH",
  "GRADUATION",
  "EID",
  "GATHERING",
  "OTHER",
] as const;

function daysUntil(dateStr: string): number {
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = dateStr.split("-").map(Number);
  let target = new Date(y, m - 1, d);
  // if this year's date passed, count to next year (for recurring feel)
  if (target < todayMid) target = new Date(y + 1, m - 1, d);
  return Math.round((target.getTime() - todayMid.getTime()) / 86400000);
}

export default function OccasionsView({
  familyId,
  me,
  myRole,
}: {
  familyId: string;
  me: { id: string };
  myRole: string;
}) {
  const { t } = useI18n();
  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";
  const [items, setItems] = useState<Occasion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", type: "BIRTHDAY", date: "", notes: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/families/${familyId}/occasions`);
    if (res.ok) {
      const data = await res.json();
      // sort: soonest upcoming first
      const sorted = [...data.occasions].sort(
        (a, b) => daysUntil(a.date) - daysUntil(b.date)
      );
      setItems(sorted);
    }
    setLoading(false);
  }, [familyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/families/${familyId}/occasions`);
      if (!cancelled && res.ok) {
        const data = await res.json();
        const sorted = [...data.occasions].sort(
          (a: Occasion, b: Occasion) => daysUntil(a.date) - daysUntil(b.date)
        );
        setItems(sorted);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [familyId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch(`/api/families/${familyId}/occasions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      setCreating(false);
      setForm({ title: "", type: "BIRTHDAY", date: "", notes: "" });
      load();
    } else {
      setError(t("error_required"));
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    await fetch(`/api/occasions/${id}`, { method: "DELETE" });
    load();
  }

  async function makeAlbum(o: Occasion) {
    const year = o.date.slice(0, 4);
    await fetch(`/api/families/${familyId}/albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${o.title} ${year}` }),
    });
    load();
  }

  const inputCls =
    "w-full rounded-lg border border-leaf-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200";

  return (
    <div className="flex-1 overflow-y-auto p-4 scroll-thin">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-extrabold text-bark-900">🎉 {t("occasions_title")}</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="ms-auto rounded-lg bg-leaf-600 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-700"
        >
          {t("newOccasion")}
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="mb-5 grid gap-3 rounded-2xl border border-leaf-200 bg-white p-5 shadow-sm sm:grid-cols-2">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t("occ_title_field")}
            required
            minLength={2}
            className={inputCls}
          />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputCls}>
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>{t(`OCC_${ty}` as "OCC_BIRTHDAY")}</option>
            ))}
          </select>
          <div>
            <label className="mb-1 block text-xs font-bold text-bark-800">{t("occ_date")} *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              dir="ltr"
              className={inputCls}
            />
          </div>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={t("occ_notes")}
            maxLength={500}
            className={`${inputCls} sm:self-end`}
          />
          {error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
          <button
            disabled={busy}
            className="rounded-lg bg-leaf-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-leaf-700 disabled:opacity-60 sm:col-span-2"
          >
            {t("add")}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-bark-800/50">{t("loading")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-leaf-200 bg-white/60 p-12 text-center">
          <div className="text-4xl">🎂</div>
          <p className="mt-3 font-semibold text-bark-800">{t("noMediaYet")}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((o) => {
            const days = daysUntil(o.date);
            const isToday = days === 0;
            return (
              <div
                key={o.id}
                className={`relative rounded-2xl bg-white p-4 shadow-sm ring-1 transition hover:shadow-md ${
                  isToday ? "ring-2 ring-amber-400" : "ring-leaf-100"
                }`}
              >
                <span
                  className={`absolute -top-2.5 end-3 rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                    isToday ? "bg-amber-400 text-white" : days <= 7 ? "bg-leaf-100 text-leaf-800" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isToday ? t("todayLabel") : `⏳ ${days} ${t("daysLeft")}`}
                </span>
                <h3 className="mt-1 text-lg font-extrabold text-bark-900">
                  {t(`OCC_${o.type}` as "OCC_BIRTHDAY")}
                </h3>
                <p className="text-sm font-bold text-leaf-700">{o.title}</p>
                <p dir="ltr" className={`mt-1 text-xs font-semibold ${isToday ? "" : "text-bark-800/50"} ${isToday ? "text-amber-600" : ""}`}>
                  📅 {o.date}
                </p>
                {o.notes && <p className="mt-1.5 line-clamp-2 text-xs text-bark-800/70">{o.notes}</p>}
                <div className="mt-3 flex items-center gap-2 border-t border-leaf-50 pt-2.5">
                  <button
                    onClick={() => makeAlbum(o)}
                    className="rounded-lg bg-leaf-50 px-3 py-1.5 text-xs font-bold text-leaf-700 hover:bg-leaf-100"
                  >
                    📸 {t("makeAlbum")}
                  </button>
                  {(isAdmin || o.createdById === me.id) && (
                    <button onClick={() => remove(o.id)} className="ms-auto rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50">
                      🗑
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
