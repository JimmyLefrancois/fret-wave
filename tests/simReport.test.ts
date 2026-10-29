/**
 * Rapport du simulateur : un test unitaire léger, et le **générateur** du rapport complet, lancé seulement
 * à la demande (`npm run sim:report`, qui pose SIM_REPORT=1) : il écrit `.shots/sim/report.md`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXED_END, PERSONAS, getPersona } from '../src/dev/simulate';
import { reportMarkdown, simReport } from '../src/dev/report';

const END = new Date(2026, 9, 29, 22, 0, 0).getTime();

describe('simReport', () => {
  it('une ligne par jour, des constats, une table Markdown', () => {
    const r = simReport(getPersona('regulier')!, { end: END, days: 14 });
    expect(r.rows).toHaveLength(14);
    expect(r.findings.length).toBeGreaterThan(2);
    for (const row of r.rows) expect(row.forms).toHaveLength(r.formLabels.length);
    expect(reportMarkdown(r)).toContain('| J | date |');
  });

  it('le joueur du week-end casse sa série', () => {
    const r = simReport(getPersona('week-end')!, { end: END });
    expect(r.findings.some((f) => f.startsWith('Série cassée'))).toBe(true);
  });
});

describe.runIf(process.env.SIM_REPORT)('rapport complet', () => {
  it('écrit .shots/sim/report.md (ou le dossier SIM_REPORT_OUT)', () => {
    const dir = process.env.SIM_REPORT_OUT ?? '.shots/sim';
    // fin fixe : le rapport ne change pas d'un jour à l'autre
    const end = FIXED_END;
    const parts = PERSONAS.map((p) => reportMarkdown(simReport(p, { end })));
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/report.md`, [`# Simulation de progression — ${new Date(end).toLocaleString('fr-FR')}`, '', ...parts].join('\n'));
  });
});
