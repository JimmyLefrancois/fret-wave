import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { THEME_SYNTHWAVE } from '../../src/core/tab/colors';
import { BufferSurface } from '../../src/core/tab/surface';
import { drawOverlay, drawScore } from '../../src/core/tab/render';
import { layoutScore, type LayoutOptions, type ScoreLayout } from '../../src/core/tab/layout';
import type { TabScore } from '../../src/core/tab/model';

function crc32(buf: Uint8Array): number {
  let c: number;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]!) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** PNG RGBA, agrandi d'un facteur entier k (pixels nets, comme à l'écran). */
export function encodePng(s: BufferSurface, k = 1): Buffer {
  const w = s.width * k;
  const h = s.height * k;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const si = (Math.floor(y / k) * s.width + Math.floor(x / k)) * 4;
      const di = y * (w * 4 + 1) + 1 + x * 4;
      raw[di] = s.data[si]!;
      raw[di + 1] = s.data[si + 1]!;
      raw[di + 2] = s.data[si + 2]!;
      raw[di + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

export function renderToBuffer(score: TabScore, opts: LayoutOptions, tick: number | null = null, frame = 0): { surface: BufferSurface; layout: ScoreLayout } {
  const layout = layoutScore(score, opts);
  const surface = new BufferSurface(layout.width, layout.height, THEME_SYNTHWAVE.panel);
  drawScore(surface, layout, THEME_SYNTHWAVE);
  drawOverlay(surface, layout, THEME_SYNTHWAVE, { tick, frame });
  return { surface, layout };
}

export function writePng(path: string, s: BufferSurface, k: number): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(s, k));
}
