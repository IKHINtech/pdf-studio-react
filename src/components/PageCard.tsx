import { useEffect, useState } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical, RotateCw, Trash2 } from 'lucide-react';
import { renderPdfPageThumbnail } from '../lib/thumbnail';
import type { PdfPageItem } from '../types/pdf';

type PageCardProps = {
  page: PdfPageItem;
  index: number;
  onDelete: (id: string) => void;
  onRotate: (id: string) => void;
};

export function PageCard({ page, index, onDelete, onRotate }: PageCardProps) {
  const [thumbnail, setThumbnail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    renderPdfPageThumbnail(page.file, page.pageIndex, page.rotation)
      .then((url) => {
        if (!cancelled) setThumbnail(url);
      })
      .catch(() => {
        if (!cancelled) setThumbnail('');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page.file, page.pageIndex, page.rotation]);

  return (
    <article
      ref={setNodeRef}
      className={`page-card ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="page-card-toolbar">
        <button className="icon-button drag-handle" title="Geser urutan" {...attributes} {...listeners}>
          <GripVertical size={18} />
        </button>
        <span className="page-position">#{index + 1}</span>
        <div className="page-actions">
          <button className="icon-button" title="Rotate" onClick={() => onRotate(page.id)}>
            <RotateCw size={16} />
          </button>
          <button className="icon-button danger" title="Hapus" onClick={() => onDelete(page.id)}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="thumbnail-shell">
        {isLoading ? <div className="thumbnail-loading">Rendering...</div> : thumbnail ? <img src={thumbnail} alt={`${page.sourceName} page ${page.pageNumber}`} /> : <div className="thumbnail-loading">Preview gagal</div>}
      </div>

      <div className="page-meta">
        <strong title={page.sourceName}>{page.sourceName}</strong>
        <span>Halaman {page.pageNumber}</span>
      </div>
    </article>
  );
}
