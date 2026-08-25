"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { prepareImage } from "@/lib/upload-client";

type Listing = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  price: number | null;
  photo: string | null;
  status: string;
  createdAt: string;
  ownerName: string | null;
  ownerId: string;
  claimsCount: number;
  isMine: boolean;
};

export default function MarketView({
  familyId,
  me: _me,
}: {
  familyId: string;
  me: { id: string };
}) {
  void _me;
  const { t } = useI18n();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "SELL" | "GIFT">("ALL");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ kind: "GIFT", title: "", description: "", price: "", photo: "" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/families/${familyId}/listings`);
    if (res.ok) setListings((await res.json()).listings);
    setLoading(false);
  }, [familyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch(`/api/families/${familyId}/listings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: form.kind,
        title: form.title,
        description: form.description,
        price: form.kind === "SELL" ? Number(form.price || 0) : 0,
        photo: form.photo,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setCreating(false);
      setForm({ kind: "GIFT", title: "", description: "", price: "", photo: "" });
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error === "FILE_TOO_LARGE" ? t("errFileTooLarge") : t("error_generic"));
    }
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    try {
      const prepared = await prepareImage(file, 800, 0.8);
      setForm((f) => ({ ...f, photo: prepared.dataUrl }));
    } catch {}
  }

  async function claim(id: string) {
    const res = await fetch(`/api/listings/${id}/claim`, { method: "POST" });
    if (res.ok) {
      setClaimed((c) => ({ ...c, [id]: true }));
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function remove(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    await fetch(`/api/listings/${id}`, { method: "DELETE" });
    load();
  }

  const filtered =
    filter === "ALL" ? listings : listings.filter((l) => l.kind === filter);

  const inputCls =
    "w-full rounded-lg border border-leaf-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200";

  return (
    <div className="flex-1 overflow-y-auto p-4 scroll-thin">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h2 className="text-xl font-extrabold text-bark-900">🛍️ {t("market_title")}</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="ms-auto rounded-lg bg-leaf-600 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-700"
        >
          {t("new_listing")}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-1.5">
        {(["ALL", "SELL", "GIFT"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              filter === k ? "bg-leaf-600 text-white" : "bg-white text-bark-800 ring-1 ring-leaf-200 hover:bg-leaf-50"
            }`}
          >
            {k === "ALL" ? t("filter_all") : k === "SELL" ? `🏷️ ${t("sell_item")}` : `🎁 ${t("gift_free")}`}
          </button>
        ))}
      </div>

      {creating && (
        <form onSubmit={submit} className="mb-6 grid gap-3 rounded-2xl border border-leaf-200 bg-white p-5 shadow-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-bark-800">{t("listing_kind")}</label>
            <div className="flex gap-2">
              {(["GIFT", "SELL"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, kind: k })}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition ${
                    form.kind === k ? "border-leaf-600 bg-leaf-600 text-white" : "border-leaf-200 bg-white text-bark-800 hover:bg-leaf-50"
                  }`}
                >
                  {k === "GIFT" ? t("gift_free") : t("sell_item")}
                </button>
              ))}
            </div>
          </div>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("listing_title")} required minLength={2} className={inputCls} />
          {form.kind === "SELL" && (
            <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder={t("listing_price")} type="number" min={0} dir="ltr" required className={inputCls} />
          )}
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("listing_desc")} rows={2} maxLength={1000} className={`${inputCls} resize-none sm:col-span-2`} />
          <div className="flex items-center gap-3 sm:col-span-2">
            <label className="cursor-pointer rounded-lg border border-leaf-300 px-4 py-2 text-xs font-bold text-leaf-700 hover:bg-leaf-50">
              📷 صورة
              <input type="file" accept="image/*" hidden onChange={(e) => handlePhoto(e.target.files?.[0])} />
            </label>
            {form.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.photo} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-leaf-200" />
            )}
            <button disabled={busy} className="ms-auto rounded-lg bg-leaf-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-leaf-700 disabled:opacity-60">
              {t("publish")}
            </button>
          </div>
          {error && <p className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
        </form>
      )}

      {loading ? (
        <p className="text-sm text-bark-800/50">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-leaf-200 p-12 text-center">
          <div className="text-4xl">🛍️</div>
          <p className="mt-3 font-semibold text-bark-800">{t("noMediaYet")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((l) => {
            const done = l.status === "DONE";
            return (
              <div key={l.id} className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition hover:shadow-md ${done ? "opacity-60" : "ring-leaf-100"}`}>
                <div className="relative aspect-square bg-leaf-50">
                  {l.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-4xl">{l.kind === "GIFT" ? "🎁" : "🏷️"}</span>
                  )}
                  <span
                    className={`absolute start-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black ${
                      l.kind === "GIFT" ? "bg-pink-500 text-white" : "bg-sky-500 text-white"
                    }`}
                  >
                    {l.kind === "GIFT" ? t("gift_free") : `${l.price} EGP`}
                  </span>
                  {done && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-black text-white">
                      {t("status_done")}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="truncate text-sm font-bold text-bark-900">{l.title}</h3>
                  {l.description && <p className="line-clamp-2 pt-0.5 text-[11px] leading-relaxed text-bark-800/60">{l.description}</p>}
                  <p className="pt-1 text-[10px] font-semibold text-bark-800/45">👤 {l.ownerName}</p>

                  <div className="mt-2">
                    {l.isMine ? (
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                          {l.claimsCount} {t("claims_n")}
                        </span>
                        {!done && (
                          <button onClick={() => setStatus(l.id, "DONE")} className="rounded-lg bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700 hover:bg-green-100">
                            ✓ {t("mark_done")}
                          </button>
                        )}
                        <button onClick={() => remove(l.id)} className="ms-auto text-red-400 hover:text-red-600">🗑</button>
                      </div>
                    ) : done ? null : (
                      <button
                        onClick={() => claim(l.id)}
                        disabled={claimed[l.id]}
                        className={`w-full rounded-lg py-1.5 text-xs font-bold transition ${
                          claimed[l.id]
                            ? "bg-green-50 text-green-600 ring-1 ring-green-200"
                            : "bg-leaf-600 text-white hover:bg-leaf-700"
                        }`}
                      >
                        {claimed[l.id] ? t("claimed_ok") : t("claim_btn")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
