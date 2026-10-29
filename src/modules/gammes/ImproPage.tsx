/**
 * Improvisation (phase 7) — **jouer sur un accompagnement, et comprendre ce qu'on joue**.
 *
 * L'écran fait trois choses, dans cet ordre d'importance :
 *
 *  1. **il accompagne** : une grille (basse, pads, batterie) synthétisée, deux styles, un tempo réglable,
 *     l'accord courant affiché et surligné. Rien de tout cela ne juge ;
 *  2. **il inscrit ce que tu joues** : chaque note entendue s'allume **à sa place dans la position**
 *     (`flash` de `TabView`) — c'est P3 de la phase 3, qui atterrit ici ;
 *  3. **il classe** : chaque note reçoit un rôle harmonique (note d'accord, couleur, passage, à éviter,
 *     hors gamme), et la prise se résume par trois taux + un conseil.
 *
 * Ce que l'écran ne fait **pas** : juger le goût, la phrase, le rythme fin. Une ligne lente et juste vaut
 * mieux qu'une avalanche de notes, mais l'app ne sait mesurer que la justesse harmonique — et elle le dit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '../../core/audio/engine';
import { BackingPlayer, backingPattern, loopBeatsOf } from '../../core/audio/backing';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { useInputSettings } from '../../core/input/settings';
import { ensureInputEngine, windowFor } from '../../app/inputSession';
import { CHORD_INTERVALS, judgeNote, ROLE_LABEL, summarizeImpro, type ImproNote, type ImproStats, type NoteRole } from '../../core/impro/classify';
import { locateInScore, scoreNotes, type PlacedNote } from '../../core/impro/locate';
import { positionToScore } from '../../core/tab/generators';
import { Chip, Panel, PixelButton, Switch } from '../../app/ui';
import { TabView } from '../../app/TabView';
import { useSettings } from '../../app/settings';
import { useScaleSelection } from '../../app/scaleSession';
import { navigate } from '../../app/router';
import { fmtNote, pitchClassOf } from '../../core/theory';
import { noteNameOf } from '../../core/input/match';
import { appendAttempt, newAttemptId, readAttempts } from '../../core/progress/journal';
import { progressStore } from '../../core/progress';
import type { Attempt } from '../../core/progress/journal';
import { chordAtMeasure, chordName, backingsFor, IMPRO_BACKINGS, STYLE_LABEL, type BackingMode, type BackingStyle } from './impro';
import { positionLabelPlain, resolveScale } from './resolve';
import * as clock from '../../core/clock';

const ROLE_CLASS: Record<NoteRole, string> = {
  chord: 'impro-role-chord',
  color: 'impro-role-color',
  passing: 'impro-role-passing',
  avoid: 'impro-role-avoid',
  out: 'impro-role-out',
};

const pct = (v: number): string => `${Math.round(v * 100)} %`;

/** « 1 passage », « 3 passages » : un compte ne s'écrit pas au pluriel par défaut. */
const count = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

export function ImproPage() {
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);

  /** La position telle qu'elle s'affiche : c'est aussi la carte des notes qu'on peut allumer. */
  const score = useMemo(() => {
    if (!r.position) return null;
    try {
      return positionToScore(r.position, r.tuning, {
        direction: 'up',
        fingers: true,
        labelText: positionLabelPlain(r.position, settings.noteNotation),
        // pas de nom d'accord au-dessus de la portée : sur cet écran l'accord **change toutes les
        // mesures** (c'est la grille qui le dit). Afficher le « chord » par défaut de la gamme
        // (Am7 pour La mineur pentatonique) annoncerait un accord que l'accompagnement ne joue pas.
      });
    } catch {
      return null;
    }
  }, [r.position, r.tuning, r.chord, settings.noteNotation]);

  const placed = useMemo(() => (score ? scoreNotes(score) : []), [score]);
  /** Les classes de hauteur de la position : c'est la gamme réellement affichée, pas une théorie à part. */
  const scalePcs = useMemo(() => [...new Set(placed.map((n) => ((n.midi % 12) + 12) % 12))].sort((a, b) => a - b), [placed]);
  /**
   * La tonique est celle de la **gamme choisie**, pas la première note de la position : une position de
   * La mineur pentatonique commence rarement sur La, et la grille se serait transposée sur la mauvaise
   * fondamentale sans que rien ne le signale.
   */
  const tonicPc = pitchClassOf(r.tonic);

  /** Mineur ou majeur : la tierce de la tonique décide, pas le nom de la famille. */
  const mode: BackingMode = useMemo(() => {
    const hasMinorThird = scalePcs.some((p) => ((p - tonicPc + 12) % 12) === 3);
    return hasMinorThird ? 'minor' : 'major';
  }, [scalePcs, tonicPc]);

  const [style, setStyle] = useState<BackingStyle>('synthwave');
  const backing = useMemo(() => backingsFor(mode).find((b) => b.style === style) ?? IMPRO_BACKINGS[0]!, [mode, style]);
  const [tempo, setTempo] = useState(backing.tempo);
  useEffect(() => setTempo(backing.tempo), [backing.tempo]);

  const [transport, setTransport] = useState<'stopped' | 'playing'>('stopped');
  const [measure, setMeasure] = useState(0);
  const [takes, setTakes] = useState<ImproNote[]>([]);
  const [summary, setSummary] = useState<ImproStats | null>(null);
  const [flash, setFlash] = useState<{ string: number; fret: number }[]>([]);
  const [status, setStatus] = useState('');

  const player = useRef<BackingPlayer | null>(null);
  const startedAt = useRef(0);
  const previous = useRef<PlacedNote | null>(null);
  const flashTimers = useRef<number[]>([]);
  const lastJudged = useRef<{ midi: number; at: number } | null>(null);
  const onFrameRef = useRef<(f: InputFrame) => void>(() => {});

  // --- micro
  const input = useInputSettings();
  const [engine, setEngine] = useState<InputEngine | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);

  const chord = useMemo(() => chordAtMeasure(backing, tonicPc, measure), [backing, tonicPc, measure]);

  const stop = useCallback(() => {
    player.current?.stop();
    setTransport('stopped');
    setFlash([]);
    for (const t of flashTimers.current) window.clearTimeout(t);
    flashTimers.current = [];
    if (takes.length === 0) {
      setSummary(null);
      return;
    }
    const stats = summarizeImpro(takes);
    setSummary(stats);
    const seconds = startedAt.current ? Math.round((performance.now() - startedAt.current) / 1000) : 0;
    if (!r.position || takes.length < 6) return; // moins de six notes : rien à conclure, rien au journal
    const attempt: Attempt = {
      id: newAttemptId(clock.now(), `${r.def.id}:impro:${r.selection.system}:${r.position.formIndex ?? r.position.index}`, readAttempts(progressStore()).length),
      ts: clock.now(),
      kind: 'impro',
      scaleId: r.def.id,
      tonic: r.tonic,
      tuningId: r.tuning.id,
      system: r.selection.system,
      positionId: r.position.id,
      formIndex: r.position.formIndex ?? r.position.index,
      level: 4,
      strings: r.tuning.strings.length,
      correct: stats.byRole.chord,
      total: stats.notes,
      seconds,
      fretMin: r.position.fretMin,
      missedStrings: [],
      tempoOk: stats.strongChordRate >= 0.5,
    };
    appendAttempt(progressStore(), attempt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takes, r]);

  const start = async (): Promise<void> => {
    setStatus('');
    setSummary(null);
    setTakes([]);
    previous.current = null;
    lastJudged.current = null;
    try {
      await AudioEngine.get().unlock();
      await AudioEngine.get().init();
      const ctx = AudioEngine.get().rawContext;
      if (!player.current) {
        const p = new BackingPlayer(ctx, AudioEngine.get().backingInput());
        p.load(backingPattern(backing, 40), tempo, loopBeatsOf(backing));
        player.current = p;
      } else {
        player.current.load(backingPattern(backing, 40), tempo, loopBeatsOf(backing));
      }
      player.current.start();
      startedAt.current = performance.now();
      setTransport('playing');
      setMeasure(0);
    } catch (e) {
      setStatus(`audio indisponible : ${(e as Error).message}`);
    }
  };

  // le tempo change en cours de jeu : on recharge la boucle sans arrêter le transport
  useEffect(() => {
    if (!player.current) return;
    player.current.load(backingPattern(backing, 40), tempo, loopBeatsOf(backing));
  }, [backing, tempo]);

  // --- suivi de la mesure (le curseur de l'écran, pas celui du son)
  useEffect(() => {
    if (transport !== 'playing') return;
    let raf = 0;
    const tick = () => {
      const p = player.current;
      if (p) setMeasure(p.currentMeasure());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [transport]);

  // --- micro : ouverture à la demande
  useEffect(() => {
    if (!micOn) {
      engine?.stop();
      return;
    }
    let cancelled = false;
    setMicBusy(true);
    void (async () => {
      try {
        await AudioEngine.get().unlock();
        const e = await ensureInputEngine();
        if (cancelled) return;
        setEngine(e);
        await e.start(input, { windowSize: windowFor(r.tuning.id) });
        if (cancelled) {
          e.stop();
          return;
        }
        if (e.state !== 'listening') {
          const d = describeInputError(e.state, e.error);
          setStatus(`${d.message} — ${d.hint}`);
          setMicOn(false);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus(`micro indisponible : ${(err as Error).message}`);
          setMicOn(false);
        }
      } finally {
        if (!cancelled) setMicBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micOn]);

  useEffect(() => {
    if (!engine) return;
    return engine.subscribe(() => {
      const f = engine.last;
      if (f) onFrameRef.current(f);
    });
  }, [engine]);

  // --- écoute : une note jouée = une note classée, une pastille allumée
  const handleFrame = (f: InputFrame): void => {
    if (transport !== 'playing' || !f.stable || !f.isNew) return;
    const now = performance.now();
    const last = lastJudged.current;
    if (last && last.midi === f.midi && now - last.at < 320) return;
    lastJudged.current = { midi: f.midi, at: now };
    const p = player.current;
    const beatPhase = p ? (p.positionBeats() % 4) / 4 : 0;
    const judgement = judgeNote(f.midi, chord, scalePcs);
    setTakes((prev) => [...prev.slice(-80), { midi: f.midi, at: now, beatPhase, chord: { root: chord.root, quality: chord.quality }, judgement }]);
    const at = locateInScore(placed, f.midi, previous.current);
    if (at) {
      previous.current = at;
      setFlash([{ string: at.string, fret: at.fret }]);
      const timer = window.setTimeout(() => setFlash([]), 900);
      flashTimers.current.push(timer);
    }
  };
  onFrameRef.current = handleFrame;

  useEffect(() => () => {
    player.current?.stop();
    for (const t of flashTimers.current) window.clearTimeout(t);
  }, []);

  const live = useMemo(() => (takes.length > 0 ? summarizeImpro(takes) : null), [takes]);
  const recent = takes.slice(-8);
  const lane = r.position ? `${positionLabelPlain(r.position, settings.noteNotation)} · ${r.title}` : r.title;

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('gammes')} aria-label="Retour">‹</button>
        <div>
          <h1 className="page-title">Improviser</h1>
          <p className="t-small t-dim">{lane} · {tempo} BPM</p>
        </div>
        <span className="tag tag-on">N4</span>
      </header>

      <Panel className="span-5" accent="magenta" label="Accompagnement">
        <div className="row">
          {(['synthwave', 'lofi'] as BackingStyle[]).map((s) => (
            <Chip key={s} selected={style === s} onClick={() => setStyle(s)}>{STYLE_LABEL[s]}</Chip>
          ))}
        </div>
        <p className="t-small t-dim">{backing.why}</p>
        {/* trois éléments, trois largeurs : les boutons font 44 px, la valeur prend le reste. Dans une
            `.row`, chacun demandait 44 % et le « − » occupait la moitié de l'écran. */}
        <div className="impro-tempo-row">
          <PixelButton variant="quiet" className="impro-step" onClick={() => setTempo((t) => Math.max(60, t - 4))} aria-label="Moins vite">−</PixelButton>
          <span className="t-body impro-tempo">{tempo} BPM</span>
          <PixelButton variant="quiet" className="impro-step" onClick={() => setTempo((t) => Math.min(140, t + 4))} aria-label="Plus vite">+</PixelButton>
        </div>
        <Switch checked={micOn} onChange={setMicOn} label={micBusy ? 'Micro…' : 'Micro'} hint="tes notes s’inscrivent sur la tablature" />
        <div className="row">
          {transport === 'stopped' ? (
            <PixelButton variant="primary" onClick={() => void start()} disabled={!score}>▶ Démarrer</PixelButton>
          ) : (
            <PixelButton variant="primary" onClick={stop}>■ Arrêter</PixelButton>
          )}
        </div>
        {status && <p className="t-small ko">{status}</p>}
      </Panel>

      <Panel className="span-7" label="La grille">
        <div className="impro-grid">
          {backing.chords.map((c, i) => {
            const name = chordName(((tonicPc + c.offset) % 12 + 12) % 12, c.quality);
            return (
              <div key={`${c.roman}-${i}`} className={`impro-chord ${transport === 'playing' && i === measure ? 'on' : ''}`}>
                <span className="impro-chord-name">{name}</span>
                <span className="impro-chord-roman">{c.roman}</span>
              </div>
            );
          })}
        </div>
        <p className="t-small">{transport === 'playing' ? <>Accord en cours : <strong>{chordName(chord.root, chord.quality)}</strong> — joue ses notes sur les temps forts, le reste en passage.</> : 'Démarre l’accompagnement : la grille tourne, l’accord courant s’allume.'}</p>
        {/* Les notes à viser, écrites en clair : c'est la seule information qui sert *pendant* qu'on joue. */}
        <p className="t-small t-dim">
          Notes de l’accord : {CHORD_INTERVALS[chord.quality].map((iv) => fmtNote(noteNameOf(60 + chord.root + iv), settings.noteNotation)).join(' · ')}
        </p>
      </Panel>

      {score && (
        <Panel className="span-12" label="Ta position">
          <TabView
            score={score}
            notes={settings.noteNotation}
            chords={settings.chordNotation}
            annotation="none"
            mode="wrap"
            scale="auto"
            reduceMotion={settings.reduceMotion}
            player={null}
            transport="stopped"
            hideRhythm
            {...(flash.length > 0 ? { flash } : {})}
          />
        </Panel>
      )}

      <Panel className="span-12" label="Ta prise" right={live ? <span className="badge">{live.notes} notes</span> : undefined}>
        {recent.length === 0 ? (
          <p className="t-small t-dim">Aucune note encore. Ouvre le micro, démarre l’accompagnement, et joue ce que tu entends.</p>
        ) : (
          <div className="impro-notes">
            {recent.map((n, i) => (
              <span key={`${n.at}-${i}`} className={`impro-note ${ROLE_CLASS[n.judgement.role]}`} title={ROLE_LABEL[n.judgement.role]}>
                {fmtNote(noteNameOf(n.midi), settings.noteNotation)}
              </span>
            ))}
          </div>
        )}
        {live && (
          <div className="impro-stats">
            <span><strong>{pct(live.chordRate)}</strong> de notes d’accord</span>
            <span><strong>{pct(live.inScaleRate)}</strong> dans la gamme</span>
            <span><strong>{pct(live.strongChordRate)}</strong> d’accords sur les temps forts</span>
          </div>
        )}
        {summary && (
          <div className="impro-summary">
            <p className="t-body"><strong>{summary.score} / 100</strong> — {summary.advice}</p>
            <p className="t-small t-dim">
              {count(summary.byRole.chord, 'note d’accord', 'notes d’accord')} · {count(summary.byRole.color, 'couleur', 'couleurs')} ·{' '}
              {count(summary.byRole.passing, 'passage', 'passages')} · {count(summary.byRole.avoid, 'note à éviter', 'notes à éviter')} ·{' '}
              {count(summary.byRole.out, 'hors gamme', 'hors gamme')}
            </p>
            <p className="t-small t-dim">
              Le score dit la tenue de la grille (notes d’accord sur les temps forts), pas le goût de la phrase. La prise est enregistrée sur la compétence « improviser sur cette position ».
            </p>
          </div>
        )}
      </Panel>
    </main>
  );
}
