/**
 * Reduz a fotografia no próprio telemóvel antes de enviar (o servidor aceita até ~1,5 MB por ficheiro).
 * Devolve sempre JPEG em base64, sem o prefixo "data:".
 */
const MAX_SIDE = 1600;
const MAX_BYTES = 1_200_000;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // cai para o método clássico
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(blob);
  });
}

export async function prepareImage(file: File): Promise<{ mime: "image/jpeg"; dataBase64: string }> {
  const img = await decode(file);
  const w = "naturalWidth" in img ? img.naturalWidth : img.width;
  const h = "naturalHeight" in img ? img.naturalHeight : img.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let blob: Blob | null = null;
  for (const q of [0.85, 0.75, 0.62, 0.5]) {
    blob = await toBlob(canvas, q);
    if (blob && blob.size <= MAX_BYTES) break;
  }
  if (!blob) throw new Error("encode");
  return { mime: "image/jpeg", dataBase64: await toBase64(blob) };
}
