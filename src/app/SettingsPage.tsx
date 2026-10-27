/**
 * Réglages globaux (PROJECT.md §12, décision D18) : notations, thème, animations, volumes.
 * Tout est mémorisé localement. Les pages de contrôle de la 1a-1c restent accessibles ici :
 * ce sont des outils de vérification, pas l'interface finale.
 */
import { useState } from 'react';
import { navigate } from './router';
import { SCALE_SELECTION_KEY, DEFAULT_SELECTION, setScaleSelection } from './scaleSession';
import { DEFAULT_SETTINGS, setSettings, useSettings } from './settings';
import { Panel, PixelButton, Segmented, Switch } from './ui';
import { Mixer, InstrumentPicker } from './AudioControls';

import { PRACTICE_KEY } from '../core/progress/practiceLog';
import {
  ATTEMPTS_KEY, exportFilename, exportText, loadJournal, mergeAttempts, parseImport, progressStore, writeAttempts,
} from '../core/progress';
import { THEME_LIST } from '../core/themes';
import type { ChordNotation, NoteNotation } from '../core/theory';

export function SettingsPage() {
  const settings = useSettings();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [count, setCount] = useState(() => loadJournal(progressStore()).length);
  const [dataMsg, setDataMsg] = useState<string | null>(null);

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
    const now = new Date();
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
        + (parsed.rejected ? ` · ${parsed.rejected} entrée${parsed.rejected > 1 ? 's' : ''} refusée${parsed.rejected > 1 ? 's' : ''}` : '')
        + '. Rouvre le hub pour voir les chiffres à jour.',
      );
    });
  };

  return (
    <main className="shell">
      <header className="page-head">
        <button type="button" className="back" onClick={() => navigate('hub')} aria-label="Retour au hub">‹</button>
        <div>
          <h1 className="page-title">Réglages</h1>
          <p className="t-small t-dim">Mémorisés sur cet appareil</p>
        </div>
      </header>

      <Panel className="span-6" accent="cyan" label="Notation">
        <div className="field">
          <span className="t-label">Noms de notes</span>
          <Segmented<NoteNotation>
            value={settings.noteNotation}
            onChange={(v) => setSettings({ noteNotation: v })}
            label="Notation des notes"
            options={[{ value: 'fr', label: 'Solfège' }, { value: 'en', label: 'Anglo' }]}
          />
          <p className="t-small t-dim">Le modèle reste en anglo-saxon ; seul l’affichage change.</p>
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
          {THEME_LIST.map((t) => (
            <div key={t.id} className={`theme-row ${settings.theme === t.id ? 'on' : ''}`}>
              <span className="theme-swatch" style={{ background: t.palette.bg, borderColor: t.palette.magenta }}>
                <i style={{ background: t.palette.magenta }} />
                <i style={{ background: t.palette.cyan }} />
                <i style={{ background: t.palette.orange }} />
              </span>
              <span className="theme-name">
                {t.name}
                <em>{settings.theme === t.id ? 'active' : ''}</em>
              </span>
              <span className="tag">seul thème en 1d</span>
            </div>
          ))}
        </div>
        <p className="t-small t-dim">
          Les couleurs d’intervalles ne changent jamais avec l’ambiance : elles portent l’apprentissage.
          Les autres ambiances (Cyber City, Lo-fi, Arcade) arrivent en phase 8.
        </p>
      </Panel>

      <Panel className="span-5" label="Mouvement">
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
      </Panel>

      <Panel className="span-7" accent="yellow" label="Son">
        <InstrumentPicker />
        <Mixer channels={['master', 'guitar', 'drone', 'metronome']} />
        <p className="t-small t-dim">
          Échantillons CC0 (FreePats nylon, Karoryfer électrique). Crédits et licences complets sur la page Audio.
        </p>
      </Panel>

      <Panel className="span-6" label="Outils de vérification">
        <p className="t-small t-dim">
          Pages de contrôle des phases 1a-1c : tous les générateurs, les accordages, les mesures audio.
        </p>
        <div className="row">
          <PixelButton onClick={() => navigate('tab')}>Tablature</PixelButton>
          <PixelButton onClick={() => navigate('audio')}>Audio</PixelButton>
          <PixelButton onClick={() => navigate('theory')}>Théorie</PixelButton>
        </div>
      </Panel>

      <Panel className="span-6" accent="orange" label="Données locales">
        <p className="t-small">
          Journal de progression et sélection courante, conservés dans ce navigateur. Rien n’est envoyé sur un serveur.
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
          L’import fusionne par identifiant : importer deux fois le même fichier ne double rien. Un fichier d’une autre
          version est refusé avec sa raison, pas appliqué à moitié.
        </p>
        {!confirmWipe ? (
          <PixelButton variant="danger" onClick={() => setConfirmWipe(true)}>Effacer les données locales</PixelButton>
        ) : (
          <div className="row">
            <PixelButton variant="danger" onClick={wipe}>Confirmer l’effacement</PixelButton>
            <PixelButton variant="quiet" onClick={() => setConfirmWipe(false)}>Annuler</PixelButton>
          </div>
        )}
        {wiped && (
          <p className="t-small t-dim">
            Données effacées. Retour à {DEFAULT_SELECTION.tonic === 'A' ? 'La mineure pentatonique' : 'la gamme par défaut'}.
          </p>
        )}
      </Panel>
    </main>
  );
}
