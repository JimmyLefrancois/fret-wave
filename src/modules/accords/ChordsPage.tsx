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
import { setChordSelection } from '../../app/chordSession';
import { useSettings } from '../../app/settings';
import { ChordBoxView } from '../../app/ChordBoxView';
import { Bar, Chip, Panel, PixelButton } from '../../app/ui';
import { fmtChord, fmtNote } from '../../core/theory';
import { interpretChord } from '../../core/theory/chords';
import { loadJournal, progressStore, summarizeNodes } from '../../core/progress';
import { voicingById } from '../../data/voicings';
import { CURRICULUM, whySentence } from './curriculum';
import type { Palier } from './curriculum';
import { chordCards, chordProgress, learnedChordIds, startedChordIds, palierStates, nextChord, reviewDelayText } from './recommend';
import type { ChordCard } from './recommend';
import { CYCLE_LIMITS } from './lesson';
import * as clock from '../../core/clock';

const STATUS_LABEL: Record<string, string> = {
  learned: 'appris',
  learning: 'commencé',
  available: 'ouvert',
  locked: 'plus tard',
};

function fretsText(frets: readonly (number | null)[]): string {
  return frets.map((f) => (f === null ? 'x' : String(f))).join(' ');
}

export function ChordsPage() {
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

  return (
    <main className="shell">
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
          <ul className="module-facts">
            <li className="t-small">Découvrir : nom, notes, degrés, écoute plaquée et arpégée</li>
            <li className="t-small">Construire : un doigt à la fois, dans l’ordre, validé au micro</li>
            <li className="t-small">Vérifier : corde par corde (étouffée, fausse, trop basse)</li>
            <li className="t-small">Plaquer : le geste complet, <strong>écouté</strong>, six cordes ensemble</li>
            <li className="t-small">Fixer : pose à froid chronométrée (8 s, puis 5 s, puis 3 s)</li>
            <li className="t-small">Enchaîner : changement mesuré entre deux accords</li>
            <li className="t-small">Intégrer : quatre accords en mesure, avec un motif de strum</li>
          </ul>
        </details>
        <p className="t-small t-dim">Sans guitare sous la main : six questions pour apprendre à lire un accord écrit.</p>
        <div className="row">
          <PixelButton onClick={() => navigate('chordquiz')}>QCM sans matériel</PixelButton>
        </div>
      </Panel>

      {CURRICULUM.map(palierPanel)}

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
    </main>
  );
}
