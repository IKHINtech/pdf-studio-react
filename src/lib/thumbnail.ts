import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const imageCache = new Map<string, string>();
const pdfCache = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

async function getPdfDocument(file: File) {
  const key = fileKey(file);
  const cached = pdfCache.get(key);

  if (cached) return cached;

  const taskPromise = file.arrayBuffer().then((buffer) => {
    const data = new Uint8Array(buffer.slice(0));
    return pdfjsLib.getDocument({ data }).promise;
  });

  pdfCache.set(key, taskPromise);
  return taskPromise;
}

export async function renderPdfPageImage(file: File, pageIndex: number, rotation: number, scale = 0.35): Promise<string> {
  const key = `${fileKey(file)}-${pageIndex}-${rotation}-${scale}`;
  const cached = imageCache.get(key);

  if (cached) return cached;

  const pdf = await getPdfDocument(file);
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale, rotation });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });

  if (!context) {
    throw new Error('Browser tidak mendukung canvas.');
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({ canvasContext: context, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', scale >= 1 ? 0.9 : 0.78);

  canvas.width = 0;
  canvas.height = 0;
  page.cleanup();

  imageCache.set(key, dataUrl);
  return dataUrl;
}

export function renderPdfPageThumbnail(file: File, pageIndex: number, rotation: number): Promise<string> {
  return renderPdfPageImage(file, pageIndex, rotation, 0.26);
}
