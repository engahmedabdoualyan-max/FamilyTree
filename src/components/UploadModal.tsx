"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { prepareUpload } from "@/lib/upload-client";

type Pending = { key: string; file: File; previewUrl: string };

export default function UploadModal({
  familyId,
  albumId,
  onClose,
  onUploaded,
}: {
  familyId: string;
  albumId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState<Pending[]>([]);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next: Pending[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      next.push({ key: `${f.name}-${f.size}-${Math.random()}`, file: f, previewUrl: URL.createObjectURL(f) });
    }
    setPending((p) => [...p, ...next].slice(0, 30));
  }

  async function uploadAll() {
    if (!pending.length) return;
    setBusy(true);
    setError("");
    let ok = 0;
    for (const item of pending) {
      try {
        const prepared = await prepareUpload(item.file, "PHOTO");
        const res = await fetch(`/api/families/${familyId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "PHOTO",
            albumId,
            fileData: prepared.dataUrl,
            title: item.file.name.replace(/\.[^.]+$/, "").slice(0, 100),
          }),
        });
        if (res.ok) ok += 1;
        else {
          const data = await res.json().catch(() => ({}));
          setError(data.error === "FILE_TOO_LARGE" ? t("errFileTooLarge") : t("error_generic"));
        }
      } catch {
        setError(t("errFileTooLarge"));
      }
      setDone((n) => n + 1);
    }
    setBusy(false);
    if (ok > 0) {
      onUploaded();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-bark-900">📤 {t("upload_title")}</h3>
          <button onClick={onClose} disabled={busy} className="rounded-lg p-2 text-bark-800/60 hover:bg-leaf-50 disabled:opacity-40">✕</button>
        </div>

        {/* Dropzone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="mt-4 cursor-pointer rounded-2xl border-2 border-dashed border-leaf-300 bg-leaf-50/60 p-8 text-center transition hover:border-leaf-500 hover:bg-leaf-50"
        >
          <div className="text-4xl">🖼️</div>
          <p className="mt-2 text-sm font-semibold text-bark-800">{t("drop_here")}</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />

        {/* Selected previews */}
        {pending.length > 0 && (
          <>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-bark-800/50">
              {t("selected_n")} ({pending.length})
            </p>
            <div className="scroll-thin mt-2 grid max-h-52 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
              {pending.map((item) => (
                <div key={item.key} className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-leaf-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  {!busy && (
                    <button
                      onClick={() => setPending((p) => p.filter((x) => x.key !== item.key))}
                      className="absolute end-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}

        {busy && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-leaf-100">
            <div
              className="h-full bg-leaf-500 transition-all"
              style={{ width: `${(done / Math.max(pending.length, 1)) * 100}%` }}
            />
          </div>
        )}

        <button
          onClick={uploadAll}
          disabled={!pending.length || busy}
          className="mt-4 w-full rounded-xl bg-leaf-600 py-3 font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
        >
          {busy ? `⏳ ${done}/${pending.length}` : `📤 ${t("upload_all")} (${pending.length})`}
        </button>
      </div>
    </div>
  );
}
