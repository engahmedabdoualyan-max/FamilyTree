"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { PersonDTO } from "@/lib/tree-data";

type LeaderRow = { userId: string; name: string; image: string | null; points: number; rank: number };
type BadgeMap = Record<string, string>;
type Riddle = {
  id: string;
  question: string;
  answer: string | null;
  reward: number;
  solved: boolean;
  solverName: string | null;
  isMine: boolean;
};

export default function ClubView({
  familyId,
  persons,
}: {
  familyId: string;
  persons: PersonDTO[];
}) {
  const { t } = useI18n();
  const [sub, setSub] = useState<"games" | "riddles" | "board">("games");
  const [myPoints, setMyPoints] = useState(0);
  const [myRank, setMyRank] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [riddles, setRiddles] = useState<Riddle[]>([]);
  const [badges, setBadges] = useState<BadgeMap>({});

  const loadClub = useCallback(async () => {
    const res = await fetch(`/api/families/${familyId}/club`);
    if (res.ok) {
      const d = await res.json();
      setMyPoints(d.myPoints);
      setMyRank(d.myRank);
      setLeaderboard(d.leaderboard);
      setBadges(d.badges ?? {});
      setRiddles(d.riddles);
    }
  }, [familyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadClub();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadClub]);

  const withPhotos = useMemo(
    () => persons.filter((p) => p.photo && !p.familyName),
    [persons]
  );

  function award(reason: "MEMORY" | "QUIZ", points: number) {
    fetch(`/api/families/${familyId}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, points }),
    }).then(() => loadClub());
  }

  const subs = [
    { key: "games" as const, label: `🎮 ${t("games_sub")}` },
    { key: "riddles" as const, label: `🧩 ${t("riddles_sub")}` },
    { key: "board" as const, label: `🏆 ${t("board_sub")}` },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 scroll-thin">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold text-bark-900">🎯 {t("club_title")}</h2>
        <span className="ms-auto rounded-full bg-leaf-600 px-4 py-1.5 text-sm font-black text-white">
          ⭐ {myPoints} · #{myRank || "-"}
        </span>
      </div>

      <div className="mb-5 flex gap-1.5">
        {subs.map((x) => (
          <button
            key={x.key}
            onClick={() => setSub(x.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              sub === x.key ? "bg-leaf-600 text-white" : "bg-white text-bark-800 ring-1 ring-leaf-200 hover:bg-leaf-50"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {sub === "games" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <MemoryGame persons={withPhotos} onWin={(pts) => award("MEMORY", pts)} />
          <GuessWho persons={withPhotos.length >= 4 ? withPhotos : persons} onDone={(pts) => award("QUIZ", pts)} />
        </div>
      )}

      {sub === "riddles" && (
        <Riddles
          riddles={riddles}
          onSolved={() => loadClub()}
          onCreate={async (question, answer, reward) => {
            await fetch(`/api/families/${familyId}/riddles`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question, answer, reward }),
            });
            loadClub();
          }}
        />
      )}

      {sub === "board" && (
        <>
        {Object.keys(badges).length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(badges).map(([uid, label]) => (
              <span key={uid} className="rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-bark-900 shadow-sm ring-1 ring-amber-200">
                {label}
              </span>
            ))}
          </div>
        )}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-leaf-100">
          {leaderboard.map((row) => (
            <div
              key={row.userId}
              className={`flex items-center gap-3 border-b border-leaf-50 px-4 py-3 last:border-0 ${
                row.rank <= 3 ? "bg-gradient-to-r from-amber-50/60 to-transparent" : ""
              }`}
            >
              <span className="w-8 text-center text-lg font-black">
                {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : row.rank}
              </span>
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-leaf-200 text-xs font-bold text-leaf-800">
                {row.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  row.name.slice(0, 1)
                )}
              </span>
              <b className="flex-1 truncate text-sm text-bark-900">{row.name}</b>
              <span className="rounded-full bg-leaf-100 px-3 py-1 text-xs font-black text-leaf-800">
                ⭐ {row.points}
              </span>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Memory Game ---------------- */

function MemoryGame({
  persons,
  onWin,
}: {
  persons: PersonDTO[];
  onWin: (pts: number) => void;
}) {
  const { t } = useI18n();
  const [cards, setCards] = useState<{ key: number; pid: string; photo: string; flipped: boolean; matched: boolean }[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const awarded = useRef(false);

  const reset = useCallback(() => {
    const picks = [...persons].sort(() => Math.random() - 0.5).slice(0, 6);
    const deck = [...picks, ...picks]
      .map((p, i) => ({ key: i, pid: p.id, photo: p.photo!, flipped: true, matched: false }))
      .sort(() => Math.random() - 0.5);
    setCards(deck);
    setFlipped([]);
    setMoves(0);
    setWon(false);
    awarded.current = false;
    setTimeout(() => {
      setCards((cs) => cs.map((c) => ({ ...c, flipped: false })));
    }, 2500);
  }, [persons]);

  useEffect(() => {
    if (persons.length < 3) return;
    queueMicrotask(() => {
      reset();
    });
  }, [persons.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function flip(idx: number) {
    if (won || cards[idx].matched || cards[idx].flipped || flipped.length === 2) return;
    const next = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    setCards(next);
    const open = [...flipped, idx];
    setFlipped(open);
    if (open.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = open;
      const isMatch = next[a].pid === next[b].pid;
      setTimeout(() => {
        setCards((cs) =>
          cs.map((c, i) =>
            i === a || i === b ? { ...c, matched: isMatch, flipped: isMatch } : c
          )
        );
        setFlipped([]);
        if (isMatch && next.every((c, i) => c.matched || i === a || i === b)) {
          setWon(true);
          if (!awarded.current) {
            awarded.current = true;
            onWin(15);
          }
        }
      }, 600);
    }
  }

  return (
    <div className="rounded-2xl border border-leaf-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-extrabold text-bark-900">🧠 {t("memory_game")}</h3>
        <span className="text-xs font-bold text-bark-800/60">
          {t("moves")}: {moves}
        </span>
      </div>
      {won ? (
        <div className="py-10 text-center">
          <div className="text-5xl">🏆</div>
          <p className="mt-3 font-extrabold text-leaf-700">{t("you_win")}</p>
          <p className="text-sm font-bold text-amber-600">+15 {t("points_awarded")}</p>
          <button onClick={reset} className="mt-4 rounded-xl bg-leaf-600 px-6 py-2.5 font-bold text-white hover:bg-leaf-700">
            {t("play_again")}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            {cards.map((c, i) => (
              <button
                key={c.key}
                onClick={() => flip(i)}
                className={`aspect-square overflow-hidden rounded-xl transition ${
                  c.flipped || c.matched ? "ring-2 ring-leaf-400" : "bg-leaf-600"
                }`}
              >
                {c.flipped || c.matched ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo} alt="" className={`h-full w-full object-cover ${c.matched ? "opacity-70" : ""}`} />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl">🌳</span>
                )}
              </button>
            ))}
          </div>
          {cards.length === 0 && (
            <p className="py-6 text-center text-sm text-bark-800/50">📸 ارفع صور في الألبومات الأول!</p>
          )}
          {!won && cards.length > 0 && (
            <button onClick={reset} className="mt-3 text-xs font-bold text-leaf-700 hover:underline">
              ⟳ {t("play_again")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- Guess Who ---------------- */

function GuessWho({
  persons,
  onDone,
}: {
  persons: PersonDTO[];
  onDone: (pts: number) => void;
}) {
  void onDone;
  const { t } = useI18n();
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const pool = useMemo(
    () => persons.filter((p) => p.photo).length >= 4 ? persons.filter((p) => p.photo) : [],
    [persons]
  );

  const [current, setCurrent] = useState<{
    person: PersonDTO;
    options: PersonDTO[];
  } | null>(null);

  const newRound = useCallback(() => {
    if (pool.length < 4) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const target = shuffled[0];
    const others = shuffled.slice(1, 4);
    setCurrent({
      person: target,
      options: [target, ...others].sort(() => Math.random() - 0.5),
    });
  }, [pool]);

  useEffect(() => {
    queueMicrotask(() => {
      newRound();
    });
  }, [newRound]);

  function pick(pid: string) {
    if (!current) return;
    if (pid === current.person.id) setScore((s) => s + 4);
    if (round >= 5) {
      const finalScore = score + (pid === current.person.id ? 4 : 0);
      setFinished(true);
      if (finalScore > 0) onDone?.(finalScore);
    } else {
      setRound((r) => r + 1);
      newRound();
    }
  }

  return (
    <div className="rounded-2xl border border-leaf-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-extrabold text-bark-900">🕵️ {t("guess_game")}</h3>
        <span className="text-xs font-bold text-bark-800/60">
          {t("round_of")} {Math.min(round, 5)}/5 · {t("score")}: {score}
        </span>
      </div>

      {pool.length < 4 ? (
        <p className="py-6 text-center text-sm text-bark-800/50">📸 محتاجين 4 صور على الأقل!</p>
      ) : finished ? (
        <div className="py-10 text-center">
          <div className="text-5xl">{score >= 16 ? "🏅" : score >= 8 ? "👏" : "🙂"}</div>
          <p className="mt-3 font-extrabold text-leaf-700">{t("score")}: {score}/20</p>
          {score > 0 && <p className="text-sm font-bold text-amber-600">+{score} {t("points_awarded")}</p>}
          <button
            onClick={() => {
              setScore(0);
              setRound(1);
              setFinished(false);
              newRound();
            }}
            className="mt-4 rounded-xl bg-leaf-600 px-6 py-2.5 font-bold text-white hover:bg-leaf-700"
          >
            {t("play_again")}
          </button>
        </div>
      ) : (
        current && (
          <>
            <div className="mx-auto max-w-[220px] overflow-hidden rounded-3xl ring-4 ring-leaf-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.person.photo!} alt="" className="aspect-square w-full object-cover" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {current.options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => pick(o.id)}
                  className="rounded-xl border border-leaf-200 py-2.5 text-sm font-bold text-bark-900 transition hover:border-leaf-500 hover:bg-leaf-50"
                >
                  {o.firstName} {o.lastName ?? ""}
                </button>
              ))}
            </div>
          </>
        )
      )}
    </div>
  );
}

/* ---------------- Riddles ---------------- */

function Riddles({
  riddles,
  onSolved,
  onCreate,
}: {
  riddles: Riddle[];
  onSolved: () => void;
  onCreate: (q: string, a: string, reward: number) => Promise<void>;
}) {
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ question: "", answer: "", reward: 10 });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  async function solve(r: Riddle) {
    const attempt = answers[r.id];
    if (!attempt?.trim()) return;
    const res = await fetch(`/api/riddles/${r.id}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: attempt }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.correct) {
      setFeedback((f) => ({ ...f, [r.id]: `🎉 ${t("you_win")} +${r.reward}` }));
      onSolved();
    } else if (data.error === "ALREADY_SOLVED") {
      setFeedback((f) => ({ ...f, [r.id]: t("no_notifications") }));
      onSolved();
    } else {
      setFeedback((f) => ({ ...f, [r.id]: `❌ ${t("wrong_answer")}` }));
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await onCreate(form.question, form.answer, form.reward);
    setForm({ question: "", answer: "", reward: 10 });
    setCreating(false);
  }

  const inputCls =
    "w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200";

  return (
    <div>
      <button
        onClick={() => setCreating(!creating)}
        className="mb-4 rounded-lg bg-leaf-600 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-700"
      >
        {t("new_riddle")}
      </button>

      {creating && (
        <form onSubmit={create} className="mb-5 grid gap-3 rounded-2xl border border-leaf-200 bg-white p-4 sm:grid-cols-[1fr_140px_auto]">
          <input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder={t("riddle_q")} required minLength={5} maxLength={500} className={inputCls} />
          <input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder={t("riddle_a")} required maxLength={200} className={inputCls} />
          <div className="flex gap-2">
            <input type="number" min={5} max={100} value={form.reward} onChange={(e) => setForm({ ...form, reward: Number(e.target.value) })} title={t("reward_points")} className={`${inputCls} w-24`} />
            <button disabled={busyCreate()} className="rounded-lg bg-leaf-600 px-4 text-sm font-bold text-white hover:bg-leaf-700">
              {t("post_riddle")}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {riddles.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-leaf-200 p-10 text-center">
            <div className="text-4xl">🧩</div>
            <p className="mt-3 font-semibold text-bark-800">{t("noMediaYet")}</p>
          </div>
        )}
        {riddles.map((r) => (
          <div key={r.id} className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${r.solved ? "ring-gray-200 opacity-80" : "ring-leaf-100"}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-bark-900">🧩 {r.question}</p>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700">
                ⭐ {r.reward}
              </span>
            </div>
            {r.solved ? (
              <p className="mt-2 text-xs font-semibold text-green-700">
                ✅ {t("solved_by")}: {r.solverName}
                {r.answer && <span className="ms-2 italic text-bark-800/60">({r.answer})</span>}
              </p>
            ) : r.isMine ? (
              <p className="mt-2 text-xs font-semibold text-bark-800/60">
                {t("riddle_a")}: <b>{r.answer}</b>
              </p>
            ) : (
              <div className="mt-2.5 flex gap-2">
                <input
                  value={answers[r.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [r.id]: e.target.value }))}
                  placeholder={t("your_answer")}
                  className="flex-1 rounded-full border border-leaf-200 px-4 py-2 text-sm outline-none focus:border-leaf-500"
                />
                <button onClick={() => solve(r)} className="rounded-full bg-leaf-600 px-4 py-2 text-xs font-bold text-white hover:bg-leaf-700">
                  {t("solve")}
                </button>
              </div>
            )}
            {feedback[r.id] && <p className="mt-1.5 text-xs font-bold text-amber-700">{feedback[r.id]}</p>}
          </div>
        ))}
      </div>
    </div>
  );

  function busyCreate() {
    return false;
  }
}
