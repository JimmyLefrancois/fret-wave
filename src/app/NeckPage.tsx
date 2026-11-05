/**
 * Page Manche : toutes les notes du manche, de la corde à vide à la case 15. La gamme se choisit comme
 * sur Jouer ou Improviser (sélection partagée) : la choisir affiche ses notes, et sa tonique donne les
 * couleurs (avec Do, les Mi sont des tierces, les Sol des quintes, comme dans la tablature). L'élève
 * ajoute ou retire ensuite des notes une à une.
 */
import { useEffect, useMemo, useState } from 'react';
import { DEGREE_OF_SEMITONE, fretboardNotes, FLAT_NAMES, intervalStyle, NECK_METRICS, outerStrings, scaleSpellings, SHARP_NAMES } from '../core/tab';
import { fmtNote, pitchClassOf } from '../core/theory';
import { ScaleSelectors } from '../modules/gammes/PracticeHeader';
import { resolveScale } from '../modules/gammes/resolve';
import { NeckView } from './NeckView';
import { useScaleSelection } from './scaleSession';
import { useSettings } from './settings';
import { Segmented, Switch } from './ui';

type Spelling = 'sharp' | 'flat';
interface NeckPrefs {
  shown: number[];
  spelling: Spelling;
  from: number;
  to: number;
  dimOuter: boolean;
  /** Notes mises en avant parmi celles affichées ; les autres s'estompent. */
  focus: number[];
  /** Gamme dont les notes ont été posées (« ionian|F ») : en changer, ici ou sur une autre page, les repose. */
  scaleKey: string | null;
}

const KEY = 'fretwave.neck';
const ALL = Array.from({ length: 12 }, (_, i) => i);
const NATURALS = [0, 2, 4, 5, 7, 9, 11];
/** Dernière case montrée par la page. */
const LAST = NECK_METRICS.fullTo;
const FULL = { from: 0, to: LAST };
const FRETS = Array.from({ length: LAST + 1 }, (_, i) => i);
const fretOk = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= LAST;

function loadPrefs(): NeckPrefs {
  const base: NeckPrefs = { shown: ALL, spelling: 'sharp', from: 0, to: LAST, dimOuter: false, focus: [], scaleKey: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<NeckPrefs>;
    return {
      shown: Array.isArray(p.shown) ? p.shown.filter((n) => Number.isInteger(n) && n >= 0 && n < 12) : base.shown,
      spelling: p.spelling === 'flat' ? 'flat' : 'sharp',
      from: fretOk(p.from) ? p.from : 0,
      to: fretOk(p.to) && (!fretOk(p.from) || p.to >= p.from) ? p.to : LAST,
      dimOuter: p.dimOuter === true,
      focus: Array.isArray(p.focus) ? p.focus.filter((n) => Number.isInteger(n) && n >= 0 && n < 12) : [],
      scaleKey: typeof p.scaleKey === 'string' ? p.scaleKey : null,
    };
  } catch {
    return base;
  }
}

export function NeckPage() {
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);
  const [prefs, setPrefs] = useState<NeckPrefs>(loadPrefs);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* stockage indisponible : réglage du moment seulement */ }
  }, [prefs]);
  const patch = (p: Partial<NeckPrefs>) => setPrefs((old) => ({ ...old, ...p }));

  const tuning = r.tuning;
  /** La gamme garde son orthographe (Si♭ en Fa) ; les notes hors gamme suivent le réglage ♯/♭. */
  const spellings = useMemo(() => scaleSpellings(r.def, r.tonic), [r.def, r.tonic]);
  const scalePcs = useMemo(() => [...spellings.keys()].sort((a, b) => a - b), [spellings]);
  const reference = pitchClassOf(r.tonic);
  const names = prefs.spelling === 'flat' ? FLAT_NAMES : SHARP_NAMES;
  const nameOf = (pc: number) => fmtNote(spellings.get(pc)?.note ?? names[pc]!, settings.noteNotation);
  const degreeOf = (pc: number) => spellings.get(pc)?.degree ?? DEGREE_OF_SEMITONE[(pc - reference + 12) % 12]!;
  const shown = useMemo(() => new Set(prefs.shown), [prefs.shown]);
  /** Seules les notes affichées peuvent être mises en avant : une note masquée sort de la mise en avant. */
  const focus = useMemo(() => new Set(prefs.focus.filter((pc) => shown.has(pc))), [prefs.focus, shown]);

  // nouvelle gamme (ici ou ailleurs) : on affiche ses notes ; les retouches à la main tiennent jusque-là
  const scaleKey = `${r.def.id}|${r.tonic}`;
  useEffect(() => {
    if (prefs.scaleKey !== scaleKey) setPrefs((old) => ({ ...old, shown: scalePcs, focus: [], scaleKey }));
  }, [scaleKey, prefs.scaleKey, scalePcs]);

  const notes = useMemo(
    () => fretboardNotes(tuning, { pitchClasses: shown, reference, spelling: prefs.spelling, notation: settings.noteNotation, maxFret: LAST, spellings, focus }),
    [tuning, shown, reference, prefs.spelling, settings.noteNotation, spellings, focus],
  );

  const zone = useMemo(() => ({ from: prefs.from, to: prefs.to }), [prefs.from, prefs.to]);
  const whole = prefs.from === 0 && prefs.to === LAST;
  /** Les bornes restent dans l'ordre : déplacer l'une au-delà de l'autre entraîne l'autre. */
  const setFrom = (from: number) => patch({ from, to: Math.max(from, prefs.to) });
  const setTo = (to: number) => patch({ to, from: Math.min(to, prefs.from) });

  const toggle = (pc: number) => patch({ shown: shown.has(pc) ? prefs.shown.filter((n) => n !== pc) : [...prefs.shown, pc].sort((a, b) => a - b) });
  const toggleFocus = (pc: number) => patch({ focus: focus.has(pc) ? [...focus].filter((n) => n !== pc) : [...focus, pc].sort((a, b) => a - b) });
  const same = (list: number[]) => list.length === prefs.shown.length && list.every((n) => shown.has(n));

  const outer = outerStrings(tuning);
  const outerLabel = outer.same ? `Cordes de ${nameOf(outer.pcs[0])} en sombre` : 'Cordes extrêmes en sombre';
  const dimStrings = useMemo(() => (prefs.dimOuter ? outer.strings : []), [prefs.dimOuter, outer.strings[0], outer.strings[1]]);
  const outerSwitch = <Switch inline checked={prefs.dimOuter} onChange={(dimOuter) => patch({ dimOuter })} label={outerLabel} />;

  const neck = (
    <NeckView
      tuning={tuning}
      notes={notes}
      zone={zone}
      range={FULL}
      shade={whole ? null : zone}
      dimStrings={dimStrings}
      notation={settings.noteNotation}
      label={`${whole ? '' : `cases ${prefs.from} à ${prefs.to}, `}${prefs.shown.length === 12 ? 'toutes les notes' : prefs.shown.length === 0 ? 'aucune note' : prefs.shown.map(nameOf).join(', ')}`}
    />
  );
  const fretSelect = (value: number, onChange: (f: number) => void, aria: string) => (
    <select value={value} aria-label={aria} onChange={(e) => onChange(Number(e.target.value))}>
      {FRETS.map((f) => <option key={f} value={f}>{f}</option>)}
    </select>
  );
  const spellingControl = (
    <Segmented<Spelling>
      size="sm"
      label="Altérations"
      value={prefs.spelling}
      onChange={(spelling) => patch({ spelling })}
      options={[{ value: 'sharp', label: '♯ dièses' }, { value: 'flat', label: '♭ bémols' }]}
    />
  );
  const presets = [
    { label: 'Gamme', list: scalePcs },
    { label: 'Toutes', list: ALL },
    { label: 'Sans altérations', list: NATURALS },
    { label: 'Aucune', list: [] as number[] },
  ];
  const subtitle = <p className="t-small t-dim">Notes de {r.title}. Ajoute ou retire des notes à la main.</p>;

  // Une seule surface au bureau comme au téléphone (D146) : la gamme dans l'en-tête, les réglages du manche
  // au-dessus de lui, puis les notes. Seule la mise en page change avec la largeur (app.css, « Page Manche »).
  return (
    <main className="shell"><div className="tool-surface neck-surface">
      <header className="page-head neck-head">
        <div>
          <h1 className="page-title">Manche</h1>
          {subtitle}
        </div>
        <ScaleSelectors scale={r} />
      </header>

      {/* réglages du manche au-dessus de lui, sur une ligne */}
      <div className="neck-bar">
        <div className="neck-field">
          <span className="t-label">Cases</span>
          {fretSelect(prefs.from, setFrom, 'De la case')}
          <span className="neck-dash" aria-hidden="true">→</span>
          {fretSelect(prefs.to, setTo, 'À la case')}
          {!whole && <button type="button" className="neck-reset" onClick={() => patch({ from: 0, to: LAST })}>Tout le manche</button>}
        </div>
        <div className="neck-field neck-spelling">
          <span className="t-label">Hors gamme</span>
          {spellingControl}
        </div>
      </div>

      <div className="neck-main">{neck}</div>

      <div className="neck-notes-bar">
        <div className="neck-notes-head">
          <span className="t-label">Notes affichées</span>
          {outerSwitch}
          <div className="neck-presets" role="group" aria-label="Raccourcis">
            {presets.map(({ label, list }) => (
              <button key={label} type="button" className={`neck-reset ${same(list) ? 'on' : ''}`} aria-pressed={same(list)} onClick={() => patch({ shown: list })}>{label}</button>
            ))}
          </div>
        </div>
        <div className="neck-notes" role="group" aria-label="Notes affichées">
          {ALL.map((pc) => {
            const st = intervalStyle(degreeOf(pc));
            const on = shown.has(pc);
            return (
              <button key={pc} type="button" className={`neck-note ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(pc)}>
                <span className="neck-swatch" style={{ background: st.fill }} aria-hidden="true" />
                {nameOf(pc)}
              </button>
            );
          })}
        </div>
        <div className="neck-notes-head neck-focus-head">
          <span className="t-label">Mettre en avant</span>
          <span className="t-small t-dim">{focus.size > 0 ? 'Les autres notes affichées s’estompent.' : 'Coche une ou plusieurs notes affichées.'}</span>
          {focus.size > 0 && (
            <div className="neck-presets">
              <button type="button" className="neck-reset" onClick={() => patch({ focus: [] })}>Effacer</button>
            </div>
          )}
        </div>
        <div className="neck-notes" role="group" aria-label="Notes mises en avant">
          {ALL.map((pc) => {
            const st = intervalStyle(degreeOf(pc));
            const on = focus.has(pc);
            return (
              <button key={pc} type="button" className={`neck-note neck-focus ${on ? 'on' : ''}`} aria-pressed={on} disabled={!shown.has(pc)} onClick={() => toggleFocus(pc)}>
                <span className="neck-swatch" style={{ background: st.fill }} aria-hidden="true" />
                {nameOf(pc)}
              </button>
            );
          })}
        </div>
      </div>
    </div></main>
  );
}
