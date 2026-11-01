import { describe, expect, it } from 'vitest';
import { VOICINGS } from '../src/data/voicings';
import { chordGroups } from '../src/modules/accords/list';

describe('liste des accords', () => {
  const groups = chordGroups(VOICINGS);
  const byId = new Map(groups.map((g) => [g.id, g] as const));
  const names = (id: Parameters<typeof byId.get>[0]) => byId.get(id)!.voicings.map((v) => v.chord);

  it('range chaque forme une seule fois, sans les triades sur trois cordes', () => {
    const ids = groups.flatMap((g) => g.voicings.map((v) => v.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(40);
    expect(ids.some((id) => id.startsWith('triad-'))).toBe(false);
  });

  it('sépare les majeurs des mineurs, à l’intérieur de leur famille commune', () => {
    expect(names('majeurs')).toEqual(['C', 'D', 'E', 'F', 'F', 'G', 'G', 'A']);
    expect(names('mineurs')).toEqual(['Dm', 'Em', 'Am', 'Bm']);
  });

  it('classe par fondamentale, de Do à Si', () => {
    expect(names('septiemes').slice(0, 4)).toEqual(['C7', 'Cmaj7', 'D7', 'Dmaj7']);
    expect(names('septiemes').slice(-2)).toEqual(['B7', 'Bm7']);
  });

  it('place les accords à basse déclarée, les couleurs et les power chords dans leur groupe', () => {
    expect(names('slash')).toEqual(['C/G', 'D/F#', 'G/B']);
    expect(names('couleurs')).toEqual(['Cadd9', 'Dsus2', 'Dsus4', 'Esus4', 'Asus2', 'Asus4']);
    expect(names('power')).toEqual(['C5', 'D5', 'E5', 'G5', 'A5']);
  });

  it('la forme la plus simple d’un même accord vient d’abord', () => {
    const fa = byId.get('majeurs')!.voicings.filter((v) => v.chord === 'F').map((v) => v.id);
    expect(fa).toEqual(['F-xx3211', 'F-133211']);
  });
});
