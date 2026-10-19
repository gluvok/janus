"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  Delete02Icon,
  Edit01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";

export interface DataTableRowActionsProps {
  copyText: string;
  copyLabel: string;
  onEdit?: () => void;
  editLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
}

export function DataTableRowActions({
  copyText,
  copyLabel,
  onEdit,
  editLabel = "Edit",
  onDelete,
  deleteLabel = "Delete",
}: DataTableRowActionsProps) {
  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(copyText);
    toast.add({
      type: "success",
      title: "Copied to Clipboard",
      description: `${copyLabel} copied.`,
    });
  }, [copyText, copyLabel]);

  return (
    <div className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
              <span className="sr-only">Open actions menu</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
            {/* 1. Copy */}
            <DropdownMenuItem onClick={handleCopy} className="gap-2 text-xs cursor-pointer">
              <HugeiconsIcon icon={Copy01Icon} className="size-3.5 text-muted-foreground" />
              <span>{copyLabel}</span>
            </DropdownMenuItem>

            {/* 2. Edit (if present) */}
            {onEdit && (
              <DropdownMenuItem onClick={onEdit} className="gap-2 text-xs cursor-pointer">
                <HugeiconsIcon icon={Edit01Icon} className="size-3.5 text-muted-foreground" />
                <span>{editLabel}</span>
              </DropdownMenuItem>
            )}

            {/* 3. Delete (if present) */}
            {onDelete && (
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                <span>{deleteLabel}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
