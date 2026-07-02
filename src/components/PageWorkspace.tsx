import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, FileImage, FilePlus2, GripVertical, Minus, MoveRight, PenLine, Plus, RotateCcw, RotateCw, Trash2, Type } from 'lucide-react';
import { renderPdfPageImage } from '../lib/thumbnail';
import type { PdfAnnotation, PdfImageAnnotation, PdfPageItem, PdfTextAnnotation } from '../types/pdf';

type PageWorkspaceProps = {
  pages: PdfPageItem[];
  selectedPageId: string | null;
  onSelectPage: (id: string) => void;
  onChange: (pages: PdfPageItem[]) => void;
  onInsertAfter: (index: number, files: File[]) => void;
  annotations: PdfAnnotation[];
  onAnnotationsChange: (annotations: PdfAnnotation[]) => void;
  disabled?: boolean;
};

export function PageWorkspace({ pages, selectedPageId, onSelectPage, onChange, onInsertAfter, annotations, onAnnotationsChange, disabled = false }: PageWorkspaceProps) {
  const insertInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number>(0);
  const [targetOrder, setTargetOrder] = useState('');
  const [zoom, setZoom] = useState(1);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const selectedIndex = useMemo(() => {
    const index = pages.findIndex((page) => page.id === selectedPageId);
    return index >= 0 ? index : 0;
  }, [pages, selectedPageId]);
  const selectedPage = pages[selectedIndex];
  const pageAnnotations = useMemo(() => annotations.filter((annotation) => annotation.pageId === selectedPage?.id), [annotations, selectedPage?.id]);
  const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  useEffect(() => {
    if (!selectedPage && pages[0]) onSelectPage(pages[0].id);
  }, [onSelectPage, pages, selectedPage]);

  useEffect(() => {
    setTargetOrder(String(selectedIndex + 1));
    setSelectedAnnotationId(null);
  }, [selectedIndex]);

  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedPageId, pages.length]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((page) => page.id === active.id);
    const newIndex = pages.findIndex((page) => page.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextPages = arrayMove(pages, oldIndex, newIndex);
    onChange(nextPages);
    onSelectPage(String(active.id));
  }

  function moveSelectedPage() {
    if (!selectedPage) return;

    const requestedPosition = Number.parseInt(targetOrder, 10);
    if (Number.isNaN(requestedPosition)) {
      setTargetOrder(String(selectedIndex + 1));
      return;
    }

    const targetIndex = Math.max(0, Math.min(requestedPosition - 1, pages.length - 1));
    if (targetIndex === selectedIndex) return;

    onChange(arrayMove(pages, selectedIndex, targetIndex));
    onSelectPage(selectedPage.id);
    setTargetOrder(String(targetIndex + 1));
  }

  function deletePage(id: string) {
    const nextPages = pages.filter((page) => page.id !== id);
    const deletedIndex = pages.findIndex((page) => page.id === id);
    const fallback = nextPages[Math.min(deletedIndex, nextPages.length - 1)] ?? nextPages[0];
    if (fallback) onSelectPage(fallback.id);
    onAnnotationsChange(annotations.filter((annotation) => annotation.pageId !== id));
    onChange(nextPages);
  }

  function rotatePage(id: string) {
    onChange(
      pages.map((page) =>
        page.id === id
          ? {
              ...page,
              rotation: (page.rotation + 90) % 360,
            }
          : page,
      ),
    );
  }

  function copySelectedPage() {
    if (!selectedPage) return;

    const copiedPageId = crypto.randomUUID();
    const copiedPage: PdfPageItem = {
      ...selectedPage,
      id: copiedPageId,
    };

    const copiedAnnotations = annotations
      .filter((annotation) => annotation.pageId === selectedPage.id)
      .map((annotation) => ({
        ...annotation,
        id: crypto.randomUUID(),
        pageId: copiedPageId,
      } as PdfAnnotation));

    const nextPages = [
      ...pages.slice(0, selectedIndex + 1),
      copiedPage,
      ...pages.slice(selectedIndex + 1),
    ];

    onChange(nextPages);
    onAnnotationsChange([...annotations, ...copiedAnnotations]);
    onSelectPage(copiedPageId);
    setSelectedAnnotationId(null);
    setTargetOrder(String(selectedIndex + 2));
  }

  function openInsertPicker(index: number) {
    setInsertAfterIndex(index);
    insertInputRef.current?.click();
  }

  function zoomIn() {
    setZoom((current) => Math.min(2.5, Number((current + 0.15).toFixed(2))));
  }

  function zoomOut() {
    setZoom((current) => Math.max(0.45, Number((current - 0.15).toFixed(2))));
  }

  function resetZoom() {
    setZoom(1);
  }

  function addTextAnnotation() {
    if (!selectedPage) return;

    const next: PdfTextAnnotation = {
      id: crypto.randomUUID(),
      pageId: selectedPage.id,
      type: 'text',
      x: 0.32,
      y: 0.32,
      width: 0.36,
      height: 0.08,
      text: 'Teks baru',
      fontSize: 18,
      color: '#111827',
    };

    onAnnotationsChange([...annotations, next]);
    setSelectedAnnotationId(next.id);
  }

  async function handleImageFiles(files: FileList | null, type: 'image' | 'signature') {
    if (!selectedPage || !files?.[0]) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    const dataUrl = await fileToDataUrl(file);
    const next: PdfImageAnnotation = {
      id: crypto.randomUUID(),
      pageId: selectedPage.id,
      type,
      x: type === 'signature' ? 0.34 : 0.36,
      y: type === 'signature' ? 0.66 : 0.36,
      width: type === 'signature' ? 0.32 : 0.28,
      height: type === 'signature' ? 0.11 : 0.2,
      dataUrl,
      name: file.name,
    };

    onAnnotationsChange([...annotations, next]);
    setSelectedAnnotationId(next.id);
  }

  function patchAnnotation(id: string, patch: Partial<PdfAnnotation>) {
    onAnnotationsChange(annotations.map((annotation) => (annotation.id === id ? ({ ...annotation, ...patch } as PdfAnnotation) : annotation)));
  }

  function deleteAnnotation(id: string) {
    onAnnotationsChange(annotations.filter((annotation) => annotation.id !== id));
    setSelectedAnnotationId(null);
  }

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="canva-workspace">
      <input
        ref={insertInputRef}
        className="hidden-input"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        disabled={disabled}
        onChange={(event) => {
          const input = event.currentTarget;
          const files = Array.from(input.files || []).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
          if (files.length > 0) onInsertAfter(insertAfterIndex, files);
          input.value = '';
        }}
      />
      <input ref={imageInputRef} className="hidden-input" type="file" accept="image/png,image/jpeg,.jpg,.jpeg" disabled={disabled} onChange={(event) => { const input = event.currentTarget; void handleImageFiles(input.files, 'image').finally(() => { input.value = ''; }); }} />
      <input ref={signatureInputRef} className="hidden-input" type="file" accept="image/png,image/jpeg,.jpg,.jpeg" disabled={disabled} onChange={(event) => { const input = event.currentTarget; void handleImageFiles(input.files, 'signature').finally(() => { input.value = ''; }); }} />

      <section className="focus-panel">
        <div className="focus-toolbar">
          <div className="focus-title">
            <p className="eyebrow compact">Preview halaman</p>
            <h2>Halaman {selectedIndex + 1}</h2>
            <span title={selectedPage.sourceName}>{selectedPage.sourceName} · halaman asli {selectedPage.pageNumber}</span>
          </div>
          <div className="focus-actions">
            <form
              className="move-form"
              onSubmit={(event) => {
                event.preventDefault();
                moveSelectedPage();
              }}
            >
              <label htmlFor="move-to-page">Pindah ke</label>
              <input
                id="move-to-page"
                type="number"
                min="1"
                max={pages.length}
                value={targetOrder}
                disabled={disabled}
                onChange={(event) => setTargetOrder(event.target.value)}
                onBlur={moveSelectedPage}
              />
              <button className="icon-button" type="submit" disabled={disabled} title="Pindahkan halaman terpilih">
                <MoveRight size={17} />
              </button>
            </form>
            <div className="edit-tools" aria-label="Tool edit PDF">
              <button className="button small" type="button" disabled={disabled} onClick={addTextAnnotation} title="Tambah teks baru">
                <Type size={16} /> Teks
              </button>
              <button className="button small" type="button" disabled={disabled} onClick={() => imageInputRef.current?.click()} title="Tambah gambar">
                <FileImage size={16} /> Gambar
              </button>
              <button className="button small" type="button" disabled={disabled} onClick={() => signatureInputRef.current?.click()} title="Tambah tanda tangan">
                <PenLine size={16} /> TTD
              </button>
            </div>
            <div className="zoom-control" aria-label="Kontrol zoom preview">
              <button className="icon-button" type="button" disabled={disabled || zoom <= 0.45} onClick={zoomOut} title="Zoom out">
                <Minus size={17} />
              </button>
              <button className="zoom-value" type="button" onClick={resetZoom} title="Reset zoom ke 100%">
                {Math.round(zoom * 100)}%
              </button>
              <button className="icon-button" type="button" disabled={disabled || zoom >= 2.5} onClick={zoomIn} title="Zoom in">
                <Plus size={17} />
              </button>
              <button className="icon-button" type="button" onClick={resetZoom} title="Reset zoom">
                <RotateCcw size={16} />
              </button>
            </div>
            <button className="button small" disabled={disabled} onClick={copySelectedPage} title="Copy halaman aktif beserta teks/gambar/tanda tangan">
              <Copy size={16} /> Copy page
            </button>
            <button className="button small" disabled={disabled} onClick={() => openInsertPicker(selectedIndex)}>
              <FilePlus2 size={16} /> Sisipkan setelah ini
            </button>
            <button className="icon-button" disabled={disabled} title="Rotate halaman" onClick={() => rotatePage(selectedPage.id)}>
              <RotateCw size={17} />
            </button>
            <button className="icon-button danger" disabled={disabled} title="Hapus halaman" onClick={() => deletePage(selectedPage.id)}>
              <Trash2 size={17} />
            </button>
          </div>
        </div>

        {selectedAnnotation ? (
          <AnnotationInspector annotation={selectedAnnotation} onChange={(patch) => patchAnnotation(selectedAnnotation.id, patch)} onDelete={() => deleteAnnotation(selectedAnnotation.id)} />
        ) : null}

        <FocusedPage
          page={selectedPage}
          zoom={zoom}
          annotations={pageAnnotations}
          selectedAnnotationId={selectedAnnotationId}
          onSelectAnnotation={setSelectedAnnotationId}
          onPatchAnnotation={patchAnnotation}
        />
      </section>

      <section className="timeline-panel" aria-label="Urutan halaman PDF">
        <div className="timeline-header">
          <div>
            <h3>Urutan halaman</h3>
            <p>Scroll kiri-kanan untuk melihat semua halaman. Drag thumbnail untuk menyusun ulang, atau tekan + untuk menyisipkan PDF.</p>
          </div>
          <button className="button small primary" disabled={disabled} onClick={() => openInsertPicker(pages.length - 1)}>
            <FilePlus2 size={16} /> Tambah di akhir
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pages.map((page) => page.id)} strategy={horizontalListSortingStrategy}>
            <div className="page-strip" ref={stripRef}>
              {pages.map((page, index) => (
                <StripPage
                  key={page.id}
                  page={page}
                  index={index}
                  isActive={page.id === selectedPage.id}
                  onSelect={() => onSelectPage(page.id)}
                  onInsertAfter={() => openInsertPicker(index)}
                  disabled={disabled}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>
    </div>
  );
}

function AnnotationInspector({ annotation, onChange, onDelete }: { annotation: PdfAnnotation; onChange: (patch: Partial<PdfAnnotation>) => void; onDelete: () => void }) {
  return (
    <div className="annotation-inspector">
      <strong>{annotation.type === 'text' ? 'Edit teks' : annotation.type === 'signature' ? 'Edit tanda tangan' : 'Edit gambar'}</strong>
      {annotation.type === 'text' ? (
        <>
          <input className="annotation-text-input" value={annotation.text} onChange={(event) => onChange({ text: event.target.value } as Partial<PdfAnnotation>)} />
          <label>
            Font
            <input type="number" min="8" max="96" value={annotation.fontSize} onChange={(event) => onChange({ fontSize: Number(event.target.value) } as Partial<PdfAnnotation>)} />
          </label>
          <label>
            Warna
            <input type="color" value={annotation.color} onChange={(event) => onChange({ color: event.target.value } as Partial<PdfAnnotation>)} />
          </label>
        </>
      ) : (
        <span title={annotation.name}>{annotation.name}</span>
      )}
      <label>
        Lebar %
        <input type="number" min="5" max="100" value={Math.round(annotation.width * 100)} onChange={(event) => onChange({ width: clamp(Number(event.target.value) / 100, 0.05, 1) } as Partial<PdfAnnotation>)} />
      </label>
      <label>
        Tinggi %
        <input type="number" min="3" max="100" value={Math.round(annotation.height * 100)} onChange={(event) => onChange({ height: clamp(Number(event.target.value) / 100, 0.03, 1) } as Partial<PdfAnnotation>)} />
      </label>
      <button className="icon-button danger" type="button" onClick={onDelete} title="Hapus objek edit">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function FocusedPage({ page, zoom, annotations, selectedAnnotationId, onSelectAnnotation, onPatchAnnotation }: { page: PdfPageItem; zoom: number; annotations: PdfAnnotation[]; selectedAnnotationId: string | null; onSelectAnnotation: (id: string | null) => void; onPatchAnnotation: (id: string, patch: Partial<PdfAnnotation>) => void }) {
  const [image, setImage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setImage('');

    renderPdfPageImage(page.file, page.pageIndex, page.rotation, Math.min(2.6, Math.max(0.8, zoom * 1.25)))
      .then((url) => {
        if (!cancelled) setImage(url);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setImage('');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page.id, page.file, page.pageIndex, page.rotation, zoom]);

  return (
    <div className="focused-page-stage" onPointerDown={() => onSelectAnnotation(null)}>
      {isLoading ? (
        <div className="thumbnail-loading">Rendering halaman fokus...</div>
      ) : image ? (
        <div className="focused-page-frame" style={{ width: `${zoom * 100}%` }}>
          <img src={image} alt={`${page.sourceName} halaman ${page.pageNumber}`} />
          <div className="annotation-layer">
            {annotations.map((annotation) => (
              <AnnotationBox
                key={annotation.id}
                annotation={annotation}
                isSelected={annotation.id === selectedAnnotationId}
                onSelect={() => onSelectAnnotation(annotation.id)}
                onMove={(patch) => onPatchAnnotation(annotation.id, patch)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="thumbnail-loading">Preview gagal. Coba pilih halaman lain lalu kembali.</div>
      )}
    </div>
  );
}

function AnnotationBox({ annotation, isSelected, onSelect, onMove }: { annotation: PdfAnnotation; isSelected: boolean; onSelect: () => void; onMove: (patch: Partial<PdfAnnotation>) => void }) {
  const dragRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number } | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    onSelect();

    const frame = event.currentTarget.parentElement?.parentElement;
    if (!frame) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = frame.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: annotation.x,
      startY: annotation.y,
    };

    event.currentTarget.dataset.frameWidth = String(rect.width);
    event.currentTarget.dataset.frameHeight = String(rect.height);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const width = Number(event.currentTarget.dataset.frameWidth || 1);
    const height = Number(event.currentTarget.dataset.frameHeight || 1);
    const nextX = clamp(drag.startX + (event.clientX - drag.startClientX) / width, 0, 1 - annotation.width);
    const nextY = clamp(drag.startY + (event.clientY - drag.startClientY) / height, 0, 1 - annotation.height);

    onMove({ x: nextX, y: nextY } as Partial<PdfAnnotation>);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      className={`annotation-box ${annotation.type} ${isSelected ? 'is-selected' : ''}`}
      style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%`, width: `${annotation.width * 100}%`, height: `${annotation.height * 100}%` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {annotation.type === 'text' ? (
        <span style={{ fontSize: annotation.fontSize, color: annotation.color }}>{annotation.text}</span>
      ) : (
        <img src={annotation.dataUrl} alt={annotation.type === 'signature' ? 'Tanda tangan' : annotation.name} />
      )}
      <span className="annotation-handle" aria-hidden="true" />
    </div>
  );
}

type StripPageProps = {
  page: PdfPageItem;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onInsertAfter: () => void;
  disabled: boolean;
};

function StripPage({ page, index, isActive, onSelect, onInsertAfter, disabled }: StripPageProps) {
  const itemRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [thumb, setThumb] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id, disabled });

  useEffect(() => {
    const node = itemRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { root: node.closest('.page-strip'), rootMargin: '360px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible && !isActive) return;

    let cancelled = false;
    setIsLoading(true);

    renderPdfPageImage(page.file, page.pageIndex, page.rotation, 0.26)
      .then((url) => {
        if (!cancelled) setThumb(url);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setThumb('');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isVisible, isActive, page.id, page.file, page.pageIndex, page.rotation]);

  return (
    <div className="strip-item-wrap" ref={itemRef} data-active={isActive ? 'true' : 'false'}>
      <article
        ref={setNodeRef}
        className={`strip-page ${isActive ? 'is-active' : ''} ${isDragging ? 'is-dragging' : ''}`}
        style={{ transform: CSS.Transform.toString(transform), transition }}
      >
        <button className="strip-preview" type="button" onClick={onSelect} disabled={disabled} title={`Pilih halaman ${index + 1}`}>
          <span className="strip-number">{index + 1}</span>
          {!isVisible && !isActive ? <span className="strip-loading">lazy</span> : isLoading ? <span className="strip-loading">...</span> : thumb ? <img src={thumb} alt={`Thumbnail halaman ${index + 1}`} /> : <span className="strip-loading">gagal</span>}
        </button>
        <button className="strip-drag" type="button" title="Drag urutan" disabled={disabled} {...attributes} {...listeners}>
          <GripVertical size={15} />
        </button>
      </article>
      <button className="insert-between" type="button" title={`Sisipkan PDF setelah halaman ${index + 1}`} disabled={disabled} onClick={onInsertAfter}>
        +
      </button>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
