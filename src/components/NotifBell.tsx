"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

type Notif = {
  id: string;
  type: string;
  text: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const ICONS: Record<string, string> = {
  LIKE: "❤️",
  COMMENT: "💬",
  OCCASION: "🎉",
  INVITE: "📨",
  MEMBER: "👋",
};

export default function NotifBell() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dnd, setDnd] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setUnread(data.unread);
        if (open || !loaded) setItems(data.notifications);
        setLoaded(true);
      }
    } catch {
      /* offline */
    }
  }, [open, loaded]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [n, me] = await Promise.all([
        fetch("/api/notifications"),
        fetch("/api/me/dnd"),
      ]);
      if (!cancelled && n.ok) {
        const data = await n.json();
        setItems(data.notifications);
        setUnread(data.unread);
        setLoaded(true);
      }
      if (!cancelled && me.ok) {
        const d = await me.json();
        setDnd(d.dndEnabled);
      }
    })();
    timer.current = setInterval(fetchNotifs, 30000);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications", { method: "POST" });
      setUnread(0);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-leaf-50"
        aria-label={t("notifications")}
      >
        🔔
        {!dnd && unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
            {unread > 9 ? "٩+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 w-80 max-w-[85vw] rounded-2xl border border-leaf-100 bg-white shadow-2xl end-0">
            <div className="flex items-center justify-between border-b border-leaf-50 px-4 py-2.5">
              <span className="text-sm font-extrabold text-bark-900">🔔 {t("notifications")}</span>
              <button
                onClick={async () => {
                  const next = !dnd;
                  setDnd(next);
                  if (next) setUnread(0);
                  await fetch("/api/me/dnd", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enabled: next }),
                  });
                }}
                title={dnd ? t("dnd_on") : t("dnd_off")}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                  dnd ? "bg-gray-200 text-gray-600" : "bg-leaf-50 text-leaf-700 ring-1 ring-leaf-200"
                }`}
              >
                {dnd ? t("dnd_on") : t("dnd_off")}
              </button>
              {items.length > 0 && (
                <button
                  onClick={() => fetch("/api/notifications", { method: "POST" }).then(() => fetchNotifs())}
                  className="text-xs font-bold text-leaf-700 hover:underline"
                >
                  {t("mark_read")}
                </button>
              )}
            </div>
            <div className="scroll-thin max-h-80 overflow-y-auto">
              {!loaded ? (
                <p className="p-4 text-sm text-bark-800/40">{t("loading")}</p>
              ) : items.length === 0 ? (
                <p className="p-6 text-center text-sm text-bark-800/50">{t("no_notifications")}</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setOpen(false);
                      if (n.link) router.push(n.link);
                    }}
                    className={`flex w-full items-start gap-2.5 border-b border-leaf-50 px-3.5 py-3 text-start transition hover:bg-leaf-50 ${
                      n.readAt ? "" : "bg-sky-50/40"
                    }`}
                  >
                    <span className="text-lg">{ICONS[n.type] ?? "🔔"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-relaxed text-bark-900">{n.text}</span>
                      <time className="block pt-0.5 text-[10px] text-bark-800/40">
                        {new Date(n.createdAt).toLocaleString([], {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
