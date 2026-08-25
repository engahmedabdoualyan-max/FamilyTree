"use client";

import { useEffect, useState } from "react";
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
  const [requireApproval, setRequireApproval] = useState(
    (family as { requireApproval?: boolean }).requireApproval ?? false
  );
  const [approver, setApprover] = useState((family as { approverUserId?: string | null }).approverUserId ?? "");
  const [friendStates, setFriendStates] = useState<Record<string, { state: string; requestId?: string }>>({});
  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/friends");
      if (!cancelled && res.ok) {
        const d = await res.json();
        const map: Record<string, { state: string; requestId?: string }> = {};
      // typed map
        type FS = { state: string; requestId?: string };
        for (const f of d.friends as { id: string; requestId?: string }[]) map[f.id] = { state: "FRIENDS", requestId: f.requestId } as FS;
        for (const r of d.incoming as { user: { id: string }; requestId?: string }[]) map[r.user.id] = { state: "INCOMING", requestId: r.requestId };
        for (const r of d.outgoing as { user: { id: string }; requestId?: string }[]) map[r.user.id] = { state: "OUTGOING", requestId: r.requestId };
        if (!cancelled) setFriendStates(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function addFriend(userId: string) {
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      const d = await res.json();
      setFriendStates((prev) => ({
        ...prev,
        [userId]: d.status === "ACCEPTED" ? { state: "FRIENDS" } : { state: "OUTGOING" },
      }));
    }
  }

  async function respondFriend(requestId: string) {
    await fetch(`/api/friends/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACCEPTED" }),
    });
    setFriendStates((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) if (next[k].requestId === requestId) delete next[k];
      return next;
    });
    router.refresh();
  }

  async function saveApproval(nextRequire: boolean, nextApprover: string) {
    const res = await fetch(`/api/families/${family.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requireApproval: nextRequire, approverUserId: nextApprover || null }),
    });
    return res.ok;
  }

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

      {/* Tree protection */}
      {isAdmin && (
        <section className="rounded-2xl border border-leaf-100 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-bark-900">🛡️ {t("approval_mode")}</h2>
          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-bark-800">
            <input
              type="checkbox"
              checked={requireApproval}
              onChange={(e) => {
                setRequireApproval(e.target.checked);
                saveApproval(e.target.checked, approver);
              }}
              className="h-4 w-4 accent-[#257d53]"
            />
            🛡️ {t("approval_mode")}
          </label>
          <div className="mt-3 max-w-sm">
            <label className="mb-1 block text-xs font-bold text-bark-800">{t("approver_select")}</label>
            <select
              value={approver}
              onChange={(e) => {
                setApprover(e.target.value);
                saveApproval(requireApproval, e.target.value);
              }}
              disabled={!requireApproval}
              className={inputCls}
            >
              <option value="">{t("none")}</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({t(m.role.toLowerCase() as "owner" | "admin" | "member")})
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

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
              {(() => {
                if (m.userId === me.id) return null;
                const st = friendStates[m.userId];
                if (!st)
                  return (
                    <button
                      onClick={() => addFriend(m.userId)}
                      className="rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100"
                    >
                      👥 {t("add_friend")}
                    </button>
                  );
                if (st.state === "FRIENDS")
                  return (
                    <span className="text-xs font-bold text-green-600">👥 {t("already_friends")}</span>
                  );
                if (st.state === "OUTGOING")
                  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">⏳</span>;
                if (st.state === "INCOMING" && st.requestId)
                  return (
                    <button
                      onClick={() => respondFriend(st.requestId!)}
                      className="rounded-lg bg-leaf-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-leaf-700"
                    >
                      {t("accept")}
                    </button>
                  );
                return null;
              })()}
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
