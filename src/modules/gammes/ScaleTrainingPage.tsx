/**
 * Module Gammes — niveaux 2 « Mémorisation » et 3 « Rappel » (BRIEF.md §2, MUSIC_DESIGN §3.4).
 *
 * Un seul écran pour les deux niveaux, parce que la mécanique est la même : **des trous dans une
 * tablature réelle**, que l'élève comble au pavé numérique (ou au clavier). Ce qui change :
 *  - N2 masque ~35 % des notes (on lit encore la forme, on comble les manques) ;
 *  - N3 masque **tout** (la tablature ne donne que les cordes, les mesures et le rythme) et chronomètre.
 *
 * Découpage (chunking) : 1 corde → 2 → 3 → position entière → aller-retour. Une tentative n'est
 * enregistrée qu'une fois la série terminée, avec les trous justes **au premier essai** : c'est la seule
 * mesure honnête de ce que l'élève sait déjà. Une note révélée après deux erreurs compte comme fausse.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { navigate } from '../../app/router';
import { setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { TabView, type TabPick } from '../../app/TabView';
import { Panel, PixelButton, Segmented } from '../../app/ui';
import { fmtNote } from '../../core/theory';
import { positionToScore } from '../../core/tab';
import { appendAttempt, newAttemptId, nodeIdOf, progressStore, readAttempts, xpForAttempt, type Attempt, type AttemptLevel } from '../../core/progress';
import { degreeName, fmtDegree, positionLabel, resolveScale } from './resolve';
import {
  HOLES_RATIO, SEGMENTS, buildExercise, holeKey, mulberry32, segmentPlan, starsFor, withRevealed, type Segment,
} from './exercise';

type HoleMark = 'right' | 'revealed';

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function stars(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

export function ScaleTrainingPage() {
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);

  const [level, setLevel] = useState<AttemptLevel>(2);
  const [segment, setSegment] = useState<Segment>('strings2');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [marks, setMarks] = useState<Record<string, HoleMark>>({});
  const [errors, setErrors] = useState<Record<string, number>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<{ accuracy: number; stars: number; xp: number; seconds: number; revealed: number; errors: number } | null>(null);
  const [journal, setJournal] = useState<Attempt[]>(() => readAttempts(progressStore()));

  const plan = useMemo(() => (r.position ? segmentPlan(r.position, segment) : null), [r.position, segment]);

  const baseScore = useMemo(() => {
    if (!plan) return null;
    try {
      return positionToScore(plan.position, r.tuning, {
        direction: plan.direction,
        fingers: true,
        labelText: positionLabel(r.position, settings.noteNotation),
        ...(r.chord ? { chord: r.chord } : {}),
      });
    } catch {
      return null;
    }
  }, [plan, r.tuning, r.position, r.chord, settings.noteNotation]);

  const exercise = useMemo(() => {
    if (!baseScore) return null;
    return buildExercise(baseScore, level as 2 | 3, level === 2 ? { rng: mulberry32(seed) } : {});
  }, [baseScore, level, seed]);

  const revealed = useMemo(() => new Set(Object.keys(marks)), [marks]);
  const display = useMemo(
    () => (exercise ? withRevealed(exercise.score, revealed) : null),
    [exercise, revealed],
  );

  const done = Object.keys(marks).length;
  const total = exercise?.total ?? 0;
  const activeHole = useMemo(() => exercise?.holes.find((h) => h.key === activeKey) ?? null, [exercise, activeKey]);

  // --- remise à zéro quand la cible change (gamme, position, niveau, segment)
  useEffect(() => {
    setMarks({});
    setErrors({});
    setActiveKey(null);
    setEntry('');
    setFeedback(null);
    setStartedAt(null);
    setResult(null);
  }, [selection.scaleId, selection.tonic, selection.tuningId, selection.system, selection.positionIndex, level, segment, seed]);

  useEffect(() => {
    if (startedAt === null || result) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [startedAt, result]);

  const touch = () => {
    if (startedAt === null) setStartedAt(Date.now());
  };

  const nextOpen = useCallback((after: string | null): string | null => {
    if (!exercise) return null;
    const marksNow = { ...marks };
    const order = exercise.holes.map((h) => h.key);
    const from = after ? order.indexOf(after) : -1;
    for (let i = 1; i <= order.length; i++) {
      const k = order[(from + i + order.length) % order.length]!;
      if (!marksNow[k]) return k;
    }
    return null;
  }, [exercise, marks]);

  const finish = useCallback((finalMarks: Record<string, HoleMark>, errorCount: Record<string, number>) => {
    if (!exercise || !plan || !r.position) return;
    const right = Object.values(finalMarks).filter((m) => m === 'right').length;
    const totalHoles = exercise.total;
    const accuracy = totalHoles > 0 ? right / totalHoles : 0;
    const revealedCount = Object.values(finalMarks).filter((m) => m === 'revealed').length;
    const errorTotal = Object.values(errorCount).reduce((s, v) => s + v, 0);
    const seconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    const attempt: Attempt = {
      id: newAttemptId(Date.now(), nodeIdOf({ scaleId: r.def.id, system: r.selection.system, formIndex: r.position.formIndex ?? r.position.index }), readAttempts(progressStore()).length),
      ts: Date.now(),
      kind: level >= 3 ? 'recall' : 'holes',
      scaleId: r.def.id,
      tonic: r.tonic,
      tuningId: r.tuning.id,
      system: r.selection.system,
      positionId: r.position.id,
      formIndex: r.position.formIndex ?? r.position.index,
      level: level as AttemptLevel,
      strings: plan.strings,
      correct: right,
      total: totalHoles,
      seconds,
      fretMin: plan.position.fretMin,
      // diagnostic par corde : les trous qui ont coûté une erreur (ou une révélation)
      missedStrings: [...new Set(Object.keys(errorCount).map((k) => Number(k.split(':')[1] ?? 0)).filter((s) => Number.isInteger(s)))],
    };
    setJournal(appendAttempt(progressStore(), attempt));
    setResult({ accuracy, stars: starsFor(accuracy, revealedCount, errorTotal), xp: xpForAttempt(attempt), seconds, revealed: revealedCount, errors: errorTotal });
  }, [exercise, plan, r, level, startedAt]);

  const validate = useCallback(() => {
    if (!activeHole || entry === '') return;
    touch();
    const value = Number(entry);
    if (value === activeHole.fret) {
      const nextMarks = { ...marks, [activeHole.key]: 'right' as HoleMark };
      setMarks(nextMarks);
      setEntry('');
      setFeedback({ ok: true, text: `${fmtNote(activeHole.note, settings.noteNotation)} · ${fmtDegree(activeHole.fn)} (${degreeName(activeHole.fn)}) — juste` });
      const next = nextOpen(activeHole.key);
      setActiveKey(next);
      if (Object.keys(nextMarks).length === total) finish(nextMarks, errors);
    } else {
      const count = (errors[activeHole.key] ?? 0) + 1;
      const nextErrors = { ...errors, [activeHole.key]: count };
      setErrors(nextErrors);
      setEntry('');
      if (count >= 2) {
        // deuxième erreur : on révèle (la pastille reprend sa couleur) et on avance
        const nextMarks = { ...marks, [activeHole.key]: 'revealed' as HoleMark };
        setMarks(nextMarks);
        setFeedback({ ok: false, text: `c’était ${activeHole.fret} (case révélée)` });
        setActiveKey(nextOpen(activeHole.key));
        if (Object.keys(nextMarks).length === total) finish(nextMarks, nextErrors);
      } else {
        setFeedback({ ok: false, text: 'non — réessaie (encore une erreur et je révèle la case)' });
      }
    }
  }, [activeHole, entry, marks, errors, r.tonic, settings.noteNotation, nextOpen, total, finish]);

  const press = useCallback((d: string) => {
    touch();
    setEntry((e) => (e.length >= 2 ? e : `${e}${d}`));
  }, [startedAt]);

  const onPick = (pick: TabPick) => {
    if (!pick.hidden) {
      setFeedback({ ok: true, text: 'cette case est déjà écrite : touche un emplacement vide' });
      return;
    }
    setActiveKey(holeKey(pick.columnIndex, pick.string));
    setEntry('');
    setFeedback(null);
  };

  // --- clavier physique : chiffres, retour arrière, entrée
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setEntry((v) => v.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        validate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, validate, result]);

  const restart = (nextLevel = level, nextSegment = segment) => {
    setLevel(nextLevel);
    setSegment(nextSegment);
    setSeed(Math.floor(Math.random() * 1e9));
  };

  // --- crochet de vérification (développement uniquement) : état de la série, jamais en production
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __training?: unknown }).__training = {
      exercise, plan, marks, errors, activeKey, result, level, segment, total, done,
      select: (key: string | null) => setActiveKey(key),
      press: (d: string) => press(d),
      validate: () => validate(),
      journalLength: journal.length,
    };
  }, [exercise, plan, marks, errors, activeKey, result, level, segment, total, done, press, validate, journal.length]);

  if (!r.position || !exercise || !display || !plan) {
    return (
      <main className="shell">
        <header className="page-head">
          <button type="button" className="back" onClick={() => navigate('gammes')} aria-label="Retour à la sélection">‹</button>
          <div>
            <h1 className="page-title">Entraînement</h1>
          </div>
        </header>
        <Panel accent="yellow">
          <p className="t-body">Aucune position pour cette gamme / cet accordage.</p>
          <PixelButton onClick={() => navigate('gammes')}>Changer de système</PixelButton>
        </Panel>
      </main>
    );
  }

  const elapsed = startedAt === null ? 0 : Math.round(((result ? result.seconds * 1000 : now - startedAt)) / 1000);
  const activeStringLabel = activeHole
    ? `${fmtNote(r.tuning.strings[activeHole.string]!.replace(/-?\d+$/, ''), settings.noteNotation)} ${activeHole.string === 0 ? '(grave)' : activeHole.string === r.tuning.strings.length - 1 ? '(aiguë)' : ''}`.trim()
    : null;

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('gammes')} aria-label="Retour à la sélection">‹</button>
        <div>
          <h1 className="page-title">{r.title}</h1>
          <p className="t-small t-dim">{positionLabel(r.position, settings.noteNotation)} · {plan.label}</p>
        </div>
        <span className="tag tag-on">N{level}</span>
      </header>

      <Panel className="span-7" accent="magenta" label="Exercice" right={<span className="badge">{done} / {total}</span>}>
        <div className="field">
          <span className="t-label">Niveau</span>
          <Segmented<AttemptLevel>
            size="sm"
            label="Niveau"
            value={level}
            onChange={(v) => restart(v, segment)}
            options={[
              { value: 2, label: 'N2 · trous' },
              { value: 3, label: 'N3 · rappel' },
            ]}
          />
        </div>
        <div className="field">
          <span className="t-label">Découpage</span>
          <Segmented<Segment>
            size="sm"
            label="Découpage"
            value={segment}
            onChange={(v) => restart(level, v)}
            options={SEGMENTS.map((s) => ({ value: s.value, label: s.label, note: s.hint }))}
          />
        </div>
        <p className="t-small">
          {level === 2
            ? `Environ ${Math.round(HOLES_RATIO * 100)} % des notes sont masquées — au moins 2, jamais toutes : ici ${total} trou${total > 1 ? 's' : ''} sur ${exercise.notes}. Touche un emplacement vide, tape la case au pavé, valide.`
            : `${exercise.notes} cases à écrire de mémoire : seules les cordes, les mesures et le rythme restent visibles.`}
        </p>
        <div className="row">
          <PixelButton variant="quiet" onClick={() => restart()} title="Même gamme, nouveaux trous">Nouvelle série</PixelButton>
          <PixelButton variant="quiet" onClick={() => navigate('scale')}>Écouter d’abord</PixelButton>
          {startedAt !== null && !result && <span className="t-label">{mmss(elapsed)}</span>}
        </div>
        {level === 3 && !startedAt && (
          <p className="t-small t-dim">Le chrono démarre à ta première réponse ; le bonus de vitesse n’existe qu’à ≥ 95 % de précision.</p>
        )}
      </Panel>

      <Panel className="span-5 numpad-panel" accent="cyan" label="Pavé numérique" right={activeStringLabel ? <span className="tag">corde de {activeStringLabel}</span> : <span className="tag">aucun trou</span>}>
        <div className="numpad-entry" aria-live="polite">
          <span className="numpad-label">{activeStringLabel ? 'Case ?' : 'touche un emplacement vide'}</span>
          <span className="numpad-digits">{entry || '—'}</span>
        </div>
        <div className="numpad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" className="key" onClick={() => press(d)} disabled={!activeHole || !!result}>{d}</button>
          ))}
          <button type="button" className="key key-alt" onClick={() => setEntry('')} disabled={!entry}>C</button>
          <button type="button" className="key" onClick={() => press('0')} disabled={!activeHole || !!result}>0</button>
          <button type="button" className="key key-ok" onClick={validate} disabled={!activeHole || entry === '' || !!result}>✓</button>
        </div>
        <p className="t-small t-dim">
          Clavier physique : chiffres, retour arrière, entrée. Une case à deux chiffres (10 à 24) se tape d’affilée.
        </p>
        {feedback && (
          <p className={`t-small numpad-feedback ${feedback.ok ? 'ok' : 'no'}`} role="status">{feedback.text}</p>
        )}
      </Panel>

      <TabView
        score={display}
        notes={settings.noteNotation}
        chords={settings.chordNotation}
        annotation="degree"
        mode="wrap"
        scale="auto"
        reduceMotion={settings.reduceMotion}
        player={null}
        transport="stopped"
        hideRhythm
        onPick={onPick}
        {...(activeKey ? { activeHoleKey: activeKey } : {})}
      />

      {result ? (
        <Panel className="span-7" accent={result.stars > 0 ? 'green' : 'orange'} label="Résultat">
          <p className="result-stars">{stars(result.stars)}</p>
          <p className="stat-line">
            <strong>{Math.round(result.accuracy * 100)} %</strong> de trous justes au premier essai · {result.revealed} révélé{result.revealed > 1 ? 's' : ''} · {result.errors} erreur{result.errors > 1 ? 's' : ''}
          </p>
          <p className="t-small">
            {result.xp > 0
              ? `+${result.xp} XP · ${mmss(result.seconds)}. Tentative enregistrée : elle entre dans la répétition espacée.`
              : `0 XP · ${mmss(result.seconds)}. La tentative est enregistrée quand même : elle dit où tu en es, et rien n’est bloqué.`}
          </p>
          <div className="row">
            <PixelButton variant="primary" onClick={() => restart()}>Rejouer</PixelButton>
            <PixelButton onClick={() => restart(level === 2 ? 3 : 2, segment)}>{level === 2 ? 'Passer au rappel (N3)' : 'Revenir aux trous (N2)'}</PixelButton>
            <PixelButton variant="quiet" onClick={() => navigate('gammes')}>Changer de gamme</PixelButton>
            <PixelButton variant="quiet" onClick={() => navigate('hub')}>Hub</PixelButton>
          </div>
          <p className="t-small t-dim">
            Étoiles : ★ dès 80 % de trous justes · ★★ dès 95 % · ★★★ sans une erreur ni une case révélée.
            Prochaine révision calculée par la répétition espacée (Leitner, 6 boîtes) : le hub affiche les échéances.
          </p>
        </Panel>
      ) : (
        <Panel className="span-7" accent="violet" label="Ce que cet exercice mesure">
          <p className="t-body">
            Les trous justes <strong>au premier essai</strong>. Une case trouvée du deuxième coup n’est pas « sue »,
            elle est reconnue. Le score d’aujourd’hui déplace la case dans la file de révision, il ne la certifie pas.
          </p>
          <p className="t-small t-dim">
            Campagne de {total} trou{total > 1 ? 's' : ''} sur {exercise.notes} note{exercise.notes > 1 ? 's' : ''} ({plan.strings} corde{plan.strings > 1 ? 's' : ''}).
            {journal.length > 0 ? ` ${journal.length} tentative${journal.length > 1 ? 's' : ''} déjà enregistrée${journal.length > 1 ? 's' : ''} sur cet appareil.` : ' Aucune tentative enregistrée pour l’instant.'}
          </p>
          <p className="t-small t-dim">
            L’annotation sous la tablature reste celle de ton réglage (notes, degrés, intervalles, doigtés) — elle est masquée sur les trous.
          </p>
        </Panel>
      )}

      <div className="pos-nav">
        <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.max(0, r.selection.positionIndex - 1) })} disabled={r.selection.positionIndex === 0}>‹ Position</PixelButton>
        <span className="t-label pos-count">{r.selection.positionIndex + 1} / {r.positions.length}</span>
        <PixelButton variant="quiet" onClick={() => setScaleSelection({ positionIndex: Math.min(r.positions.length - 1, r.selection.positionIndex + 1) })} disabled={r.selection.positionIndex >= r.positions.length - 1}>Position ›</PixelButton>
      </div>

      <p className="t-small t-dim foot-note">
        Niveau 1 (découverte, avec le son) : <button type="button" className="linkish" onClick={() => navigate('scale')}>écran d’écoute</button>.
        Niveau 4 (improvisation) : phase 7. Une note masquée n’est jamais jouée par l’app avant d’être trouvée.
      </p>
    </main>
  );
}
