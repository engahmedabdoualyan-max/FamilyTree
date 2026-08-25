import type { PersonDTO } from "@/lib/tree-data";

const year = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const m = s.match(/(\d{4})/);
  return m ? Number(m[1]) : null;
};

/** Detects logical inconsistencies in tree data (Arabic warnings). */
export function computeIssues(persons: PersonDTO[]): string[] {
  const issues: string[] = [];
  const byId = new Map(persons.map((p) => [p.id, p]));
  const name = (p?: PersonDTO | null) =>
    p ? `${p.firstName} ${p.lastName ?? ""}`.trim() : "؟";

  for (const p of persons) {
    const b = year(p.birthDate);
    const d = year(p.deathDate);

    if (b && d && d < b)
      issues.push(`⚠️ ${name(p)}: الوفاة (${d}) قبل الميلاد (${b})!`);
    if (b && !p.isDeceased && new Date().getFullYear() - b > 120)
      issues.push(`⚠️ ${name(p)}: العمر أكتر من ١٢٠ سنة — راجع تاريخ الميلاد`);
    if (d && !p.isDeceased)
      issues.push(`ℹ️ ${name(p)}: له تاريخ وفاة — فعّل علم «متوفى»`);

    for (const pid of [p.fatherId, p.motherId]) {
      if (!pid) continue;
      const parent = byId.get(pid);
      if (!parent) continue;
      const pb = year(parent.birthDate);
      if (b && pb && b - pb >= 0 && b - pb < 12)
        issues.push(`⚠️ ${name(parent)} بقى والد/والدة ${name(p)} وعمره ${b - pb} سنة بس!`);
      const pd = year(parent.deathDate);
      if (b && pd && b > pd + 1)
        issues.push(`⚠️ ${name(p)} اتولد بعد وفاة ${name(parent)} (${pd})`);
    }
  }
  return issues.slice(0, 30);
}
