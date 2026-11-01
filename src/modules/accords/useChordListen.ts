/** Écoute d'une forme d'accord, plaquée ou arpégée : partagée par la liste et le dictionnaire. */
import { useEffect, useRef, useState } from 'react';
import { TabPlayer } from '../../core/audio/tabPlayer';
import { chordToScore } from '../../core/tab';
import type { Voicing } from '../../core/theory/voicings';

export type ChordStyle = 'strum' | 'arpeggio';

export function useChordListen() {
  const [sounding, setSounding] = useState<{ id: string; style: ChordStyle } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const player = useRef<TabPlayer | null>(null);
  if (player.current === null) player.current = new TabPlayer();
  useEffect(() => {
    const p = player.current!;
    return () => p.dispose();
  }, []);

  const listen = async (v: Voicing, style: ChordStyle) => {
    const p = player.current!;
    try {
      await p.init(); // en premier : reprend le contexte audio dans le geste
      p.stop();
      await p.load(chordToScore(v, { style, tempo: 70 }), { loop: false });
      p.onEnded = () => setSounding(null);
      await p.play();
      setSounding({ id: v.id, style });
      setError(null);
    } catch (e) {
      setSounding(null);
      setError(`erreur audio : ${(e as Error).message}`);
    }
  };

  return { sounding, error, listen };
}
