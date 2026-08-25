"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";

type Friend = { id: string; name: string | null; image: string | null };
type Thread = { friend: Friend; lastText: string | null; lastAt: string; unread: number };
type DM = { id: string; senderId: string; receiverId: string; text: string; createdAt: string };

export default function MessagesPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [meId, setMeId] = useState<string>("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/dm");
    if (res.ok) setThreads((await res.json()).threads);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/dm");
      if (!cancelled && res.ok) {
        setThreads((await res.json()).threads);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // open ?with= param
  useEffect(() => {
    const withId = searchParams.get("with");
    if (!withId) return;
    const th = threads.find((x) => x.friend.id === withId);
    if (!th || activeFriend) return;
    queueMicrotask(() => {
      openThread(th.friend);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, searchParams]);

  const pollThread = useCallback(async () => {
    if (!activeFriend) return;
    const res = await fetch(`/api/dm/${activeFriend.id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
      loadThreads();
    }
  }, [activeFriend, loadThreads]);

  useEffect(() => {
    if (!activeFriend) return;
    const timer = setInterval(pollThread, 3000);
    return () => clearInterval(timer);
  }, [activeFriend, pollThread]);

  function scrollDown() {
    requestAnimationFrame(() =>
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    );
  }

  async function openThread(friend: Friend) {
    setActiveFriend(friend);
    const res = await fetch(`/api/dm/${friend.id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
      // determine my id from messages or assume none yet
      const mine = data.messages.find((m: DM) => m.senderId !== friend.id);
      setMeId(mine?.senderId ?? meId);
      setTimeout(scrollDown, 50);
      loadThreads();
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeFriend) return;
    const res = await fetch(`/api/dm/${activeFriend.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const { message } = await res.json();
      setMessages((m) => [...m, message]);
      setMeId(message.senderId);
      setText("");
      setTimeout(scrollDown, 30);
      loadThreads();
    }
  }

  const inputCls =
    "w-full rounded-full border border-leaf-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 overflow-hidden px-2 py-3 sm:px-4">
      {/* Threads sidebar */}
      <aside className={`w-full shrink-0 sm:w-64 ${activeFriend ? "hidden sm:block" : ""}`}>
        <h1 className="mb-3 px-1 text-xl font-extrabold text-bark-900">✉️ {t("messages_page")}</h1>
        {!loaded ? (
          <p className="px-1 text-sm text-bark-800/40">{t("loading")}</p>
        ) : threads.length === 0 ? (
          <p className="rounded-xl border border-dashed border-leaf-200 p-4 text-center text-xs text-bark-800/50">
            {t("no_friends")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {threads.map((th) => (
              <li key={th.friend.id}>
                <button
                  onClick={() => openThread(th.friend)}
                  className={`flex w-full items-center gap-2.5 rounded-2xl p-2.5 text-start transition ${
                    activeFriend?.id === th.friend.id ? "bg-leaf-100 ring-1 ring-leaf-300" : "hover:bg-leaf-50"
                  }`}
                >
                  <span className="relative">
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-leaf-200 font-bold text-leaf-800">
                      {th.friend.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={th.friend.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (th.friend.name ?? "?").slice(0, 1)
                      )}
                    </span>
                    {th.unread > 0 && (
                      <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                        {th.unread}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-bark-900">{th.friend.name}</span>
                    <span className="block truncate text-[11px] text-bark-800/50">
                      {th.lastText ?? t("messages_page")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <a href="/friends" className="mt-3 block rounded-xl bg-white p-3 text-center text-xs font-bold text-leaf-700 ring-1 ring-leaf-200 hover:bg-leaf-50">
          👥 {t("friends_page")}
        </a>
      </aside>

      {/* Thread */}
      <section className={`flex min-w-0 flex-1 flex-col rounded-3xl bg-white shadow-sm ring-1 ring-leaf-100 ${activeFriend ? "" : "hidden sm:flex"}`}>
        {activeFriend ? (
          <>
            <div className="flex items-center gap-2.5 border-b border-leaf-50 px-4 py-2.5">
              <button onClick={() => setActiveFriend(null)} className="sm:hidden">←</button>
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-leaf-200 text-xs font-bold text-leaf-800">
                {(activeFriend.name ?? "?").slice(0, 1)}
              </span>
              <b className="truncate text-sm text-bark-900">{activeFriend.name}</b>
            </div>
            <div ref={listRef} className="scroll-thin flex-1 space-y-2 overflow-y-auto p-3.5">
              {messages.length === 0 && (
                <p className="pt-6 text-center text-xs text-bark-800/40">{t("write_message")}</p>
              )}
              {messages.map((m) => {
                const mine = m.senderId === meId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <p
                      className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                        mine ? "bg-leaf-600 text-white" : "bg-leaf-50 text-bark-900 ring-1 ring-leaf-100"
                      }`}
                    >
                      {m.text}
                    </p>
                  </div>
                );
              })}
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-leaf-50 p-3">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("write_message")} maxLength={2000} className={inputCls} />
              <button disabled={!text.trim()} className="rounded-full bg-leaf-600 px-5 text-sm font-bold text-white hover:bg-leaf-700 disabled:opacity-50">
                ➤
              </button>
            </form>
          </>
        ) : (
          <div className="hidden flex-1 items-center justify-center text-center sm:flex">
            <div>
              <div className="text-4xl">✉️</div>
              <p className="mt-2 text-sm font-semibold text-bark-800/60">{t("messages_page")}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
