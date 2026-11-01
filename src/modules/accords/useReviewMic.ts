/** Micro d'une séance de révision d'accords : s'ouvre seul si le navigateur le permet, se ferme en quittant. */
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { ensureInputEngine, inputEngineIfAny, windowFor } from '../../app/inputSession';
import { AudioEngine } from '../../core/audio/engine';
import { canAutoOpenMic, micPermission } from '../../core/input/autoOpen';
import { describeInputError, type InputEngine, type InputFrame } from '../../core/input/engine';
import { useInputSettings } from '../../core/input/settings';

export function useReviewMic(onFrame: MutableRefObject<(f: InputFrame) => void>) {
  const input = useInputSettings();
  const inputRef = useRef(input);
  inputRef.current = input;
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<InputEngine | null>(null);

  useEffect(() => {
    if (!on) {
      engine?.stop();
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        await AudioEngine.get().unlock(); // dans le geste qui a ouvert le micro
        const e = await ensureInputEngine();
        if (cancelled) return;
        setEngine(e);
        await e.start(inputRef.current, { windowSize: windowFor('standard') });
        if (cancelled) {
          e.stop();
          return;
        }
        if (e.state !== 'listening') {
          const info = describeInputError(e.state, e.error);
          setError(`${info.message} — ${info.hint}`);
          setOn(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(`le micro n’a pas pu s’ouvrir — réessaie. (navigateur : ${(err as Error).message})`);
          setOn(false);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  useEffect(() => {
    let cancelled = false;
    void micPermission().then((permission) => {
      if (!cancelled && canAutoOpenMic(permission, navigator.userActivation?.hasBeenActive ?? false)) setOn(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!engine) return;
    return engine.subscribe(() => {
      const f = engine.last;
      if (f) onFrame.current(f);
    });
  }, [engine, onFrame]);

  useEffect(() => {
    engine?.setGates({ thresholdDb: input.thresholds[input.source], clarityMin: input.clarityMin, a4: input.a4 });
  }, [engine, input.thresholds, input.source, input.clarityMin, input.a4]);

  useEffect(() => () => {
    inputEngineIfAny()?.stop();
  }, []);

  return { on, setOn, busy, error };
}
