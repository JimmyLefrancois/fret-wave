/** Onglet Progression de Séquences : tempo atteint et meilleure suite, session par session, sur la forme choisie. */
import { useMemo } from 'react';
import type { Attempt } from '../../core/progress';
import { loopHistory, type LoopSession } from './sequence';

// proche de la taille réelle sur téléphone : un dessin plus large y serait réduit, points et traits compris
const W = 340;
const H = 120;
const PAD = 12;
const day = (ts: number) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function Curve(props: { title: string; unit: string; sessions: readonly LoopSession[]; value: (s: LoopSession) => number }) {
  const { title, unit, sessions, value } = props;
  const values = sessions.map(value);
  const best = Math.max(...values);
  const min = Math.min(...values);
  const span = best - min || 1;
  const x = (i: number) => (sessions.length > 1 ? PAD + (i * (W - 2 * PAD)) / (sessions.length - 1) : W / 2);
  const y = (v: number) => (best === min ? H / 2 : H - PAD - ((v - min) * (H - 2 * PAD)) / span);
  return (
    <figure className="seq-chart">
      <figcaption><span>{title}</span><strong>meilleur : {best} {unit === 'gammes' && best < 2 ? 'gamme' : unit}</strong></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, de ${values[0]} à ${values[values.length - 1]} ${unit}, meilleur ${best}`}>
        <line className="grid" x1={0} x2={W} y1={H - 1} y2={H - 1} />
        <polyline className="line" points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
        {values.map((v, i) => (
          <circle key={sessions[i]!.ts} className="dot" cx={x(i)} cy={y(v)} r={4}>
            <title>{day(sessions[i]!.ts)} : {v} {unit}</title>
          </circle>
        ))}
      </svg>
      {sessions.length > 1 && (
        <p className="seq-chart-axis"><span>{day(sessions[0]!.ts)}</span><span>{day(sessions[sessions.length - 1]!.ts)}</span></p>
      )}
    </figure>
  );
}

export function SequenceProgress(props: { journal: readonly Attempt[]; form: { scaleId: string; system: string; formIndex: number } }) {
  const { journal, form } = props;
  const sessions = useMemo(() => loopHistory(journal, form), [journal, form]);
  if (sessions.length === 0) {
    return <section className="seq-progress"><p className="t-body">Pas encore de mesure sur cette position. Joue la gamme en écoute Tolérant : chaque session s’ajoutera ici.</p></section>;
  }
  return (
    <section className="seq-progress" aria-label="Progression de la gamme en boucle">
      <Curve title="Tempo atteint" unit="BPM" sessions={sessions} value={(s) => s.bpm} />
      <Curve title="Meilleure suite de gammes propres" unit="gammes" sessions={sessions} value={(s) => s.streak} />
      <table className="loop-table">
        <thead><tr><th scope="col">Session</th><th scope="col">BPM</th><th scope="col">Suite</th><th scope="col">Propres</th></tr></thead>
        <tbody>
          {sessions.slice(-5).reverse().map((s) => <tr key={s.ts}><th scope="row">{day(s.ts)}</th><td>{s.bpm}</td><td>{s.streak}</td><td>{s.clean} / {s.tours}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
}
