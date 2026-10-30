/** cover-fit a source into w x h (no pan/zoom), used for small thumbnails */
export function drawCoverSimple(ctx: CanvasRenderingContext2D, src: CanvasImageSource & { width: number; height: number }, w: number, h: number) {
  const k = Math.max(w / src.width, h / src.height);
  const dw = src.width * k;
  const dh = src.height * k;
  ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
