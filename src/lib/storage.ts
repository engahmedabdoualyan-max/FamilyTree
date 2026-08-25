import { prisma } from "@/lib/prisma";

/** Free plan storage budget: 450MB (leaves headroom under Neon's 0.5GB). */
export const STORAGE_LIMIT_BYTES = 450 * 1024 * 1024;
export const SOFT_LIMIT_RATIO = 0.8;

export type StorageUsage = {
  usedBytes: number;
  limitBytes: number;
  percent: number;
  softExceeded: boolean;
  hardExceeded: boolean;
  byKind: { photos: number; docs: number; voices: number; avatars: number };
};

/**
 * Estimates stored bytes for a family from base64 TEXT columns.
 * base64 length ≈ bytes × 4/3, so bytes ≈ chars × 3/4.
 */
export async function getFamilyUsage(familyId: string): Promise<StorageUsage> {
  const [photos, docs, voices, avatars] = await Promise.all([
    prisma.$queryRaw<{ b: bigint | null }[]>`SELECT COALESCE(SUM(LENGTH("fileData")),0) as b FROM "MediaAsset" WHERE "familyId"=${familyId} AND kind='PHOTO'`,
    prisma.$queryRaw<{ b: bigint | null }[]>`SELECT COALESCE(SUM(LENGTH("fileData")),0) as b FROM "MediaAsset" WHERE "familyId"=${familyId} AND kind='DOC'`,
    prisma.$queryRaw<{ b: bigint | null }[]>`SELECT COALESCE(SUM(LENGTH("dataUrl")),0) as b FROM "PersonVoice" pv JOIN "Person" p ON p.id=pv."personId" WHERE p."familyId"=${familyId}`,
    prisma.$queryRaw<{ b: bigint | null }[]>`SELECT COALESCE(SUM(LENGTH("photo")),0) as b FROM "Person" WHERE "familyId"=${familyId} AND "photo" IS NOT NULL`,
  ]);
  const toBytes = (r: { b: bigint | null } | undefined) =>
    Math.round(Number(r?.b ?? 0) * 0.75);
  const byKind = {
    photos: toBytes(photos[0]),
    docs: toBytes(docs[0]),
    voices: toBytes(voices[0]),
    avatars: toBytes(avatars[0]),
  };
  const usedBytes = byKind.photos + byKind.docs + byKind.voices + byKind.avatars;
  const percent = Math.min(100, Math.round((usedBytes / STORAGE_LIMIT_BYTES) * 100));
  return {
    usedBytes,
    limitBytes: STORAGE_LIMIT_BYTES,
    percent,
    softExceeded: usedBytes >= STORAGE_LIMIT_BYTES * SOFT_LIMIT_RATIO,
    hardExceeded: usedBytes >= STORAGE_LIMIT_BYTES,
    byKind,
  };
}

/** Returns error message key if upload should be blocked, else null. */
export async function checkUploadAllowance(
  familyId: string,
  incomingBytes: number
): Promise<string | null> {
  const usage = await getFamilyUsage(familyId);
  if (usage.hardExceeded || usage.usedBytes + incomingBytes > usage.limitBytes) {
    return "STORAGE_FULL";
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
