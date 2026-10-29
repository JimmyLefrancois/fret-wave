/**
 * Panneau DEV (développement seulement, chargé à la demande par `App.tsx`, absent du build) : charger
 * une persona, sauvegarder / restaurer le vrai journal, avancer l'horloge, ajouter une série à la main
 * et lire la radiographie de l'état dérivé. Toute la logique vit dans `devStore.ts`.
 *
 * Les pages lisent le journal au montage : après chaque action, on recharge la page.
 */
import { useEffect, useMemo, useState } from 'react';
import * as clock from '../core/clock';
import { DAY, loadJournal, progressStore } from '../core/progress';
import { loadScaleSelection, useScaleSelection } from '../app/scaleSession';
import { PixelButton } from '../app/ui';
import { PERSONAS, getPersona } from './simulate';
import './devpanel.css';
import { addSeries, clearJournal, hasBackup, loadPersona, restoreJournal, xray, type SeriesKind, type SeriesSpec } from './devStore';

const KINDS: { value: SeriesKind; label: string }[] = [
  { value: 'listen', label: 'Écoute (N1)' },
  { value: 'holes', label: 'Trous (N2)' },
  { value: 'recall', label: 'De mémoire (N3)' },
  { value: 'blind', label: 'À l’aveugle (N3)' },
  { value: 'sequence', label: 'Séquence' },
  { value: 'impro', label: 'Impro (N4)' },
];

const MIN = 60_000;

function shift(ms: number): void {
  clock.setClockOffset(ms === 0 ? 0 : clock.clockOffset() + ms);
  location.reload();
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtIn(ms: number): string {
  if (ms <= 0) return 'due';
  if (ms < 3_600_000) return `dans ${Math.round(ms / MIN)} min`;
  if (ms < DAY) return `dans ${Math.round(ms / 3_600_000)} h`;
  return `dans ${Math.round(ms / DAY)} j`;
}

/** Console : les mêmes actions, scriptables (`__sim.load('decrocheur')`, `__sim.shift(1)`…). */
function installConsole(): void {
  const store = progressStore();
  (window as unknown as Record<string, unknown>).__sim = {
    personas: PERSONAS.map((p) => p.id),
    days: Object.fromEntries(PERSONAS.map((p) => [p.id, p.days])),
    load: (id: string, days?: number) => {
      const p = getPersona(id);
      if (!p) return `persona inconnue : ${id}`;
      loadPersona(store, p, { end: clock.now(), days });
      location.reload();
      return p.label;
    },
    clear: () => { clearJournal(store, clock.nowDate()); location.reload(); },
    restore: () => { const n = restoreJournal(store); location.reload(); return n; },
    shift: (days: number) => shift(days * DAY),
    present: () => shift(0),
    add: (spec: SeriesSpec) => { const a = addSeries(store, spec, loadScaleSelection(store), clock.nowDate()); location.reload(); return a; },
    xray: () => xray(loadJournal(store), clock.nowDate()),
  };
}

export default function DevPanel() {
  const store = progressStore();
  const sel = useScaleSelection();
  const [open, setOpen] = useState(false);
  const [personaId, setPersonaId] = useState(PERSONAS[0]!.id);
  const [days, setDays] = useState(0);
  const [spec, setSpec] = useState<SeriesSpec>({ kind: 'recall', score: 0.9, mic: true, full: true, grid: 0, tempoOk: false, afterReveal: false });
  useEffect(installConsole, []);
  const now = clock.now();
  const offset = clock.clockOffset();
  const backup = hasBackup(store);
  const x = useMemo(() => (open ? xray(loadJournal(store), new Date(now)) : null), [open, store, now]);
  const set = <K extends keyof SeriesSpec>(k: K, v: SeriesSpec[K]) => setSpec((s) => ({ ...s, [k]: v }));
  const persona = getPersona(personaId)!;

  return (
    <div className="devpanel-root">
      <button type="button" className={`devpanel-toggle ${offset || backup ? 'devpanel-live' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        DEV{offset ? ` ${offset > 0 ? '+' : ''}${(offset / DAY).toFixed(offset % DAY ? 1 : 0)} j` : ''}{backup ? ' · SIM' : ''}
      </button>
      {open && x && (
        <div className="devpanel" role="dialog" aria-label="Panneau de développement">
          <section>
            <h3>Horloge</h3>
            <p>{fmtDate(now)}{offset ? ` (décalage ${(offset / DAY).toFixed(2)} j)` : ' (heure réelle)'}</p>
            <div className="devpanel-row">
              <PixelButton variant="quiet" onClick={() => shift(10 * MIN)}>+10 min</PixelButton>
              <PixelButton variant="quiet" onClick={() => shift(DAY)}>+1 j</PixelButton>
              <PixelButton variant="quiet" onClick={() => shift(3 * DAY)}>+3 j</PixelButton>
              <PixelButton variant="quiet" onClick={() => shift(7 * DAY)}>+1 sem.</PixelButton>
              <PixelButton variant="quiet" onClick={() => shift(0)} disabled={!offset}>Présent</PixelButton>
            </div>
          </section>

          <section>
            <h3>Journal</h3>
            <p>{x.attempts} tentatives{backup ? ' · simulé, vrai journal sauvegardé' : ' · vrai journal'}</p>
            <div className="devpanel-row">
              <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} aria-label="Persona">
                {PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <label>
                jours <input type="number" min={1} max={120} value={days || persona.days} onChange={(e) => setDays(Number(e.target.value))} />
              </label>
            </div>
            <p className="devpanel-hint">{persona.summary}</p>
            <div className="devpanel-row">
              <PixelButton onClick={() => { loadPersona(store, persona, { end: clock.now(), days: days || undefined }); location.reload(); }}>Charger</PixelButton>
              <PixelButton variant="quiet" onClick={() => { clearJournal(store, clock.nowDate()); location.reload(); }}>Vider</PixelButton>
              <PixelButton variant="danger" disabled={!backup} onClick={() => { restoreJournal(store); location.reload(); }}>Restaurer le vrai</PixelButton>
            </div>
          </section>

          <section>
            <h3>Ajouter une série</h3>
            <p className="devpanel-hint">Sur la sélection : {sel.scaleId} · {sel.tonic} · {sel.system} · position {sel.positionIndex + 1}</p>
            <div className="devpanel-row">
              <select value={spec.kind} onChange={(e) => set('kind', e.target.value as SeriesKind)} aria-label="Genre">
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <label>
                {Math.round(spec.score * 100)} %
                <input type="range" min={0} max={100} value={Math.round(spec.score * 100)} onChange={(e) => set('score', Number(e.target.value) / 100)} />
              </label>
            </div>
            <div className="devpanel-row">
              <label><input type="checkbox" checked={spec.mic} onChange={(e) => set('mic', e.target.checked)} /> micro</label>
              <label><input type="checkbox" checked={spec.full} onChange={(e) => set('full', e.target.checked)} /> position entière</label>
              <label><input type="checkbox" checked={spec.afterReveal} onChange={(e) => set('afterReveal', e.target.checked)} /> rattrapage</label>
            </div>
            <div className="devpanel-row">
              <label>
                {spec.kind === 'sequence' ? 'BPM validé' : 'grille (notes/min)'}
                <input type="number" min={0} max={400} value={spec.grid} onChange={(e) => set('grid', Number(e.target.value))} />
              </label>
              <label><input type="checkbox" checked={spec.tempoOk} onChange={(e) => set('tempoOk', e.target.checked)} /> grille tenue</label>
            </div>
            <PixelButton onClick={() => { addSeries(store, spec, sel, clock.nowDate()); location.reload(); }}>Ajouter maintenant</PixelButton>
          </section>

          <section>
            <h3>Radiographie</h3>
            <p>
              Accueil : <b>{x.hero}</b> · jour : {x.today.exercises} exo(s), {x.today.listens} écoute(s)
              {x.today.accuracy !== null ? `, ${Math.round(x.today.accuracy * 100)} %` : ''} · XP {x.xp.today}/{x.xp.cap} (total {x.xp.total}) · série {x.streak} j
            </p>
            <details open>
              <summary>Formes ({x.nodes.length})</summary>
              <table className="devpanel-table">
                <thead><tr><th>nœud</th><th>état</th><th>boîte</th><th>réuss./jours</th><th>fortes</th><th>maîtrise</th><th>dernier</th></tr></thead>
                <tbody>
                  {x.nodes.map((n) => (
                    <tr key={n.nodeId}>
                      <td>{n.nodeId.replace(/^gam:/, '')}</td>
                      <td>{n.state}{n.speed ? ' +vitesse' : ''}</td>
                      <td>{n.box ?? '—'}</td>
                      <td>{n.successes}/{n.successDays}</td>
                      <td>{n.strong}</td>
                      <td>{Math.round(n.mastery * 100)}</td>
                      <td>{Math.round(n.last * 100)} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            <details>
              <summary>Révisions ({x.due.length} due(s))</summary>
              <ul>{x.due.map((d) => <li key={d.nodeId}>{d.nodeId.replace(/^gam:/, '')} · boîte {d.box} · {fmtIn(d.due - now)} · {d.summary}</li>)}</ul>
            </details>
            <details>
              <summary>Badges ({x.badges.filter((b) => b.earned).length}/{x.badges.length})</summary>
              <ul>{x.badges.map((b) => <li key={b.title}>{b.earned ? '✓' : '·'} {b.title}</li>)}</ul>
            </details>
            <details>
              <summary>Accomplissements récents</summary>
              <ul>{x.feats.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </details>
          </section>
        </div>
      )}
    </div>
  );
}
