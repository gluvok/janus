"use client";

import * as React from "react";
import { type SortingState, type Updater } from "@tanstack/react-table";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Sorting05Icon } from "@hugeicons/core-free-icons";
import { SortableSortChip, SortChipOverlay } from "./sortable-sort-chip";
import { DEFAULT_COLUMN_METADATA } from "./data-table-columns";

export interface DataTableCriteriaBarProps {
  hasActiveSorts?: boolean;
  sorting?: SortingState;
  onSortingChange?: (updater: Updater<SortingState>) => void;
  onRemoveSort?: (columnId: string) => void;
  onResetSorts?: () => void;
  onResetAll?: () => void;
}

export function DataTableCriteriaBar({
  hasActiveSorts = false,
  sorting = [],
  onSortingChange,
  onRemoveSort,
  onResetSorts,
  onResetAll,
}: DataTableCriteriaBarProps) {
  const [activeSortId, setActiveSortId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveSortId(String(event.active.id));
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveSortId(null);

      if (!over || active.id === over.id || !onSortingChange) return;

      onSortingChange((prev) => {
        const oldIndex = prev.findIndex((s) => s.id === active.id);
        const newIndex = prev.findIndex((s) => s.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    },
    [onSortingChange],
  );

  const handleDragCancel = React.useCallback(() => {
    setActiveSortId(null);
  }, []);

  const activeSortRule = React.useMemo(() => {
    if (!activeSortId) return null;
    return sorting.find((s) => s.id === activeSortId) ?? null;
  }, [activeSortId, sorting]);

  const activeSortIndex = React.useMemo(() => {
    if (!activeSortId) return -1;
    return sorting.findIndex((s) => s.id === activeSortId);
  }, [activeSortId, sorting]);

  const showBar = hasActiveSorts;
  if (!showBar) return null;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      {/* Active Sorts Line - Boxless seamless row */}
      {hasActiveSorts && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex flex-wrap items-center gap-1.5 py-0.5">
            <div className="flex items-center gap-1 text-2xs font-medium text-primary shrink-0">
              <HugeiconsIcon icon={Sorting05Icon} className="size-3 text-primary" />
              <span>Sorts:</span>
            </div>
            <SortableContext
              items={sorting.map((s) => s.id)}
              strategy={horizontalListSortingStrategy}
            >
              {sorting.map((sortRule, index) => {
                const meta = DEFAULT_COLUMN_METADATA[sortRule.id];
                return (
                  <SortableSortChip
                    key={sortRule.id}
                    sortRule={sortRule}
                    index={index}
                    colTitle={meta.label}
                    colIcon={meta.icon}
                    isDraggable={sorting.length > 1}
                    onRemove={(columnId) => {
                      onRemoveSort?.(columnId);
                    }}
                  />
                );
              })}
            </SortableContext>

            {(onResetSorts || onResetAll) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onResetSorts ?? onResetAll}
                className="shrink-0 ml-auto h-5 gap-1 px-1.5 text-2xs text-primary/80 hover:bg-primary/15 hover:text-primary"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-2.5" data-icon="inline-start" />
                <span>Clear sorts</span>
              </Button>
            )}

            <DragOverlay>
              {activeSortRule && activeSortIndex !== -1 ? (
                <SortChipOverlay
                  sortRule={activeSortRule}
                  index={activeSortIndex}
                  colTitle={DEFAULT_COLUMN_METADATA[activeSortRule.id].label}
                  colIcon={DEFAULT_COLUMN_METADATA[activeSortRule.id].icon}
                />
              ) : null}
            </DragOverlay>
          </div>
        </DndContext>
      )}
    </div>
  );
}
