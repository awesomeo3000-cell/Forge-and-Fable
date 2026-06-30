"use client";

import { ChevronDown, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

export default function SheetSection({
  id,
  title,
  collapsed,
  onToggle,
  editMode,
  children,
}: {
  id: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  editMode: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <section
      ref={setNodeRef}
      className={`cs-section${isDragging ? " cs-dragging" : ""}`}
      data-section-id={id}
      style={style}
    >
      <div className="cs-section-header-row">
        {editMode ? (
          <button
            type="button"
            className="cs-drag-handle"
            aria-label={`Drag ${title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
        ) : null}
        <button
          type="button"
          className="cs-section-header"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={`cs-section-body-${id}`}
        >
          <span
            className={`cs-section-chevron${collapsed ? " cs-collapsed" : ""}`}
            aria-hidden="true"
          >
            <ChevronDown size={14} />
          </span>
          <span className="cs-section-title">{title}</span>
        </button>
      </div>
      <div
        id={`cs-section-body-${id}`}
        className={`cs-section-body${collapsed ? " cs-collapsed" : ""}`}
      >
        {children}
      </div>
    </section>
  );
}
