"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

type Member = {
  userId: string;
  role: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export default function FamilySettings({
  family,
  members,
  me,
  myRole,
}: {
  family: {
    id: string;
    name: string;
    description: string | null;
    inviteCode: string;
    createdById: string;
  };
  members: Member[];
  me: { id: string };
  myRole: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState(family.name);
  const [description, setDescription] = useState(family.description ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch(`/api/families/${family.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      router.refresh();
    } else setError(t("error_generic"));
  }

  async function changeRole(userId: string, role: string) {
    const res = await fetch(`/api/families/${family.id}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) router.refresh();
  }

  async function removeMember(userId: string) {
    if (!window.confirm(t("remove") + "?")) return;
    const res = await fetch(`/api/families/${family.id}/members/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (userId === me.id) router.push("/dashboard");
      else router.refresh();
    }
  }

  async function deleteFamily() {
    if (confirmDelete !== family.name) return;
    const res = await fetch(`/api/families/${family.id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
  }

  const inputCls =
    "w-full rounded-lg border border-leaf-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-bark-900">⚙️ {t("settings_family")}</h1>
        <Link
          href={`/family/${family.id}`}
          className="rounded-lg border border-leaf-200 px-4 py-2 text-sm font-bold text-leaf-700 hover:bg-leaf-50"
        >
          🌳 ←
        </Link>
      </div>

      {/* Family info */}
      <form onSubmit={saveInfo} className="rounded-2xl border border-leaf-100 bg-white p-5 shadow-sm">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-bark-800">
              {t("dash_create_name")}
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-bark-800">{t("dash_create_desc")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isAdmin}
              rows={2}
              maxLength={500}
              className={`${inputCls} resize-none`}
            />
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3">
              <button
                disabled={busy}
                className="rounded-lg bg-leaf-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-leaf-700 disabled:opacity-60"
              >
                {t("save")}
              </button>
              {saved && <span className="text-sm font-bold text-leaf-700">✓ {t("copied")}</span>}
              {error && <span className="text-sm font-semibold text-red-600">{error}</span>}
            </div>
          )}
        </div>
      </form>

      {/* Invite */}
      <section className="rounded-2xl border border-leaf-100 bg-white p-5 shadow-sm">
        <h2 className="font-extrabold text-bark-900">✉️ {t("invite_title")}</h2>
        <p className="mt-1 text-sm text-bark-800/70">{t("invite_desc")}</p>
        <div dir="ltr" className="mt-3 inline-block rounded-xl border-2 border-dashed border-leaf-300 bg-leaf-50 px-4 py-2 font-mono text-lg font-bold tracking-[0.25em] text-leaf-800">
          {family.inviteCode}
        </div>
      </section>

      {/* Members */}
      <section className="rounded-2xl border border-leaf-100 bg-white p-5 shadow-sm">
        <h2 className="font-extrabold text-bark-900">
          👥 {t("settings_members")} ({members.length})
        </h2>
        <ul className="mt-4 divide-y divide-leaf-50">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-leaf-200 font-bold text-leaf-800">
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  (m.name ?? "?").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-bark-900">
                  {m.name} {m.userId === me.id && <span className="text-xs text-leaf-700">({t("you")})</span>}
                </p>
                <p dir="ltr" className="truncate text-xs text-bark-800/50">{m.email}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  m.role === "OWNER"
                    ? "bg-leaf-100 text-leaf-800"
                    : m.role === "ADMIN"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {t(m.role.toLowerCase() as "owner" | "admin" | "member")}
              </span>
              {myRole === "OWNER" && m.userId !== me.id && m.role !== "OWNER" && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => changeRole(m.userId, m.role === "ADMIN" ? "MEMBER" : "ADMIN")}
                    className="rounded-lg border border-leaf-200 px-2.5 py-1.5 text-xs font-bold text-leaf-700 hover:bg-leaf-50"
                  >
                    {m.role === "ADMIN" ? t("make_member") : t("make_admin")}
                  </button>
                  {!isAdminOnlyMe(m, members) && (
                    <button
                      onClick={() => removeMember(m.userId)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
              {m.userId === me.id && m.userId !== family.createdById && (
                <button
                  onClick={() => removeMember(me.id)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50"
                >
                  {t("leave")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Danger zone */}
      {myRole === "OWNER" && (
        <section className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
          <h2 className="font-extrabold text-red-700">⚠️ {t("settings_danger")}</h2>
          <p className="mt-1 text-sm text-red-900/70">{t("settings_delete_confirm")}:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={family.name}
              className="w-64 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-400"
            />
            <button
              onClick={deleteFamily}
              disabled={confirmDelete !== family.name}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40"
            >
              🗑 {t("settings_delete_family")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function isAdminOnlyMe(m: Member, members: Member[]): boolean {
  void m;
  void members;
  return false;
}
