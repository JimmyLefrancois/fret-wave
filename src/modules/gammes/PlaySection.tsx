import type { ReactNode } from 'react';

/** Section de la surface du bureau : une étiquette et un filet pointillé, jamais une case de plus. */
export function PlaySection(props: { title: string; tone?: 'magenta' | 'cyan'; action?: ReactNode; children: ReactNode }) {
  const { title, tone = 'magenta', action, children } = props;
  return (
    <section className="play-sec">
      <div className="play-sec-head">
        <span className={`play-sec-mark ${tone}`} aria-hidden="true" />
        <h2 className="t-label">{title}</h2>
        <span className="play-sec-rule" aria-hidden="true" />
        {action}
      </div>
      {children}
    </section>
  );
}
