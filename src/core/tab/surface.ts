/**
 * Surface de dessin en pixels LOGIQUES : le rendu n'écrit que des rectangles entiers, jamais de lissage.
 *  - CanvasSurface : Canvas 2D avec une transformation d'échelle entière (k pixels physiques par pixel logique) ;
 *  - BufferSurface : tampon RGBA en mémoire (tests de rendu pixel par pixel, export PNG).
 */
import { hexToRgb } from './colors';

export interface Surface {
  readonly width: number;
  readonly height: number;
  fillRect(x: number, y: number, w: number, h: number, color: string, alpha?: number): void;
}

export class CanvasSurface implements Surface {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    readonly width: number,
    readonly height: number,
    private readonly k: number,
  ) {}

  /** À appeler avant de dessiner : échelle entière + aucun lissage. */
  begin(clear = true): void {
    const c = this.ctx;
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    c.imageSmoothingEnabled = false;
    if (clear) c.clearRect(0, 0, this.width, this.height);
  }

  fillRect(x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
    const c = this.ctx;
    if (alpha !== 1) c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
    if (alpha !== 1) c.globalAlpha = 1;
  }
}

export class BufferSurface implements Surface {
  readonly data: Uint8ClampedArray;

  constructor(readonly width: number, readonly height: number, background = '#000000') {
    this.data = new Uint8ClampedArray(width * height * 4);
    const [r, g, b] = hexToRgb(background);
    for (let i = 0; i < width * height; i++) {
      this.data[i * 4] = r;
      this.data[i * 4 + 1] = g;
      this.data[i * 4 + 2] = b;
      this.data[i * 4 + 3] = 255;
    }
  }

  fillRect(x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
    const [r, g, b] = hexToRgb(color);
    const x0 = Math.max(0, x), y0 = Math.max(0, y);
    const x1 = Math.min(this.width, x + w), y1 = Math.min(this.height, y + h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * this.width + xx) * 4;
        if (alpha >= 1) {
          this.data[i] = r;
          this.data[i + 1] = g;
          this.data[i + 2] = b;
        } else {
          this.data[i] = this.data[i]! * (1 - alpha) + r * alpha;
          this.data[i + 1] = this.data[i + 1]! * (1 - alpha) + g * alpha;
          this.data[i + 2] = this.data[i + 2]! * (1 - alpha) + b * alpha;
        }
      }
    }
  }

  pixel(x: number, y: number): string {
    const i = (y * this.width + x) * 4;
    const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
    return `#${h(this.data[i]!)}${h(this.data[i + 1]!)}${h(this.data[i + 2]!)}`.toUpperCase();
  }

  /** Nombre de pixels d'une couleur donnée dans un rectangle. */
  count(color: string, x = 0, y = 0, w = this.width, h = this.height): number {
    const want = color.toUpperCase();
    let n = 0;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.pixel(xx, yy) === want) n++;
    return n;
  }
}
