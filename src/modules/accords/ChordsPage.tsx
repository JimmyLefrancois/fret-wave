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
import { Bar, Chip, Panel, PixelButton } from '../../app/ui';
import { fmtChord, fmtNote } from '../../core/theory';
import { interpretChord } from '../../core/theory/chords';
import { loadJournal, progressStore, summarizeNodes } from '../../core/progress';
import { CURRICULUM } from './curriculum';
import { chordCards, chordProgress, learnedChordIds, startedChordIds, palierStates, nextChord } from './recommend';
import { CYCLE_LIMITS } from './lesson';

const STATUS_LABEL: Record<string, string> = {
  learned: 'appris',
  learning: 'commencé',
  available: 'ouvert',
  locked: 'prérequis',
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
  const chordNodes = useMemo(() => summarizeNodes(journal).filter((n) => n.module === 'accords'), [journal]);

  const open = (voicingId: string) => {
    setChordSelection({ voicingId });
    navigate('chord');
  };

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('hub')} aria-label="Retour au hub">‹</button>
        <div>
          <h1 className="page-title">Accords</h1>
          <p className="t-small t-dim">Doigt par doigt, puis corde par corde</p>
        </div>
        <span className="tag tag-on">P1 → P7</span>
      </header>

      <p className="t-small span-12">
        Un accord s’apprend doigt par doigt, puis corde par corde, puis <strong>en changement</strong>. Chaque
        corde est vérifiée au micro — c’est ce qu’un micro peut vérifier honnêtement.
      </p>

      <Panel
        className="span-7"
        accent="cyan"
        label="Prochain accord"
        right={<span className="badge">{progress.done} / {progress.total}</span>}
      >
        {next ? (
          <>
            <h3 className="card-title">{fmtChord(next.chord, settings.chordNotation)}</h3>
            <p className="t-small">
              palier {next.palier.id} · {next.palier.title} — {next.why}
            </p>
            <p className="t-small t-dim">Pourquoi maintenant : {next.reason}.</p>
            <div className="row">
              <PixelButton variant="primary" onClick={() => open(next.voicingId)}>Apprendre</PixelButton>
              <PixelButton variant="quiet" onClick={() => setBranch((b) => !b)}>
                {branch ? 'Masquer la branche rock' : 'Voir aussi les power chords'}
              </PixelButton>
            </div>
          </>
        ) : (
          <>
            <p className="t-body">Tout le parcours principal est appris. Il reste à le tenir dans le temps : les révisions passent par la répétition espacée.</p>
            <PixelButton onClick={() => navigate('hub')}>Retour au hub</PixelButton>
          </>
        )}
        <Bar value={progress.done} max={Math.max(1, progress.total)} accent="cyan" />
        <p className="t-small t-dim">{progress.done} accord{progress.done > 1 ? 's' : ''} appris sur {progress.total} — les sept étapes du cycle sont là. Les barrés mobiles et les doigtés avancés arrivent plus tard.</p>
        <p className="t-small t-dim">
          « Appris » = 3 vérifications propres en mode arpège sur au moins 2 jours différents <strong>et</strong> une
          pose à froid réussie (étape Fixer). Un plaqué écouté compte comme une vérification ; un plaqué seulement déclaré, non.
        </p>
      </Panel>

      <Panel className="span-5" accent="violet" label="Ce que la leçon fait">
        <ul className="module-facts">
          <li className="t-small">Découvrir — nom, notes, degrés, écoute plaquée et arpégée</li>
          <li className="t-small">Construire — un doigt à la fois, dans l’ordre, validé au micro</li>
          <li className="t-small">Vérifier — corde par corde (étouffée, fausse, trop basse)</li>
          <li className="t-small">Plaquer — le geste complet, <strong>écouté</strong> : six cordes ensemble, une confiance par corde</li>
          <li className="t-small">Fixer — pose à froid chronométrée (8 s → 5 s → 3 s)</li>
          <li className="t-small">Enchaîner — changement mesuré entre deux accords</li>
          <li className="t-small">Intégrer — quatre accords en mesure, avec un motif de strum</li>
        </ul>
        <p className="t-small t-dim">{CYCLE_LIMITS}</p>
        <div className="row">
          <PixelButton onClick={() => navigate('chordquiz')}>Sans matériel · QCM</PixelButton>
        </div>
      </Panel>

      {CURRICULUM.map((palier) => {
        const st = states.find((s) => s.palier.id === palier.id)!;
        const mine = cards.filter((c) => c.palier.id === palier.id);
        if (palier.branch && !branch) {
          return (
            <Panel key={palier.id} className="span-12" accent="yellow" label={`${palier.id} · ${palier.title} — branche`}>
              <p className="t-small t-dim">
                {palier.goal} <button type="button" className="linklike" onClick={() => setBranch(true)}>Afficher la branche rock</button>
              </p>
            </Panel>
          );
        }
        return (
          <Panel
            key={palier.id}
            className="span-12"
            accent={st.status === 'current' ? 'cyan' : st.status === 'done' ? 'green' : 'violet'}
            label={`${palier.id} · ${palier.title}`}
            right={<span className={`tag ${st.status === 'done' ? 'tag-on' : ''}`}>{st.total === 0 ? 'étape' : `${st.done} / ${st.total}`}</span>}
          >
            <p className="t-small">{palier.goal} <span className="t-dim">· {st.reason}</span></p>
            <details className="prof-note">
              <summary className="t-small">Avis de prof</summary>
              <p className="t-small t-dim">{palier.prof}</p>
            </details>
            {palier.drills && (
              <ul className="module-facts">
                {palier.drills.map((d) => <li key={d} className="t-small t-dim">{d}</li>)}
              </ul>
            )}
            <div className="chord-list">
              {mine.map((card) => {
                const info = interpretChord(card.voicing.chord);
                return (
                  <article key={card.voicing.id} className={`chord-row ${card.status}`}>
                    <div className="chord-main">
                      <h4 className="chord-name">
                        {fmtChord(card.voicing.chord, settings.chordNotation)}
                        <span className="chord-frets">{fretsText(card.voicing.frets)}</span>
                      </h4>
                      <p className="t-small t-dim">
                        {info.notes.map((n) => fmtNote(n, settings.noteNotation)).join(' – ')}
                        {card.missing.length > 0 ? ` · d’abord ${card.missing.map((m) => fmtChord(m, settings.chordNotation)).join(', ')}` : ''}
                      </p>
                      <p className="t-small">{card.entry.why}</p>
                    </div>
                    <div className="chord-side">
                      <span className={`tag ${card.status === 'learned' ? 'tag-on' : ''}`}>{STATUS_LABEL[card.status]}</span>
                      {card.transitions > 0 && <span className="t-small t-dim">{card.transitions} transition{card.transitions > 1 ? 's' : ''}</span>}
                      <Chip small onClick={() => open(card.voicing.id)}>{card.status === 'learned' ? 'revoir' : 'entrer'}</Chip>
                    </div>
                  </article>
                );
              })}
            </div>
          </Panel>
        );
      })}

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
                  <h4 className="chord-name">{fmtChord(n.chordId ?? '', settings.chordNotation)}</h4>
                  <p className="t-small t-dim">
                    {n.attempts} vérification{n.attempts > 1 ? 's' : ''} · {n.successes} propre{n.successes > 1 ? 's' : ''} ·
                    {' '}{n.successDays} jour{n.successDays > 1 ? 's' : ''} · maîtrise {Math.round(n.mastery * 100)} %
                    {n.due !== null ? ` · révision dans ${Math.max(1, Math.round((n.due - Date.now()) / 60_000))} min` : ''}
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
