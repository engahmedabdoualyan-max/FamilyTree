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
  inviteCount?: number;
  albumCount?: number;
  myInvite?: { id: string; status: string } | null;
};

type PersonLite = { id: string; firstName: string; lastName: string | null };

const TYPES = [
  "BIRTHDAY",
  "WEDDING",
  "ENGAGEMENT",
  "BIRTH",
  "GRADUATION",
  "UNIVERSITY_SUCCESS",
  "SCHOOL_SUCCESS",
  "EID",
  "GATHERING",
  "OTHER",
] as const;

function daysUntil(dateStr: string): number {
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = dateStr.split("-").map(Number);
  let target = new Date(y, m - 1, d);
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
  const [, setMyPersonIdSafe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", type: "BIRTHDAY", date: "", notes: "" });
  const [error, setError] = useState("");
  // invite modal
  const [inviteFor, setInviteFor] = useState<Occasion | null>(null);
  const [persons, setPersons] = useState<PersonLite[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [inviteMsg, setInviteMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/families/${familyId}/occasions`);
    if (res.ok) {
      const data = await res.json();
      const sorted: Occasion[] = [...data.occasions].sort(
        (a: Occasion, b: Occasion) => daysUntil(a.date) - daysUntil(b.date)
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
        const sorted: Occasion[] = [...data.occasions].sort(
          (a: Occasion, b: Occasion) => daysUntil(a.date) - daysUntil(b.date)
        );
        setItems(sorted);
        setMyPersonIdSafe(data.myPersonId);
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

  function openInvites(o: Occasion) {
    setInviteFor(o);
    setInviteMsg("");
    setSelected([]);
    if (!persons.length) {
      fetch(`/api/families/${familyId}/persons`)
        .then((r) => r.json())
        .then((d) =>
          setPersons(
            (d.persons ?? [])
              .filter((p: PersonLite & { familyName?: string }) => !p.familyName)
              .map((p: PersonLite) => ({
                id: p.id,
                firstName: p.firstName,
                lastName: p.lastName,
              }))
          )
        );
    }
  }

  async function sendInvites() {
    if (!inviteFor) return;
    setBusy(true);
    const res = await fetch(`/api/occasions/${inviteFor.id}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personIds: selected }),
    });
    setBusy(false);
    if (res.ok) {
      setInviteMsg(t("invited_ok"));
      setTimeout(() => {
        setInviteFor(null);
        setInviteMsg("");
        load();
      }, 1200);
    }
  }

  async function rsvp(invite: { id: string }, status: string) {
    await fetch(`/api/invites/${invite.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
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
              <option key={ty} value={ty}>
                {t(`OCC_${ty}` as "OCC_BIRTHDAY")}
              </option>
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
                    isToday
                      ? "bg-amber-400 text-white"
                      : days <= 7
                        ? "bg-leaf-100 text-leaf-800"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isToday ? t("todayLabel") : `⏳ ${days} ${t("daysLeft")}`}
                </span>
                <h3 className="mt-1 text-lg font-extrabold text-bark-900">
                  {t(`OCC_${o.type}` as "OCC_BIRTHDAY")}
                </h3>
                <p className="text-sm font-bold text-leaf-700">{o.title}</p>
                <p dir="ltr" className={`mt-1 text-xs font-semibold ${isToday ? "text-amber-600" : "text-bark-800/50"}`}>
                  📅 {o.date}
                </p>
                {o.notes && <p className="mt-1.5 line-clamp-2 text-xs text-bark-800/70">{o.notes}</p>}

                {/* My RSVP */}
                {o.myInvite && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-xl bg-sky-50/70 p-2 ring-1 ring-sky-100">
                    <span className="w-full text-[10px] font-black uppercase tracking-wide text-sky-700">
                      📨 {t("send_invites")}
                    </span>
                    {(["GOING", "MAYBE", "DECLINED"] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => rsvp(o.myInvite!, st)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                          o.myInvite!.status === st
                            ? "bg-sky-500 text-white"
                            : "bg-white text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100"
                        }`}
                      >
                        {t(`rsvp_${st.toLowerCase()}` as "rsvp_going")}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 border-t border-leaf-50 pt-2.5">
                  <a
                    href={`/family/${familyId}/gallery`}
                    className="rounded-lg bg-leaf-50 px-3 py-1.5 text-xs font-bold text-leaf-700 hover:bg-leaf-100"
                  >
                    📸 {t("makeAlbum")} {o.albumCount ? `(${o.albumCount})` : ""}
                  </a>
                  <button
                    onClick={() => openInvites(o)}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-leaf-700 ring-1 ring-leaf-200 hover:bg-leaf-50"
                  >
                    📨 {t("send_invites")} {o.inviteCount ? `(${o.inviteCount} ${t("invited_count")})` : ""}
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

      {/* Invite modal */}
      {inviteFor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setInviteFor(null)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 scroll-thin" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-bark-900">
              📨 {t("send_invites")} — {inviteFor.title}
            </h3>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-bark-800/50">{t("invite_whom")}</p>
              <button
                onClick={() => setSelected(selected.length === persons.length ? [] : persons.map((p) => p.id))}
                className="text-xs font-bold text-leaf-700 hover:underline"
              >
                {t("select_all_tree")}
              </button>
            </div>
            <div className="scroll-thin mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl bg-leaf-50/50 p-2">
              {persons.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelected(on ? selected.filter((x) => x !== p.id) : [...selected, p.id])
                    }
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm transition ${
                      on ? "bg-leaf-600 text-white" : "bg-white hover:bg-leaf-100 ring-1 ring-leaf-100"
                    }`}
                  >
                    <span>{on ? "☑" : "☐"}</span>
                    <span className="font-semibold">
                      {p.firstName} {p.lastName ?? ""}
                    </span>
                  </button>
                );
              })}
            </div>
            {inviteMsg && <p className="mt-2 text-sm font-bold text-leaf-700">{inviteMsg}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={sendInvites}
                disabled={busy || !selected.length}
                className="flex-1 rounded-xl bg-leaf-600 py-3 font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
              >
                {busy ? "…" : `📨 ${t("send_invites")} (${selected.length})`}
              </button>
              <button onClick={() => setInviteFor(null)} className="rounded-xl border border-leaf-200 px-4 font-semibold text-bark-800 hover:bg-leaf-50">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
