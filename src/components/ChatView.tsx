"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Message = {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
};

export default function ChatView({
  familyId,
  me,
}: {
  familyId: string;
  me: { id: string; name?: string | null; image?: string | null };
}) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const scrollDown = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() =>
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" })
    );
  }, []);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/families/${familyId}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages);
    setLoaded(true);
    if (data.messages.length !== lastCount.current) {
      const grew = data.messages.length > lastCount.current;
      lastCount.current = data.messages.length;
      scrollDown(grew && lastCount.current > 0);
    }
  }, [familyId, scrollDown]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/families/${familyId}/messages`);
      if (!cancelled && res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        setLoaded(true);
      }
    })();
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [poll, familyId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/families/${familyId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setSending(false);
    if (res.ok) {
      const { message } = await res.json();
      setMessages((m) => [...m.filter((x) => x.id !== message.id), message]);
      setText("");
      lastCount.current += 1;
      scrollDown(true);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={listRef} className="scroll-thin flex-1 space-y-2.5 overflow-y-auto p-4">
        {!loaded ? (
          <p className="text-sm text-bark-800/50">{t("loading")}</p>
        ) : messages.length === 0 ? (
          <div className="mt-10 rounded-2xl border-2 border-dashed border-leaf-200 bg-white/60 p-10 text-center">
            <div className="text-4xl">💬</div>
            <p className="mt-3 font-semibold text-bark-800">{t("chat_title")}</p>
            <p className="mt-1 text-sm text-bark-800/60">{t("chatPlaceholder")}</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.user.id === me.id;
            return (
              <div key={m.id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-leaf-200 text-xs font-bold text-leaf-800">
                  {m.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.user.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (m.user.name ?? "?").slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="max-w-[75%]">
                  <span className={`block px-1 pb-0.5 text-[11px] font-bold ${mine ? "text-end" : ""} text-bark-800/50`}>
                    {mine ? t("you") : m.user.name}
                  </span>
                  <span
                    className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                      mine
                        ? "bg-leaf-600 text-white"
                        : "bg-white text-bark-900 ring-1 ring-leaf-100"
                    }`}
                  >
                    {m.text}
                  </span>
                  <time className={`mt-0.5 block px-1 text-[10px] text-bark-800/40 ${mine ? "text-end" : ""}`}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </time>
                </span>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-leaf-100 bg-white p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chatPlaceholder")}
          maxLength={2000}
          className="flex-1 rounded-full border border-leaf-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200"
        />
        <button
          disabled={sending || !text.trim()}
          className="rounded-full bg-leaf-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
