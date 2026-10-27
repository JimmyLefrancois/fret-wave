/**
 * Accordeur et calibration de l'entrée (phase 3, `#/accordeur`).
 *
 * Trois choses, dans l'ordre où un élève en a besoin :
 *  1. **Entrée** : ouvrir le micro, choisir le périphérique, voir le niveau, régler le seuil.
 *     Le seuil se suggère à partir du **bruit de la pièce mesuré au silence** (médiane, pas moyenne).
 *  2. **Latence** : l'app joue cinq clics et écoute quand ils reviennent. La valeur n'est pas une
 *     estimation du navigateur : c'est le temps mesuré sortie → air/câble → entrée, retranché du
 *     chronomètre quand on joue sur la grille.
 *  3. **Accordeur** : les cordes de l'accordage courant, la corde entendue allumée, l'écart en cents.
 *     Sans lui, un exercice au micro devient injuste : une guitare à −20 cents ferait échouer des
 *     notes justes (MUSIC_DESIGN §6).
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AudioEngine } from '../core/audio/engine';
import { describeInputError, type InputEngine } from '../core/input/engine';
import { estimateLatency, noiseFloorDb, suggestThreshold, type LatencyPair, type LatencyResult } from '../core/input/calibration';
import { nearestOpenString, noteNameOf, tuneStatus } from '../core/input/match';
import {
  A4_MAX, A4_MIN, CENTS_MAX, CENTS_MIN, INPUT_SOURCES, THRESHOLD_MAX, THRESHOLD_MIN,
  setInputSettings, useInputSettings, type InputSource,
} from '../core/input/settings';
import { fmtNote, openStringMidi, midiToFreq, TUNINGS, type NoteNotation, type Tuning } from '../core/theory';
import { ensureInputEngine, inputEngineIfAny, windowFor } from './inputSession';
import { useScaleSelection } from './scaleSession';
import { useSettings } from './settings';
import { MicStrip } from './MicStrip';
import { navigate } from './router';
import { Panel, PixelButton, Segmented } from './ui';

type Phase = 'idle' | 'running' | 'done';

const STATUS_LABEL: Record<string, string> = { in: 'juste', low: 'trop bas', high: 'trop haut', far: 'très loin' };

export function TunerPage() {
  const settings = useSettings();
  const input = useInputSettings();
  const selection = useScaleSelection();
  const tuning = TUNINGS[selection.tuningId] ?? TUNINGS.standard!;

  const [engine, setEngine] = useState<InputEngine | null>(() => inputEngineIfAny());
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [noise, setNoise] = useState<{ floor: number; suggested: number; samples: number } | null>(null);
  const [noisePhase, setNoisePhase] = useState<Phase>('idle');
  const [latency, setLatency] = useState<LatencyResult | null>(null);
  const [latencyPhase, setLatencyPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const thresholdDb = input.thresholds[input.source];
  const listening = engine?.state === 'listening';

  useEffect(() => {
    return () => {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    };
  }, []);

  const start = useCallback(async (): Promise<InputEngine | null> => {
    setBusy(true);
    setMsg(null);
    try {
      await AudioEngine.get().unlock(); // doit rester dans le geste
      const e = await ensureInputEngine();
      setEngine(e);
      await e.start(input, { windowSize: windowFor(selection.tuningId) });
      setDevices(await e.devices());
      if (e.state !== 'listening') {
        const info = describeInputError(e.state, e.error);
        setMsg(`${info.message} — ${info.hint}`);
      }
      return e;
    } catch (err) {
      setMsg(`entrée audio indisponible : ${(err as Error).message}`);
      return null;
    } finally {
      setBusy(false);
    }
  }, [input, selection.tuningId]);

  const stop = () => {
    engine?.stop();
    setMsg(null);
  };

  /** Redémarre sur le même moteur quand un réglage qui ne peut pas changer à chaud est modifié. */
  const restart = async (patch: Parameters<typeof setInputSettings>[0]) => {
    const next = setInputSettings(patch);
    if (listening && engine) {
      await engine.start(next, { windowSize: windowFor(selection.tuningId) });
      setDevices(await engine.devices());
    }
  };

  const measureNoise = () => {
    if (!engine || !listening) {
      setMsg('active d’abord l’écoute, puis reste silencieux deux secondes.');
      return;
    }
    setNoisePhase('running');
    setMsg('reste silencieux deux secondes (ne touche pas les cordes)…');
    const t = window.setTimeout(() => {
      const levels = engine.recentLevels(2000).map((l) => l.db);
      const floor = noiseFloorDb(levels);
      const suggested = suggestThreshold(floor);
      setNoise({ floor, suggested, samples: levels.length });
      setNoisePhase('done');
      setMsg(null);
    }, 2100);
    timers.current.push(t);
  };

  const applyThreshold = () => {
    if (!noise) return;
    setInputSettings({ thresholds: { ...input.thresholds, [input.source]: noise.suggested } });
    engine?.setGates({ thresholdDb: noise.suggested });
    setMsg(`seuil réglé à ${noise.suggested} dBFS pour « ${input.source === 'mic' ? 'micro' : 'interface USB'} ».`);
  };

  const measureLatency = async () => {
    const e = engine ?? (await start());
    if (!e || e.state !== 'listening') {
      setMsg('active l’écoute avant de mesurer la latence.');
      return;
    }
    setLatencyPhase('running');
    setMsg('cinq clics… laisse-les sonner, ne gratte pas pendant la mesure.');
    const clicks: number[] = [];
    for (let k = 0; k < 5; k++) {
      const at = e.now + 0.6 + k * 0.7;
      clicks.push(at);
      e.clickAt(at);
    }
    const pairs: LatencyPair[] = [];
    const pending = [...clicks];
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      unsubscribe();
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
      const r = estimateLatency(pairs);
      setLatency(r);
      setLatencyPhase('done');
      if (r.used < 3) {
        // une ou deux attaques peuvent être un clic du métronome resté en mémoire ou une chaise :
        // on ne mémorise pas une latence tirée d'une mesure isolée
        setMsg(`mesure non concluante (${r.used} clic${r.used > 1 ? 's' : ''} entendu${r.used > 1 ? 's' : ''} sur ${clicks.length}) : rien n’est mémorisé. Monte le volume de sortie et refais la mesure.`);
        return;
      }
      setInputSettings({ latencies: { ...input.latencies, [input.source]: r.ms } });
      setMsg(`latence retenue : ${r.ms} ms (${r.used} mesure${r.used > 1 ? 's' : ''} sur ${clicks.length}).`);
    };

    const unsubscribe = e.subscribe(() => {
      const f = e.last;
      if (!f || !f.onset || f.onsetT === null) return;
      const at = f.onsetT;
      const i = pending.findIndex((c) => at >= c - 0.02 && at <= c + 0.62);
      if (i >= 0) {
        pairs.push({ playedS: pending[i]!, detectedS: at });
        pending.splice(i, 1);
        if (pairs.length === clicks.length) finish();
      }
    });
    const guard = window.setTimeout(finish, 6000);
    timers.current.push(guard);
  };

  const info = engine ? describeInputError(engine.state, engine.error) : null;
  const latencyMs = input.latencies[input.source];

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('hub')} aria-label="Retour au hub">‹</button>
        <div>
          <h1 className="page-title">Accordeur</h1>
          <p className="t-small t-dim">
            {tuning.nameFr} · entrée {input.source === 'mic' ? 'micro' : 'interface USB'} · seuil {thresholdDb} dBFS
            {latencyMs > 0 ? ` · latence ${latencyMs} ms` : ' · latence non mesurée'}
          </p>
        </div>
        <span className={`tag ${listening ? 'tag-on' : ''}`}>{listening ? 'micro ouvert' : 'micro fermé'}</span>
      </header>

      <Panel className="span-7" accent="cyan" label="Entrée" right={<span className="badge">{input.a4} Hz</span>}>
        <MicStrip
          engine={engine}
          notation={settings.noteNotation}
          thresholdDb={thresholdDb}
          tolerance={input.centsTolerance}
          tuning={tuning}
          a4={input.a4}
          big
        />
        <div className="row">
          {!listening ? (
            <PixelButton variant="primary" onClick={() => void start()} disabled={busy}>
              {busy ? 'ouverture…' : 'Activer l’écoute'}
            </PixelButton>
          ) : (
            <PixelButton variant="ghost" onClick={stop}>Arrêter l’écoute</PixelButton>
          )}
          <PixelButton onClick={measureNoise} disabled={!listening || noisePhase === 'running'}>
            {noisePhase === 'running' ? 'mesure du silence…' : 'Mesurer le silence (2 s)'}
          </PixelButton>
        </div>
        {info && engine && engine.state !== 'idle' && engine.state !== 'listening' && (
          <p className="t-small calib-warn"><strong>{info.message}</strong> — {info.hint}</p>
        )}
        {engine?.warning && <p className="t-small calib-warn">{engine.warning}</p>}

        <div className="field">
          <span className="t-label">Source</span>
          <Segmented<InputSource>
            value={input.source}
            onChange={(v) => void restart({ source: v })}
            label="Source d’entrée"
            options={INPUT_SOURCES.map((s) => ({ value: s.value, label: s.label, note: s.hint }))}
          />
          <p className="t-small t-dim">
            Les seuils et la latence sont mémorisés <strong>par source</strong> : un micro de téléphone et une Focusrite n’ont ni le
            même niveau ni le même retard.
          </p>
        </div>

        <div className="field">
          <span className="t-label">Périphérique</span>
          <select
            value={input.deviceId ?? ''}
            onChange={(e) => void restart({ deviceId: e.target.value || null })}
            aria-label="Périphérique d’entrée"
          >
            <option value="">Périphérique par défaut</option>
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `entrée ${i + 1}`}
              </option>
            ))}
          </select>
          <p className="t-small t-dim">
            Les noms n’apparaissent qu’après autorisation (règle des navigateurs). Une interface USB en direct donne un
            signal bien plus propre qu’un micro de pièce.
          </p>
        </div>

        <div className="field">
          <span className="t-label">Seuil de détection · {thresholdDb} dBFS</span>
          <input
            className="range"
            type="range"
            min={THRESHOLD_MIN}
            max={THRESHOLD_MAX}
            step={1}
            value={thresholdDb}
            onChange={(e) => {
              const v = Number(e.target.value);
              setInputSettings({ thresholds: { ...input.thresholds, [input.source]: v } });
              engine?.setGates({ thresholdDb: v });
            }}
            aria-label="Seuil de détection en dBFS"
          />
          {noise && (
            <p className="t-small">
              plancher de bruit mesuré : <strong>{noise.floor.toFixed(0)} dBFS</strong> ({noise.samples} mesures) →
              seuil suggéré <strong>{noise.suggested} dBFS</strong>{' '}
              <button type="button" className="linkish" onClick={applyThreshold}>appliquer</button>
            </p>
          )}
        </div>

        <div className="field">
          <span className="t-label">Tolérance d’accord · {input.centsTolerance} cents</span>
          <input
            className="range"
            type="range"
            min={CENTS_MIN}
            max={CENTS_MAX}
            step={1}
            value={input.centsTolerance}
            onChange={(e) => setInputSettings({ centsTolerance: Number(e.target.value) })}
            aria-label="Tolérance d’accord en cents"
          />
          <p className="t-small t-dim">
            Au-delà, la note est considérée comme un problème d’accord (aucune erreur comptée) et l’app renvoie ici.
            35 cents est le défaut ; une guitare bien accordée reste sous 10.
          </p>
        </div>

        <div className="field">
          <span className="t-label">Clarté minimale · {input.clarityMin.toFixed(2)}</span>
          <input
            className="range"
            type="range"
            min={0.5}
            max={0.98}
            step={0.01}
            value={input.clarityMin}
            onChange={(e) => {
              const v = Number(e.target.value);
              setInputSettings({ clarityMin: v });
              engine?.setGates({ clarityMin: v });
            }}
            aria-label="Clarté minimale de la détection"
          />
          <p className="t-small t-dim">
            Sous ce seuil, la fenêtre est ignorée (bruit, corde qui s’éteint). Baisser la valeur fait entrer plus de
            notes, et plus de fausses notes.
          </p>
        </div>

        <div className="field">
          <span className="t-label">La de référence</span>
          <div className="tempo-row">
            <div className="tempo">
              <button type="button" className="tempo-btn" onClick={() => setInputSettings({ a4: Math.max(A4_MIN, input.a4 - 1) })} aria-label="La plus bas">−</button>
              <span className="tempo-val">{input.a4} Hz</span>
              <button type="button" className="tempo-btn" onClick={() => setInputSettings({ a4: Math.min(A4_MAX, input.a4 + 1) })} aria-label="La plus haut">+</button>
            </div>
            <span className="t-small t-dim">lu par la détection et par l’accordeur</span>
          </div>
        </div>

        {msg && <p className="t-small calib-msg" role="status">{msg}</p>}
      </Panel>

      <Panel className="span-5" accent="violet" label="Latence" right={<span className="badge">{latencyMs > 0 ? `${latencyMs} ms` : '—'}</span>}>
        <p className="t-body">
          Le temps entre le moment où l’app joue un clic et celui où elle l’entend revenir. C’est cette valeur qui est
          retranchée du chronomètre quand tu joues sur la grille.
        </p>
        <div className="row">
          <PixelButton variant="primary" onClick={() => void measureLatency()} disabled={latencyPhase === 'running' || busy}>
            {latencyPhase === 'running' ? 'mesure en cours…' : 'Mesurer (5 clics)'}
          </PixelButton>
        </div>
        {latency && latency.used > 0 && (
          <p className="t-small">
            <strong>{latency.ms} ms</strong> · {latency.used} mesure{latency.used > 1 ? 's' : ''} retenue
            {latency.used > 1 ? 's' : ''}
            {latency.rejected > 0 ? ` · ${latency.rejected} écartée${latency.rejected > 1 ? 's' : ''}` : ''} · brut :{' '}
            {latency.raw.map((v) => `${v.toFixed(0)}`).join(' / ')} ms
          </p>
        )}
        <p className="t-small t-dim">
          Au casque, la valeur est celle de la chaîne audio. Aux haut-parleurs, elle inclut le trajet dans l’air — et
          dépend donc de ta distance : mesure casque en place si tu joues au casque.
        </p>
        <p className="t-small t-dim">
          Une latence au-dessus de 40 ms rend le jeu en mesure difficile : c’est un casque filaire et une interface USB,
          pas du Bluetooth (le profil mains-libres dégrade aussi le micro).
        </p>
        <p className="t-small t-dim">La valeur est mémorisée par source. Non mesurée, elle vaut 0 : rien n’est retranché.</p>

        <h3 className="t-label" style={{ marginTop: 14 }}>Ordre des gestes</h3>
        <ol className="calib-steps">
          <li>Accorde-toi (l’accordeur ci-contre) : une guitare à −20 cents fait échouer des notes justes.</li>
          <li>Mesure le silence deux secondes, applique le seuil suggéré.</li>
          <li>Mesure la latence, puis joue sur la grille : le chronomètre est corrigé.</li>
          <li>Dans l’exercice, bascule « Micro » : la case se remplit à la note jouée.</li>
        </ol>
      </Panel>

      <Panel className="span-6" accent="yellow" label="Accordeur">
        <TunerList engine={engine} tuning={tuning} notation={settings.noteNotation} a4={input.a4} />
      </Panel>

      <Panel className="span-6" accent="orange" label="Ce que le micro ne sait pas faire">
        <p className="t-body">
          Il donne une <strong>hauteur</strong>, jamais une <strong>corde</strong>. La même note existe à plusieurs
          endroits du manche (La3 : quatre cases différentes) : l’app ne peut pas dire sur quelle corde tu as joué, et
          elle ne l’affirme pas. L’exercice valide donc la <strong>case attendue</strong>.
        </p>
        <p className="t-small t-dim">
          Sur un micro de téléphone, les deux cordes graves manquent d’énergie sous 100 Hz : une octave fausse est
          possible. L’app la reconnaît (<em>octave douteuse</em>) et ne compte alors aucune erreur — c’est le détecteur
          qui se trompe, pas l’élève.
        </p>
        <p className="t-small t-dim">
          Une guitare à −20 cents fait passer des notes justes pour fausses : accorde-toi ici avant un exercice au micro.
          Et si l’app joue du son pendant que tu joues, mets un casque, sinon le micro le reprend.
        </p>
        <p className="t-small t-dim">
          Le métronome de l’app est masqué ±90 ms autour de chaque clic : sans cela, il remplirait des cases tout seul.
        </p>
      </Panel>
    </main>
  );
}

/**
 * Liste des cordes, abonnée au moteur d'entrée : elle se re-rend ~47 fois par seconde sans entraîner
 * la page (les panneaux de réglage ne changent pas 47 fois par seconde).
 */
function TunerList(props: { engine: InputEngine | null; tuning: Tuning; notation: NoteNotation; a4: number }) {
  const { engine, tuning, notation, a4 } = props;
  const subscribe = useCallback((cb: () => void) => (engine ? engine.subscribe(cb) : () => {}), [engine]);
  const version = useSyncExternalStore(subscribe, () => engine?.version ?? 0, () => 0);
  void version;

  const heard = engine?.last?.stable ?? null;
  // 0,75 demi-ton : la corde « visée » est celle qu'on accorde, pas la plus proche du manche
  const nearest = heard ? nearestOpenString(tuning, heard.midi + heard.cents / 100, a4, 0.75) : null;
  const status = nearest ? tuneStatus(nearest.cents) : null;

  return (
    <>
      <p className="t-small t-dim">
        Corde entendue allumée ; l’écart est signé (− = trop bas). Numéro de corde à gauche (1 = la plus aiguë),{' '}
        {tuning.nameFr}.
      </p>
      <div className="tuner-list">
        {tuning.strings.map((_, i) => i).reverse().map((s) => {
          const pitch = tuning.strings[s]!;
          const hz = midiToFreq(openStringMidi(tuning, s), a4);
          const active = nearest !== null && nearest.string === s;
          const rowStatus = active ? status : null;
          return (
            <div key={s} className={`tuner-row ${active ? 'on' : ''} ${rowStatus ?? ''}`}>
              <span className="tuner-label" title={`corde ${tuning.strings.length - s}`}>{tuning.strings.length - s}</span>
              <span className="tuner-target">
                {fmtNote(pitch, notation)} · {hz.toFixed(1)} Hz
              </span>
              <span className="tuner-cents">{active ? `${nearest!.cents > 0 ? '+' : ''}${nearest!.cents.toFixed(0)} ¢` : '—'}</span>
              <span className={`tuner-status ${rowStatus ?? ''}`}>{rowStatus ? STATUS_LABEL[rowStatus] : ''}</span>
            </div>
          );
        })}
      </div>
      <div className="tuner-needle" aria-hidden="true">
        <span className="tuner-needle-zero" />
        {nearest && <b className={status ?? ''} style={{ left: `${50 + Math.max(-48, Math.min(48, nearest.cents / 2))}%` }} />}
      </div>
      <p className="t-small">
        {heard
          ? `entendu ${fmtNote(noteNameOf(heard.midi), notation)}${Math.floor(heard.midi / 12) - 1} · ${
            nearest ? `corde de ${fmtNote(tuning.strings[nearest.string]!, notation)} — ${STATUS_LABEL[status!]}` : 'aucune corde à moins d’un demi-ton (ce n’est pas une corde à vide)'
          }`
          : 'joue une corde à vide pour commencer.'}
      </p>
    </>
  );
}
