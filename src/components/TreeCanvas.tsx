"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { PersonDTO, SpouseLinkDTO } from "@/lib/tree-data";
import { fullName, layoutTree } from "@/lib/tree-layout";

export type SelectedInfo =
  | { kind: "person"; id: string }
  | { kind: "empty" };

function initialsOf(firstName: string): string {
  return (firstName[0] ?? "?").toUpperCase();
}

export function Avatar({
  person,
  size = 40,
}: {
  person: { photo: string | null; firstName: string; gender: string };
  size?: number;
}) {
  const bg = person.gender === "MALE" ? "#257d53" : person.gender === "FEMALE" ? "#9c3474" : "#555";

  if (person.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.photo}
        alt={person.firstName}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}
      aria-hidden
    >
      {initialsOf(person.firstName)}
    </div>
  );
}

export default function TreeCanvas({
  persons,
  spouseLinks,
  onSelect,
}: {
  persons: PersonDTO[];
  spouseLinks: SpouseLinkDTO[];
  onSelect: (info: SelectedInfo) => void;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const layout = useMemo(
    () => layoutTree({ persons, spouseLinks }, collapsed),
    [persons, spouseLinks, collapsed]
  );

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el || !layout.width) return;
    const pad = 48;
    const s = Math.min(
      (el.clientWidth - pad) / layout.width,
      (el.clientHeight - pad) / Math.max(layout.height, 200),
      1.1
    );
    const clamped = Math.max(0.25, Math.min(s, 1.1));
    setScale(clamped);
    setOffset({
      x: Math.max(24, (el.clientWidth - layout.width * clamped) / 2),
      y: 32,
    });
  }, [layout.width, layout.height]);

  // initial fit & refit when tree size changes drastically
  useLayoutEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons.length]);

  function startDrag(e: React.MouseEvent) {
    if (e.button !== 0) return;
    setDragging(true);
    dragState.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onMove(e: React.MouseEvent) {
    if (!dragging || !dragState.current) return;
    setOffset({
      x: dragState.current.ox + (e.clientX - dragState.current.x),
      y: dragState.current.oy + (e.clientY - dragState.current.y),
    });
  }
  function endDrag() {
    setDragging(false);
    dragState.current = null;
  }

  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setScale((s) => {
        const next = Math.max(0.25, Math.min(1.6, s * (e.deltaY > 0 ? 0.92 : 1.08)));
        setOffset((o) => ({
          x: mx - ((mx - o.x) / s) * next,
          y: my - ((my - o.y) / s) * next,
        }));
        return next;
      });
    }
    const el = containerRef.current;
    el?.addEventListener("wheel", onWheel, { passive: false });
    return () => el?.removeEventListener("wheel", onWheel);
  }, []);

  const parentIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of persons) {
      if (p.fatherId) s.add(p.fatherId);
      if (p.motherId) s.add(p.motherId);
    }
    return s;
  }, [persons]);

  if (persons.length === 0) {
    return (
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <button
            onClick={() => onSelect({ kind: "empty" })}
            className="group rounded-3xl border-4 border-dashed border-leaf-300 bg-white/80 px-14 py-12 text-center transition hover:border-leaf-500 hover:bg-white"
          >
            <div className="text-5xl transition group-hover:scale-110">🌳</div>
            <div className="mt-4 max-w-xs font-bold text-bark-900">{t("tree_addFirst")}</div>
            <div className="mt-3 inline-block rounded-xl bg-leaf-600 px-5 py-2.5 font-bold text-white">
              + {t("tree_addPerson")}
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={`tree-canvas relative flex-1 overflow-hidden ${dragging ? "dragging" : ""}`}
      onMouseDown={startDrag}
      onMouseMove={onMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          width: layout.width,
          height: layout.height,
        }}
      >
        <svg
          width={layout.width}
          height={layout.height}
          className="pointer-events-none absolute left-0 top-0"
        >
          {layout.edges.map((e, i) =>
            e.kind === "marriage" ? (
              <line
                key={`m${i}`}
                x1={e.from.x}
                y1={e.from.y}
                x2={e.to.x}
                y2={e.to.y}
                stroke="#d9822b"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            ) : (
              <polyline
                key={`c${i}`}
                points={e.path.map((pt) => `${pt.x},${pt.y}`).join(" ")}
                fill="none"
                stroke="#8ad1ab"
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            )
          )}
        </svg>

        {layout.cards.map((c) => {
          const p = c.person;
          const name = fullName(p);
          const isCollapsedUnit = collapsed.has(p.id);
          const canCollapse = parentIds.has(p.id);
          const years =
            p.birthDate || p.deathDate
              ? `${p.birthDate ?? "?"}${p.deathDate ? ` – ${p.deathDate}` : p.isDeceased ? " – ؟" : ""}`
              : null;
          return (
            <button
              key={p.id}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelect({ kind: "person", id: p.id });
              }}
              title={name}
              className={`person-card absolute flex items-center gap-2 rounded-2xl border-2 bg-white px-2.5 text-start shadow-sm ${
                p.isDeceased
                  ? "border-gray-300 bg-gray-50"
                  : p.gender === "MALE"
                    ? "border-leaf-300"
                    : p.gender === "FEMALE"
                      ? "border-pink-200"
                      : "border-gray-200"
              }`}
              style={{
                left: c.x,
                top: c.y,
                width: 148,
                height: 64,
              }}
            >
              <Avatar person={p} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold leading-tight text-bark-900">
                  {name}
                </span>
                <span className="mt-0.5 block truncate text-[11px] leading-tight text-bark-800/60">
                  {years ?? t("noDates")}
                </span>
                {p.familyName && (
                  <span className="block truncate text-[10px] font-semibold italic leading-tight text-amber-700">
                    {t("external_family")} {p.familyName}
                  </span>
                )}
              </span>
              {p.commentCount > 0 && (
                <span className="absolute -top-2 end-2 rounded-full bg-sky-500 px-1.5 text-[10px] font-bold text-white">
                  {p.commentCount}
                </span>
              )}
              {canCollapse && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    });
                  }}
                  className="absolute -bottom-2.5 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-leaf-300 bg-white text-[10px] font-black text-leaf-700 shadow hover:bg-leaf-50"
                >
                  {isCollapsedUnit ? "+" : "−"}
                </span>
              )}
              {p.isDeceased && <span className="absolute -top-2 start-2 text-sm">🕊️</span>}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="absolute bottom-4 start-4 z-20 flex items-center gap-1.5 rounded-xl border border-leaf-100 bg-white/95 p-1.5 shadow-lg backdrop-blur">
        <ToolBtn label={t("tree_zoomIn")} onClick={() => setScale((s) => Math.min(1.6, s * 1.15))}>
          ＋
        </ToolBtn>
        <ToolBtn label={t("tree_zoomOut")} onClick={() => setScale((s) => Math.max(0.25, s * 0.87))}>
          −
        </ToolBtn>
        <ToolBtn label={t("tree_reset")} onClick={() => { setScale(1); setOffset({ x: 40, y: 40 }); }}>
          ⟳
        </ToolBtn>
        <ToolBtn label={t("tree_fit")} onClick={fit}>⛶</ToolBtn>
        <div className="mx-1 h-5 w-px bg-leaf-100" />
        <ToolBtn
          label={t("tree_expandAll")}
          onClick={() => setCollapsed(new Set())}
        >
          ⤢
        </ToolBtn>
        <ToolBtn
          label={t("tree_collapseAll")}
          onClick={() => setCollapsed(new Set(parentIds))}
        >
          ⤡
        </ToolBtn>
      </div>
    </div>
  );
}

function ToolBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-bark-800 hover:bg-leaf-50"
    >
      {children}
    </button>
  );
}
