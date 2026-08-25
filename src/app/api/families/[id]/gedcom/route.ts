import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

function esc(s: string) {
  return s.replace(/\n/g, " ");
}

// GET /api/families/[id]/gedcom → GEDCOM 5.5.1 file
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  if (!(await getMembership(id, userId))) return new Response("Forbidden", { status: 403 });

  const [family, persons, links] = await Promise.all([
    prisma.family.findUnique({ where: { id }, select: { name: true } }),
    prisma.person.findMany({ where: { familyId: id, status: "APPROVED" } }),
    prisma.spouseLink.findMany({
      where: { a: { familyId: id } },
    }),
  ]);

  // build family units: couple (spouse link or shared children) + children
  type Unit = { xref: string; husb?: string; wife?: string; chil: string[] };
  const units: Unit[] = [];

  const usedPairs = new Set<string>();
  let fSeq = 0;
  for (const l of links) {
    const key = [l.aId, l.bId].sort().join("|");
    if (usedPairs.has(key)) continue;
    usedPairs.add(key);
    fSeq += 1;
    units.push({ xref: `F${fSeq}`, husb: l.aId, wife: l.bId, chil: [] });
  }
  // children grouping by their parents present in tree
  const childToUnit = new Map<string, string>();
  for (const p of persons) {
    const parents = [p.fatherId, p.motherId].filter(Boolean) as string[];
    if (parents.length < 1) continue;
    let unit = units.find(
      (u) => parents.includes(u.husb ?? "@") || parents.includes(u.wife ?? "@")
    );
    if (!unit && parents.length === 2) {
      const pairKey = [...parents].sort().join("|");
      if (!usedPairs.has(pairKey)) {
        fSeq += 1;
        unit = { xref: `F${fSeq}`, husb: parents[0], wife: parents[1], chil: [] };
        units.push(unit);
        usedPairs.add(pairKey);
      } else {
        unit = units.find((u) => [u.husb, u.wife].every((x) => parents.includes(x!)));
      }
    }
    if (unit) {
      if (!unit.chil.includes(p.id)) unit.chil.push(p.id);
      childToUnit.set(p.id, unit.xref);
    }
  }

  const lines: string[] = [];
  lines.push("0 HEAD");
  lines.push("1 SOUR SHAJARATNA");
  lines.push("2 NAME Shajaratna");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("2 FORM LINEAGE-LINKED");
  lines.push("1 CHAR UTF-8");
  lines.push(`1 DATE ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`1 FILE shajaratna-${id}.ged`);

  const pidXref = new Map<string, string>();
  persons.forEach((p, i) => pidXref.set(p.id, `I${i + 1}`));

  const dateLine = (val: string | null | undefined, tag: "DATE") =>
    val ? `2 ${tag} ${esc(val)}` : null;

  for (const p of persons) {
    const x = pidXref.get(p.id)!;
    lines.push(`0 @${x}@ INDI`);
    const given = esc(p.firstName);
    const surname = esc(p.lastName ?? "");
    lines.push(`1 NAME ${given} /${surname}/`);
    if (p.nickname) lines.push(`2 NICK ${esc(p.nickname)}`);
    lines.push(`1 SEX ${p.gender === "MALE" ? "M" : p.gender === "FEMALE" ? "F" : "U"}`);
    if (p.birthDate || p.birthPlace) {
      lines.push("1 BIRT");
      const d = dateLine(p.birthDate, "DATE");
      if (d) lines.push(d);
      if (p.birthPlace) lines.push(`2 PLAC ${esc(p.birthPlace)}`);
    }
    if (p.deathDate) {
      lines.push("1 DEAT");
      const d = dateLine(p.deathDate, "DATE");
      if (d) lines.push(d);
    }
    if (p.occupation) lines.push(`1 OCCU ${esc(p.occupation)}`);
    if (p.bio) lines.push(`1 NOTE ${esc(p.bio).slice(0, 200)}`);
    const famc = childToUnit.get(p.id);
    if (famc) lines.push(`1 FAMC @${famc}@`);
    for (const u of units)
      if (u.husb === p.id || u.wife === p.id) lines.push(`1 FAMS @${u.xref}@`);
  }

  for (const u of units) {
    lines.push(`0 @${u.xref}@ FAM`);
    if (u.husb && pidXref.has(u.husb)) lines.push(`1 HUSB @${pidXref.get(u.husb)}@`);
    if (u.wife && pidXref.has(u.wife)) lines.push(`1 WIFE @${pidXref.get(u.wife)}@`);
    for (const c of u.chil) if (pidXref.has(c)) lines.push(`1 CHIL @${pidXref.get(c)}@`);
  }
  lines.push("0 TRLR");

  const content = lines.join("\r\n") + "\r\n";
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="shajaratna-${esc(family?.name ?? id)}.ged"`,
    },
  });
}
