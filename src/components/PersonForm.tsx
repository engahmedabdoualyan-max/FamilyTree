"use client";

import { useI18n } from "@/lib/i18n";
import type { PersonDTO } from "@/lib/tree-data";
import PhotoInput from "./PhotoInput";

export type PersonFormValues = {
  firstName: string;
  lastName: string;
  nickname: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  photo: string | null;
  birthDate: string;
  deathDate: string;
  birthPlace: string;
  occupation: string;
  bio: string;
  isDeceased: boolean;
};

export function emptyForm(gender: PersonFormValues["gender"] = "MALE"): PersonFormValues {
  return {
    firstName: "",
    lastName: "",
    nickname: "",
    gender,
    photo: null,
    birthDate: "",
    deathDate: "",
    birthPlace: "",
    occupation: "",
    bio: "",
    isDeceased: false,
  };
}

export function personToForm(p: PersonDTO): PersonFormValues {
  return {
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    nickname: p.nickname ?? "",
    gender: (p.gender as PersonFormValues["gender"]) || "OTHER",
    photo: p.photo,
    birthDate: p.birthDate ?? "",
    deathDate: p.deathDate ?? "",
    birthPlace: p.birthPlace ?? "",
    occupation: p.occupation ?? "",
    bio: p.bio ?? "",
    isDeceased: p.isDeceased,
  };
}

export default function PersonForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
}: {
  values: PersonFormValues;
  onChange: (v: PersonFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const set = <K extends keyof PersonFormValues>(k: K, v: PersonFormValues[K]) =>
    onChange({ ...values, [k]: v });

  const inputCls =
    "w-full rounded-lg border border-leaf-200 bg-white px-3 py-2 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <PhotoInput value={values.photo} onChange={(v) => set("photo", v)} />

      <div>
        <label className="mb-1 block text-xs font-bold text-bark-800">{t("firstName")} *</label>
        <input
          value={values.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          required
          maxLength={60}
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-bark-800">{t("lastName")}</label>
          <input
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            maxLength={60}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-bark-800">{t("nickname")}</label>
          <input
            value={values.nickname}
            onChange={(e) => set("nickname", e.target.value)}
            maxLength={60}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-bold text-bark-800">{t("gender")} *</label>
        <div className="flex gap-2">
          {(["MALE", "FEMALE", "OTHER"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => set("gender", g)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                values.gender === g
                  ? "border-leaf-600 bg-leaf-600 text-white"
                  : "border-leaf-200 bg-white text-bark-800 hover:bg-leaf-50"
              }`}
            >
              {t(g.toLowerCase() as "male" | "female" | "other")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-bark-800">{t("birthDate")}</label>
          <input
            value={values.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
            placeholder="1945 / 1950-03"
            maxLength={20}
            dir="ltr"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-bark-800">{t("deathDate")}</label>
          <input
            value={values.deathDate}
            onChange={(e) => set("deathDate", e.target.value)}
            placeholder="1998"
            maxLength={20}
            dir="ltr"
            disabled={!values.isDeceased && !values.deathDate ? false : !values.isDeceased}
            className={`${inputCls} disabled:cursor-not-allowed disabled:bg-gray-100`}
          />
        </div>
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-bark-800">
        <input
          type="checkbox"
          checked={values.isDeceased}
          onChange={(e) => {
            const checked = e.target.checked;
            onChange({ ...values, isDeceased: checked, deathDate: checked ? values.deathDate : "" });
          }}
          className="h-4 w-4 accent-[#257d53]"
        />
        🕊️ {t("deceased")}
      </label>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-bark-800">{t("birthPlace")}</label>
          <input
            value={values.birthPlace}
            onChange={(e) => set("birthPlace", e.target.value)}
            maxLength={120}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-bark-800">{t("occupation")}</label>
          <input
            value={values.occupation}
            onChange={(e) => set("occupation", e.target.value)}
            maxLength={120}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-bold text-bark-800">{t("bio")}</label>
        <textarea
          value={values.bio}
          onChange={(e) => set("bio", e.target.value)}
          rows={3}
          maxLength={2000}
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="mt-1 flex gap-2">
        <button
          disabled={busy}
          className="flex-1 rounded-lg bg-leaf-600 px-4 py-2.5 font-bold text-white hover:bg-leaf-700 disabled:opacity-60"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-leaf-200 px-4 py-2.5 font-semibold text-bark-800 hover:bg-leaf-50"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
