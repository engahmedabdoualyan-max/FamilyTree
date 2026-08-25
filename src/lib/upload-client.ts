"use client";

export type PreparedFile = {
  dataUrl: string;
  mime: string;
  name: string;
  size: number;
};

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Downscale an image file in the browser before upload. */
export async function prepareImage(
  file: File,
  maxDim = 1280,
  quality = 0.82
): Promise<PreparedFile> {
  const raw = await readAsDataUrl(file);
  try {
    const img = await loadImage(raw);
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no ctx");
    ctx.drawImage(img, 0, 0, w, h);
    const out = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl: out, mime: "image/jpeg", name: file.name, size: Math.round(out.length * 0.75) };
  } catch {
    // not a decodable image — keep original if small enough
    return { dataUrl: raw, mime: file.type || "application/octet-stream", name: file.name, size: file.size };
  }
}

/** Prepare any upload: images get downscaled, PDFs pass through (size-capped). */
export async function prepareUpload(file: File, kind: "PHOTO" | "DOC"): Promise<PreparedFile> {
  const capMb = kind === "DOC" ? 4.5 : 4.5;
  if (file.type === "application/pdf") {
    if (file.size > capMb * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
    const dataUrl = await readAsDataUrl(file);
    return { dataUrl, mime: "application/pdf", name: file.name, size: file.size };
  }
  if (!file.type.startsWith("image/")) throw new Error("UNSUPPORTED_TYPE");
  return prepareImage(file, kind === "DOC" ? 1600 : 1280, kind === "DOC" ? 0.85 : 0.82);
}
