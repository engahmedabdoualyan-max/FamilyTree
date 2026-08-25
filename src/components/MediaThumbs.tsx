"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Media = { id: string; fileData: string; mime: string; caption: string | null };

export default function MediaThumbs({
  familyId,
  personId,
}: {
  familyId: string;
  personId: string;
}) {
  const { t } = useI18n();
  const [media, setMedia] = useState<Media[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/families/${familyId}/media?personId=${personId}`);
      if (!cancelled && res.ok) {
        setMedia((await res.json()).media);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [familyId, personId]);

  if (!media?.length) return null;

  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-bark-800/50">
        📸 {t("tab_photos")} ({media.length})
      </h4>
      <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
        {media.map((m) => (
          <a
            key={m.id}
            href={m.fileData}
            target="_blank"
            rel="noreferrer"
            title={m.caption ?? ""}
            className="h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-leaf-200 transition hover:ring-leaf-500"
          >
            {m.mime.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.fileData} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-leaf-50 text-xl">📄</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
