"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { PersonDTO } from "@/lib/tree-data";
import UploadModal from "./UploadModal";

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
  visibility?: string;
  viewerIds?: string[];
  likesCount?: number;
  commentsCount?: number;
  likedByMe?: boolean;
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
    const [lightbox, setLightbox] = useState<Media | null>(null);
  const [memberOptions, setMemberOptions] = useState<{ userId: string; name: string | null }[]>([]);

  useEffect(() => {
    if (!lightbox) return;
    (async () => {
      const res = await fetch(`/api/families/${familyId}/members`);
      if (res.ok) setMemberOptions((await res.json()).members);
    })();
  }, [lightbox?.id, familyId]); // eslint-disable-line react-hooks/exhaustive-deps
    
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

  async function saveLightbox() {
    if (!lightbox) return;
    await fetch(`/api/media/${lightbox.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: lightbox.caption,
        personIds: lightbox.personIds,
        visibility: lightbox.visibility ?? "FAMILY",
        viewerIds: lightbox.viewerIds ?? [],
      }),
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
          <button
            onClick={() => setUploadOpen(true)}
            className="ms-auto rounded-lg bg-leaf-600 px-4 py-2 text-sm font-bold text-white hover:bg-leaf-700"
          >
            📤 {t("uploadPhotos")}
          </button>
          <button
            onClick={() => deleteAlbum(openAlbum.id)}
            className="rounded-lg px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50"
          >
            🗑
          </button>
        </div>
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
                {m.visibility === "PRIVATE" && (
                  <span className="absolute top-1.5 start-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">🔒</span>
                )}
                {m.visibility === "CUSTOM" && (
                  <span className="absolute top-1.5 start-1.5 rounded-full bg-sky-500/80 px-2 py-0.5 text-[10px] font-bold text-white">👥</span>
                )}
              </button>
            ))}
          </div>
        )}

        {uploadOpen && (
          <UploadModal
            familyId={familyId}
            albumId={openAlbumId}
            me={me}
            onClose={() => setUploadOpen(false)}
            onUploaded={() => {
              loadMedia(openAlbumId);
              loadAlbums();
            }}
          />
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

              {/* Visibility */}
              {(lightbox.uploadedById === me.id || isAdmin) && (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-bark-800/50">🔒 مين يشوفها؟</p>
                  <div className="flex gap-1.5">
                    {([
                      ["FAMILY", "👨‍👩‍👧 الكل"],
                      ["PRIVATE", "🔒 أنا"],
                      ["CUSTOM", "👥 محددين"],
                    ] as const).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() =>
                          setLightbox({ ...lightbox, visibility: k, viewerIds: k === "CUSTOM" ? lightbox.viewerIds ?? [] : [] })
                        }
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${
                          (lightbox.visibility ?? "FAMILY") === k
                            ? "border-leaf-600 bg-leaf-600 text-white"
                            : "border-leaf-200 bg-white text-bark-800 hover:bg-leaf-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {(lightbox.visibility ?? "FAMILY") === "CUSTOM" && (
                    <div className="scroll-thin mt-2 max-h-28 space-y-1 overflow-y-auto rounded-xl bg-leaf-50/60 p-2">
                      {persons.map((p) => {
                        void p;
                        return null;
                      })}
                      {memberOptions.map((m) => {
                        const on = lightbox.viewerIds?.includes(m.userId);
                        return (
                          <button
                            key={m.userId}
                            onClick={() =>
                              setLightbox({
                                ...lightbox,
                                viewerIds: on
                                  ? (lightbox.viewerIds ?? []).filter((x) => x !== m.userId)
                                  : [...(lightbox.viewerIds ?? []), m.userId],
                              })
                            }
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-semibold transition ${
                              on ? "bg-leaf-600 text-white" : "bg-white hover:bg-leaf-100"
                            }`}
                          >
                            <span>{on ? "☑" : "☐"}</span> {m.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <MediaSocial media={lightbox} />

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


type MComment = {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
};

function MediaSocial({ media }: { media: Media }) {
  const { t } = useI18n();
  const [likes, setLikes] = useState(media.likesCount ?? 0);
  const [likedByMe, setLikedByMe] = useState(!!media.likedByMe);
  const [comments, setComments] = useState<MComment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/media/${media.id}/comments`);
      if (!cancelled && res.ok) setComments((await res.json()).comments);
    })();
    return () => {
      cancelled = true;
    };
  }, [media.id]);

  async function toggleLike() {
    setLikes((n) => n + (likedByMe ? -1 : 1));
    setLikedByMe(!likedByMe);
    await fetch(`/api/media/${media.id}/like`, { method: "POST" });
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/media/${media.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setBusy(false);
    if (res.ok) {
      const { comment } = await res.json();
      setComments((c) => [...(c ?? []), comment]);
      setText("");
    }
  }

  async function share() {
    const shareData = {
      title: media.title || t("photos_title"),
      text: (media.caption || media.title || "") + " — " + t("appName"),
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
      } catch {}
    }
  }

  function download() {
    const a = document.createElement("a");
    a.href = media.fileData;
    a.download = media.title || "photo.jpg";
    a.click();
  }

  return (
    <div className="mt-4 border-t border-leaf-100 pt-3">
      {/* Actions row */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition ${
            likedByMe ? "bg-red-50 text-red-500 ring-1 ring-red-200" : "bg-gray-50 text-bark-800 ring-1 ring-gray-200 hover:bg-red-50"
          }`}
        >
          {likedByMe ? "❤️" : "🤍"} {likes}
        </button>
        <span className="rounded-full bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-600 ring-1 ring-sky-100">
          💬 {comments?.length ?? media.commentsCount ?? 0}
        </span>
        <button onClick={share} className="ms-auto rounded-full bg-leaf-50 px-3 py-1.5 text-sm font-bold text-leaf-700 ring-1 ring-leaf-200 hover:bg-leaf-100">
          ↗ {t("share_btn")}
        </button>
        <button onClick={download} className="rounded-full bg-leaf-50 px-3 py-1.5 text-sm font-bold text-leaf-700 ring-1 ring-leaf-200 hover:bg-leaf-100">
          ⬇ {t("download_btn")}
        </button>
      </div>

      {/* Comments */}
      <div className="mt-3 space-y-2">
        {comments === null ? (
          <p className="text-xs text-bark-800/40">{t("loading")}</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-leaf-200 text-[10px] font-bold text-leaf-800">
                {(c.user.name ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <p className="rounded-xl bg-leaf-50/70 px-3 py-1.5 text-xs leading-relaxed text-bark-900 ring-1 ring-leaf-100">
                <b>{c.user.name}</b> {c.text}
              </p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={sendComment} className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("comment_placeholder")}
          maxLength={1000}
          className="flex-1 rounded-full border border-leaf-200 px-3.5 py-2 text-xs outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200"
        />
        <button
          disabled={busy || !text.trim()}
          className="rounded-full bg-leaf-600 px-4 py-2 text-xs font-bold text-white hover:bg-leaf-700 disabled:opacity-50"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
