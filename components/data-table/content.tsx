"use client";

import type { ReactTable, RowData } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, SearchVisualIcon } from "@hugeicons/core-free-icons";
import { type DataTableFeatures } from "./features";

export interface DataTableContentProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
}

export function DataTableContent<TData extends RowData>({
  table,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = "No results found matching your filters.",
}: DataTableContentProps<TData>) {
  if (loading) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col justify-start">
      <div className="flex flex-col w-full h-fit max-h-full overflow-hidden rounded-lg border border-border/75 bg-card shadow-2xs">
        {error ? (
          <div className="flex items-center justify-center p-6">
            <div className="flex flex-col items-center justify-center gap-2 text-destructive">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-5" />
              <span className="text-xs">{error}</span>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
                  Try again
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="min-h-0 overflow-auto">
            <Table className="min-w-full w-max">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-xs shadow-2xs">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="h-9 border-border/75 hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="h-9 px-3.5 text-xs font-semibold text-foreground/90 bg-card/95"
                      >
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="h-9 border-border/60 hover:bg-muted/35 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-3.5 py-1.5 text-xs">
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={table.getVisibleLeafColumns().length}
                      className="h-36 text-center text-xs text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center gap-2 py-8">
                        <HugeiconsIcon
                          icon={SearchVisualIcon}
                          className="size-5 text-muted-foreground/60"
                        />
                        <span>{emptyMessage}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
