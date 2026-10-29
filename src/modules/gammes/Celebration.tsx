/**
 * Panneau de réussite — animation synthwave à la fin d'une série vérifiée.
 *
 * Ce qui s'affiche (tout vient du journal, rien n'est inventé) :
 *  - le **XP gagné** par cette tentative, en compteur qui monte ;
 *  - le **XP total** de l'appareil et le XP du jour rapporté au plafond (120), avec sa barre ;
 *  - les étoiles, la précision au premier essai, le temps, les cases révélées et les erreurs ;
 *  - un sceau « sans faute » quand la série est parfaite (aucune erreur, aucune révélation).
 *
 * Le décor est en CSS pur (aucun canvas de plus) : soleil rayé qui monte, grille en perspective qui
 * défile, étoiles qui éclosent en décalé. Tout se figé quand « réduire les animations » est actif, et
 * la mise en page reste lisible sans aucune animation.
 */
import { useEffect, useRef, useState } from 'react';
import { Bar } from '../../app/ui';

export interface CelebrationProps {
  /** Titre de la gamme travaillée. */
  title: string;
  /** Position travaillée (« Position 1 · cases 5–8 »). */
  position: string;
  stars: number;
  accuracy: number;
  seconds: number;
  revealed: number;
  errors: number;
  /** XP gagné par cette tentative. */
  earned: number;
  /** XP total de l'appareil et XP du jour (déjà plafonné). */
  totalXp: number;
  todayXp: number;
  cap: number;
  /** Jours d'affilée et nombre de séries déjà terminées aujourd'hui (0 = rien à dire). */
  streakDays: number;
  sessionsToday: number;
  onClose: () => void;
  /** « Réduire les animations » : aucune animation, même mise en page. */
  readonly?: boolean;
  /**
   * Échec (0 ★) : même cadre, sans fête — ni étoiles, ni compteur d'XP, ni animation. La série a une
   * fin visible, et la suite utile est proposée (revoir la forme d'abord, rejouer ensuite).
   */
  calm?: boolean;
  /** Ligne de détail sous le titre (« 3 cases manquées : Sol ×2, Si ×1 »). */
  detail?: string | null;
  /** Actions à la place de « Continuer » ; la première est l'action principale. */
  actions?: { label: string; onClick: () => void }[];
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Compteur qui monte de 0 à `value` (ou direct à `value` si les animations sont réduites). */
function useCountUp(value: number, readonly: boolean, ms = 700): number {
  const [shown, setShown] = useState(readonly ? value : 0);
  useEffect(() => {
    if (readonly) {
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, readonly, ms]);
  return shown;
}

export function Celebration(props: CelebrationProps) {
  const {
    title, position, stars, accuracy, seconds, revealed, errors, earned, totalXp, todayXp, cap,
    streakDays, sessionsToday, onClose, readonly = false, calm = false, detail = null, actions,
  } = props;
  const still = readonly || calm;
  const shownXp = useCountUp(earned, still);
  const closeRef = useRef<HTMLButtonElement>(null);
  const perfect = stars === 3 && revealed === 0 && errors === 0;

  // le focus entre sur « Continuer » à l'ouverture et revient d'où il venait à la fermeture
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => before?.focus?.();
  }, []);

  // Échap ferme ; Tab tourne entre les boutons de la boîte, sans en sortir
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'Tab') {
        e.preventDefault();
        const btns = [...(cardRef.current?.querySelectorAll('button') ?? [])];
        if (btns.length === 0) return;
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        const next = (i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length;
        btns[i === -1 ? 0 : next]!.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={`celebrate ${still ? 'still' : ''} ${calm ? 'calm' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Série terminée : ${title}`}
      onClick={(e) => {
        // clic sur le fond : on ferme (mais pas un clic dans la carte)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="celebrate-scene" aria-hidden="true">
        <div className="celebrate-sun" />
        <div className="celebrate-grid" />
      </div>

      <div className="celebrate-card" ref={cardRef}>
        <p className="celebrate-kicker">{stars >= 2 ? 'Série tenue' : 'Série terminée'}</p>
        <h2 className="celebrate-title">{perfect ? 'Sans faute' : stars > 0 ? 'Réussi' : 'À revoir'}</h2>
        <p className="celebrate-sub">{title} · {position}</p>
        {detail && <p className="celebrate-detail">{detail}</p>}

        {!calm && (<>
        <p className="celebrate-stars" aria-label={`${stars} étoile${stars > 1 ? 's' : ''} sur 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < stars ? 'on' : ''} style={{ animationDelay: `${120 + i * 110}ms` }}>★</span>
          ))}
        </p>

        <p className="celebrate-xp">
          +<span className="celebrate-xp-value">{shownXp}</span> XP
        </p>
        <p className="celebrate-total">
          <strong>{totalXp}</strong> XP au total · <strong>{todayXp}</strong> / {cap} aujourd’hui
        </p>
        <Bar value={Math.min(todayXp, cap)} max={cap} accent="yellow" />
        {/* « 1 jour d’affilée » ne dit rien : la série commence à deux jours */}
        {(streakDays >= 2 || sessionsToday > 1) && (
          <p className="celebrate-meta">
            {streakDays >= 2 ? `${streakDays} jours d’affilée` : ''}
            {streakDays >= 2 && sessionsToday > 1 ? ' · ' : ''}
            {sessionsToday > 1 ? `${sessionsToday}e série aujourd’hui` : ''}
          </p>
        )}
        </>)}

        <dl className="celebrate-stats">
          <div><dt>Précision</dt><dd>{Math.round(accuracy * 100)} %</dd></div>
          <div><dt>Temps</dt><dd>{mmss(seconds)}</dd></div>
          <div><dt>Révélés</dt><dd>{revealed}</dd></div>
          <div><dt>Erreurs</dt><dd>{errors}</dd></div>
        </dl>

        {perfect && (
          <p className="celebrate-seal">
            <span aria-hidden="true">✦</span> Aucune erreur, aucune case révélée : ★★★
          </p>
        )}

        {actions && actions.length > 0 ? (
          <div className="celebrate-actions">
            {actions.map((a, i) => (
              <button
                key={a.label}
                type="button"
                className={`btn ${i === 0 ? 'btn-primary' : ''} wide`}
                onClick={a.onClick}
                ref={i === 0 ? closeRef : undefined}
              >
                {a.label}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="btn btn-primary wide" onClick={onClose} ref={closeRef}>
            Continuer
          </button>
        )}
        <p className="celebrate-note">
          {calm
            ? 'La tentative est enregistrée quand même : elle dit où tu en es, et rien n’est bloqué.'
            : 'La tentative est enregistrée : elle déplace la forme dans la file de révision, elle ne la certifie pas.'}
        </p>
      </div>
    </div>
  );
}
