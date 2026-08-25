"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { PersonDTO } from "@/lib/tree-data";
import { prepareUpload } from "@/lib/upload-client";

type Album = {
  id: string;
  title: string;
  description: string | null;
  mediaCount: number;
  cover: string | null;
};

type Media = {
  id: string;
  albumId: string | null;
  kind: string;
  title: string | null;
  caption: string | null;
  mime: string;
  fileData: string;
  uploadedById: string;
  createdAt: string;
  personIds: string[];
};

export default function GalleryView({
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
  const [albums, setAlbums] = useState<Album[]>([]);
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [uploading, setUploading] = useState(0);
  const [lightbox, setLightbox] = useState<Media | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAlbums = useCallback(async () => {
    const res = await fetch(`/api/families/${familyId}/albums`);
    if (res.ok) setAlbums((await res.json()).albums);
  }, [familyId]);

  const loadMedia = useCallback(async (albumId: string) => {
    const res = await fetch(`/api/families/${familyId}/media?albumId=${albumId}`);
    if (res.ok) setMedia((await res.json()).media);
  }, [familyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/families/${familyId}/albums`);
      if (!cancelled && res.ok) {
        setAlbums((await res.json()).albums);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [familyId]);

  function openAlbumView(id: string | null) {
    setOpenAlbumId(id);
    setMedia([]);
  }

  async function createAlbum(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const res = await fetch(`/api/families/${familyId}/albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    if (res.ok) {
      setNewTitle("");
      setCreating(false);
      loadAlbums();
    }
  }

  async function deleteAlbum(id: string) {
    if (!window.confirm(t("deleteAlbumConfirm"))) return;
    await fetch(`/api/families/${familyId}/albums/${id}`, { method: "DELETE" });
    openAlbumView(null);
    loadAlbums();
  }

  async function upload(files: FileList | null) {
    if (!files?.length || !openAlbumId) return;
    setError("");
    for (const file of Array.from(files).slice(0, 20)) {
      setUploading((n) => n + 1);
      try {
        const prepared = await prepareUpload(file, "PHOTO");
        const res = await fetch(`/api/families/${familyId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "PHOTO",
            albumId: openAlbumId,
            fileData: prepared.dataUrl,
            title: prepared.name.replace(/\.[^.]+$/, "").slice(0, 100),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error === "FILE_TOO_LARGE" ? t("errFileTooLarge") : t("error_generic"));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setError(msg === "UNSUPPORTED_TYPE" ? t("errUnsupported") : t("errFileTooLarge"));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    loadMedia(openAlbumId);
    loadAlbums();
  }

  async function saveLightbox() {
    if (!lightbox) return;
    await fetch(`/api/media/${lightbox.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: lightbox.caption, personIds: lightbox.personIds }),
    });
    setLightbox(null);
    if (openAlbumId) loadMedia(openAlbumId);
  }

  async function deleteMedia(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    await fetch(`/api/media/${id}`, { method: "DELETE" });
    setLightbox(null);
    if (openAlbumId) loadMedia(openAlbumId);
    loadAlbums();
  }

  const openAlbum = useMemo(
    () => albums.find((a) => a.id === openAlbumId),
    [albums, openAlbumId]
  );

  if (openAlbumId && openAlbum) {
    return (
      <div className="flex-1 overflow-y-auto p-4 scroll-thin">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button onClick={() => setOpenAlbumId(null)} className="rounded-lg border border-leaf-200 px-3 py-1.5 text-sm font-bold text-leaf-700 hover:bg-leaf-50">
            ←
          </button>
          <h2 className="text-xl font-extrabold text-bark-900">{openAlbum.title}</h2>
          <span className="text-xs font-semibold text-bark-800/50">
            {openAlbum.mediaCount} 📸
          </span>
          {(isAdmin || true) && (
            <>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading > 0}
                className="ms-auto rounded-lg bg-leaf-600 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-700 disabled:opacity-60"
              >
                {uploading > 0 ? `⏳ ${t("uploading")} (${uploading})` : `+ ${t("uploadPhotos")}`}
              </button>
              {(isAdmin || openAlbum) && (
                <button
                  onClick={() => deleteAlbum(openAlbum.id)}
                  className="rounded-lg px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50"
                >
                  🗑
                </button>
              )}
            </>
          )}
        </div>
        {error && <p className="mb-3 text-sm font-semibold text-red-600">{error}</p>}

        {media.length === 0 ? (
          <EmptyHint />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {media.map((m) => (
              <button
                key={m.id}
                onClick={() => setLightbox(m)}
                className="group relative aspect-square overflow-hidden rounded-2xl ring-1 ring-leaf-100 transition hover:shadow-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.fileData} alt={m.title ?? ""} className="h-full w-full object-cover" />
                {m.personIds.length > 0 && (
                  <span className="absolute bottom-1.5 start-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                    👤 {m.personIds.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {lightbox && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
            <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-4 scroll-thin" onClick={(e) => e.stopPropagation()}>
              {lightbox.mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lightbox.fileData} alt="" className="max-h-[55vh] w-full rounded-2xl object-contain bg-gray-50" />
              ) : (
                <a href={lightbox.fileData} target="_blank" rel="noreferrer" className="block rounded-2xl bg-gray-50 p-8 text-center font-bold text-leaf-700 underline">
                  📄 {lightbox.title || "PDF"}
                </a>
              )}

              <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-bark-800/50">{t("captionLabel")}</label>
              <textarea
                value={lightbox.caption ?? ""}
                onChange={(e) => setLightbox({ ...lightbox, caption: e.target.value })}
                rows={2}
                maxLength={300}
                className="mt-1 w-full resize-none rounded-lg border border-leaf-200 px-3 py-2 text-sm outline-none focus:border-leaf-500"
              />

              <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-bark-800/50">
                👤 {t("tagPeople")}
              </label>
              <div className="mt-1.5 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-leaf-50/60 p-2 scroll-thin">
                {persons.map((p) => {
                  const on = lightbox.personIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() =>
                        setLightbox({
                          ...lightbox,
                          personIds: on
                            ? lightbox.personIds.filter((x) => x !== p.id)
                            : [...lightbox.personIds, p.id],
                        })
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        on ? "bg-leaf-600 text-white" : "bg-white text-bark-800 ring-1 ring-leaf-200 hover:bg-leaf-100"
                      }`}
                    >
                      {p.firstName} {p.lastName ?? ""}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button onClick={saveLightbox} className="flex-1 rounded-lg bg-leaf-600 py-2.5 font-bold text-white hover:bg-leaf-700">
                  {t("saveChanges")}
                </button>
                {(isAdmin || lightbox.uploadedById === me.id) && (
                  <button onClick={() => deleteMedia(lightbox.id)} className="rounded-lg px-4 py-2.5 font-bold text-red-500 hover:bg-red-50">
                    🗑 {t("delete")}
                  </button>
                )}
                <button onClick={() => setLightbox(null)} className="rounded-lg border border-leaf-200 px-4 py-2.5 font-semibold text-bark-800 hover:bg-leaf-50">
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 scroll-thin">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold text-bark-900">📸 {t("photos_title")}</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="ms-auto rounded-lg bg-leaf-600 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-700"
        >
          {t("newAlbum")}
        </button>
      </div>

      {creating && (
        <form onSubmit={createAlbum} className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-leaf-200 bg-white p-4">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("albumName")} required className="min-w-48 flex-1 rounded-lg border border-leaf-200 px-3 py-2 text-sm outline-none focus:border-leaf-500" />
          <button className="rounded-lg bg-leaf-600 px-5 py-2 text-sm font-bold text-white hover:bg-leaf-700">{t("add")}</button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-bark-800/50">{t("loading")}</p>
      ) : albums.length === 0 ? (
        <EmptyHint />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {albums.map((a) => (
            <button
              key={a.id}
              onClick={() => openAlbumView(a.id)}
              className="overflow-hidden rounded-2xl bg-white text-start shadow-sm ring-1 ring-leaf-100 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="aspect-video bg-leaf-50">
                {a.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl text-leaf-300">🖼️</div>
                )}
              </div>
              <div className="p-3">
                <h3 className="truncate font-bold text-bark-900">{a.title}</h3>
                <p className="mt-0.5 text-xs font-semibold text-bark-800/50">{a.mediaCount} 📸</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyHint() {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border-2 border-dashed border-leaf-200 bg-white/60 p-12 text-center">
      <div className="text-4xl">🖼️</div>
      <p className="mt-3 font-semibold text-bark-800">{t("noMediaYet")}</p>
    </div>
  );
}
