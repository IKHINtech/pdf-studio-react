import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { PageCard } from './PageCard';
import type { PdfPageItem } from '../types/pdf';

type PageGridProps = {
  pages: PdfPageItem[];
  onChange: (pages: PdfPageItem[]) => void;
};

export function PageGrid({ pages, onChange }: PageGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex((page) => page.id === active.id);
    const newIndex = pages.findIndex((page) => page.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(pages, oldIndex, newIndex));
  }

  function handleDelete(id: string) {
    onChange(pages.filter((page) => page.id !== id));
  }

  function handleRotate(id: string) {
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pages.map((page) => page.id)} strategy={rectSortingStrategy}>
        <section className="page-grid">
          {pages.map((page, index) => (
            <PageCard key={page.id} page={page} index={index} onDelete={handleDelete} onRotate={handleRotate} />
          ))}
        </section>
      </SortableContext>
    </DndContext>
  );
}
