/**
 * Primitives d'interface « console pixel » : panneaux à coins repérés, boutons à ombre dure,
 * segments défilants, barres de progression crantées, icônes en bitmap.
 * Aucune logique métier ici : seulement du rendu et de l'accessibilité (cible tactile ≥ 44 px).
 */
import { useId, useState, type CSSProperties, type ReactNode } from 'react';

export const ACCENTS = ['magenta', 'cyan', 'yellow', 'violet', 'green', 'orange'] as const;
export type Accent = (typeof ACCENTS)[number];

export function accentVar(a: Accent | undefined): string {
  return a ? `var(--${a})` : 'var(--line)';
}

export function Panel(props: {
  children: ReactNode;
  accent?: Accent;
  className?: string;
  label?: string;
  right?: ReactNode;
  as?: 'section' | 'div' | 'article';
  /** Le panneau où l'on agit maintenant : seul lui porte le halo. L'accent seul ne colore que la
   *  bordure et le titre — un halo sur chaque panneau ne désignait plus rien. */
  active?: boolean;
}) {
  const { children, accent, className = '', label, right, as: Tag = 'section', active = false } = props;
  return (
    <Tag
      className={`panel ${accent ? 'panel-accent' : ''} ${active ? 'panel-active' : ''} ${className}`}
      style={accent ? ({ '--accent': accentVar(accent) } as CSSProperties) : undefined}
    >
      {(label || right) && (
        <header className="panel-head">
          {label && <h2 className="t-label">{label}</h2>}
          {right && <div className="panel-right">{right}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}

export function PixelButton(props: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger';
  disabled?: boolean;
  title?: string;
  className?: string;
  ariaLabel?: string;
  type?: 'button' | 'submit';
  /** Raccourci clavier annoncé aux lecteurs d'écran (`aria-keyshortcuts`). */
  keyShortcuts?: string;
}) {
  const { children, onClick, variant = 'ghost', disabled, title, className = '', ariaLabel, type = 'button', keyShortcuts } = props;
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-keyshortcuts={keyShortcuts}
    >
      {children}
    </button>
  );
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
  /** Raison affichée quand l'option est indisponible. */
  note?: string;
  disabled?: boolean;
}

/** Segments qui défilent horizontalement (téléphone) : une seule ligne, jamais de retour à la ligne. */
export function Segmented<T extends string | number>(props: {
  options: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const { options, value, onChange, label, size = 'md' } = props;
  return (
    <div className={`segmented segmented-${size}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`seg ${o.value === value ? 'on' : ''}`}
          aria-pressed={o.value === value}
          disabled={o.disabled}
          title={o.note ?? o.label}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip(props: {
  children: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  small?: boolean;
  accent?: Accent;
  /** Nom accessible quand le libellé visible ne suffit pas (« entrer » répété sur chaque ligne). */
  ariaLabel?: string;
}) {
  const { children, selected, disabled, onClick, title, small, accent, ariaLabel } = props;
  return (
    <button
      type="button"
      className={`chip ${selected ? 'on' : ''} ${small ? 'chip-sm' : ''}`}
      aria-pressed={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={accent ? ({ '--accent': accentVar(accent) } as CSSProperties) : undefined}
    >
      {children}
    </button>
  );
}

/**
 * Contenus d'appoint d'un panneau, un seul ouvert à la fois : une rangée de pastilles au lieu de replis
 * empilés. Trois `<details>` l'un sous l'autre prenaient chacun une ligne fermés, et s'additionnaient
 * ouverts ; ici, fermé, tout tient sur une rangée, et ouvert, une seule liste à la fois. Retoucher la
 * pastille ouverte referme.
 */
export function Reveal(props: { label: string; items: readonly { id: string; label: string; content: ReactNode }[] }) {
  const { label, items } = props;
  const [open, setOpen] = useState<string | null>(null);
  const base = useId();
  return (
    <div className="reveal">
      <div className="reveal-tabs" role="group" aria-label={label}>
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className={`chip chip-sm ${open === it.id ? 'on' : ''}`}
            aria-expanded={open === it.id}
            aria-controls={`${base}-${it.id}`}
            onClick={() => setOpen((o) => (o === it.id ? null : it.id))}
          >
            {it.label}
          </button>
        ))}
      </div>
      {items.map((it) => (
        <div key={it.id} id={`${base}-${it.id}`} className="reveal-body" hidden={open !== it.id}>
          {it.content}
        </div>
      ))}
    </div>
  );
}

export function Bar(props: { value: number; max: number; accent?: Accent; label?: string; valueText?: string }) {
  const { value, max, accent = 'magenta', label, valueText } = props;
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="bar" role="progressbar" aria-label={label} aria-valuetext={valueText} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <i style={{ width: `${pct * 100}%`, background: accentVar(accent) }} />
    </div>
  );
}

export function Switch(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  /** Libellé et précision sur la même ligne (au lieu de deux) : pour un réglage court et explicite. */
  inline?: boolean;
  /** Indisponible (la raison va dans `hint`) : on montre l'option, on ne la cache pas. */
  disabled?: boolean;
}) {
  const { checked, onChange, label, hint, inline = false, disabled = false } = props;
  return (
    <button
      type="button"
      className={`switch ${checked ? 'on' : ''} ${inline ? 'inline' : ''}`}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-box" aria-hidden="true" />
      <span className="switch-label">{label}</span>
      {hint && <span className="switch-hint">{hint}</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icônes bitmap 16×16, sauf celles de la navigation en 10×10 (aucune dépendance ; nettes quand
// la taille affichée est un multiple entier de la grille)
// ---------------------------------------------------------------------------

const ICONS = {
  // escalier de notes : une gamme qui monte
  scales: [
    '................',
    '................',
    '................',
    '............####',
    '............####',
    '............####',
    '........####....',
    '........####....',
    '....####........',
    '....####........',
    '####............',
    '####............',
    '................',
    '................',
    '................',
    '................',
  ],
  // trois barres : une pile d'accord
  chords: [
    '................',
    '................',
    '....##..........',
    '....##..##......',
    '....##..##..##..',
    '....##..##..##..',
    '....##..##..##..',
    '....##..##..##..',
    '....##..##..##..',
    '....##..##..##..',
    '....##..##..##..',
    '....##..##..##..',
    '................',
    '................',
    '................',
    '................',
  ],
  // métronome
  rhythm: [
    '................',
    '................',
    '.......##.......',
    '......####......',
    '......####......',
    '.....######.....',
    '.....######.....',
    '....###..###....',
    '....##.##.##....',
    '...###.##.###...',
    '...##..##..##...',
    '..############..',
    '..############..',
    '................',
    '................',
    '................',
  ],
  // oreille / forme d'onde
  ear: [
    '................',
    '................',
    '......##........',
    '....######......',
    '....##..##......',
    '....##..##......',
    '....##..##......',
    '....##..######..',
    '....##..##..##..',
    '....##..##..##..',
    '....######..##..',
    '......##....##..',
    '................',
    '................',
    '................',
    '................',
  ],
  // maison : le hub
  home: [
    '................',
    '.......##.......',
    '......####......',
    '.....######.....',
    '....########....',
    '...##########...',
    '..############..',
    '....########....',
    '....##....##....',
    '....##....##....',
    '....##....##....',
    '....########....',
    '................',
    '................',
    '................',
    '................',
  ],
  // réglages : trois curseurs
  sliders: [
    '................',
    '................',
    '..##########....',
    '.......##.......',
    '................',
    '....##########..',
    '....##..........',
    '................',
    '..##########....',
    '.......##.......',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  // son : trois barres de niveau
  wave: [
    '................',
    '................',
    '................',
    '....##....##....',
    '..######..##....',
    '..######..##....',
    '..############..',
    '..############..',
    '..######..##....',
    '....##....##....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  play: [
    '................',
    '..##............',
    '..####..........',
    '..######........',
    '..########......',
    '..##########....',
    '..############..',
    '..##############',
    '..############..',
    '..##########....',
    '..########......',
    '..######........',
    '..####..........',
    '..##............',
    '................',
    '................',
  ],
  pause: [
    '................',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '....###..###....',
    '................',
    '................',
    '................',
  ],
  stop: [
    '................',
    '................',
    '..############..',
    '..############..',
    '..############..',
    '..############..',
    '..############..',
    '..############..',
    '..############..',
    '..############..',
    '..############..',
    '..############..',
    '..############..',
    '................',
    '................',
    '................',
  ],
  // barre de navigation : glyphes pleins 10×10, dessinés à ×2 (20 px) pour rester lisibles à un mètre
  navHome: ['....##....', '...####...', '..##..##..', '.##....##.', '##########', '.#......#.', '.#..##..#.', '.#..##..#.', '.#..##..#.', '.########.'],
  navScales: ['..........', '........##', '........##', '......####', '......####', '....######', '....######', '..########', '..########', '##########'],
  navChords: ['##########', '#..#..#..#', '#..#.##..#', '##########', '#.##..#..#', '#.##..#..#', '##########', '#..#..#.##', '#..#..#.##', '##########'],
  navTuner: ['.##....##.', '.##....##.', '.##....##.', '.##....##.', '.##....##.', '.###..###.', '..######..', '....##....', '....##....', '...####...'],
  navSliders: ['...##.....', '##########', '...##.....', '..........', '......##..', '##########', '......##..', '..........', '.##.......', '##########'],
} as const;

export type IconName = keyof typeof ICONS;

/** Icône pixel : un rectangle par pixel du bitmap (rendu net, sans lissage). */
export function PixelIcon(props: { name: IconName; size?: number; color?: string; className?: string }) {
  const { name, size = 32, color = 'currentColor', className = '' } = props;
  const rows = ICONS[name];
  const rects: ReactNode[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
    }
  });
  return (
    <svg
      className={`picon ${className}`}
      width={size}
      height={size}
      viewBox={`0 0 ${rows[0].length} ${rows.length}`}
      fill={color}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {rects}
    </svg>
  );
}
