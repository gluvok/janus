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
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  Delete02Icon,
  Edit01Icon,
  Loading03Icon,
  MoreHorizontalIcon,
  PrinterIcon,
} from "@hugeicons/core-free-icons";

function useCopyAction(text: string, label: string) {
  return React.useCallback(() => {
    navigator.clipboard.writeText(text);
    toast.add({
      type: "success",
      title: "Copied to Clipboard",
      description: `${label} copied.`,
    });
  }, [text, label]);
}

function ActionsTrigger() {
  return (
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
  );
}

/* -------------------------------------------------------------------------- */
/* Copy Only Row Action (Weighments)                                          */
/* -------------------------------------------------------------------------- */

export interface CopyRowActionProps {
  copyText: string;
  copyLabel: string;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
  onEdit?: () => void;
  editLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
}

export function CopyRowAction({
  copyText,
  copyLabel,
  onDownloadPdf,
  isDownloadingPdf = false,
  onEdit,
  editLabel,
  onDelete,
  deleteLabel,
}: CopyRowActionProps) {
  const handleCopy = useCopyAction(copyText, copyLabel);

  return (
    <div className="flex items-center justify-end">
      <DropdownMenu>
        <ActionsTrigger />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleCopy} className="gap-2 text-xs cursor-pointer">
              <HugeiconsIcon icon={Copy01Icon} className="size-3.5 text-muted-foreground" />
              <span>{copyLabel}</span>
            </DropdownMenuItem>
            {onDownloadPdf && (
              <DropdownMenuItem
                onClick={onDownloadPdf}
                disabled={isDownloadingPdf}
                className="gap-2 text-xs cursor-pointer focus:bg-accent focus:text-accent-foreground"
              >
                <HugeiconsIcon
                  icon={isDownloadingPdf ? Loading03Icon : PrinterIcon}
                  className={cn(
                    "size-3.5 shrink-0 text-primary",
                    isDownloadingPdf && "animate-spin",
                  )}
                />
                <span>Print PDF</span>
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem onClick={onEdit} className="gap-2 text-xs cursor-pointer">
                <HugeiconsIcon icon={Edit01Icon} className="size-3.5 text-muted-foreground" />
                <span>{editLabel ?? "Edit"}</span>
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                <span>{deleteLabel ?? "Delete"}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Editable Row Actions (Centers)                                             */
/* -------------------------------------------------------------------------- */

export interface EditableRowActionsProps {
  copyText: string;
  copyLabel: string;
  onEdit: () => void;
  editLabel: string;
}

export function EditableRowActions({
  copyText,
  copyLabel,
  onEdit,
  editLabel,
}: EditableRowActionsProps) {
  const handleCopy = useCopyAction(copyText, copyLabel);

  return (
    <div className="flex items-center justify-end">
      <DropdownMenu>
        <ActionsTrigger />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleCopy} className="gap-2 text-xs cursor-pointer">
              <HugeiconsIcon icon={Copy01Icon} className="size-3.5 text-muted-foreground" />
              <span>{copyLabel}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit} className="gap-2 text-xs cursor-pointer">
              <HugeiconsIcon icon={Edit01Icon} className="size-3.5 text-muted-foreground" />
              <span>{editLabel}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Full Row Actions (Users)                                                   */
/* -------------------------------------------------------------------------- */

export interface FullRowActionsProps {
  copyText: string;
  copyLabel: string;
  onEdit: () => void;
  editLabel: string;
  onDelete: () => void;
  deleteLabel: string;
}

export function FullRowActions({
  copyText,
  copyLabel,
  onEdit,
  editLabel,
  onDelete,
  deleteLabel,
}: FullRowActionsProps) {
  const handleCopy = useCopyAction(copyText, copyLabel);

  return (
    <div className="flex items-center justify-end">
      <DropdownMenu>
        <ActionsTrigger />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={handleCopy} className="gap-2 text-xs cursor-pointer">
              <HugeiconsIcon icon={Copy01Icon} className="size-3.5 text-muted-foreground" />
              <span>{copyLabel}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit} className="gap-2 text-xs cursor-pointer">
              <HugeiconsIcon icon={Edit01Icon} className="size-3.5 text-muted-foreground" />
              <span>{editLabel}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
              <span>{deleteLabel}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
