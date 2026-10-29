/** Lê um ficheiro de imagem, reduz-o (máx. 1200 px) e devolve base64 sem o prefixo "data:". */
export async function fileToBase64Image(
  file: File,
  maxSide = 1200,
): Promise<{ mime: "image/jpeg" | "image/png" | "image/webp"; dataBase64: string; previewUrl: string }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("FORMAT");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const keepPng = file.type === "image/png";
  const mime = keepPng ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(mime, 0.86);
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (base64.length > 2_800_000) throw new Error("TOO_BIG");
  return { mime, dataBase64: base64, previewUrl: dataUrl };
}
