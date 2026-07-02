import { PDFDocument, degrees, rgb } from 'pdf-lib';
import type { PdfAnnotation, PdfImageAnnotation, PdfPageItem, PdfTextAnnotation, SourcePdf } from '../types/pdf';

export async function loadPdfSource(file: File): Promise<SourcePdf> {
  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });

  return {
    id: crypto.randomUUID(),
    file,
    name: file.name,
    pageCount: pdf.getPageCount(),
  };
}

export function sourceToPages(source: SourcePdf): PdfPageItem[] {
  return Array.from({ length: source.pageCount }, (_, pageIndex) => ({
    id: `${source.id}-${pageIndex}-${crypto.randomUUID()}`,
    sourceId: source.id,
    sourceName: source.name,
    file: source.file,
    pageIndex,
    pageNumber: pageIndex + 1,
    rotation: 0,
  }));
}

export async function buildPdfFromPages(pages: PdfPageItem[], annotations: PdfAnnotation[] = []): Promise<Blob> {
  if (pages.length === 0) {
    throw new Error('Tidak ada halaman PDF untuk diexport.');
  }

  const outputPdf = await PDFDocument.create();
  const cache = new Map<File, PDFDocument>();

  for (const item of pages) {
    let sourcePdf = cache.get(item.file);

    if (!sourcePdf) {
      const bytes = await item.file.arrayBuffer();
      sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      cache.set(item.file, sourcePdf);
    }

    const [copiedPage] = await outputPdf.copyPages(sourcePdf, [item.pageIndex]);

    if (item.rotation !== 0) {
      copiedPage.setRotation(degrees(item.rotation));
    }

    outputPdf.addPage(copiedPage);

    const pageAnnotations = annotations.filter((annotation) => annotation.pageId === item.id);
    for (const annotation of pageAnnotations) {
      if (annotation.type === 'text') {
        drawTextAnnotation(copiedPage, annotation);
      } else {
        await drawImageAnnotation(outputPdf, copiedPage, annotation);
      }
    }
  }

  const outputBytes = await outputPdf.save();
  const arrayBuffer = outputBytes.buffer.slice(outputBytes.byteOffset, outputBytes.byteOffset + outputBytes.byteLength) as ArrayBuffer;
  return new Blob([arrayBuffer], { type: 'application/pdf' });
}

function drawTextAnnotation(page: import('pdf-lib').PDFPage, annotation: PdfTextAnnotation) {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const fontSize = Math.max(6, Math.min(annotation.fontSize, 96));
  const color = hexToRgb(annotation.color);
  const x = annotation.x * pageWidth;
  const yTop = annotation.y * pageHeight;
  const maxWidth = Math.max(12, annotation.width * pageWidth);

  page.drawText(annotation.text || 'Teks', {
    x,
    y: pageHeight - yTop - fontSize,
    size: fontSize,
    maxWidth,
    lineHeight: fontSize * 1.18,
    color: rgb(color.r, color.g, color.b),
  });
}

async function drawImageAnnotation(pdf: PDFDocument, page: import('pdf-lib').PDFPage, annotation: PdfImageAnnotation) {
  const bytes = dataUrlToUint8Array(annotation.dataUrl);
  const mime = annotation.dataUrl.slice(0, annotation.dataUrl.indexOf(';')).toLowerCase();
  const image = mime.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

  const { width: pageWidth, height: pageHeight } = page.getSize();
  const drawWidth = Math.max(12, annotation.width * pageWidth);
  const drawHeight = Math.max(12, annotation.height * pageHeight);
  const x = annotation.x * pageWidth;
  const y = pageHeight - annotation.y * pageHeight - drawHeight;

  page.drawImage(image, {
    x,
    y,
    width: drawWidth,
    height: drawHeight,
  });
}

function dataUrlToUint8Array(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim();
  const fallback = { r: 0, g: 0, b: 0 };

  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    g: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    b: Number.parseInt(normalized.slice(4, 6), 16) / 255,
  };
}
