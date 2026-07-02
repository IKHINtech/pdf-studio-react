export type SourcePdf = {
  id: string;
  file: File;
  name: string;
  pageCount: number;
};

export type PdfAnnotationBase = {
  id: string;
  pageId: string;
  x: number; // ratio 0..1 from left
  y: number; // ratio 0..1 from top
  width: number; // ratio 0..1
  height: number; // ratio 0..1
};

export type PdfTextAnnotation = PdfAnnotationBase & {
  type: 'text';
  text: string;
  fontSize: number;
  color: string;
};

export type PdfImageAnnotation = PdfAnnotationBase & {
  type: 'image' | 'signature';
  dataUrl: string;
  name: string;
};

export type PdfAnnotation = PdfTextAnnotation | PdfImageAnnotation;

export type PdfPageItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  file: File;
  pageIndex: number;
  pageNumber: number;
  rotation: number;
};
