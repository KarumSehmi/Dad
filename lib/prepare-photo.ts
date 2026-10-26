// Runs in the browser. Shrinks a photo to at most 2048px on its longest side
// and re-encodes it as JPEG before upload. Re-encoding also drops the photo's
// metadata, including the GPS location phones embed.

export type PreparedPhoto = {
  blob: Blob;
  width: number;
  height: number;
  color: string;
  previewUrl: string;
};

const MAX_EDGE = 2048;
const MAX_BYTES = 3.5 * 1024 * 1024;

function canvas(width: number, height: number) {
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  const ctx = el.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { el, ctx };
}

function release(el: HTMLCanvasElement) {
  // Frees the pixel buffer straight away, which matters on iPhones.
  el.width = 0;
  el.height = 0;
}

function toJpeg(el: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    el.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))), "image/jpeg", quality),
  );
}

function averageColor(source: HTMLCanvasElement): string {
  const { el, ctx } = canvas(16, 16);
  ctx.drawImage(source, 0, 0, 16, 16);
  const { data } = ctx.getImageData(0, 0, 16, 16);
  release(el);
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    sum[0] += data[i];
    sum[1] += data[i + 1];
    sum[2] += data[i + 2];
  }
  const pixels = data.length / 4;
  return "#" + sum.map((c) => Math.round(c / pixels).toString(16).padStart(2, "0")).join("");
}

export function friendlyPhotoError(file: File): string {
  if (/hei[cf]$/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    return "This browser can't open HEIC photos. Try Safari, or save the photo as a JPEG first.";
  }
  return "This file couldn't be opened as a photo.";
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = sourceUrl;
    await img.decode();
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) throw new Error("Image has no size");

    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    const width = Math.max(1, Math.round(w * scale));
    const height = Math.max(1, Math.round(h * scale));

    // Halve repeatedly before the final resize; a single big jump looks soft.
    let current: CanvasImageSource = img;
    let cw = w;
    let ch = h;
    let step: HTMLCanvasElement | null = null;
    while (cw / 2 > width) {
      cw = Math.round(cw / 2);
      ch = Math.round(ch / 2);
      const next = canvas(cw, ch);
      next.ctx.drawImage(current, 0, 0, cw, ch);
      if (step) release(step);
      step = next.el;
      current = next.el;
    }

    const out = canvas(width, height);
    // Transparent areas (e.g. in PNGs) would otherwise turn black.
    out.ctx.fillStyle = "#ffffff";
    out.ctx.fillRect(0, 0, width, height);
    out.ctx.drawImage(current, 0, 0, width, height);
    if (step) release(step);

    const color = averageColor(out.el);
    let quality = 0.86;
    let blob = await toJpeg(out.el, quality);
    while (blob.size > MAX_BYTES && quality > 0.5) {
      quality -= 0.12;
      blob = await toJpeg(out.el, quality);
    }
    release(out.el);
    if (blob.size > MAX_BYTES) throw new Error("Photo is still too large");

    return { blob, width, height, color, previewUrl: URL.createObjectURL(blob) };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
