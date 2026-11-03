import { PracticeHeader, PositionRail, PositionStepper } from './PracticeHeader';
/**
 * Module Gammes — « Découvrir » (BRIEF.md §2, docs/ARCHITECTURE.md §6.3).
 * La gamme est écrite en tablature, en aller-retour, avec :
 *  - les couleurs de fonction d'intervalle et le glow des notes caractéristiques du mode ;
 *  - quatre annotations au choix (note, degré, intervalle, doigté) ;
 *  - un calque « notes de l'accord » qui estompe les notes étrangères ;
 *  - le mode « fondamentales d'abord » et le découpage par nombre de cordes (chunking) ;
 *  - la comparaison de deux modes voisins ;
 *  - le son final de la 1c (échantillons CC0), un drone de fondamentale, un métronome.
 * Une écoute n'est écrite nulle part : c'est un outil. « Réviser cette forme » ouvre le rappel à froid.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { requestFormReview, requestLiaison, setScaleSelection, useScaleSelection } from '../../app/scaleSession';
import { useSettings } from '../../app/settings';
import { TabView } from '../../app/TabView';
import { NeckView } from '../../app/NeckView';
import { Panel, PixelButton, PixelIcon, Segmented, Switch } from '../../app/ui';
import { filterPosition, fmtNote, linkedPair, relabelPosition, stepFormula } from '../../core/theory';
import { type AnnotationKind, defaultChordForScale, linkNeckNotes, neckNotes, positionToScore } from '../../core/tab';
import { TabPlayer, scoreTonic } from '../../core/audio/tabPlayer';
import { fmtDegree, legendFor, positionLabelPlain, resolveScale, scaleTitle } from './resolve';
import { ScaleRuler } from './ScaleRuler';
import { TabLegend } from './TabLegend';
import { PlaySection } from './PlaySection';
import { useDesktop } from '../../app/useDesktop';
import { LandscapeView, openLandscape } from '../../app/LandscapeView';
import {
  compareChoices, counterpartPosition, differingDegrees, markDegrees, neighbourPositions, relativeDegrees, samePlaceIndex,
} from './compare';

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
  const [tabFull, setTabFull] = useState(false);
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
        direction: 'updown',
        tempo,
        fingers: true,
        markChordTones: true,
        labelText: positionLabelPlain(shownPos, settings.noteNotation),
        ...(r.chord ? { chord: r.chord } : {}),
      });
    } catch {
      return null;
    }
  }, [shownPos, r.tuning, tempo, r.chord, settings.noteNotation]);

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
        direction: 'updown', tempo, fingers: true,
        ...(otherChord ? { chord: otherChord } : {}),
      });
      const mine = positionToScore(base, r.tuning, {
        direction: 'updown', tempo, fingers: true,
        ...(r.chord ? { chord: r.chord } : {}),
      });
      return { diff, score: markDegrees(other, diff.onlyB), mine: markDegrees(mine, diff.onlyA) };
    } catch {
      return null;
    }
  }, [compare, choice, r.position, r.tonic, r.tuning, r.selection.system, r.def, r.chord, tempo, shownPos]);
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

  useEffect(() => {
    player.current?.stop();
    loaded.current = null;
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
        setTransport('stopped');
        setStatus('terminé');
      };
      await p.play();
      setTransport('playing');
      setStatus('');
    } catch (e) {
      setStatus(`erreur audio : ${(e as Error).message}`);
      setTransport('stopped');
    }
  };
  const onPause = () => {
    player.current?.pause();
    setTransport('paused');
    setStatus('pause');
  };
  const onStop = () => {
    player.current?.stop();
    setTransport('stopped');
    setStatus('arrêté');
  };

  const closeTabFull = useCallback(() => setTabFull(false), []);
  const openTabFull = () => {
    setTabFull(true);
    openLandscape();
  };

  const gotoPosition = (delta: number) => {
    const n = r.positions.length;
    if (n === 0) return;
    setScaleSelection({ positionIndex: (r.selection.positionIndex + delta + n) % n });
  };

  const characteristic = (r.def.characteristic ?? []).map(fmtDegree);
  const steps = stepFormula(r.def);

  // --- pièces communes aux deux mises en page : téléphone (colonne) et bureau (surface unique)
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
        playback={{ score: scoreTab, player: player.current!, transport }}
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
              <p className="t-small t-dim">Les cases en pointillés sont communes aux deux positions. Utilise-les pour passer de l’une à l’autre.</p>
              <PixelButton variant="quiet" onClick={() => { requestLiaison(); navigate('sequences'); }}>
                Travailler la liaison ›
              </PixelButton>
            </>
          )}
        </div>
      )}
    </Panel>
  );
  const neckButton = neckPanel && <PixelButton variant="quiet" onClick={() => setNeckOpen(true)}>Vue manche</PixelButton>;
  const neckDialog = neckOpen && neckPanel && (
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
  );
  const tabLegend = <TabLegend def={r.def} readonly={settings.reduceMotion} />;
  const reviewForm = () => {
    requestFormReview();
    navigate('review');
  };
  const reviewButton = r.position && <PixelButton onClick={reviewForm}>Réviser cette forme</PixelButton>;
  const reviewNote = (
    <p className="t-small t-dim">
      « Réviser cette forme » lance un rappel de mémoire au micro, sur toute la position. La forme entre alors dans ta
      file de révision et revient à intervalles croissants, en haut de la page Gammes.
    </p>
  );
  const transportButtons = (
    <>
      <PixelButton variant="primary" onClick={onPlay} disabled={!scoreTab || playing} ariaLabel="Lecture" className="play">
        <PixelIcon name="play" size={18} /> <span className="transport-label">{transport === 'paused' ? 'Reprendre' : 'Écouter'}</span>
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
  const annotationOptions = (
    <Segmented
      size="sm"
      label="Annotation"
      value={annotation}
      onChange={setAnnotation}
      options={ANNOTATIONS.map((a) => ({ value: a.value, label: a.label }))}
    />
  );
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
  const tabFullView = tabFull && scoreTab && (
    <LandscapeView label={`Tablature : ${r.title}`} onClose={closeTabFull}>
      <div className="tab-full-bar">
        <PixelButton variant="quiet" onClick={closeTabFull}>Fermer</PixelButton>
        <span className="tab-full-title">{r.title}</span>
        <div className="tab-full-transport">{transportButtons}</div>
        {tempoControl}
      </div>
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
        oneLine
      />
    </LandscapeView>
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
        <div className="play-surface practice-surface">
          {/* l'identité et l'écoute restent à portée pendant tout le défilement */}
          <PracticeHeader scale={r} current="scale" disabled={transport !== 'stopped'} />

          <section className="play-tab practice-tab">
            <div className="play-tab-bar">
              <div className="play-degrees" role="img" aria-label={`Couleurs des degrés : ${legend.map((it) => it.name).join(', ')}`}>
                {legend.map((it) => (
                  <span key={it.fn} className="legend-pill" style={{ background: it.fill, color: it.digit }}>{it.fn}</span>
                ))}
              </div>
              <div className="field">
                <span className="t-label">Annotation</span>
                {annotationOptions}
              </div>
              {neckButton}
              <PositionStepper scale={r} onStep={gotoPosition} />
            </div>
            <div className="practice-score"><PositionRail scale={r} disabled={transport !== 'stopped'} onSelect={i => gotoPosition(i - r.selection.positionIndex)} /><div className="practice-score-body"><p className="practice-position">{positionLabelPlain(r.position!, settings.noteNotation)}</p>{tab}</div></div>
            {tabLegend}
          </section>

          {neckDialog}

          <div className="practice-transport play-head">
            <div className="transport-side">{tempoControl}</div>
            <div className="play-transport">{transportButtons}</div>
            <div className="transport-side play-toggles">{audioSwitches(false)}</div>
          </div>

          <div className="play-more">
            <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
              {infoOpen ? '▾ Masquer les détails' : '▸ Détails de la gamme'}
            </PixelButton>
            {reviewButton}
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
                  <p className="t-small t-dim">Les chiffres indiquent le nombre de cases : 1 pour un demi-ton, 2 pour un ton.</p>
                  {structureOpen && structure}
                </PlaySection>
                <PlaySection title="Lecture">{parentNote}{moreOptions}</PlaySection>
                <PlaySection title="Révision">{reviewNote}</PlaySection>
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
        </div>
        {tabFullView}
      </main>
    );
  }

  // Téléphone : un seul bloc, comme la surface du bureau. Une tablature à la verticale se lit mal (plusieurs
  // écrans pour une position) : le manche la remplace, la note jouée s'y cadre, et la tablature reste à un
  // geste. Les commandes suivent le manche ; la théorie s'ouvre juste sous « Détails », en bas du bloc.
  return (
    <main className="shell mplay">
      <div className="mplay-surface">
      <PracticeHeader scale={r} current="scale" disabled={transport !== 'stopped'} />

      <section className="mplay-tab">
        <div className="mplay-bar">
          <div className="mplay-pos">
            <PixelButton variant="quiet" onClick={() => gotoPosition(-1)} disabled={r.positions.length < 2} ariaLabel="Position précédente">‹</PixelButton>
            <span className="t-label">Position {r.selection.positionIndex + 1} / {r.positions.length}</span>
            <PixelButton variant="quiet" onClick={() => gotoPosition(1)} disabled={r.positions.length < 2} ariaLabel="Position suivante">›</PixelButton>
          </div>
          {annotationOptions}
          <div className="mplay-toggles">{audioSwitches(false)}</div>
        </div>
        {neckPanel}
        <div className="mplay-transport">{transportButtons}{tempoControl}</div>
        {tabLegend}
        {scoreTab && (
          <div className="mplay-tab-toggle">
            <PixelButton variant="quiet" onClick={openTabFull}>Tablature</PixelButton>
          </div>
        )}
        {!scoreTab && tab}
      </section>

      <div className="mplay-more">
        {reviewButton}
        <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
          {infoOpen ? '▾ Masquer les détails' : '▸ Détails de la gamme'}
        </PixelButton>
      </div>

      {infoOpen && (
        <div className="mplay-details">
          <Panel className="span-12" label="Lecture" right={<span className="badge">{r.formula}</span>}>
            {parentNote}
            {moreOptions}
          </Panel>

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

          <Panel className="span-12" label="Révision">{reviewNote}</Panel>
        </div>
      )}
      </div>

      {tabFullView}
    </main>
  );
}
