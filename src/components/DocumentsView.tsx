"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { PersonDTO } from "@/lib/tree-data";
import { prepareUpload } from "@/lib/upload-client";

type Media = {
  id: string;
  kind: string;
  docType: string | null;
  title: string | null;
  caption: string | null;
  mime: string;
  fileData: string;
  uploadedById: string;
  createdAt: string;
  personIds: string[];
};

const DOC_TYPES = [
  "BIRTH_CERT",
  "MARRIAGE_CERT",
  "DEATH_CERT",
  "ID_CARD",
  "EDUCATION",
  "PROPERTY",
  "OTHER",
] as const;

export default function DocumentsView({
  familyId,
  persons,
  me,
  myRole,
}: {
  familyId: string;
  persons: PersonDTO[];
  me: { id: string };
  myRole: string;
}) {
  const { t } = useI18n();
  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [docType, setDocType] = useState<string>("BIRTH_CERT");
  const [docPerson, setDocPerson] = useState<string>("");
  const [preview, setPreview] = useState<Media | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/families/${familyId}/media?kind=DOC`);
    if (res.ok) setMedia((await res.json()).media);
  }, [familyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/families/${familyId}/media?kind=DOC`);
      if (!cancelled && res.ok) {
        setMedia((await res.json()).media);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [familyId]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    for (const file of Array.from(files).slice(0, 10)) {
      try {
        const prepared = await prepareUpload(file, "DOC");
        const res = await fetch(`/api/families/${familyId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "DOC",
            docType,
            fileData: prepared.dataUrl,
            title: file.name.replace(/\.[^.]+$/, "").slice(0, 100),
            personIds: docPerson ? [docPerson] : [],
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error === "FILE_TOO_LARGE" ? t("errFileTooLarge") : t("error_generic"));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setError(msg === "UNSUPPORTED_TYPE" ? t("errUnsupported") : t("errFileTooLarge"));
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
  }

  async function deleteMedia(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    await fetch(`/api/media/${id}`, { method: "DELETE" });
    setPreview(null);
    load();
  }

  const filtered = useMemo(
    () => (filter === "ALL" ? media : media.filter((m) => m.docType === filter)),
    [media, filter]
  );
  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  const inputCls =
    "rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200";

  return (
    <div className="flex-1 overflow-y-auto p-4 scroll-thin">
      <h2 className="mb-4 text-xl font-extrabold text-bark-900">📜 {t("docs_title")}</h2>

      {/* Upload bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-leaf-100 bg-white p-4 shadow-sm">
        <select value={docType} onChange={(e) => setDocType(e.target.value)} className={inputCls}>
          {DOC_TYPES.map((dt) => (
            <option key={dt} value={dt}>{t(`DOC_${dt}` as "DOC_BIRTH_CERT")}</option>
          ))}
        </select>
        <select value={docPerson} onChange={(e) => setDocPerson(e.target.value)} className={inputCls}>
          <option value="">{t("choosePerson")}</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName ?? ""}
            </option>
          ))}
        </select>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="ms-auto rounded-lg bg-leaf-600 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-700 disabled:opacity-60"
        >
          {busy ? `⏳ ${t("uploading")}` : `+ ${t("uploadDocs")}`}
        </button>
      </div>
      {error && <p className="mb-3 text-sm font-semibold text-red-600">{error}</p>}

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip active={filter === "ALL"} onClick={() => setFilter("ALL")} label={`🗂 ${media.length}`} />
        {DOC_TYPES.map((dt) => {
          const count = media.filter((m) => m.docType === dt).length;
          if (!count) return null;
          return (
            <Chip key={dt} active={filter === dt} onClick={() => setFilter(dt)} label={`${t(`DOC_${dt}` as "DOC_BIRTH_CERT")} ${count}`} />
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-bark-800/50">{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-leaf-200 bg-white/60 p-12 text-center">
          <div className="text-4xl">📜</div>
          <p className="mt-3 font-semibold text-bark-800">{t("noMediaYet")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const owner = byId.get(m.personIds[0] ?? "");
            return (
              <button
                key={m.id}
                onClick={() => setPreview(m)}
                className="flex items-start gap-3 rounded-2xl bg-white p-3.5 text-start shadow-sm ring-1 ring-leaf-100 transition hover:shadow-md"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-leaf-50 text-2xl">
                  {m.mime.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.fileData} alt="" className="h-full w-full object-cover" />
                  ) : (
                    "📄"
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-bark-900">
                    {t(`DOC_${m.docType ?? "OTHER"}` as "DOC_BIRTH_CERT")}
                  </span>
                  {owner && (
                    <span className="block truncate text-xs font-semibold text-leaf-700">
                      {t("linkedTo")}: {owner.firstName} {owner.lastName ?? ""}
                    </span>
                  )}
                  <span className="block truncate text-[11px] text-bark-800/45">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-4 scroll-thin" onClick={(e) => e.stopPropagation()}>
            {preview.mime.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.fileData} alt="" className="max-h-[60vh] w-full rounded-2xl bg-gray-50 object-contain" />
            ) : (
              <a href={preview.fileData} target="_blank" rel="noreferrer" className="block rounded-2xl bg-gray-50 p-8 text-center font-bold text-leaf-700 underline">
                📄 افتح المستند (PDF)
              </a>
            )}
            <div className="mt-3 flex items-center gap-2">
              {(isAdmin || preview.uploadedById === me.id) && (
                <button onClick={() => deleteMedia(preview.id)} className="rounded-lg px-4 py-2.5 font-bold text-red-500 hover:bg-red-50">
                  🗑 {t("delete")}
                </button>
              )}
              <button onClick={() => setPreview(null)} className="ms-auto rounded-lg border border-leaf-200 px-4 py-2.5 font-semibold text-bark-800 hover:bg-leaf-50">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
        active ? "bg-leaf-600 text-white" : "bg-white text-bark-800 ring-1 ring-leaf-200 hover:bg-leaf-50"
      }`}
    >
      {label}
    </button>
  );
}
