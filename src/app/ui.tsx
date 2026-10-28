/**
 * Primitives d'interface « console pixel » : panneaux à coins repérés, boutons à ombre dure,
 * segments défilants, barres de progression crantées, icônes en bitmap.
 * Aucune logique métier ici : seulement du rendu et de l'accessibilité (cible tactile ≥ 44 px).
 */
import type { CSSProperties, ReactNode } from 'react';

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
}) {
  const { children, accent, className = '', label, right, as: Tag = 'section' } = props;
  return (
    <Tag
      className={`panel ${accent ? 'panel-accent' : ''} ${className}`}
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
}) {
  const { children, selected, disabled, onClick, title, small, accent } = props;
  return (
    <button
      type="button"
      className={`chip ${selected ? 'on' : ''} ${small ? 'chip-sm' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={accent ? ({ '--accent': accentVar(accent) } as CSSProperties) : undefined}
    >
      {children}
    </button>
  );
}

export function Bar(props: { value: number; max: number; accent?: Accent }) {
  const { value, max, accent = 'magenta' } = props;
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
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
}) {
  const { checked, onChange, label, hint, inline = false } = props;
  return (
    <button
      type="button"
      className={`switch ${checked ? 'on' : ''} ${inline ? 'inline' : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-box" aria-hidden="true" />
      <span className="switch-label">{label}</span>
      {hint && <span className="switch-hint">{hint}</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icônes bitmap 16×16 (aucune dépendance, nettes à toute échelle)
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
      viewBox="0 0 16 16"
      fill={color}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {rects}
    </svg>
  );
}
