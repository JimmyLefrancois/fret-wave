/** Dimensions du décor : l'échelle entière en pixels physiques doit couvrir tout le viewport CSS. */
export function sceneViewport(width: number, height: number, dpr: number) {
  const scale = Math.max(2, Math.min(3, Math.round(Math.min(width, height) / 500)));
  const pixelScale = Math.max(1, Math.round(scale * dpr));
  const cssScale = pixelScale / dpr;
  // Avec un DPR fractionnaire, cssScale peut être inférieur à scale : on ajuste le nombre de pixels
  // logiques, sinon une bande reste vide à droite et en bas (par exemple DPR 2,625).
  const logicalWidth = Math.ceil(width / cssScale);
  const logicalHeight = Math.ceil(height / cssScale);
  return { pixelScale, logicalWidth, logicalHeight, cssWidth: logicalWidth * cssScale, cssHeight: logicalHeight * cssScale };
}
