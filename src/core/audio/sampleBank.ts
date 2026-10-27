/**
 * Banques d'échantillons de guitare (phase 1c) : manifeste, choix de l'échantillon, hauteur, chargement.
 *
 * Tout ce qui décide QUOI jouer est PUR (testé sans navigateur) ; seul `loadSampleSet` touche à Web Audio.
 * Les manifestes (`public/samples/<id>/manifest.json`, produits par `tools/build-samples.mjs`) portent la
 * provenance, la licence, et — par échantillon — l'écart de hauteur MESURÉ (cents) et le gain de nivellement :
 * la lecture les applique, donc la note jouée sort à la hauteur nominale et au même niveau que ses voisines.
 */

export type Layer = 'p' | 'mf' | 'f';
export const LAYER_ORDER: readonly Layer[] = ['p', 'mf', 'f'];

export interface SampleEntry {
  /** Hauteur nominale de l'échantillon (MIDI, E2 = 40). */
  midi: number;
  layer: Layer;
  /** Répétition (round-robin), à partir de 1. */
  variant: number;
  file: string;
  sourceFile: string;
  bytes: number;
  sha256: string;
  durationS: number;
  /** Écart MESURÉ entre la hauteur réelle de l'enregistrement et la hauteur nominale (+ = trop haut). */
  measuredCents: number;
  pitchClarity: number;
  /** Gain de nivellement (dB) appliqué à la lecture. */
  gainDb: number;
}

export interface LicenseInfo {
  spdx: string;
  url: string;
  file: string;
  attributionRequired: boolean;
}

export interface SampleManifest {
  id: string;
  nameFr: string;
  format: string;
  sampleRate: number;
  /** Écart maximal (demi-tons) toléré entre la note demandée et l'échantillon le plus proche. */
  maxShiftSemitones: number;
  /** Durée de la coupure d'une note relâchée (s). */
  releaseS: number;
  /** Niveau relatif de la banque (dB), mesuré : changer d'instrument ne change pas le volume. */
  trimDb: number;
  license: LicenseInfo;
  source: { title: string; author: string; url: string; download: string; version: string; recording: string; archiveSha256?: string };
  modifications: string[];
  samples: SampleEntry[];
  totalBytes: number;
}

/** Licences que l'application accepte d'embarquer sans attribution obligatoire (voir MUSIC_DESIGN.md §11.2). */
export const ACCEPTED_LICENSES: readonly string[] = ['CC0-1.0'];

export function parseManifest(x: unknown): SampleManifest {
  const fail = (m: string): never => {
    throw new Error(`manifeste d'échantillons invalide : ${m}`);
  };
  if (typeof x !== 'object' || x === null) return fail('pas un objet');
  const m = x as Record<string, unknown>;
  for (const k of ['id', 'nameFr', 'format']) if (typeof m[k] !== 'string') fail(`${k} manquant`);
  for (const k of ['sampleRate', 'maxShiftSemitones', 'releaseS', 'trimDb', 'totalBytes']) if (typeof m[k] !== 'number') fail(`${k} manquant`);
  const lic = m.license as Record<string, unknown> | undefined;
  if (!lic || typeof lic.spdx !== 'string' || typeof lic.url !== 'string' || typeof lic.file !== 'string') fail('licence incomplète');
  if (!m.source || typeof (m.source as Record<string, unknown>).url !== 'string') fail('source manquante');
  if (!Array.isArray(m.modifications)) fail('modifications manquantes');
  if (!Array.isArray(m.samples) || m.samples.length === 0) fail('aucun échantillon');
  for (const s of m.samples as Array<Record<string, unknown>>) {
    for (const k of ['midi', 'variant', 'bytes', 'durationS', 'measuredCents', 'gainDb']) {
      if (typeof s[k] !== 'number' || !Number.isFinite(s[k] as number)) fail(`échantillon ${String(s.file)} : ${k} invalide`);
    }
    if (typeof s.file !== 'string' || typeof s.sha256 !== 'string') fail('échantillon sans fichier / empreinte');
    if (!LAYER_ORDER.includes(s.layer as Layer)) fail(`échantillon ${String(s.file)} : couche inconnue`);
  }
  return x as SampleManifest;
}

/**
 * Couche de vélocité demandée (0-1) : p < 0,5 ≤ mf < 0,85 ≤ f. La vélocité de base du jeu (0,70) est au milieu de la
 * couche mf : l'humanisation et les accents ne la font pas basculer d'une note à l'autre (changement de timbre audible).
 */
export function layerFor(velocity: number): Layer {
  return velocity < 0.5 ? 'p' : velocity < 0.85 ? 'mf' : 'f';
}

/**
 * Gain linéaire dû à la vélocité. Banque à plusieurs couches : les couches portent déjà l'essentiel de la dynamique
 * (le timbre change), le gain ne fait que lisser entre elles. Banque à une couche : le gain porte toute la dynamique.
 */
export function velocityGain(velocity: number, layered: boolean): number {
  const v = Math.max(0, Math.min(1, velocity));
  return layered ? 0.62 + 0.38 * v : 0.3 + 0.7 * v ** 1.2;
}

export const dbToGain = (db: number): number => 10 ** (db / 20);

export interface NotePlan {
  entry: SampleEntry;
  /** Vitesse de lecture à appliquer (hauteur demandée + correction de l'écart mesuré). */
  rate: number;
  /** Écart entre la note demandée et la hauteur nominale de l'échantillon (demi-tons, signé). */
  shiftSemitones: number;
  /** Gain de nivellement × gain de vélocité. */
  gain: number;
}

export class SampleSet {
  readonly roots: readonly number[];
  readonly layers: readonly Layer[];
  private readonly byRoot = new Map<number, Map<Layer, SampleEntry[]>>();

  constructor(readonly manifest: SampleManifest) {
    for (const e of manifest.samples) {
      const layers = this.byRoot.get(e.midi) ?? new Map<Layer, SampleEntry[]>();
      const list = layers.get(e.layer) ?? [];
      list.push(e);
      layers.set(e.layer, list);
      this.byRoot.set(e.midi, layers);
    }
    for (const layers of this.byRoot.values()) for (const list of layers.values()) list.sort((a, b) => a.variant - b.variant);
    this.roots = [...this.byRoot.keys()].sort((a, b) => a - b);
    this.layers = LAYER_ORDER.filter((l) => manifest.samples.some((s) => s.layer === l));
  }

  get layered(): boolean {
    return this.layers.length > 1;
  }

  /** Plage de notes jouables par échantillon (au-delà : synthèse de repli). */
  get range(): { lo: number; hi: number } {
    const s = this.manifest.maxShiftSemitones;
    return { lo: this.roots[0]! - s, hi: this.roots[this.roots.length - 1]! + s };
  }

  covers(midi: number): boolean {
    return midi >= this.range.lo && midi <= this.range.hi;
  }

  /** Échantillon le plus proche ; à égalité on prend le plus aigu (on ralentit un échantillon plutôt qu'on ne l'accélère). */
  nearestRoot(midi: number): number {
    let best = this.roots[0]!;
    for (const r of this.roots) {
      const d = Math.abs(midi - r), db = Math.abs(midi - best);
      if (d < db || (d === db && r > best)) best = r;
    }
    return best;
  }

  variantsAt(root: number, layer: Layer): number {
    return this.byRoot.get(root)?.get(layer)?.length ?? 0;
  }

  /**
   * Choisit l'échantillon et la vitesse de lecture. `rr` = compteur de répétitions (le moteur le fait avancer à chaque
   * note de même hauteur : des notes répétées ne sonnent pas deux fois la même).
   * `layerVelocity` : vélocité qui choisit la COUCHE (celle de l'événement entier : toutes les cordes d'un même strum
   * gardent le même timbre) ; `velocity` ne règle que le gain. Renvoie `null` si la note est hors plage (le moteur
   * bascule alors sur la synthèse de repli).
   */
  plan(midi: number, velocity: number, rr = 0, extraCents = 0, layerVelocity = velocity): NotePlan | null {
    if (!this.covers(midi)) return null;
    const root = this.nearestRoot(midi);
    const layers = this.byRoot.get(root)!;
    const want = layerFor(layerVelocity);
    // couche voulue, sinon la plus proche disponible
    const order = [...layers.keys()].sort((a, b) => Math.abs(LAYER_ORDER.indexOf(a) - LAYER_ORDER.indexOf(want)) - Math.abs(LAYER_ORDER.indexOf(b) - LAYER_ORDER.indexOf(want)));
    const list = layers.get(order[0]!)!;
    const entry = list[((rr % list.length) + list.length) % list.length]!;
    const shift = midi - entry.midi;
    const cents = shift * 100 - entry.measuredCents + extraCents;
    return {
      entry,
      rate: 2 ** (cents / 1200),
      shiftSemitones: shift,
      gain: dbToGain(entry.gainDb + this.manifest.trimDb) * velocityGain(velocity, this.layered),
    };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Chargement (navigateur)
// ---------------------------------------------------------------------------------------------------------------

export interface LoadProgress {
  loadedBytes: number;
  totalBytes: number;
  loadedFiles: number;
  totalFiles: number;
  /** Fichier en cours / dernier terminé (affichage). */
  file: string;
}

export function sampleBaseUrl(id: string, base = import.meta.env.BASE_URL): string {
  return `${base}samples/${id}/`;
}

export async function fetchManifest(id: string, fetchFn: typeof fetch = fetch): Promise<SampleManifest> {
  const res = await fetchFn(`${sampleBaseUrl(id)}manifest.json`);
  if (!res.ok) throw new Error(`manifeste ${id} : HTTP ${res.status}`);
  return parseManifest(await res.json());
}

/**
 * Télécharge et décode tous les fichiers (6 en parallèle). `ctx` peut être suspendu : `decodeAudioData` fonctionne
 * avant le premier geste de l'utilisateur.
 */
export async function loadSampleBuffers(
  ctx: Pick<BaseAudioContext, 'decodeAudioData'>,
  set: SampleSet,
  onProgress?: (p: LoadProgress) => void,
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, AudioBuffer>> {
  const entries = set.manifest.samples;
  const total = set.manifest.totalBytes;
  const out = new Map<string, AudioBuffer>();
  let loadedBytes = 0;
  let next = 0;
  const base = sampleBaseUrl(set.manifest.id);
  const worker = async () => {
    for (;;) {
      const i = next++;
      const e = entries[i];
      if (!e) return;
      const res = await fetchFn(base + e.file);
      if (!res.ok) throw new Error(`${e.file} : HTTP ${res.status}`);
      const data = await res.arrayBuffer();
      out.set(e.file, await ctx.decodeAudioData(data));
      loadedBytes += e.bytes;
      onProgress?.({ loadedBytes, totalBytes: total, loadedFiles: out.size, totalFiles: entries.length, file: e.file });
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, entries.length) }, worker));
  return out;
}
