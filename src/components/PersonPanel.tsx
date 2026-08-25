"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { PersonDTO, SpouseLinkDTO } from "@/lib/tree-data";
import PersonForm, {
  emptyForm,
  personToForm,
  type PersonFormValues,
} from "./PersonForm";
import CommentsSection from "./CommentsSection";
import MediaThumbs from "./MediaThumbs";
import { Avatar } from "./TreeCanvas";

export type AddRelation =
  | { kind: "root" }
  | { kind: "father"; personId: string }
  | { kind: "mother"; personId: string }
  | { kind: "spouse"; personId: string }
  | {
      kind: "child";
      personId: string;
      fatherId?: string | null;
      motherId?: string | null;
    };

type Common = {
  persons: PersonDTO[];
  spouseLinks: SpouseLinkDTO[];
  me: { id: string; name?: string | null; image?: string | null };
};

type Props =
  | ({
      mode?: { kind: "view" };
      person: PersonDTO;
      canDelete: boolean;
      onClose: () => void;
      onDeleted: () => void;
      onChanged: () => void;
      onAddRelation: (rel: AddRelation) => void;
    } & Common)
  | ({
      mode: { kind: "add"; relation: AddRelation };
      familyId: string;
      onClose: () => void;
      onCreated: (id: string) => void;
    } & Common);

export default function PersonPanel(props: Props) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={props.onClose} />
      <aside className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md flex-col border-s border-leaf-100 bg-white shadow-2xl sm:top-14">
        {props.mode?.kind === "add" ? (
          <AddPanel {...(props as Extract<Props, { mode: { kind: "add" } }>)} />
        ) : (
          <ViewPanel {...(props as Extract<Props, { mode?: { kind: "view" } }>)} />
        )}
      </aside>
    </>
  );
}

function fullName(p: PersonDTO) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}

/* ------------------------------ VIEW MODE ------------------------------ */

function ViewPanel({
  person,
  persons,
  spouseLinks,
  canDelete,
  me,
  onClose,
  onDeleted,
  onChanged,
  onAddRelation,
}: Extract<Props, { mode?: { kind: "view" } }>) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"info" | "chat">("info");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PersonFormValues>(() => personToForm(person));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  const spouseIds = useMemo(() => {
    const out: string[] = [];
    for (const l of spouseLinks) {
      if (l.aId === person.id) out.push(l.bId);
      else if (l.bId === person.id) out.push(l.aId);
    }
    return [...new Set(out)].filter((id) => byId.has(id));
  }, [spouseLinks, person.id, byId]);

  const father = person.fatherId ? byId.get(person.fatherId) : undefined;
  const mother = person.motherId ? byId.get(person.motherId) : undefined;
  const spouses = spouseIds.map((id) => byId.get(id)!).filter(Boolean);
  const children = persons.filter((p) => p.fatherId === person.id || p.motherId === person.id);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await fetch(`/api/persons/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      onChanged();
    } else {
      setError(t("error_generic"));
    }
  }

  async function deletePerson() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setBusy(true);
    const res = await fetch(`/api/persons/${person.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onDeleted();
    else if (res.status === 400) window.alert(t("deleteBlocked"));
    else setError(t("error_generic"));
  }

  async function unlinkSpouse(spouseId: string) {
    await fetch(`/api/persons/${person.id}/spouse?spouseId=${spouseId}`, { method: "DELETE" });
    onChanged();
  }

  const hasAnyDetail =
    person.birthDate ||
    person.deathDate ||
    person.birthPlace ||
    person.occupation ||
    person.bio;

  return (
    <>
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-leaf-100 p-4 pb-3">
        <Avatar person={person} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-extrabold leading-tight text-bark-900">
            {fullName(person)}
          </h2>
          {person.nickname && (
            <p className="text-xs font-semibold italic text-bark-800/60">
              &quot;{person.nickname}&quot;
            </p>
          )}
          <p className="mt-1 text-xs text-bark-800/60">
            {t(
              person.gender === "MALE" ? "male" : person.gender === "FEMALE" ? "female" : "other"
            )}
            {person.familyName && ` · ${t("external_family")} ${person.familyName}`}
            {person.isDeceased && " · 🕊️ " + t("deceased")}
          </p>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-bark-800/50 hover:bg-leaf-50">
          ✕
        </button>
      </div>

      {/* Tabs */}
      {!editing && (
        <div className="flex border-b border-leaf-100 text-sm font-bold">
          <button
            onClick={() => setTab("info")}
            className={`flex-1 py-2.5 ${
              tab === "info"
                ? "border-b-2 border-leaf-600 text-leaf-700"
                : "text-bark-800/50 hover:text-bark-800"
            }`}
          >
            👤 {t("info")}
          </button>
          <button
            onClick={() => setTab("chat")}
            className={`flex-1 py-2.5 ${
              tab === "chat"
                ? "border-b-2 border-leaf-600 text-leaf-700"
                : "text-bark-800/50 hover:text-bark-800"
            }`}
          >
            💬 {t("discussion")}
          </button>
        </div>
      )}

      <div className="scroll-thin flex-1 overflow-y-auto p-4">
        {editing ? (
          <PersonForm
            key={`edit-${person.id}`}
            values={form}
            onChange={setForm}
            onSubmit={saveEdit}
            onCancel={() => setEditing(false)}
            submitLabel={t("save")}
            busy={busy}
          />
        ) : tab === "chat" ? (
          <CommentsSection personId={person.id} meId={me.id} />
        ) : (
          <div className="space-y-5">
            {/* Details */}
            {hasAnyDetail && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail label={t("birthDate")} value={person.birthDate} ltr />
                <Detail label={t("deathDate")} value={person.deathDate} ltr />
                <Detail label={t("birthPlace")} value={person.birthPlace} />
                <Detail label={t("occupation")} value={person.occupation} />
              </dl>
            )}
            {!hasAnyDetail && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-200">
                ❓ {t("noDates")}{" "}
                <button onClick={() => setTab("chat")} className="font-bold underline">
                  {t("discussion")} →
                </button>
              </p>
            )}
            {person.bio && (
              <div>
                <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-bark-800/50">
                  {t("bio")}
                </h4>
                <p className="whitespace-pre-wrap rounded-xl bg-leaf-50/70 p-3 text-sm leading-relaxed text-bark-800 ring-1 ring-leaf-100">
                  {person.bio}
                </p>
              </div>
            )}

            {/* Relations */}
            <section>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-bark-800/50">
                👪 {t("settings_members")}
              </h4>
              <div className="space-y-2 text-sm">
                <RelationChip
                  icon={person.gender === "FEMALE" ? "👩" : "👨"}
                  label={t("addFather")}
                  person={father}
                  onAdd={
                    person.familyName || !canDeleteAndEdit()
                      ? undefined
                      : () =>
                          onAddRelation({ kind: "father", personId: person.id })
                  }
                />
                <RelationChip
                  icon="👩"
                  label={t("addMother")}
                  person={mother}
                  onAdd={
                    person.familyName
                      ? undefined
                      : () => onAddRelation({ kind: "mother", personId: person.id })
                  }
                />

                {spouses.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-leaf-100"
                  >
                    <span className="flex-1 truncate">💍 {fullName(s)}</span>
                    {s.familyName && (
                      <span className="text-[11px] italic text-amber-700">{s.familyName}</span>
                    )}
                    {!person.familyName && (
                      <button
                        onClick={() => unlinkSpouse(s.id)}
                        title={t("remove")}
                        className="text-xs text-red-400 hover:text-red-600 hover:underline"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {!spouses.length && !person.familyName && (
                  <button
                    onClick={() => onAddRelation({ kind: "spouse", personId: person.id })}
                    className="w-full rounded-xl border-2 border-dashed border-leaf-200 py-2.5 text-sm font-bold text-leaf-700 transition hover:border-leaf-400 hover:bg-leaf-50"
                  >
                    + 💍 {t("addSpouse")}
                  </button>
                )}

                {children.length > 0 && (
                  <div className="rounded-xl bg-leaf-50/70 p-2.5 ring-1 ring-leaf-100">
                    <span className="text-xs font-bold text-bark-800/60">
                      👶 {children.length} {t("persons")}
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {children.map((c) => (
                        <span
                          key={c.id}
                          className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold ring-1 ring-leaf-200"
                        >
                          {c.firstName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {!person.familyName &&
                  (() => {
                    const maleSpouse = spouses.find((s) => s.gender === "MALE") ?? null;
                    const femaleSpouse = spouses.find((s) => s.gender === "FEMALE") ?? null;
                    return (
                      <button
                        onClick={() =>
                          onAddRelation({
                            kind: "child",
                            personId: person.id,
                            fatherId:
                              person.gender === "MALE" ? person.id : maleSpouse?.id ?? null,
                            motherId:
                              person.gender === "FEMALE" ? person.id : femaleSpouse?.id ?? null,
                          })
                        }
                        className="w-full rounded-xl border-2 border-dashed border-leaf-200 py-2.5 text-sm font-bold text-leaf-700 transition hover:border-leaf-400 hover:bg-leaf-50"
                      >
                        + 👶 {t("addChild")}
                      </button>
                    );
                  })()}
              </div>
            </section>

            {person.familyId && (
              <MediaThumbs familyId={person.familyId} personId={person.id} />
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 border-t border-leaf-100 pt-4">
              <button
                onClick={() => {
                  setForm(personToForm(person));
                  setEditing(true);
                }}
                disabled={!!person.familyName}
                title={person.familyName ? t("external_family") + " " + person.familyName : t("edit")}
                className="rounded-lg border border-leaf-300 px-4 py-2 text-sm font-bold text-leaf-700 hover:bg-leaf-50 disabled:opacity-40"
              >
                ✏️ {t("edit")}
              </button>
              {canDelete && !person.familyName && (
                <button
                  onClick={deletePerson}
                  disabled={busy}
                  className="rounded-lg px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 disabled:opacity-50"
                >
                  🗑 {t("delete")}
                </button>
              )}
            </div>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          </div>
        )}
      </div>
    </>
  );

  function canDeleteAndEdit() {
    return true;
  }
}

function Detail({ label, value, ltr }: { label: string; value: string | null; ltr?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-bark-800/45">{label}</dt>
      <dd dir={ltr ? "ltr" : undefined} className="mt-0.5 font-semibold text-bark-900">
        {value}
      </dd>
    </div>
  );
}

function RelationChip({
  icon,
  label,
  person,
  onAdd,
}: {
  icon: string;
  label: string;
  person?: PersonDTO | null;
  onAdd?: () => void;
}) {
  if (person) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-leaf-100">
        <span className="flex-1 truncate">
          {icon} {label.split(" ")[0]}: {person.firstName} {person.lastName ?? ""}
        </span>
      </div>
    );
  }
  if (!onAdd) return null;
  return (
    <button
      onClick={onAdd}
      className="w-full rounded-xl border-2 border-dashed border-leaf-200 py-2.5 text-start px-3 text-sm font-bold text-leaf-700 transition hover:border-leaf-400 hover:bg-leaf-50"
    >
      + {icon} {label}
    </button>
  );
}

/* ------------------------------- ADD MODE ------------------------------- */

function AddPanel({
  mode,
  familyId,
  persons,
  onClose,
  onCreated,
}: Extract<Props, { mode: { kind: "add" } }>) {
  const { t } = useI18n();
  const relation = mode.relation;
  const target = "personId" in relation ? persons.find((p) => p.id === relation.personId) : null;

  function initialValues(): PersonFormValues {
    const v = emptyForm("MALE");
    if (relation.kind === "mother") v.gender = "FEMALE";
    if (relation.kind === "spouse" && target)
      v.gender = target.gender === "MALE" ? "FEMALE" : "MALE";
    if (target && relation.kind !== "root" && target.lastName) v.lastName = target.lastName;
    return v;
  }

  const [form, setForm] = useState<PersonFormValues>(initialValues);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<
    { id: string; firstName: string; lastName: string | null; familyName: string }[]
  >([]);

  async function searchPersons(q: string) {
    setSearch(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(
      `/api/persons/search?q=${encodeURIComponent(q)}&excludeFamily=${familyId}`
    );
    if (res.ok) {
      const data = await res.json();
      setResults(data.persons.slice(0, 8));
    }
  }

  async function linkExisting(spouseId: string) {
    if (relation.kind !== "spouse") return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/persons/${relation.personId}/spouse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spouseId }),
    });
    setBusy(false);
    if (res.ok) onCreated(relation.personId);
    else setError(t("error_generic"));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const payload: Record<string, unknown> = { ...form };
      if (relation.kind === "root") payload.isRoot = true;
      if (relation.kind === "spouse") payload.spouseOfId = relation.personId;
      if (relation.kind === "child") {
        if (relation.fatherId) payload.fatherId = relation.fatherId;
        if (relation.motherId) payload.motherId = relation.motherId;
      }

      let createdId: string | null = null;

      if (relation.kind === "father" || relation.kind === "mother") {
        // create parent first, then attach to the child
        const res = await fetch(`/api/families/${familyId}/persons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const { person: parent } = await res.json();
        createdId = parent.id;
        const patch = await fetch(`/api/persons/${relation.personId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            relation.kind === "father" ? { fatherId: parent.id } : { motherId: parent.id }
          ),
        });
        if (!patch.ok) throw new Error();
      } else {
        const res = await fetch(`/api/families/${familyId}/persons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(
            err.error === "NAME_AND_GENDER_REQUIRED" ? t("error_required") : t("error_generic")
          );
          setBusy(false);
          return;
        }
        const { person } = await res.json();
        createdId = person.id;
      }

      if (createdId) onCreated(createdId);
    } catch {
      setError(t("error_generic"));
    } finally {
      setBusy(false);
    }
  }

  const titleByKind: Record<AddRelation["kind"], string> = {
    root: t("tree_addPerson"),
    father: t("addFather"),
    mother: t("addMother"),
    spouse: t("addSpouse"),
    child: t("addChild"),
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-leaf-100 p-4">
        <h2 className="text-lg font-extrabold text-bark-900">
          + {titleByKind[relation.kind]}
          {target && (
            <span className="text-sm font-semibold text-bark-800/60"> — {target.firstName}</span>
          )}
        </h2>
        <button onClick={onClose} className="rounded-lg p-2 text-bark-800/50 hover:bg-leaf-50">
          ✕
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto p-4">
        {relation.kind === "spouse" && (
          <div className="mb-5">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-bark-800/50">
              🔗 {t("linkExistingSpouse")}
            </h4>
            <input
              value={search}
              onChange={(e) => searchPersons(e.target.value)}
              placeholder={`${t("selectPerson")}…`}
              className="w-full rounded-lg border border-leaf-200 px-3 py-2 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200"
            />
            <div className="mt-2 space-y-1.5">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => linkExisting(r.id)}
                  disabled={busy}
                  className="flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2 text-start text-sm ring-1 ring-leaf-200 transition hover:bg-leaf-50 disabled:opacity-50"
                >
                  <span className="flex-1 truncate font-semibold">
                    {r.firstName} {r.lastName ?? ""}
                  </span>
                  <span className="text-xs italic text-amber-700">{r.familyName}</span>
                </button>
              ))}
            </div>
            <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase text-bark-800/40">
              <span className="h-px flex-1 bg-leaf-100" />
              {t("signin_or")}
              <span className="h-px flex-1 bg-leaf-100" />
            </div>
          </div>
        )}

        <PersonForm
          key={`add-${relation.kind}-${"personId" in relation ? relation.personId : ""}`}
          values={form}
          onChange={setForm}
          onSubmit={submit}
          onCancel={onClose}
          submitLabel={t("add")}
          busy={busy}
        />
        {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </>
  );
}
