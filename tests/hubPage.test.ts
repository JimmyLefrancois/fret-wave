import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HubPage } from '../src/app/HubPage';
import { VOICINGS } from '../src/data/voicings';

afterEach(() => vi.unstubAllGlobals());

describe('accueil : accords à réviser', () => {
  function render(known: string[] = [], noReview: string[] = []) {
    const data = new Map([
      ['fretwave.chords.v1', JSON.stringify({ v: 1, known, noReview, stamps: {} })],
    ]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null });
    return renderToStaticMarkup(createElement(HubPage));
  }

  it('titre l\'accueil du nom de l\'app, sur téléphone comme au bureau', () => {
    const html = render();
    expect(html).toContain('>Fretwave</h1>');
    expect(html).not.toContain('Accueil');
  });

  it('garde le bloc visible sans révision et sans bouton de lancement', () => {
    const html = render();
    expect(html).toContain('Accords à réviser');
    expect(html).toContain('Aucun accord à réviser aujourd’hui.');
    expect(html).toContain('class="badge">0</span>');
    expect(html).not.toContain('Réviser cet accord');
    expect(html).toContain('Apprendre un nouvel accord');
    expect(html).toContain('Dans Accords, coche');
  });

  it('propose toujours de réviser un accord dû', () => {
    const html = render([VOICINGS.find((v) => v.chord === 'Em')!.id]);
    expect(html).toContain('Accords à réviser');
    expect(html).toContain('Réviser cet accord');
    expect(html).toContain('Apprendre un nouvel accord');
    expect(html).not.toContain('Aucun accord à réviser aujourd’hui.');
    expect(html).not.toContain('Dans Accords, coche');
  });

  it('masque la consigne si un accord est connu même sans révision due', () => {
    const id = VOICINGS.find((v) => v.chord === 'Em')!.id;
    const html = render([id], [id]);
    expect(html).toContain('Aucun accord à réviser aujourd’hui.');
    expect(html).not.toContain('Dans Accords, coche');
  });
});
