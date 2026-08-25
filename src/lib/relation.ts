import type { PersonDTO, SpouseLinkDTO } from "@/lib/tree-data";

export type RelationStep = {
  personId: string;
  name: string;
  via: string; // relation label from previous person to this one
};

type BfsNode = {
  id: string;
  parent: BfsNode | null;
  via: string;
};

/**
 * BFS over parent/child + spouse edges.
 * Returns the chain of persons from "from" to "to" with a label per hop.
 */
export function findRelationPath(
  fromId: string,
  toId: string,
  persons: PersonDTO[],
  spouseLinks: SpouseLinkDTO[]
): RelationStep[] | null {
  const byId = new Map(persons.map((p) => [p.id, p]));
  if (!byId.has(fromId) || !byId.has(toId)) return null;
  if (fromId === toId) return [];

  // children map
  const childrenOf = new Map<string, string[]>();
  for (const p of persons) {
    for (const parentId of [p.fatherId, p.motherId]) {
      if (!parentId || !byId.has(parentId)) continue;
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
      childrenOf.get(parentId)!.push(p.id);
    }
  }
  // spouse map
  const spousesOf = new Map<string, string[]>();
  for (const l of spouseLinks) {
    for (const [a, b] of [
      [l.aId, l.bId],
      [l.bId, l.aId],
    ]) {
      if (!byId.has(a) || !byId.has(b)) continue;
      if (!spousesOf.has(a)) spousesOf.set(a, []);
      spousesOf.get(a)!.push(b);
    }
  }

  function neighbors(id: string): { id: string; via: string }[] {
    const out: { id: string; via: string }[] = [];
    for (const c of childrenOf.get(id) ?? [])
      out.push({ id: c, via: genderLabel(byId.get(c)?.gender, "child") });
    const me = byId.get(id);
    if (me) {
      for (const pid of [me.fatherId, me.motherId])
        if (pid && byId.has(pid))
          out.push({ id: pid, via: genderLabel(byId.get(pid)?.gender, "parent") });
    }
    for (const s of spousesOf.get(id) ?? [])
      out.push({ id: s, via: genderLabel(byId.get(s)?.gender, "spouse") });
    return out;
  }

  const root: BfsNode = { id: fromId, parent: null, via: "" };
  const queue: BfsNode[] = [root];
  const visited = new Set([fromId]);

  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of neighbors(cur.id)) {
      if (visited.has(nb.id)) continue;
      visited.add(nb.id);
      const node: BfsNode = { id: nb.id, parent: cur, via: nb.via };
      if (nb.id === toId) return buildPath(node, byId);
      queue.push(node);
    }
  }
  return null;
}

function buildPath(
  target: BfsNode,
  byId: Map<string, PersonDTO>
): RelationStep[] {
  const chain: BfsNode[] = [];
  let cur: BfsNode | null = target;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent;
  }
  return chain.map((n) => {
    const p = byId.get(n.id);
    return {
      personId: n.id,
      name: [p?.firstName, p?.lastName].filter(Boolean).join(" "),
      via: n.via,
    };
  });
}

function genderLabel(gender: string | undefined, kind: "parent" | "child" | "spouse"): string {
  const male = gender === "MALE";
  if (kind === "parent") return male ? "والد" : "والدة";
  if (kind === "child") return male ? "ابن" : "ابنة";
  return male ? "زوج" : "زوجة";
}
