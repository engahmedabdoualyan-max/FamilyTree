"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FamilyTreeData } from "@/lib/tree-data";
import TreeCanvas from "./TreeCanvas";
import PersonPanel, { type AddRelation } from "./PersonPanel";
import FamilyPageHeader from "./FamilyPageHeader";

export default function FamilyWorkspace({
  treeData,
  me,
  myRole,
}: {
  treeData: FamilyTreeData;
  me: { id: string; name?: string | null; image?: string | null };
  myRole: string;
}) {
  const [data, setData] = useState<FamilyTreeData>(treeData);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"view" | "add">("view");
  const [addRelation, setAddRelation] = useState<AddRelation | null>(null);
  const [toast, setToast] = useState("");
  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";

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
      <FamilyPageHeader
        familyId={data.family.id}
        familyName={data.family.name}
        active="tree"
        isAdmin={isAdmin}
      />

      <TreeCanvas
        persons={data.persons}
        spouseLinks={data.spouseLinks}
        onSelect={(info) => {
          if (info.kind === "person") openView(info.id);
          else openAdd({ kind: "root" });
        }}
      />

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

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-bark-900 px-5 py-2.5 text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
