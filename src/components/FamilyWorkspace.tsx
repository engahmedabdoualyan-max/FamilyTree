"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";
  const isApprover = data.family.approverUserId === me.id;
  const canModerate = isAdmin || isApprover;
  const [pending, setPending] = useState<
    { id: string; firstName: string; lastName: string | null; createdBy: { name: string | null } }[]
  >([]);

  const loadPending = useCallback(async () => {
    const res = await fetch(`/api/families/${data.family.id}/pending`);
    if (res.ok) setPending((await res.json()).persons);
  }, [data.family.id]);

  useEffect(() => {
    if (!canModerate || !data.family.requireApproval) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/families/${data.family.id}/pending`);
      if (!cancelled && res.ok) setPending((await res.json()).persons);
    })();
    return () => {
      cancelled = true;
    };
  }, [canModerate, data.family.requireApproval, data.family.id]);

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

      {/* Pending approvals strip */}
      {canModerate && data.family.requireApproval && pending.length > 0 && (
        <div className="z-20 border-b border-amber-200 bg-amber-50 px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-extrabold text-amber-800">
              🛡️ {t("pending_approvals")} ({pending.length})
            </span>
            {pending.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold ring-1 ring-amber-200">
                {p.firstName} {p.lastName ?? ""}
                <button
                  onClick={async () => {
                    await fetch(`/api/families/${data.family.id}/pending`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ personId: p.id, action: "APPROVE" }),
                    });
                    loadPending();
                    refresh();
                  }}
                  className="text-green-600 hover:text-green-700"
                >
                  ✅
                </button>
                <button
                  onClick={async () => {
                    await fetch(`/api/families/${data.family.id}/pending`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ personId: p.id, action: "REJECT" }),
                    });
                    loadPending();
                  }}
                  className="text-red-500 hover:text-red-600"
                >
                  ❌
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="z-20 flex items-center gap-2 border-b border-leaf-100 bg-white px-4 py-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`🔎 ${t("tree_search")}`}
          className="w-full max-w-xs rounded-full border border-leaf-200 px-4 py-1.5 text-sm outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-200"
        />
        {search.trim().length >= 1 && (
          <div className="flex flex-wrap gap-1.5">
            {data.persons
              .filter((p) =>
                `${p.firstName} ${p.lastName ?? ""}`.toLowerCase().includes(search.toLowerCase())
              )
              .slice(0, 6)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setFocusId(p.id);
                    setSearch("");
                  }}
                  className="rounded-full bg-leaf-100 px-3 py-1 text-xs font-bold text-leaf-800 hover:bg-leaf-200"
                >
                  {p.firstName} {p.lastName ?? ""}
                </button>
              ))}
            {!data.persons.some(
              (p) => `${p.firstName} ${p.lastName ?? ""}`.toLowerCase().includes(search.toLowerCase())
            ) && <span className="text-xs text-bark-800/40">…</span>}
          </div>
        )}
      </div>

      <TreeCanvas
        persons={data.persons}
        spouseLinks={data.spouseLinks}
        focusPersonId={focusId}
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
          familyId={data.family.id}
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
