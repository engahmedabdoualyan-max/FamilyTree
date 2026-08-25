"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { FamilyTreeData } from "@/lib/tree-data";
import TreeCanvas, { type SelectedInfo } from "./TreeCanvas";
import PersonPanel, { type AddRelation } from "./PersonPanel";
import InvitePopover from "./InvitePopover";

export default function FamilyWorkspace({
  treeData,
  me,
  myRole,
}: {
  treeData: FamilyTreeData;
  me: { id: string; name?: string | null; image?: string | null };
  myRole: string;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<FamilyTreeData>(treeData);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"view" | "add">("view");
  const [addRelation, setAddRelation] = useState<AddRelation | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toast, setToast] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/families/${treeData.family.id}/persons`);
    if (res.ok) setData(await res.json());
  }, [treeData.family.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const selected = useMemo(
    () => data.persons.find((p) => p.id === selectedId) ?? null,
    [data.persons, selectedId]
  );

  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";

  function openAdd(rel: AddRelation) {
    setAddRelation(rel);
    setPanelMode("add");
  }

  function openView(personId: string) {
    setSelectedId(personId);
    setPanelMode("view");
  }

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Sub-header */}
      <div className="z-30 flex flex-wrap items-center gap-2 border-b border-leaf-100 bg-white px-4 py-2.5">
        <Link
          href="/dashboard"
          className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-leaf-700 hover:bg-leaf-50"
        >
          ← {t("back_to_dashboard")}
        </Link>
        <div className="mx-1 hidden h-6 w-px bg-leaf-100 sm:block" />
        <h1 className="truncate text-lg font-extrabold text-bark-900">{data.family.name}</h1>

        <div className="ms-auto flex items-center gap-2">
          <button
            onClick={() => setInviteOpen(!inviteOpen)}
            className="rounded-lg border border-leaf-300 bg-white px-3 py-1.5 text-sm font-bold text-leaf-700 hover:bg-leaf-50"
          >
            ✉️ {t("invite_title").split(" ")[0]}
          </button>
          <Link
            href={`/family/${data.family.id}/settings`}
            className="rounded-lg border border-leaf-200 px-3 py-1.5 text-sm font-semibold text-bark-800 hover:bg-leaf-50"
            title={t("settings")}
          >
            ⚙️ <span className="hidden sm:inline">{t("settings")}</span>
          </Link>
        </div>
      </div>

      {inviteOpen && (
        <InvitePopover
          familyId={data.family.id}
          inviteCode={data.family.inviteCode}
          canRotate={isAdmin}
          onClose={() => setInviteOpen(false)}
          onRotated={(code) =>
            setData((d) => ({ ...d, family: { ...d.family, inviteCode: code } }))
          }
        />
      )}

      {/* Canvas */}
      <TreeCanvas
        persons={data.persons}
        spouseLinks={data.spouseLinks}
        onSelect={(info: SelectedInfo) => {
          if (info.kind === "person") openView(info.id);
          else openAdd({ kind: "root" });
        }}
      />

      {/* Side panel */}
      {panelMode === "view" && selected && (
        <PersonPanel
          key={`view-${selected.id}`}
          person={selected}
          persons={data.persons}
          spouseLinks={data.spouseLinks}
          me={me}
          canDelete={isAdmin}
          onClose={() => {
            setPanelMode("view");
            setSelectedId(null);
          }}
          onDeleted={() => {
            refresh();
            setSelectedId(null);
          }}
          onChanged={refresh}
          onAddRelation={(rel) => openAdd(rel)}
        />
      )}
      {panelMode === "add" && addRelation && (
        <PersonPanel
          mode={{ kind: "add", relation: addRelation }}
          familyId={data.family.id}
          persons={data.persons}
          spouseLinks={data.spouseLinks}
          me={me}
          onClose={() => {
            setPanelMode("view");
            setAddRelation(null);
          }}
          onCreated={(id) => {
            refresh().then(() => openView(id));
          }}
        />
      )}
    </div>
  );
}
