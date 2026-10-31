/**
 * Module Accords — écran d'entrée (phase 4a) : le parcours, l'accord recommandé, l'état de chacun.
 *
 * Ce que l'écran ne fait pas : il n'invente aucun chiffre. « Appris » vient du journal (3 vérifications
 * propres en mode arpège sur 2 jours), « commencé » d'au moins une vérification enregistrée. Un accord
 * verrouillé n'est **jamais** inaccessible : la raison est écrite, et on peut entrer quand même
 * (le brief demande que rien ne bloque).
 */
import { useMemo, useState } from 'react';
import { navigate } from '../../app/router';
import { requestLessonStep, setChordSelection } from '../../app/chordSession';
import { useSettings } from '../../app/settings';
import { useDesktop } from '../../app/useDesktop';
import { ChordBoxView } from '../../app/ChordBoxView';
import { Bar, Chip, Panel, PixelButton, Reveal } from '../../app/ui';
import { fmtChord, fmtNote } from '../../core/theory';
import { interpretChord } from '../../core/theory/chords';
import { loadJournal, progressStore, summarizeNodes } from '../../core/progress';
import { voicingById } from '../../data/voicings';
import { CURRICULUM, FIRST_CHORDS, FIRST_CHORDS_MORE, FIRST_CHORDS_PLAN, whySentence } from './curriculum';
import type { FirstChord, Palier } from './curriculum';
import {
  chordCards, chordProgress, firstChordsProgress, learnedChordIds, startedChordIds, palierStates, nextChord, reviewDelayText,
} from './recommend';
import type { ChordCard } from './recommend';
import { CYCLE_LIMITS } from './lesson';
import { CHANGE_MISTAKES, CHANGE_RULES, CHANGE_STEPS, CHANGE_WHOLE_SHAPE } from './changeGuide';
import * as clock from '../../core/clock';

const STATUS_LABEL: Record<string, string> = {
  learned: 'appris',
  learning: 'commencé',
  available: 'ouvert',
  locked: 'plus tard',
};

/** Repli de « Mes premiers accords », retenu d'une visite à l'autre (confort, pas une donnée). */
const FIRST_FOLD_KEY = 'fretwave.accords.firstFolded';

function readFirstFolded(): boolean | null {
  try {
    const v = localStorage.getItem(FIRST_FOLD_KEY);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

function writeFirstFolded(folded: boolean): void {
  try {
    localStorage.setItem(FIRST_FOLD_KEY, folded ? '1' : '0');
  } catch {
    /* stockage interdit : le repli vaut pour la visite */
  }
}

function fretsText(frets: readonly (number | null)[]): string {
  return frets.map((f) => (f === null ? 'x' : String(f))).join(' ');
}

export function ChordsPage() {
  const desktop = useDesktop();
  const [infoOpen, setInfoOpen] = useState(false);
  const settings = useSettings();
  const [journal] = useState(() => loadJournal(progressStore()));
  const [branch, setBranch] = useState(false);

  const learned = useMemo(() => learnedChordIds(journal), [journal]);
  const started = useMemo(() => startedChordIds(journal), [journal]);
  const cards = useMemo(() => chordCards(learned, started), [learned, started]);
  const progress = chordProgress(learned);
  const states = useMemo(() => palierStates(learned), [learned]);
  const next = useMemo(() => nextChord(learned, { branch }), [learned, branch]);
  const nextVoicing = next ? voicingById(next.voicingId) : undefined;
  const chordNodes = useMemo(() => summarizeNodes(journal).filter((n) => n.module === 'accords'), [journal]);
  // Seul le palier en cours est déplié : 35 lignes ouvertes faisaient dix écrans au téléphone et
  // noyaient l'endroit où l'on en est. Les autres tiennent en deux lignes, dépliables à la demande.
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(
    () => new Set(states.filter((s) => s.status === 'current').map((s) => s.palier.id)),
  );
  const toggle = (id: string) => setUnfolded((prev) => {
    const out = new Set(prev);
    if (out.has(id)) out.delete(id); else out.add(id);
    return out;
  });

  const open = (voicingId: string) => {
    setChordSelection({ voicingId });
    navigate('chord');
  };
  const chordName = (symbol: string) => fmtChord(symbol, settings.chordNotation);
  const first = firstChordsProgress(learned);
  // déplié par défaut tant que les huit ne sont pas appris ; ensuite, replié sauf choix contraire
  const [firstFolded, setFirstFolded] = useState(() => readFirstFolded() ?? first.done === first.total);
  const toggleFirst = () => setFirstFolded((f) => {
    writeFirstFolded(!f);
    return !f;
  });
  const practiseChange = () => {
    requestLessonStep('enchainer');
    navigate('chord');
  };

  // « Mes premiers accords » (D105) : une tuile par accord, qui ouvre sa leçon habituelle
  const firstTile = (fc: FirstChord) => {
    const fv = voicingById(fc.voicingId);
    if (!fv) return null;
    const name = chordName(fv.chord);
    const isLearned = learned.has(fc.voicingId);
    const isStarted = started.has(fc.voicingId);
    return (
      <button
        key={fc.voicingId}
        type="button"
        className={`first-tile ${isLearned ? 'learned' : ''}`}
        onClick={() => open(fc.voicingId)}
        aria-label={`${isLearned ? 'Revoir' : 'Apprendre'} ${name} : ${fc.note}`}
      >
        <ChordBoxView voicing={fv} maxScale={2} />
        <span className="first-name">{name}</span>
        <span className="first-note">{fc.note}</span>
        {/* pas d'étiquette pour un accord neuf : seuls l'état et la difficulté méritent d'être lus */}
        {(isLearned || isStarted || fc.hard) && (
          <span className={`tag ${isLearned ? 'tag-on' : ''}`}>{isLearned ? 'appris' : isStarted ? 'commencé' : 'difficile'}</span>
        )}
      </button>
    );
  };

  const row = (card: ChordCard) => {
    const info = interpretChord(card.voicing.chord);
    const name = chordName(card.voicing.chord);
    // « prérequis » à côté d'un bouton « entrer » disait deux choses contraires : on nomme l'accord
    // qui vient d'abord, et l'entrée reste ouverte (rien ne bloque)
    const status = card.status === 'locked' && card.missing.length > 0
      ? `après ${card.missing.map(chordName).join(', ')}`
      : STATUS_LABEL[card.status];
    return (
      <article key={card.voicing.id} className={`chord-row ${card.status}`}>
        <ChordBoxView voicing={card.voicing} maxScale={2} />
        <div className="chord-main">
          <h3 className="chord-name">{name}</h3>
          <p className="t-small t-dim">
            <span className="chord-frets">{fretsText(card.voicing.frets)}</span>
            {' · '}{info.notes.map((n) => fmtNote(n, settings.noteNotation)).join(' – ')}
          </p>
          <p className="t-small">{whySentence(card.entry.why)}</p>
        </div>
        <div className="chord-side">
          <span className={`tag ${card.status === 'learned' ? 'tag-on' : ''}`}>{status}</span>
          {card.transitions > 0 && <span className="t-small t-dim">{card.transitions} transition{card.transitions > 1 ? 's' : ''}</span>}
          <Chip small ariaLabel={`${card.status === 'learned' ? 'Revoir' : 'Entrer'} : ${name}`} onClick={() => open(card.voicing.id)}>
            {card.status === 'learned' ? 'revoir' : 'entrer'}
          </Chip>
        </div>
      </article>
    );
  };

  const palierPanel = (palier: Palier) => {
    const st = states.find((s) => s.palier.id === palier.id)!;
    const mine = cards.filter((c) => c.palier.id === palier.id);
    // le code du palier (« P2 ») est interne, comme sur l'accueil : l'élève lit son titre
    if (palier.branch && !branch) {
      return (
        <Panel key={palier.id} className="span-12 palier" label={palier.title} right={<span className="tag">optionnel</span>}>
          <p className="t-small">{palier.goal} <span className="t-dim">· {st.reason}</span></p>
          <div className="row palier-actions">
            <button type="button" className="palier-toggle" onClick={() => { setBranch(true); setUnfolded((p) => new Set(p).add(palier.id)); }}>
              Afficher la branche rock
            </button>
          </div>
        </Panel>
      );
    }
    const isOpen = unfolded.has(palier.id);
    const count = mine.length;
    // le palier en cours est accentué, sans halo : le seul halo de l'écran est le héros (D104)
    return (
      <Panel
        key={palier.id}
        className="span-12 palier"
        accent={st.status === 'current' ? 'cyan' : undefined}
        label={palier.title}
        right={<span className={`tag ${st.status === 'done' ? 'tag-on' : ''}`}>{st.total === 0 ? 'à faire une fois' : `${st.done} / ${st.total}`}</span>}
      >
        <p className="t-small">{palier.goal} <span className="t-dim">· {st.reason}</span></p>
        {isOpen && (
          <>
            <details className="prof-note">
              <summary className="t-small">Avis de prof</summary>
              <p className="t-small t-dim">{palier.prof}</p>
            </details>
            {palier.drills && (
              <ul className="module-facts">
                {palier.drills.map((d) => <li key={d} className="t-small t-dim">{d}</li>)}
              </ul>
            )}
            {count > 0 && <div className="chord-list">{mine.map(row)}</div>}
          </>
        )}
        <div className="row palier-actions">
          <button type="button" className="palier-toggle" aria-expanded={isOpen} onClick={() => toggle(palier.id)}>
            {isOpen ? 'Replier' : count > 0 ? `Voir les ${count} accord${count > 1 ? 's' : ''}` : 'Voir le détail'}
          </button>
          {palier.branch && (
            <button type="button" className="palier-toggle" onClick={() => setBranch(false)}>Masquer la branche rock</button>
          )}
        </div>
      </Panel>
    );
  };

  // D106 : comment travailler un changement ; l'exercice mesuré reste l'étape Enchaîner de la leçon
  const changeGuide = (
      <Panel className="span-12 change-guide" accent="violet" label="Changer d’accord">
        {/* les trois règles sont la page : côte à côte au bureau, empilées serrées au téléphone */}
        <ol className="pix-steps pix-steps-rules">
          {CHANGE_RULES.map((r) => <li key={r}>{r}</li>)}
        </ol>
        <Reveal
          label="Pour aller plus loin sur le changement d’accord"
          items={[
            {
              id: 'methode',
              label: 'Méthode',
              content: (
                <>
                  <ol className="pix-steps pix-steps-cols">
                    {CHANGE_STEPS.map((r) => <li key={r}>{r}</li>)}
                  </ol>
                  <p className="t-small t-dim">La main droite ne joue qu’à la dernière étape : avant, c’est la main gauche seule qui apprend.</p>
                </>
              ),
            },
            {
              id: 'sans-pivot',
              label: 'Sans pivot',
              content: (
                <ul className="module-facts">
                  {CHANGE_WHOLE_SHAPE.map((r) => <li key={r} className="t-small">{r}</li>)}
                </ul>
              ),
            },
            {
              id: 'pieges',
              label: 'Pièges',
              content: (
                <ul className="module-facts module-facts-cols">
                  {CHANGE_MISTAKES.map((r) => <li key={r} className="t-small">{r}</li>)}
                </ul>
              ),
            },
          ]}
        />
        <div className="change-foot">
          <p className="t-small t-dim">
            L’étape Enchaîner chronomètre 30 secondes de va-et-vient au micro. Cinq changements nets valent mieux que
            quinze crispés.
          </p>
          <PixelButton onClick={practiseChange}>S’entraîner : Enchaîner</PixelButton>
        </div>
      </Panel>
  );

  return (
    <main className="shell play-shell">
      <div className="play-surface chord-surface">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('hub')} aria-label="Retour au hub">‹</button>
        <div>
          <h1 className="page-title">Accords</h1>
          <p className="t-small t-dim">Doigt par doigt, puis corde par corde</p>
        </div>
      </header>

      <Panel className="span-7" accent="cyan" active label="Prochain accord">
        {next && nextVoicing ? (
          <>
            {/* la forme dessinée à côté de son nom : c'est elle qu'on vient apprendre, pas une suite de chiffres */}
            <div className="chord-hero">
              <ChordBoxView voicing={nextVoicing} maxScale={2} />
              <div className="chord-hero-text">
                <h3 className="home-title">{chordName(next.chord)}</h3>
                <p className="t-body">{next.palier.title}</p>
                <p className="t-small">{whySentence(next.why)}</p>
              </div>
            </div>
            <div className="row home-actions">
              <PixelButton variant="primary" onClick={() => open(next.voicingId)}>Apprendre</PixelButton>
            </div>
          </>
        ) : (
          <>
            <p className="t-body">Tout le parcours principal est appris. Il reste à le tenir dans le temps : les révisions passent par la répétition espacée.</p>
            <PixelButton onClick={() => navigate('hub')}>Retour au hub</PixelButton>
          </>
        )}
        <div className="chord-progress">
          <p className="t-small t-dim">{progress.done} accord{progress.done > 1 ? 's' : ''} appris sur {progress.total}</p>
          <Bar value={progress.done} max={Math.max(1, progress.total)} accent="cyan" label="Accords appris" valueText={`${progress.done} sur ${progress.total}`} />
        </div>
        <details className="ex-more chord-more">
          <summary>Comment un accord est validé</summary>
          <p className="t-small t-dim">
            Chaque corde est vérifiée au micro : c’est ce qu’un micro peut vérifier honnêtement.
            « Appris » = 3 vérifications propres en mode arpège sur au moins 2 jours différents <strong>et</strong> une
            pose à froid réussie (étape Fixer). Un plaqué écouté compte comme une vérification ; un plaqué seulement déclaré, non.
          </p>
          <p className="t-small t-dim">{CYCLE_LIMITS} Les barrés mobiles et les doigtés avancés arrivent plus tard.</p>
        </details>
      </Panel>

      <Panel className="span-5" label="La leçon, en sept étapes">
        <p className="t-small">De la découverte du nom au jeu en mesure, chaque geste validé au micro.</p>
        <details className="ex-more chord-more">
          <summary>Voir les sept étapes</summary>
          {/* le nom de l'étape mène la ligne, son contenu suit en atténué : on parcourt la colonne des noms */}
          <ol className="pix-steps pix-steps-tight">
            <li><strong>Découvrir</strong> <span>nom, notes, degrés, écoute plaquée et arpégée</span></li>
            <li><strong>Construire</strong> <span>un doigt à la fois, dans l’ordre, validé au micro</span></li>
            <li><strong>Vérifier</strong> <span>corde par corde (étouffée, fausse, trop basse)</span></li>
            <li><strong>Plaquer</strong> <span>le geste complet, écouté, six cordes ensemble</span></li>
            <li><strong>Fixer</strong> <span>pose à froid chronométrée (8 s, puis 5 s, puis 3 s)</span></li>
            <li><strong>Enchaîner</strong> <span>changement mesuré entre deux accords</span></li>
            <li><strong>Intégrer</strong> <span>quatre accords en mesure, avec un motif de strum</span></li>
          </ol>
        </details>
        <p className="t-small t-dim">Sans guitare sous la main : six questions pour apprendre à lire un accord écrit.</p>
        <div className="row">
          <PixelButton onClick={() => navigate('chordquiz')}>QCM sans matériel</PixelButton>
        </div>
      </Panel>

      {/* une seconde porte, « chansons d'abord », sur les mêmes leçons : chaque accord garde son palier */}
      <Panel
        className="span-12 first-chords"
        accent="magenta"
        label="Mes premiers accords"
        right={<span className={`tag ${first.done === first.total ? 'tag-on' : ''}`}>{first.done} / {first.total}</span>}
      >
        <p className="t-small">
          Les huit accords de la plupart des chansons pop. Les mineurs d’abord, souvent plus faciles ; Do et Sol
          en dernier, ce sont eux qui résistent.
        </p>
        {!firstFolded && (
          <>
            <div className="first-grid">{FIRST_CHORDS.map(firstTile)}</div>
            <Reveal
              label="Compléments sur les premiers accords"
              items={[
                {
                  id: 'semaine',
                  label: 'Ta semaine',
                  content: (
                    <>
                      <ol className="pix-steps">
                        {FIRST_CHORDS_PLAN.map((line) => <li key={line}>{line}</li>)}
                      </ol>
                      <p className="t-small t-dim">
                        La progression « Mineurs en La » (étape Intégrer) enchaîne La mineur, Mi et Ré mineur.
                      </p>
                    </>
                  ),
                },
                {
                  id: 'plus',
                  label: 'Pour aller plus loin',
                  content: (
                    <>
                      <p className="t-small t-dim">Toujours sans barré.</p>
                      <div className="first-grid">{FIRST_CHORDS_MORE.map(firstTile)}</div>
                    </>
                  ),
                },
              ]}
            />
          </>
        )}
        <div className="row palier-actions">
          <button type="button" className="palier-toggle" aria-expanded={!firstFolded} onClick={toggleFirst}>
            {firstFolded ? 'Voir les 8 accords' : 'Replier'}
          </button>
        </div>
      </Panel>

      {!desktop && changeGuide}

      {/* un palier sans accord (Fondations) ne s'affiche pas ici : matériel et posture vivent dans
          l'accordeur et dans la leçon (D106) */}
      {CURRICULUM.filter((p) => p.entries.length > 0).map(palierPanel)}

      {chordNodes.length > 0 && (
        <Panel className="span-12" accent="green" label="Tes accords, un par un">
          <p className="t-small">
            {chordNodes.length} accord{chordNodes.length > 1 ? 's' : ''} vérifié{chordNodes.length > 1 ? 's' : ''} au micro ·
            {' '}{chordNodes.filter((n) => n.state === 'learned' || n.state === 'mastered').length} appris.
            Les échéances de révision sont calculées par le même Leitner que les gammes.
          </p>
          <div className="chord-list">
            {chordNodes.map((n) => (
              <div key={n.nodeId} className="chord-row">
                <div className="chord-main">
                  <h3 className="chord-name">{chordName(n.chordId ?? '')}</h3>
                  <p className="t-small t-dim">
                    {n.attempts} vérification{n.attempts > 1 ? 's' : ''} · {n.successes} propre{n.successes > 1 ? 's' : ''} ·
                    {' '}{n.successDays} jour{n.successDays > 1 ? 's' : ''} · maîtrise {Math.round(n.mastery * 100)} %
                    {n.due !== null ? ` · ${reviewDelayText(n.due - clock.now())}` : ''}
                  </p>
                </div>
                <div className="chord-side"><span className="tag">{n.state === 'learned' ? 'appris' : n.state === 'mastered' ? 'maîtrisé' : 'en apprentissage'}</span></div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {desktop && (
        <div className="play-more">
          <PixelButton variant="quiet" onClick={() => setInfoOpen((o) => !o)}>
            {infoOpen ? '▾ Masquer le changement d’accord' : '▸ Changer d’accord : la méthode'}
          </PixelButton>
        </div>
      )}
      {desktop && infoOpen && changeGuide}
      </div>
    </main>
  );
}
