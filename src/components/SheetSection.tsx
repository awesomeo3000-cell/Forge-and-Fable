"use client";

import { ChevronDown, GripVertical } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

import { memo } from "react";

export default memo(function SheetSection({
  id,
  title,
  collapsed,
  onToggle,
  editMode,
  onHide,
  onRename,
  children,
}: {
  id: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  editMode: boolean;
  onHide?: () => void;
  onRename?: (title: string) => void;
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
  const { setNodeRef: setMergeRef, isOver: isMergeOver } = useDroppable({ id: `merge:${id}`, disabled: !editMode || collapsed });

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
        <button type="button" className={`cs-section-header${editMode && onRename ? " cs-section-header-edit" : ""}`} onClick={onToggle} aria-expanded={!collapsed} aria-controls={`cs-section-body-${id}`} aria-label={editMode && onRename ? `${collapsed ? "Expand" : "Collapse"} ${title}` : undefined}>
          <span
            className={`cs-section-chevron${collapsed ? " cs-collapsed" : ""}`}
            aria-hidden="true"
          >
            <ChevronDown size={14} />
          </span>
          {editMode && onRename ? null : <span className="cs-section-title">{title}</span>}
        </button>
        {editMode && onRename ? (
          <input
            className="cs-section-title-input"
            value={title}
            aria-label={`Rename ${title} module`}
            maxLength={60}
            onChange={(event) => onRename(event.target.value)}
          />
        ) : null}
        {editMode && onHide ? (
          <button type="button" className="cs-section-hide" onClick={onHide} title={`Hide ${title} from the sheet`}>
            Hide
          </button>
        ) : null}
      </div>
      <div
        ref={setMergeRef}
        id={`cs-section-body-${id}`}
        className={`cs-section-body${collapsed ? " cs-collapsed" : ""}${isMergeOver ? " cs-merge-target" : ""}`}
      >
        {children}
      </div>
    </section>
  );
})
