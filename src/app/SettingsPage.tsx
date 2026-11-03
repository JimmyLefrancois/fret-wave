/**
 * Réglages globaux (PROJECT.md §12, décision D18) : notations, thème, animations, volumes.
 * Tout est mémorisé localement. Les pages de contrôle de la 1a-1c restent accessibles ici :
 * ce sont des outils de vérification, pas l'interface finale.
 */
import { useEffect, useState } from 'react';
import { navigate } from './router';
import { ACCOUNTS_ENABLED, fetchAccount } from '../core/account/client';
import { SCALE_SELECTION_KEY, DEFAULT_SELECTION, setScaleSelection } from './scaleSession';
import { DEFAULT_SETTINGS, setSettings, useSettings } from './settings';
import { AccountPanel } from './AccountPanel';
import { Panel, PixelButton, Segmented, Switch } from './ui';
import { Mixer, InstrumentPicker } from './AudioControls';
import { useInputSettings } from '../core/input/settings';
import { LOOK_SECONDS, type LookSeconds } from '../modules/gammes/coldReview';
import { PRACTICE_KEY } from '../core/progress/practiceLog';
import {
  ATTEMPTS_KEY, exportFilename, exportText, loadJournal, mergeAttempts, parseImport, progressStore, writeAttempts,
} from '../core/progress';
import { THEME_LIST } from '../core/themes';
import type { ChordNotation, NoteNotation } from '../core/theory';
import * as clock from '../core/clock';

export function SettingsPage() {
  const settings = useSettings();
  const input = useInputSettings();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [count, setCount] = useState(() => loadJournal(progressStore()).length);
  const [dataMsg, setDataMsg] = useState<string | null>(null);
  // connecté, le journal est celui du compte : l'effacer ici le ferait revenir à la prochaine synchro
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!ACCOUNTS_ENABLED) return;
    let alive = true;
    fetchAccount().then(
      (account) => { if (alive) setConnected(account !== null); },
      () => { /* compte indisponible : on ne sait pas, le bouton reste */ },
    );
    return () => { alive = false; };
  }, []);

  const wipe = () => {
    try {
      localStorage.removeItem(PRACTICE_KEY);
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem(SCALE_SELECTION_KEY);
    } catch {
      /* stockage inaccessible : rien à effacer */
    }
    setSettings({ ...DEFAULT_SETTINGS });
    setScaleSelection({ ...DEFAULT_SELECTION });
    setConfirmWipe(false);
    setWiped(true);
    setCount(0);
    setDataMsg('journal effacé');
  };

  const doExport = () => {
    const now = clock.nowDate();
    const text = exportText(loadJournal(progressStore()), now);
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename(now);
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDataMsg(`export : ${count} tentative${count > 1 ? 's' : ''}, ${(text.length / 1024).toFixed(1).replace('.', ',')} ko`);
    } catch (e) {
      setDataMsg(`export impossible : ${(e as Error).message}`);
    }
  };

  const doImport = (file: File) => {
    void file.text().then((text) => {
      const parsed = parseImport(text);
      if (parsed.error) {
        setDataMsg(`import refusé : ${parsed.error}`);
        return;
      }
      const current = loadJournal(progressStore());
      const merged = mergeAttempts(current, parsed.attempts);
      writeAttempts(progressStore(), merged);
      setCount(merged.length);
      setDataMsg(
        `${parsed.attempts.length} tentative${parsed.attempts.length > 1 ? 's' : ''} lue${parsed.attempts.length > 1 ? 's' : ''}, `
        + `${merged.length - current.length} ajoutée${merged.length - current.length > 1 ? 's' : ''}`
        + (parsed.rejected ? ` · ${parsed.rejected} entrée${parsed.rejected > 1 ? 's' : ''} refusée${parsed.rejected > 1 ? 's' : ''}` : ''),
      );
    });
  };

  return (
    <main className="shell">
      <div className="set-surface">
        <header className="page-head">
          <div>
            <h1 className="page-title">Réglages</h1>
            <p className="t-small t-dim">Mémorisés sur cet appareil</p>
          </div>
        </header>

        <AccountPanel />

        <Panel className="span-6" accent="cyan" label="Notation">
          <div className="field">
            <span className="t-label">Noms de notes</span>
            <Segmented<NoteNotation>
              value={settings.noteNotation}
              onChange={(v) => setSettings({ noteNotation: v })}
              label="Notation des notes"
              options={[{ value: 'fr', label: 'Solfège' }, { value: 'en', label: 'Anglo' }]}
            />
            <p className="t-small t-dim">Choisis comment afficher les noms des notes.</p>
          </div>
          <div className="field">
            <span className="t-label">Accords</span>
            <Segmented<ChordNotation>
              value={settings.chordNotation}
              onChange={(v) => setSettings({ chordNotation: v })}
              label="Notation des accords"
              options={[{ value: 'en', label: 'Am7' }, { value: 'fr', label: 'Lam7' }, { value: 'jazz', label: 'A-7' }]}
            />
          </div>
        </Panel>

        <Panel className="span-6" accent="magenta" label="Ambiance">
          <div className="theme-list">
            {THEME_LIST.map((t) => {
              const on = settings.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`theme-row ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => setSettings({ theme: t.id })}
                >
                  <span className="theme-swatch" style={{ background: t.palette.bg, borderColor: t.palette.magenta }}>
                    <i style={{ background: t.palette.magenta }} />
                    <i style={{ background: t.palette.cyan }} />
                    <i style={{ background: t.palette.orange }} />
                  </span>
                  <span className="theme-name">
                    {t.name}
                    <em>{on ? 'active' : t.scheme === 'light' ? 'clair' : 'sombre'}</em>
                  </span>
                  <span className={`tag ${on ? 'tag-on' : ''}`}>{on ? 'actif' : 'choisir'}</span>
                </button>
              );
            })}
          </div>
          <p className="t-small t-dim">
            Les couleurs des intervalles restent les mêmes dans les deux ambiances. Le décor et le texte changent.
          </p>
        </Panel>

        <Panel className="span-6" accent="violet" label="Révision">
          <div className="field">
            <span className="t-label">Regarder la forme après un rappel manqué</span>
            <Segmented<LookSeconds>
              value={settings.lookSeconds}
              onChange={(v) => setSettings({ lookSeconds: v })}
              label="Temps d’observation"
              options={LOOK_SECONDS.map((s) => ({ value: s, label: `${s} s` }))}
            />
            <p className="t-small t-dim">
              Seul le premier essai, fait de mémoire, compte pour la révision. L’essai après observation est enregistré,
              mais ne modifie pas la prochaine échéance.
            </p>
          </div>
        </Panel>

        <Panel className="span-6 set-switches" label="Mouvement">
          <Switch
            checked={settings.reduceMotion}
            onChange={(v) => setSettings({ reduceMotion: v })}
            label="Réduire les animations"
            hint="grille figée, glow fixe"
          />
          <Switch
            checked={settings.scanlines}
            onChange={(v) => setSettings({ scanlines: v })}
            label="Scanlines CRT"
            hint="sur le décor seulement, jamais sur les chiffres"
          />
          <Switch
            checked={settings.showDegreeRow}
            onChange={(v) => setSettings({ showDegreeRow: v })}
            label="Rangée de degrés"
            hint="aide à la lecture (daltonisme)"
          />
          <Switch
            checked={settings.showNeck}
            onChange={(v) => setSettings({ showNeck: v })}
            label="Vue manche"
            hint="module Gammes, page Découvrir : la forme de la position, tonique cerclée"
          />
        </Panel>

        <Panel className="span-12" accent="yellow" label="Son">
          <InstrumentPicker />
          <Mixer channels={['master', 'guitar', 'backing', 'drone', 'metronome']} />
          <p className="t-small t-dim">
            Échantillons CC0 (FreePats nylon, Karoryfer électrique). Crédits et licences complets sur la page Audio.
          </p>
        </Panel>

        <Panel className="span-6" accent="green" label="Entrée audio">
          <p className="t-body">
            Micro ou interface USB, pour jouer sur la vraie guitare : niveau, seuil de bruit, <strong>latence mesurée</strong>
            {' '}et accordeur. Les seuils et la latence sont mémorisés par source.
          </p>
          <p className="t-small">
            seuil <strong>{input.thresholds[input.source]} dBFS</strong> ({input.source === 'mic' ? 'micro' : 'interface USB'}) ·
            tolérance <strong>{input.centsTolerance} cents</strong> · La <strong>{input.a4} Hz</strong> · latence{' '}
            <strong>{input.latencies[input.source] > 0 ? `${input.latencies[input.source]} ms` : 'non mesurée'}</strong>
          </p>
          <p className="t-small t-dim">
            Le micro détecte la hauteur de la note, mais pas la corde jouée. Il nécessite une connexion HTTPS ou localhost.
            Un casque évite qu’il capte le son de l’app.
          </p>
        </Panel>

        <Panel className="span-6" label="Outils de vérification">
          <p className="t-small t-dim">
            Pages de contrôle du développement : générateurs de tablature, accordages, mesures audio.
          </p>
          <div className="row">
            <PixelButton onClick={() => navigate('tab')}>Tablature</PixelButton>
            <PixelButton onClick={() => navigate('audio')}>Audio</PixelButton>
            <PixelButton onClick={() => navigate('theory')}>Théorie</PixelButton>
          </div>
        </Panel>

        <Panel className="span-12" accent="orange" label="Données locales">
          <p className="t-small">
            Tes révisions, ton historique de séquences et ta gamme en cours, conservés dans ce navigateur. Sans compte,
            rien n’est envoyé sur un serveur.
          </p>
          <p className="t-small">
            <strong>{count}</strong> tentative{count > 1 ? 's' : ''} enregistrée{count > 1 ? 's' : ''} (plafond 2 000).
          </p>
          <div className="data-row">
            <PixelButton onClick={doExport} disabled={count === 0}>Exporter en JSON</PixelButton>
            <label className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
              Importer un fichier
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) doImport(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          {dataMsg && <p className="t-small data-msg" role="status">{dataMsg}</p>}
          <p className="t-small t-dim">
            L’import fusionne les données : tu peux importer deux fois le même fichier sans créer de doublons.
            Si le fichier vient d’une autre version, il est refusé et la raison s’affiche.
          </p>
          {!connected && (!confirmWipe ? (
            <PixelButton variant="danger" onClick={() => setConfirmWipe(true)}>Effacer les données locales</PixelButton>
          ) : (
            <div className="field">
              <p className="t-small">
                Efface le journal, les réglages et la gamme en cours de ce navigateur. Ça ne peut pas se défaire ;
                exporte avant si tu veux garder les tentatives.
              </p>
              <div className="row">
                <PixelButton variant="danger" onClick={wipe}>Confirmer l’effacement</PixelButton>
                <PixelButton variant="quiet" onClick={() => setConfirmWipe(false)}>Annuler</PixelButton>
              </div>
            </div>
          ))}
          {wiped && (
            <p className="t-small t-dim">
              Données effacées. Retour à {DEFAULT_SELECTION.tonic === 'A' ? 'La mineure pentatonique' : 'la gamme par défaut'}.
            </p>
          )}
        </Panel>
      </div>
    </main>
  );
}
