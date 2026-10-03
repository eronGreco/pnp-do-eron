import type { ComposerImage } from "./types";

const SUPPORTED = ["image/png", "image/jpeg"];

let counter = 0;

/**
 * Le imagens do disco do usuario. Os bytes ficam apenas na memoria do
 * navegador e no blob local usado para a miniatura.
 */
export async function importImages(files: File[]): Promise<{
  images: ComposerImage[];
  rejected: string[];
}> {
  const images: ComposerImage[] = [];
  const rejected: string[] = [];

  for (const file of files) {
    if (!SUPPORTED.includes(file.type)) {
      rejected.push(`${file.name}: use imagens PNG ou JPG.`);
      continue;
    }

    const bytes = await file.arrayBuffer();
    const blob = new Blob([bytes.slice(0)], { type: file.type });
    let widthPx = 0;
    let heightPx = 0;

    try {
      const bitmap = await createImageBitmap(blob);
      widthPx = bitmap.width;
      heightPx = bitmap.height;
      bitmap.close();
    } catch {
      rejected.push(`${file.name}: não consegui abrir esta imagem.`);
      continue;
    }

    counter += 1;
    images.push({
      // Unico entre sessoes: imagens restauradas mantem seus ids salvos.
      id: `img-${Date.now().toString(36)}-${counter}-${crypto.randomUUID().slice(0, 8)}`,
      name: file.name,
      mime: file.type,
      bytes,
      previewUrl: URL.createObjectURL(blob),
      widthPx,
      heightPx,
    });
  }

  return { images, rejected };
}

export function releaseImages(images: ComposerImage[]) {
  for (const image of images) URL.revokeObjectURL(image.previewUrl);
}
