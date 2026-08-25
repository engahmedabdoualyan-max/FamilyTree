"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

type LifeEvent = { id: string; year: string | null; title: string; place: string | null };

export function Timeline({
  personId,
  birthDate,
  deathDate,
}: {
  personId: string;
  birthDate: string | null;
  deathDate: string | null;
}) {
  const { t } = useI18n();
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", year: "", place: "" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/persons/${personId}/events`);
    if (res.ok) setEvents((await res.json()).events);
    setLoaded(true);
  }, [personId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await fetch(`/api/persons/${personId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ title: "", year: "", place: "" });
    setAdding(false);
    load();
  }

  async function remove(eventId: string) {
    await fetch(`/api/persons/${personId}/events?eventId=${eventId}`, { method: "DELETE" });
    load();
  }

  const timeline: { label: string; sub?: string }[] = [];
  if (birthDate) timeline.push({ label: `👶 ${t("born")}`, sub: birthDate });
  for (const ev of events)
    timeline.push({ label: `📌 ${ev.title}`, sub: [ev.year, ev.place].filter(Boolean).join(" · ") });
  if (deathDate) timeline.push({ label: `🕊️ ${t("died")}`, sub: deathDate });

  const inputCls =
    "w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wide text-bark-800/50">
          📅 {t("timeline_tab")}
        </h4>
        <button onClick={() => setAdding(!adding)} className="text-xs font-bold text-leaf-700 hover:underline">
          {t("add_event")}
        </button>
      </div>

      {adding && (
        <form onSubmit={add} className="mb-3 grid gap-2 rounded-xl bg-leaf-50/60 p-3 ring-1 ring-leaf-100 sm:grid-cols-[1fr_90px_auto]">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("event_title_field")} required className={inputCls} />
          <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder={t("event_year")} dir="ltr" maxLength={10} className={inputCls} />
          <button className="rounded-lg bg-leaf-600 px-3 text-xs font-bold text-white hover:bg-leaf-700">{t("add")}</button>
          <input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder={t("event_place")} maxLength={120} className={`${inputCls} sm:col-span-3`} />
        </form>
      )}

      {!loaded ? (
        <p className="text-xs text-bark-800/40">{t("loading")}</p>
      ) : timeline.length === 0 ? (
        <p className="rounded-xl border border-dashed border-leaf-200 p-3 text-center text-xs text-bark-800/40">
          {t("noMediaYet")}
        </p>
      ) : (
        <ol className="relative space-y-2.5 ps-5">
          <span className="absolute bottom-1 start-1.5 top-1 w-0.5 bg-leaf-200" aria-hidden />
          {timeline.map((item, i) => (
            <li key={i} className="relative">
              <span className="absolute -start-5 top-1 h-3 w-3 rounded-full border-2 border-white bg-leaf-500 shadow" />
              {i > 0 && events[i - 1] && (
                <button
                  onClick={() => remove(events[i - 1].id)}
                  className="absolute -start-9 top-0.5 text-[10px] text-red-300 hover:text-red-500"
                  title={t("delete")}
                >
                  ✕
                </button>
              )}
              <p className="text-sm font-semibold leading-snug text-bark-900">{item.label}</p>
              {item.sub && <p dir="auto" className="text-[11px] font-medium text-bark-800/50">{item.sub}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ---------------- Voice stories ---------------- */

type Voice = { id: string; dataUrl: string; durationSec: number; recordedBy: string | null; createdAt: string };

export function VoiceStories({ personId, meId }: { personId: string; meId: string }) {
  const { t } = useI18n();
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/persons/${personId}/voices`);
    if (res.ok) setVoices((await res.json()).voices);
  }, [personId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/persons/${personId}/voices`);
      if (!cancelled && res.ok) setVoices((await res.json()).voices);
    })();
    return () => {
      cancelled = true;
    };
  }, [personId]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((tk) => tk.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size > 1_400_000) {
          setError(t("errFileTooLarge"));
          return;
        }
        const dataUrl = await new Promise<string>((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.readAsDataURL(blob);
        });
        await fetch(`/api/persons/${personId}/voices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl, durationSec: seconds }),
        });
        load();
      };
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s >= 59) {
            stopRecording();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError(t("error_generic"));
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    recorderRef.current?.stop();
  }

  async function deleteVoice(id: string) {
    await fetch(`/api/persons/${personId}/voices?voiceId=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="rounded-xl bg-violet-50/60 p-3 ring-1 ring-violet-100">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wide text-bark-800/50">🎙️ حكايات مسجلة</h4>
        {!recording ? (
          <button onClick={startRecording} className="rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-violet-700">
            ● سجل حكاية
          </button>
        ) : (
          <button onClick={stopRecording} className="flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[11px] font-bold text-white">
            ⏹ إيقاف ({seconds}s)
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs font-bold text-red-600">{error}</p>}
      {voices && voices.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {voices.map((v) => (
            <li key={v.id} className="flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-violet-100">
              <audio controls preload="none" src={v.dataUrl} className="h-8 flex-1" />
              <span className="shrink-0 text-[10px] font-bold text-bark-800/50">{v.recordedBy}</span>
              {(v.recordedBy === meId || true) && (
                <button onClick={() => deleteVoice(v.id)} className="text-xs text-red-300 hover:text-red-500">✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
