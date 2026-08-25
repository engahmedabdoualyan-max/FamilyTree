"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type FriendUser = { id: string; name: string | null; image: string | null };

export default function FriendsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"friends" | "in" | "out">("friends");
  const [friends, setFriends] = useState<(FriendUser & { requestId?: string })[]>([]);
  const [incoming, setIncoming] = useState<{ requestId: string; user: FriendUser }[]>([]);
  const [outgoing, setOutgoing] = useState<{ requestId: string; user: FriendUser }[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/friends");
    if (res.ok) {
      const d = await res.json();
      setFriends(d.friends);
      setIncoming(d.incoming);
      setOutgoing(d.outgoing);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/friends");
      if (!cancelled && res.ok) {
        const d = await res.json();
        setFriends(d.friends);
        setIncoming(d.incoming);
        setOutgoing(d.outgoing);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function respond(requestId: string, status: "ACCEPTED" | "DECLINED") {
    await fetch(`/api/friends/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function removeFriend(id?: string) {
    if (!id) return;
    if (!window.confirm(t("remove") + "?")) return;
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    load();
  }

  function Avatar({ u }: { u: FriendUser }) {
    const initial = (u.name ?? "?").slice(0, 1).toUpperCase();
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-leaf-200 font-bold text-leaf-800">
        {u.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.image} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </span>
    );
  }

  const tabs = [
    { key: "friends" as const, label: `👥 ${t("friends_tab")} (${friends.length})` },
    { key: "in" as const, label: `📥 ${t("requests_in")} (${incoming.length})` },
    { key: "out" as const, label: `📤 ${t("requests_out")} (${outgoing.length})` },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-4 text-2xl font-extrabold text-bark-900">👥 {t("friends_page")}</h1>

      <div className="mb-5 flex gap-1.5">
        {tabs.map((x) => (
          <button
            key={x.key}
            onClick={() => setTab(x.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              tab === x.key ? "bg-leaf-600 text-white" : "bg-white text-bark-800 ring-1 ring-leaf-200 hover:bg-leaf-50"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <p className="text-sm text-bark-800/50">{t("loading")}</p>
      ) : tab === "friends" ? (
        friends.length === 0 ? (
          <p className="rounded-xl border border-dashed border-leaf-200 p-6 text-center text-sm text-bark-800/50">
            {t("no_friends")}
          </p>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-leaf-100">
                <Avatar u={f} />
                <span className="flex-1 truncate font-bold text-bark-900">{f.name}</span>
                <a href={`/messages?with=${f.id}`} className="rounded-lg bg-leaf-50 px-3 py-1.5 text-xs font-bold text-leaf-700 hover:bg-leaf-100">
                  ✉️ {t("messages_page")}
                </a>
                {f.requestId && (
                  <button onClick={() => removeFriend(f.requestId)} className="text-xs font-bold text-red-400 hover:text-red-600">
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )
      ) : tab === "in" ? (
        incoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-leaf-200 p-6 text-center text-sm text-bark-800/50">{t("no_notifications")}</p>
        ) : (
          <ul className="space-y-2">
            {incoming.map((r) => (
              <li key={r.requestId} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-leaf-100">
                <Avatar u={r.user} />
                <span className="flex-1 truncate font-bold text-bark-900">{r.user.name}</span>
                <button onClick={() => respond(r.requestId, "ACCEPTED")} className="rounded-lg bg-leaf-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-leaf-700">
                  {t("accept")}
                </button>
                <button onClick={() => respond(r.requestId, "DECLINED")} className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50">
                  {t("decline")}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : outgoing.length === 0 ? (
        <p className="rounded-xl border border-dashed border-leaf-200 p-6 text-center text-sm text-bark-800/50">{t("no_notifications")}</p>
      ) : (
        <ul className="space-y-2">
          {outgoing.map((r) => (
            <li key={r.requestId} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-leaf-100">
              <Avatar u={r.user} />
              <span className="flex-1 truncate font-bold text-bark-900">{r.user.name}</span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">⏳</span>
              <button onClick={() => removeFriend(r.requestId)} className="text-xs font-bold text-red-400 hover:text-red-600">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
