import type { PersonDTO, SpouseLinkDTO } from "@/lib/tree-data";

export const CARD_W = 148;
export const CARD_H = 64;
export const SPOUSE_GAP = 28; // gap between person card and spouse card
export const UNIT_GAP = 36; // horizontal gap between units on same level
export const LEVEL_H = 140; // vertical distance between generations
const CHILD_GAP = 24;

export type PositionedCard = {
  person: PersonDTO;
  x: number; // left
  y: number; // top
  isSpouseSlot: boolean;
  primaryId?: string; // for spouse cards: the primary they're attached to
};

export type TreeEdge =
  | { kind: "marriage"; from: { x: number; y: number }; to: { x: number; y: number } }
  | { kind: "child"; path: { x: number; y: number }[] };

export type UnitLayout = {
  primaryId: string;
  spouseIds: string[]; // linked spouse ids (in order)
  childUnitIds: string[];
  depth: number;
  x: number;
  y: number;
  width: number;
  parentAnchorX: number | null; // x of attachment point under parents' unit
  coupleAnchors: Record<string, number>; // childKey -> anchor x for that couple group
};

export type TreeLayout = {
  cards: PositionedCard[];
  edges: TreeEdge[];
  units: Map<string, UnitLayout>;
  width: number;
  height: number;
};

type Input = {
  persons: PersonDTO[];
  spouseLinks: SpouseLinkDTO[];
};

function spousesOf(id: string, links: SpouseLinkDTO[]): string[] {
  const out: string[] = [];
  for (const l of links) {
    if (l.aId === id) out.push(l.bId);
    else if (l.bId === id) out.push(l.aId);
  }
  return [...new Set(out)];
}

/**
 * Builds a tidy top-down genealogy layout.
 * Each "unit" = a primary person + their spouses laid horizontally.
 * Children hang below the couple they belong to (or below the single parent).
 */
export function layoutTree({ persons, spouseLinks }: Input, collapsed: Set<string>): TreeLayout {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const units = new Map<string, UnitLayout>();
  const primaryOf = new Map<string, string>(); // every visible person -> unit primary

  // Determine unit primaries: a person not already claimed as a spouse of an
  // earlier-processed person becomes a primary. Process in stable order:
  // roots (no in-tree parents) first, then others — so parents own the unit
  // before their children marry into other units.
  const ids = persons.map((p) => p.id);
  const hasInTreeParent = (id: string) => {
    const p = byId.get(id)!;
    return (
      (p.fatherId && byId.has(p.fatherId)) || (p.motherId && byId.has(p.motherId))
    );
  };
  const ordered = [
    ...ids.filter((id) => !hasInTreeParent(id)),
    ...ids.filter((id) => hasInTreeParent(id)),
  ];

  for (const id of ordered) {
    if (primaryOf.has(id)) continue;
    const sps = spousesOf(id, spouseLinks).filter((s) => byId.has(s));
    const taken = sps.find((s) => primaryOf.has(s));
    if (taken) {
      // This person was already placed as someone's spouse in another unit?
      // If married both ways (A-B and B-C), keep first claim.
      continue;
    }
    const visibleSpouses = collapsed.has(id) ? [] : sps;
    for (const s of [id, ...visibleSpouses]) {
      if (!primaryOf.has(s)) primaryOf.set(s, id);
      else if (primaryOf.get(s) !== id) {
        // already claimed elsewhere; leave it
      }
    }
    units.set(id, {
      primaryId: id,
      spouseIds: visibleSpouses.filter((s) => primaryOf.get(s) === id),
      childUnitIds: [],
      depth: 0,
      x: 0,
      y: 0,
      width: 0,
      parentAnchorX: null,
      coupleAnchors: {},
    });
  }

  // Rebuild spouse lists strictly with claims
  for (const u of units.values()) {
    u.spouseIds = u.spouseIds.filter((s) => primaryOf.get(s) === u.primaryId);
  }

  // Assign children to units: a child belongs to the unit of its first
  // in-tree parent.
  const childrenByUnit = new Map<string, PersonDTO[]>();
  for (const p of persons) {
    let owner: string | null = null;
    if (p.fatherId && byId.has(p.fatherId)) owner = primaryOf.get(p.fatherId) ?? null;
    else if (p.motherId && byId.has(p.motherId)) owner = primaryOf.get(p.motherId) ?? null;
    if (!owner) continue;
    if (!childrenByUnit.has(owner)) childrenByUnit.set(owner, []);
    childrenByUnit.get(owner)!.push(p);
  }

  // Depth via DFS on unit graph
  const visitDepth = (unitId: string, depth: number, seen: Set<string>) => {
    const u = units.get(unitId);
    if (!u || seen.has(unitId)) return;
    seen.add(unitId);
    u.depth = Math.max(u.depth, depth);
    const kids = childrenByUnit.get(unitId) ?? [];
    const childPrimaries = new Set<string>();
    for (const c of kids) {
      if (collapsed.has(unitId)) break;
      const cu = primaryOf.get(c.id);
      if (cu && cu !== unitId && units.has(cu)) childPrimaries.add(cu);
    }
    for (const cp of childPrimaries) {
      if (!units.get(unitId)!.childUnitIds.includes(cp))
        units.get(unitId)!.childUnitIds.push(cp);
      visitDepth(cp, depth + 1, seen);
    }
  };
  const roots = [...units.values()].filter((u) => u.depth === 0 && !hasInTreeParent(u.primaryId));
  for (const r of roots) visitDepth(r.primaryId, 0, new Set());

  // Measure widths bottom-up
  const measure = (unitId: string, seen: Set<string>): number => {
    const u = units.get(unitId);
    if (!u || seen.has(unitId)) return u?.width ?? CARD_W;
    seen.add(unitId);
    const ownWidth =
      (1 + u.spouseIds.length) * CARD_W + u.spouseIds.length * SPOUSE_GAP;
    if (!u.childUnitIds.length) {
      u.width = ownWidth;
      return ownWidth;
    }
    let childrenW = 0;
    for (const k of u.childUnitIds)
      childrenW += measure(k, seen) + (u.childUnitIds.indexOf(k) ? CHILD_GAP : 0);
    u.width = Math.max(ownWidth, childrenW);
    return u.width;
  };
  const seenMeasure = new Set<string>();
  let totalW = 0;
  for (const r of roots) totalW += measure(r.primaryId, seenMeasure) + UNIT_GAP;
  totalW = Math.max(totalW - UNIT_GAP, 300);

  // Place top-down
  const cards: PositionedCard[] = [];
  let cursorX = 0;
  let maxDepth = 0;

  const place = (unitId: string, x: number) => {
    const u = units.get(unitId);
    if (!u) return;
    const y = u.depth * LEVEL_H;
    maxDepth = Math.max(maxDepth, u.depth);

    const ownWidth = (1 + u.spouseIds.length) * CARD_W + u.spouseIds.length * SPOUSE_GAP;
    const startX = x + (u.width - ownWidth) / 2;

    u.x = startX;
    u.y = y;
    u.coupleAnchors = {};

    const primary = byId.get(u.primaryId)!;
    cards.push({
      person: primary,
      x: startX,
      y,
      isSpouseSlot: false,
    });

    u.spouseIds.forEach((sid, i) => {
      const sx = startX + (i + 1) * (CARD_W + SPOUSE_GAP);
      const sp = byId.get(sid);
      if (!sp) return;
      cards.push({
        person: sp,
        x: sx,
        y,
        isSpouseSlot: true,
        primaryId: u.primaryId,
      });
    });

    // Distribute child units across [x, x+width]
    const kids = u.childUnitIds;
    if (kids.length) {
      let cx = x;
      for (const k of kids) {
        const ku = units.get(k)!;
        place(k, cx);
        cx += ku.width + CHILD_GAP;
      }
    }
  };

  for (const r of roots) {
    place(r.primaryId, cursorX);
    cursorX += (units.get(r.primaryId)?.width ?? 0) + UNIT_GAP;
  }

  // Edges
  const edges: TreeEdge[] = [];

  const cardCenter = (personId: string) => {
    for (const u of units.values()) {
      if (u.primaryId === personId)
        return { x: u.x + CARD_W / 2, y: u.y + CARD_H / 2 };
      const idx = u.spouseIds.indexOf(personId);
      if (idx >= 0)
        return {
          x: u.x + (idx + 1) * (CARD_W + SPOUSE_GAP) + CARD_W / 2,
          y: u.y + CARD_H / 2,
        };
    }
    return null;
  };

  // Marriage edges between adjacent cards within a unit
  for (const u of units.values()) {
    let prevId = u.primaryId;
    for (const sid of u.spouseIds) {
      const a = cardCenter(prevId);
      const b = cardCenter(sid);
      if (a && b) {
        edges.push({
          kind: "marriage",
          from: { x: a.x + CARD_W / 2, y: a.y },
          to: { x: b.x - CARD_W / 2, y: b.y },
        });
      }
      prevId = sid;
    }
  }

  // Child edges: from couple midpoint down to each child unit's top center
  for (const u of units.values()) {
    if (collapsed.has(u.primaryId)) continue;
    // Group child unit primaries by their connecting parent(s) inside this unit
    for (const childPrimary of u.childUnitIds) {
      const cu = units.get(childPrimary);
      if (!cu) continue;
      const childPerson = byId.get(childPrimary)!;
      const parentIds = [childPerson.fatherId, childPerson.motherId].filter(
        (pid): pid is string => !!pid && byId.has(pid)
      );
      // Anchor: midpoint of the two parent cards (if both in this unit), else single parent card
      const centers = parentIds.map((pid) => {
        if (pid === u.primaryId) return { x: u.x + CARD_W / 2, y: u.y + CARD_H / 2 };
        const idx = u.spouseIds.indexOf(pid);
        if (idx >= 0)
          return { x: u.x + (idx + 1) * (CARD_W + SPOUSE_GAP) + CARD_W / 2, y: u.y + CARD_H / 2 };
        return null;
      }).filter(Boolean) as { x: number; y: number }[];

      const anchorX = centers.length
        ? centers.reduce((s, c) => s + c.x, 0) / centers.length
        : u.x + u.width / 2;
      const fromY = u.y + CARD_H / 2;

      const toX = cu.x + (cu.width / 2);
      const toY = cu.y;
      const midY = (fromY + toY) / 2;

      edges.push({
        kind: "child",
        path: [
          { x: anchorX, y: fromY },
          { x: anchorX, y: midY },
          { x: toX, y: midY },
          { x: toX, y: toY },
        ],
      });
    }
  }

  const height = (maxDepth + 1) * LEVEL_H;

  return { cards, edges, units, width: totalW, height };
}

export function fullName(p: PersonDTO): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ");
}
