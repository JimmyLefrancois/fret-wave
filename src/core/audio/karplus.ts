/**
 * Synthèse de corde pincée (Karplus-Strong) : REPLI pour les notes hors de la plage des échantillons
 * (PROJECT.md §3.5, D7), pour qu'une note du score ne soit jamais muette. Pure et déterministe (bruit initial
 * pseudo-aléatoire à graine fixe) : testée en mesurant la hauteur du signal produit.
 *
 * Boucle : y[n] = g · ½ (y[n−D] + y[n−D−1]) ; le filtre moyenneur retarde de ½ échantillon, un filtre passe-tout du
 * premier ordre règle la partie fractionnaire du retard (sinon une note aiguë serait fausse de dizaines de cents).
 */
export function karplusStrong(freq: number, sampleRate: number, seconds: number, seed = 1): Float32Array {
  const n = Math.max(1, Math.round(seconds * sampleRate));
  const out = new Float32Array(n);
  const delay = sampleRate / freq - 0.5; // retard total voulu de la boucle, moins le ½ échantillon du moyenneur
  const M = Math.floor(delay) - 1; // longueur entière de la ligne à retard
  const frac = delay - M; // ∈ [1, 2[ : partie restante, portée par le passe-tout (retard basse fréquence = frac)
  const c = (1 - frac) / (1 + frac);
  const line = new Float32Array(M);
  // bruit initial, passé dans un lissage (corde pincée : spectre sans trop d'aigus)
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let prev = 0;
  for (let i = 0; i < line.length; i++) {
    const v = rnd() * 2 - 1;
    prev = 0.55 * v + 0.45 * prev;
    line[i] = prev;
  }
  // décroissance : ≈ 1,2 s pour −60 dB à 110 Hz, plus rapide dans l'aigu (comme une vraie corde)
  const t60 = Math.max(0.35, 1.4 * (110 / freq) ** 0.35);
  const loopGain = Math.min(0.9995, 10 ** (-3 / (freq * t60))); // gain par tour de boucle : −60 dB au bout de t60
  let apX = 0, apY = 0, lp = 0, pos = 0;
  for (let i = 0; i < n; i++) {
    const x = line[pos]!;
    const avg = 0.5 * (x + lp);
    lp = x;
    const y = c * (avg - apY) + apX; // passe-tout
    apX = avg;
    apY = y;
    line[pos] = y * loopGain;
    out[i] = x;
    pos = pos + 1 >= line.length ? 0 : pos + 1;
  }
  // fondu de fin (pas de clic quand la source s'arrête)
  const fade = Math.min(n, Math.round(0.03 * sampleRate));
  for (let i = 0; i < fade; i++) out[n - 1 - i] = out[n - 1 - i]! * (i / fade);
  return out;
}
