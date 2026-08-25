"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

type CommentDTO = {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
};

export default function CommentsSection({
  personId,
  meId,
}: {
  personId: string;
  meId: string;
}) {
  const { t } = useI18n();
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/persons/${personId}/comments`);
      if (!cancelled && res.ok) {
        const data = await res.json();
        setComments(data.comments);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/persons/${personId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setBusy(false);
    if (res.ok) {
      const { comment } = await res.json();
      setComments((c) => [...c, comment]);
      setText("");
      requestAnimationFrame(() =>
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
      );
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="scroll-thin flex-1 space-y-3 overflow-y-auto pe-1">
        {!loaded ? (
          <p className="text-sm text-bark-800/50">{t("loading")}</p>
        ) : comments.length === 0 ? (
          <p className="rounded-xl bg-sky-50 p-3 text-sm leading-relaxed text-sky-900 ring-1 ring-sky-100">
            💬 {t("comments_empty")}
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-leaf-200 text-xs font-bold text-leaf-800"
              >
                {c.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.user.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  (c.user.name ?? "?").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="rounded-2xl rounded-ts-sm bg-leaf-50 px-3.5 py-2 ring-1 ring-leaf-100">
                  <span className="block text-xs font-bold text-bark-900">
                    {c.user.name}
                    {c.user.id === meId && ` (${t("you")})`}
                  </span>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-bark-800">
                    {c.text}
                  </p>
                </div>
                <time className="mt-1 block text-[10px] text-bark-800/40" dateTime={c.createdAt}>
                  {new Date(c.createdAt).toLocaleString()}
                </time>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2 border-t border-leaf-100 pt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("comment_placeholder")}
          maxLength={1000}
          className="flex-1 rounded-lg border border-leaf-200 px-3 py-2 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200"
        />
        <button
          disabled={busy || !text.trim()}
          className="rounded-lg bg-leaf-600 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
        >
          {t("send")}
        </button>
      </form>
    </div>
  );
}
