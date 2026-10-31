/**
 * Module Gammes — niveau 1 « Découverte » (BRIEF.md §2, docs/ARCHITECTURE.md §6.3).
 * La gamme est écrite en tablature (montée / descente / aller-retour) avec :
 *  - les couleurs de fonction d'intervalle et le glow des notes caractéristiques du mode ;
 *  - quatre annotations au choix (note, degré, intervalle, doigté) ;
 *  - un calque « notes de l'accord » qui estompe les notes étrangères ;
 *  - le mode « fondamentales d'abord » et le découpage par nombre de cordes (chunking) ;
 *  - la comparaison de deux modes voisins ;
 *  - le son final de la 1c (échantillons CC0), un drone de fondamentale, un métronome.
 * Chaque écoute complète est écrite dans le journal local : le hub affiche des chiffres vrais.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { requestLiaison, setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { setSettings, useSettings } from '../../app/settings';
import { TabView } from '../../app/TabView';
import { NeckView } from '../../app/NeckView';
import { InstrumentPicker } from '../../app/AudioControls';
import { Panel, PixelButton, PixelIcon, Segmented, Switch } from '../../app/ui';
import { filterPosition, fmtNote, linkedPair, relabelPosition, stepFormula } from '../../core/theory';
import { type AnnotationKind, type Direction, defaultChordForScale, linkNeckNotes, neckNotes, positionToScore } from '../../core/tab';
import { TabPlayer, scoreTonic } from '../../core/audio/tabPlayer';
import { appendAttempt, newAttemptId, nodeIdOf, progressStore, readAttempts } from '../../core/progress';
import { fmtDegree, legendFor, positionLabelPlain, resolveScale, scaleTitle } from './resolve';
import { ScaleRuler } from './ScaleRuler';
import { TabLegend } from './TabLegend';
import { LevelsNav } from './LevelsNav';
import { PlaySection } from './PlaySection';
import { useDesktop } from '../../app/useDesktop';
import {
  compareChoices, counterpartPosition, differingDegrees, markDegrees, neighbourPositions, relativeDegrees, samePlaceIndex,
} from './compare';
import * as clock from '../../core/clock';

const DIRECTION_LABEL: Record<Direction, string> = { up: 'Montée', down: 'Descente', updown: 'Aller-retour' };

const ANNOTATIONS: { value: AnnotationKind; label: string }[] = [
  { value: 'note', label: 'Notes' },
  { value: 'degree', label: 'Degrés' },
  { value: 'interval', label: 'Intervalles' },
  { value: 'finger', label: 'Doigtés' },
];

/** Sous-ensembles de cordes du découpage : on commence par les cordes graves (début de la montée). */
type StringLimit = 0 | 2 | 3 | 4;

export function ScaleDiscoveryPage() {
  const desktop = useDesktop();
  const settings = useSettings();
  const selection = useScaleSelection();
  const r = useMemo(() => resolveScale(selection, settings.noteNotation), [selection, settings.noteNotation]);
  const legend = useMemo(() => legendFor(r.def), [r.def]);

  const [direction, setDirection] = useState<Direction>('updown');
  const [annotation, setAnnotation] = useState<AnnotationKind>('degree');
  const [tempo, setTempo] = useState(70);
  const [loop, setLoop] = useState(false);
  const [drone, setDrone] = useState(true);
  const [metro, setMetro] = useState(false);
  const [chordLayer, setChordLayer] = useState(false);
  const [rootsOnly, setRootsOnly] = useState(false);
  const [stringLimit, setStringLimit] = useState<StringLimit>(0);
  const [showRhythm, setShowRhythm] = useState(false);
  const [compare, setCompare] = useState(false);
  const [compareId, setCompareId] = useState('');
  const [neckLink, setNeckLink] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);
  const [neckOpen, setNeckOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [transport, setTransport] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const [status, setStatus] = useState('');
  const playing = transport === 'playing';

  // --- position affichée (fondamentales seules, sous-ensemble de cordes)
  const shownPos = useMemo(() => {
    if (!r.position) return null;
    let p = r.position;
    if (rootsOnly) p = filterPosition(p, (n) => n.degree === '1' || n.degree === '5');
    if (stringLimit) p = filterPosition(p, (n) => n.string < stringLimit);
    return p.notes.length ? p : r.position;
  }, [r.position, rootsOnly, stringLimit]);

  // --- vue manche : les notes affichées par la tab, étiquetées comme elle, sur le fond de la position entière
  // avec la position voisine, la zone couvre les deux : c'est le passage de l'une à l'autre qu'on regarde
  const neighbourPos = useMemo(() => {
    const pair = r.position ? linkedPair(r.positions, r.position) : null;
    return pair ? (pair[0].id === r.position!.id ? pair[1] : pair[0]) : null;
  }, [r.positions, r.position]);
  const linkOn = neckLink && neighbourPos !== null;
  const neckLabelled = useMemo(
    () => (shownPos
      ? (linkOn ? linkNeckNotes(shownPos, neighbourPos!, annotation, settings.noteNotation) : neckNotes(shownPos, annotation, settings.noteNotation))
      : []),
    [shownPos, linkOn, neighbourPos, annotation, settings.noteNotation],
  );
  const neckZone = useMemo(() => {
    if (!r.position) return null;
    const { fretMin, fretMax } = r.position;
    return linkOn
      ? { from: Math.min(fretMin, neighbourPos!.fretMin), to: Math.max(fretMax, neighbourPos!.fretMax) }
      : { from: fretMin, to: fretMax };
  }, [r.position, linkOn, neighbourPos]);

  const scoreTab = useMemo(() => {
    if (!shownPos) return null;
    try {
      return positionToScore(shownPos, r.tuning, {
        direction,
        tempo,
        fingers: true,
        markChordTones: true,
        labelText: positionLabelPlain(shownPos, settings.noteNotation),
        ...(r.chord ? { chord: r.chord } : {}),
      });
    } catch {
      return null;
    }
  }, [shownPos, r.tuning, direction, tempo, r.chord, settings.noteNotation]);

  // --- comparaison : une gamme voisine (même tonique, même forme) ou les mêmes notes lues depuis une autre tonique
  const choices = useMemo(
    () => compareChoices(r.def, r.tonic, r.selection.system),
    [r.def, r.tonic, r.selection.system],
  );
  const choice = choices.find((c) => c.id === compareId) ?? choices[0] ?? null;
  const comparison = useMemo(() => {
    if (!compare || !choice || !r.position) return null;
    try {
      const base = shownPos ?? r.position;
      const relative = choice.kind === 'relative';
      const pos = relative
        ? relabelPosition(base, choice.def.id, choice.tonic)
        : counterpartPosition(neighbourPositions(choice.def.id, r.tonic, r.tuning, r.selection.system), r.position);
      if (!pos) return null;
      const diff = relative ? relativeDegrees(r.def, r.tonic, choice.def, choice.tonic) : differingDegrees(r.def, choice.def);
      const otherChord = defaultChordForScale(choice.def.id, choice.tonic);
      const other = positionToScore(pos, r.tuning, {
        direction, tempo, fingers: true,
        ...(otherChord ? { chord: otherChord } : {}),
      });
      const mine = positionToScore(base, r.tuning, {
        direction, tempo, fingers: true,
        ...(r.chord ? { chord: r.chord } : {}),
      });
      return { diff, score: markDegrees(other, diff.onlyB), mine: markDegrees(mine, diff.onlyA) };
    } catch {
      return null;
    }
  }, [compare, choice, r.position, r.tonic, r.tuning, r.selection.system, r.def, r.chord, direction, tempo, shownPos]);
  const otherTitle = choice ? scaleTitle(choice.def, choice.tonic, settings.noteNotation) : '';

  const openRelative = () => {
    if (!choice || !r.position) return;
    const positions = neighbourPositions(choice.def.id, choice.tonic, r.tuning, r.selection.system);
    setScaleSelection({ scaleId: choice.def.id, tonic: choice.tonic, positionIndex: samePlaceIndex(positions, r.position) });
    window.scrollTo({ top: 0 });
  };

  // --- lecture audio
  const player = useRef<TabPlayer | null>(null);
  if (player.current === null) player.current = new TabPlayer();
  const loaded = useRef<{ score: unknown; loop: boolean } | null>(null);
  const startedAt = useRef(0);
  const playedMs = useRef(0);

  useEffect(() => {
    player.current?.stop();
    loaded.current = null;
    playedMs.current = 0;
    startedAt.current = 0;
    setTransport('stopped');
    setStatus('');
  }, [scoreTab]);
  useEffect(() => player.current?.setTempo(tempo), [tempo]);
  useEffect(() => player.current?.setDrone(drone), [drone]);
  useEffect(() => player.current?.setMetronome(metro), [metro]);
  useEffect(() => {
    const p = player.current!;
    return () => p.dispose();
  }, []);

  const droneAvailable = scoreTab !== null && scoreTonic(scoreTab) !== null;

  const consume = (): number => {
    if (startedAt.current) {
      playedMs.current += performance.now() - startedAt.current;
      startedAt.current = 0;
    }
    return playedMs.current;
  };
  const logPlayed = () => {
    const seconds = Math.round(consume() / 1000);
    playedMs.current = 0;
    if (seconds >= 3 && r.position) {
      // une écoute est une tentative non vérifiée : elle compte pour la série et la durée, jamais pour l'XP
      const formIndex = r.position.formIndex ?? r.position.index;
      const node = nodeIdOf({ scaleId: r.def.id, system: r.selection.system, formIndex });
      appendAttempt(progressStore(), {
        id: newAttemptId(clock.now(), node, readAttempts(progressStore()).length),
        ts: clock.now(),
        kind: 'listen',
        scaleId: r.def.id,
        tonic: r.tonic,
        tuningId: r.tuning.id,
        system: r.selection.system,
        positionId: r.position.id,
        formIndex,
        level: 1,
        strings: r.tuning.strings.length,
        correct: null,
        total: null,
        seconds,
        fretMin: r.position.fretMin,
        missedStrings: [],
        tempoOk: false,
      });
    }
  };

  const onPlay = async () => {
    if (!scoreTab) return;
    const p = player.current!;
    try {
      await p.init(); // en premier : reprend le contexte audio dans le geste
      if (!loaded.current || loaded.current.score !== scoreTab || loaded.current.loop !== loop) {
        await p.load({ ...scoreTab, tempo }, { loop });
        loaded.current = { score: scoreTab, loop };
      }
      p.onEnded = () => {
        logPlayed();
        setTransport('stopped');
        setStatus('terminé');
      };
      await p.play();
      startedAt.current = performance.now();
      setTransport('playing');
      setStatus('');
    } catch (e) {
      setStatus(`erreur audio : ${(e as Error).message}`);
      setTransport('stopped');
    }
  };
  const onPause = () => {
    player.current?.pause();
    consume();
    setTransport('paused');
    setStatus('pause');
  };
  const onStop = () => {
    player.current?.stop();
    logPlayed();
    setTransport('stopped');
    setStatus('arrêté');
  };

  const gotoPosition = (delta: number) => {
    const n = r.positions.length;
    if (n === 0) return;
    setScaleSelection({ positionIndex: (r.selection.positionIndex + delta + n) % n });
  };

  const characteristic = (r.def.characteristic ?? []).map(fmtDegree);
  const steps = stepFormula(r.def);

  // --- pièces communes aux deux mises en page : téléphone (colonne) et bureau (surface unique)
  const back = <button type="button" className="back" onClick={() => navigate('gammes')} aria-label="Retour à la sélection">‹</button>;
  const subtitle = <p className="t-small t-dim">{positionLabelPlain(r.position, settings.noteNotation)} · {r.tuning.strings.length} cordes</p>;
  const tab = scoreTab ? (
    <TabView
      score={scoreTab}
      notes={settings.noteNotation}
      chords={settings.chordNotation}
      annotation={annotation}
      mode="wrap"
      scale="auto"
      reduceMotion={settings.reduceMotion}
      player={player.current}
      transport={transport}
      emphasizeChordTones={chordLayer}
      hideRhythm={!showRhythm}
      oneLine={desktop}
    />
  ) : (
    <Panel accent="yellow">
      <p className="t-body">Aucune position pour cette gamme / cet accordage.</p>
      <PixelButton onClick={() => navigate('gammes')}>Changer de système</PixelButton>
    </Panel>
  );
  const neckSwitch = (
    <Switch
      checked={settings.showNeck}
      onChange={(v) => setSettings({ showNeck: v })}
      label="Vue manche"
      hint="la forme de la position, tonique cerclée"
      inline
    />
  );
  // la forme que la tab écrit en chiffres : même pastilles, même orientation (aiguë en haut)
  const neckPanel = scoreTab && neckZone && (
    <Panel
      className="span-12 neck-panel"
      label="Manche"
      right={<span className="badge">tonique {fmtNote(r.tonic, settings.noteNotation)} · cases {neckZone.from}–{neckZone.to}</span>}
    >
      <NeckView
        tuning={r.tuning}
        notes={neckLabelled}
        zone={neckZone}
        notation={settings.noteNotation}
        label={positionLabelPlain(r.position, settings.noteNotation)}
      />
      {neighbourPos && (
        <div className="neck-link">
          <Switch
            checked={linkOn}
            onChange={setNeckLink}
            label="Position voisine"
            hint={`cases ${neighbourPos.fretMin}–${neighbourPos.fretMax}`}
            inline
          />
          {linkOn && (
            <>
              <p className="t-small t-dim">En pointillés, les cases communes : c’est par elles que la main passe d’une position à l’autre.</p>
              <PixelButton variant="quiet" onClick={() => { requestLiaison(); navigate('sequences'); }}>
                Travailler la liaison ›
              </PixelButton>
            </>
          )}
        </div>
      )}
    </Panel>
  );
  const neck = settings.showNeck && neckPanel;
  const tabLegend = <TabLegend def={r.def} readonly={settings.reduceMotion} />;
  // le chemin d'une forme en cinq niveaux : on est au 1, les suivants sont à un toucher
  const levels = (
    <LevelsNav
      current={1}
      onSelect={(n) => navigate(n === 5 ? 'impro' : n === 4 ? 'sequences' : 'training')}
    />
  );
  const prevPosition = <PixelButton variant="quiet" onClick={() => gotoPosition(-1)} disabled={r.positions.length < 2}>‹ Position</PixelButton>;
  const nextPosition = <PixelButton variant="quiet" onClick={() => gotoPosition(1)} disabled={r.positions.length < 2}>Position ›</PixelButton>;
  const positionCount = <span className="t-label pos-count">{r.selection.positionIndex + 1} / {r.positions.length}</span>;
  const transportButtons = (
    <>
      <PixelButton variant="primary" onClick={onPlay} disabled={!scoreTab || playing} ariaLabel="Lecture" className="play">
        <PixelIcon name="play" size={18} /> {transport === 'paused' ? 'Reprendre' : 'Écouter'}
      </PixelButton>
      <PixelButton variant="quiet" onClick={onPause} disabled={!playing} ariaLabel="Pause">
        <PixelIcon name="pause" size={14} />
      </PixelButton>
      <PixelButton variant="quiet" onClick={onStop} ariaLabel="Stop">
        <PixelIcon name="stop" size={12} />
      </PixelButton>
    </>
  );
  // le tempo est un réglage de lecture : il vit sur la même ligne que le transport, à droite
  const tempoControl = (
    <div className="tempo-group">
      <span className="t-label">Tempo</span>
      <div className="tempo">
        <button type="button" className="tempo-btn" onClick={() => setTempo((t) => Math.max(40, t - 5))} aria-label="Moins vite">−</button>
        <span className="tempo-val">♩ {tempo}</span>
        <button type="button" className="tempo-btn" onClick={() => setTempo((t) => Math.min(200, t + 5))} aria-label="Plus vite">+</button>
      </div>
    </div>
  );
  const audioSwitches = (droneInline: boolean) => (
    <>
      <Switch checked={drone && droneAvailable} onChange={setDrone} label="Drone" hint="fond. + quinte" inline={droneInline} />
      <Switch checked={metro} onChange={setMetro} label="Métronome" />
      <Switch checked={loop} onChange={setLoop} label="Boucle" />
    </>
  );
  // Une phrase sur la gamme elle-même (« mêmes notes que Do majeur ») : elle ouvre le panneau,
  // au lieu de traîner en bas après les options, où elle n'avait ni sujet ni étiquette.
  const parentNote = r.parent && <p className="t-small t-dim">{r.parent}</p>;
  const directionField = (
    <div className="field">
      <span className="t-label">Sens</span>
      <Segmented
        size="sm"
        label="Sens de lecture"
        value={direction}
        onChange={setDirection}
        options={(Object.keys(DIRECTION_LABEL) as Direction[]).map((d) => ({ value: d, label: DIRECTION_LABEL[d] }))}
      />
    </div>
  );
  const annotationOptions = (
    <Segmented
      size="sm"
      label="Annotation"
      value={annotation}
      onChange={setAnnotation}
      options={ANNOTATIONS.map((a) => ({ value: a.value, label: a.label }))}
    />
  );
  const neckNote = settings.showNeck && <p className="t-small t-dim">Elle s’applique aussi au manche.</p>;
  const moreOptions = (
    <>
      <details className="more-opts">
        <summary className="t-label">Plus d’options</summary>
        <div className="field">
          <span className="t-label">Cordes (découpage)</span>
          <Segmented<StringLimit>
            size="sm"
            label="Nombre de cordes affichées"
            value={stringLimit}
            onChange={setStringLimit}
            options={[
              { value: 0, label: 'toutes' },
              { value: 2, label: '2 graves' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
          />
        </div>
        <div className="toggle-grid">
          <Switch checked={chordLayer} onChange={setChordLayer} label={`Accord${r.chord ? ` (${r.chord})` : ''}`} hint="estompe les autres notes" />
          <Switch checked={rootsOnly} onChange={setRootsOnly} label="Fondamentales" hint="1 et 5 seulement" />
        </div>
        <Switch checked={showRhythm} onChange={setShowRhythm} label="Rythme" hint="hampes et ligatures" />
        {stringLimit !== 0 && (
          <p className="t-small t-dim">Découpage : les {stringLimit} cordes graves d’abord, puis on ajoute les suivantes.</p>
        )}
      </details>
      {status && <p className="t-small t-dim status">{status}</p>}
    </>
  );
  // Le geste suivant, écrit noir sur blanc : on a vu la position, on la joue. Deux suites, et pas
  // une seule : répéter la position (justesse) ou improviser dessus (musique) — c'est la même
  // position, ce ne sont pas les mêmes compétences.
  const nextStep = (
    <div className="next-step">
      <div className="next-step-row">
        <PixelButton variant="primary" onClick={() => navigate('training')} title="S’exercer sur cette position, au micro" ariaLabel="S’exercer sur cette position, au micro">
          ▶ S’exercer
        </PixelButton>
        <PixelButton onClick={() => navigate('impro')} title="Improviser sur cette position, avec un accompagnement" ariaLabel="Improviser sur cette position, avec un accompagnement">
          Improviser
        </PixelButton>
        <PixelButton variant="quiet" onClick={() => navigate('sequences')} title="Séquences au métronome : par 3, par 4, tierces, quartes, saut de corde, tour depuis un degré" ariaLabel="Séquences au métronome">
          Séquences
        </PixelButton>
      </div>
      <p className="t-small t-dim">
        S’exercer : le micro valide chaque note, la case se remplit. Sans micro, le pavé numérique
        prend le relais. Le niveau 2 masque une partie des notes, le niveau 3 toute la tablature : seule une
        tentative de l’exercice sert à la révision, une écoute ici ne prouve rien.
      </p>
    </div>
  );
  // la règle et les couleurs d'abord : la comparaison s'y appuie
  const structure = (
    <>
      <ScaleRuler def={r.def} />
      <p className="t-small t-dim">
        Sur une corde, chaque chiffre compte les cases jusqu’à la note suivante : 12 cases de la fondamentale à l’octave.
        Cette suite reconstruit la gamme depuis n’importe quelle case.
      </p>
      <p className="t-label structure-sub">Une couleur par rôle</p>
      <div className="legend">
        {legend.map((it) => (
          <div key={it.fn} className="legend-item">
            <span className="legend-pill" style={{ background: it.fill, color: it.digit }}>{it.fn}</span>
            <span className="legend-name">{it.name}</span>
            {it.characteristic && <span className="tag tag-on">caractéristique</span>}
          </div>
        ))}
      </div>
      <p className="t-small t-dim">
        Chaque couleur marque le <strong>rôle</strong> de la note dans la gamme, pas sa place sur le manche : ♯4 et ♭5 sont sur la même case, mais gardent chacune leur couleur.
        {characteristic.length > 0 ? ` Note${characteristic.length > 1 ? 's' : ''} caractéristique${characteristic.length > 1 ? 's' : ''} : ${characteristic.join(', ')} (anneau qui pulse).` : ''}
      </p>
    </>
  );
  const compareChooser = choice && choices.length > 1 && (
    <Segmented
      size="sm"
      label="Gamme à comparer"
      value={choice.id}
      onChange={setCompareId}
      options={choices.map((c) => ({ value: c.id, label: c.short, note: c.difference }))}
    />
  );
  const compareResult = choice && (
    <>
      {compare && comparison && (
        <>
          <p className="t-small">
            {choice.kind === 'relative' ? (
              <><strong>Mêmes notes, mêmes cases</strong> : seule la tonique change. La note qui brille est la fondamentale de l’autre gamme.</>
            ) : (
              <><strong>Même forme au même endroit</strong> : {choice.difference} (la note qui brille).</>
            )}
          </p>
          <p className="t-label comp-label">{r.title} · {comparison.diff.onlyA.join(' ') || '—'}</p>
          <TabView
            score={comparison.mine}
            notes={settings.noteNotation}
            chords={settings.chordNotation}
            annotation={annotation}
            mode="wrap"
            scale="auto"
            reduceMotion
            player={null}
            transport="stopped"
            hideRhythm
          />
          <p className="t-label comp-label">{otherTitle} · {comparison.diff.onlyB.join(' ') || '—'}</p>
          <TabView
            score={comparison.score}
            notes={settings.noteNotation}
            chords={settings.chordNotation}
            annotation={annotation}
            mode="wrap"
            scale="auto"
            reduceMotion
            player={null}
            transport="stopped"
            hideRhythm
          />
          {choice.kind === 'relative' && (
            <PixelButton variant="quiet" onClick={openRelative}>Ouvrir {otherTitle} ›</PixelButton>
          )}
        </>
      )}
      {compare && !comparison && <p className="t-small t-dim">Pas de position équivalente pour cette comparaison.</p>}
    </>
  );

  if (desktop) {
    return (
      <main className="shell play-shell">
        <div className="play-surface">
          {/* l'identité et l'écoute restent à portée pendant tout le défilement */}
          <header className="play-head">
            <div className="play-id">
              {back}
              <div>
                <div className="play-title">
                  <h1 className="page-title">{r.title}</h1>
                  <span className="tag tag-on">Niv1</span>
                </div>
                {subtitle}
              </div>
            </div>
            <div className="play-transport">{transportButtons}</div>
            {tempoControl}
            <div className="play-toggles">{audioSwitches(false)}</div>
          </header>

          <section className="play-tab">
            <div className="play-tab-bar">
              <div className="play-degrees" role="img" aria-label={`Couleurs des degrés : ${legend.map((it) => it.name).join(', ')}`}>
                {legend.map((it) => (
                  <span key={it.fn} className="legend-pill" style={{ background: it.fill, color: it.digit }}>{it.fn}</span>
                ))}
              </div>
              {directionField}
              <div className="field">
                <span className="t-label">Annotation</span>
                {annotationOptions}
              </div>
              {neckPanel && <PixelButton variant="quiet" onClick={() => setNeckOpen(true)}>Vue manche</PixelButton>}
            </div>
            {tab}
            {tabLegend}
          </section>

          {neckOpen && neckPanel && (
            <dialog
              ref={(d) => { if (d && !d.open) d.showModal(); }}
              className="play-neck-dialog"
              aria-label="Vue manche"
              onClose={() => setNeckOpen(false)}
              // un clic sur le fond (hors du contenu) referme
              onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
            >
              {neckPanel}
              <form method="dialog" className="play-neck-close">
                <PixelButton variant="quiet" onClick={() => setNeckOpen(false)}>Fermer</PixelButton>
              </form>
            </dialog>
          )}

          <div className="play-nav">
            {levels}
            <div className="play-pos">
              {prevPosition}
              <span className="play-dots" aria-hidden="true">
                {r.positions.map((p, i) => <span key={p.id} className={i === r.selection.positionIndex ? 'on' : ''} />)}
              </span>
              {positionCount}
              {nextPosition}
            </div>
          </div>

          <div className="play-more">
            <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
              {infoOpen ? '▾ Masquer les détails' : '▸ Détails de la gamme'}
            </PixelButton>
          </div>

          {infoOpen && (
            <div className="play-columns">
              <div className="play-col">
                <PlaySection
                  title="Structure"
                  action={(
                    <button type="button" className="linkish" aria-expanded={structureOpen} onClick={() => setStructureOpen((o) => !o)}>
                      {structureOpen ? '▾ Masquer' : '▸ Détails'}
                    </button>
                  )}
                >
                  <div className="play-steps" role="img" aria-label={`Structure de la gamme : ${steps.join(', ')}`}>
                    {steps.map((s, i) => (
                      <span key={i} className={Number(s) === 1 ? 'semi' : ''} style={{ flexGrow: Number(s) }}>{s}</span>
                    ))}
                  </div>
                  <p className="t-small t-dim">Chaque chiffre compte les cases : 1 = un demi-ton, 2 = un ton.</p>
                  {structureOpen && structure}
                </PlaySection>
                <PlaySection title="Lecture">{parentNote}{moreOptions}</PlaySection>
              </div>

              <div className="play-col">
                {choice && (
                  <PlaySection title="Comprendre" tone="cyan">
                    <div className="play-compare">
                      <span className="t-label">Comparer avec</span>
                      {compareChooser}
                      <Switch checked={compare} onChange={setCompare} label="Côte à côte" />
                    </div>
                    <p className="t-small t-dim">{otherTitle} : {choice.difference}</p>
                    {compareResult}
                  </PlaySection>
                )}
                {r.hint && (
                  <PlaySection title="Ce que tu écoutes" tone="cyan">
                    <p className="play-hint">{r.hint}</p>
                  </PlaySection>
                )}
              </div>
            </div>
          )}

          <footer className="play-foot">
            <InstrumentPicker />
            <PixelButton variant="quiet" onClick={() => navigate('gammes')}>← Changer de gamme</PixelButton>
          </footer>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="page-head">
        {back}
        <div>
          <h1 className="page-title">{r.title}</h1>
          {subtitle}
        </div>
        <span className="tag tag-on">Niv1</span>
      </header>

      {tab}

      {scoreTab && <div className="listen-band">{neckSwitch}</div>}

      {neck}

      {tabLegend}

      {levels}

      <div className="pos-nav">
        {prevPosition}
        {positionCount}
        {nextPosition}
      </div>

      <Panel className="span-7" accent="magenta" label="Écoute" right={<span className="badge">{r.formula}</span>}>
        <div className="transport-row">
          {transportButtons}
          {tempoControl}
        </div>
        <div className="toggle-grid">{audioSwitches(true)}</div>
      </Panel>

      <Panel className="span-5 panel-fill" label="Lecture">
        {parentNote}
        {directionField}
        <div className="field">
          <span className="t-label">Annotation sous la tablature</span>
          {annotationOptions}
          {neckNote}
        </div>
        {moreOptions}
      </Panel>

      {nextStep}

      <Panel className="span-12" label="Structure" right={<span className="badge">{steps.join('-')}</span>}>{structure}</Panel>

      {choice && (
        <Panel className="span-12" label="Comparer">
          {compareChooser && (
            <div className="field">
              <span className="t-label">Avec</span>
              {compareChooser}
            </div>
          )}
          <Switch
            checked={compare}
            onChange={setCompare}
            label="Côte à côte"
            hint={`${otherTitle} : ${choice.difference}`}
          />
          {compareResult}
        </Panel>
      )}

      {r.hint && (
        <Panel className="span-12" label="Ce que tu écoutes">
          <p className="t-body">{r.hint}</p>
        </Panel>
      )}

      <Panel className="span-12">
        <InstrumentPicker />
      </Panel>

      <div className="row span-7 page-exit">
        <PixelButton variant="quiet" onClick={() => navigate('gammes')}>← Changer de gamme</PixelButton>
      </div>
    </main>
  );
}
