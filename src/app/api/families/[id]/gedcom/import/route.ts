import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership } from "@/lib/family";

type Ctx = { params: Promise<{ id: string }> };

type Indi = {
  xref: string;
  given: string;
  surname: string;
  sex: "M" | "F" | "U";
  birth?: string;
  birthPlace?: string;
  death?: string;
  famc?: string;
  fams: string[];
};

// POST import GEDCOM (multipart form: file)
export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id: familyId } = await ctx.params;

  const membership = await getMembership(familyId, userId);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
  if (file.size > 5_000_000) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });

  const text = await file.text();
  const lines = text.split(/\r?\n/);

  const indis = new Map<string, Indi>();
  const fams = new Map<string, { husb?: string; wife?: string; chil: string[] }>();

  // pass 1: collect records
  let curType: "INDI" | "FAM" | null = null;
  let curXref: string | null = null;
  let curIndi: Indi | null = null;
  let curCtx: string | null = null; // BIRT/DEAT sub-context
  for (const raw of lines) {
    const m = raw.match(/^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\w+)(?:\s(.*))?$/);
    if (!m) continue;
    const level = Number(m[1]);
    const xref = m[2];
    const tag = m[3];
    const value = (m[4] ?? "").trim();

    if (level === 0) {
      curCtx = null;
      if (xref && tag === "INDI") {
        curType = "INDI";
        curXref = xref.replace(/@/g, "");
        curIndi = {
          xref: curXref,
          given: "",
          surname: "",
          sex: "U",
          fams: [],
        };
        indis.set(curXref, curIndi);
        continue;
      }
      if (xref && tag === "FAM") {
        curType = "FAM";
        curXref = xref.replace(/@/g, "");
        fams.set(curXref, { chil: [] });
        continue;
      }
      curType = null;
      continue;
    }

    if (curType === "INDI" && curIndi) {
      if (level === 1 && tag === "NAME") {
        const nm = value.match(/^(.*?)\s*\/(.*?)\/(.*)$/);
        if (nm) {
          curIndi.given = nm[1].trim();
          curIndi.surname = nm[2].trim();
        } else curIndi.given = value;
      } else if (level === 2 && tag === "GIVN") {
        curIndi.given = value || curIndi.given;
      } else if (level === 2 && tag === "SURN") {
        curIndi.surname = value || curIndi.surname;
      } else if (level === 1 && tag === "SEX") {
        curIndi.sex = value === "M" ? "M" : value === "F" ? "F" : "U";
      } else if (level === 1 && (tag === "BIRT" || tag === "DEAT")) {
        curCtx = tag;
        if (tag === "DEAT") curIndi.death = curIndi.death ?? "";
      } else if (level === 2 && tag === "DATE" && curCtx === "BIRT") {
        curIndi.birth = value.slice(0, 20);
      } else if (level === 2 && tag === "PLAC" && curCtx === "BIRT") {
        curIndi.birthPlace = value.slice(0, 120);
      } else if (level === 2 && tag === "DATE" && curCtx === "DEAT") {
        curIndi.death = value.slice(0, 20);
      } else if (level === 1 && tag === "FAMC") {
        curIndi.famc = value.replace(/@/g, "");
      } else if (level === 1 && tag === "FAMS") {
        curIndi.fams.push(value.replace(/@/g, ""));
      } else if (level === 1) {
        curCtx = null;
      }
    } else if (curType === "FAM") {
      const fam = fams.get(curXref ?? "");
      if (fam) {
        if (level === 1 && tag === "HUSB") fam.husb = value.replace(/@/g, "");
        else if (level === 1 && tag === "WIFE") fam.wife = value.replace(/@/g, "");
        else if (level === 1 && tag === "CHIL") fam.chil.push(value.replace(/@/g, ""));
      }
    }
  }

  // pass 2: create persons
  const xrefToId = new Map<string, string>();
  let created = 0;
  for (const [xref, indi] of indis) {
    const firstName = indi.given || indi.surname || "بدون اسم";
    const person = await prisma.person.create({
      data: {
        familyId,
        firstName: firstName.slice(0, 60),
        lastName: indi.surname ? indi.surname.slice(0, 60) : null,
        gender: indi.sex === "M" ? "MALE" : indi.sex === "F" ? "FEMALE" : "OTHER",
        birthDate: indi.birth ?? null,
        birthPlace: indi.birthPlace ?? null,
        isDeceased: !!indi.death,
        deathDate: indi.death || null,
        createdById: userId,
        status: "APPROVED",
        isRoot: false,
      },
    });
    xrefToId.set(xref, person.id);
    created += 1;
    if (created >= 2000) break; // safety cap
  }

  // pass 3: parent links + spouses
  let spouseLinksCreated = 0;
  for (const [, fam] of fams) {
    const husbId = fam.husb ? xrefToId.get(fam.husb) : undefined;
    const wifeId = fam.wife ? xrefToId.get(fam.wife) : undefined;

    if (husbId && wifeId) {
      const [aId, bId] = [husbId, wifeId].sort();
      await prisma.spouseLink.upsert({
        where: { aId_bId: { aId, bId } },
        update: {},
        create: { aId, bId },
      });
      spouseLinksCreated += 1;
    }
    for (const cx of fam.chil) {
      const childId = xrefToId.get(cx);
      if (!childId) continue;
      await prisma.person.updateMany({
        where: { id: childId },
        data: {
          ...(husbId ? { fatherId: husbId } : {}),
          ...(wifeId ? { motherId: wifeId } : {}),
          isRoot: false,
        },
      });
    }
  }

  // mark root candidates: persons with no parents and no FAMC
  const roots = [...indis.values()].filter(
    (i) => !i.famc && !(famHasParent(fams, i.xref))
  );
  for (const r of roots.slice(0, 10)) {
    const pid = xrefToId.get(r.xref);
    if (pid) await prisma.person.update({ where: { id: pid }, data: { isRoot: true } });
  }
  function famHasParent(
    famMap: Map<string, { husb?: string; wife?: string; chil: string[] }>,
    xref: string
  ): boolean {
    for (const [, f] of famMap) if (f.chil.includes(xref)) return true;
    return false;
  }

  return NextResponse.json({
    imported: created,
    spouseLinks: spouseLinksCreated,
  });
}
