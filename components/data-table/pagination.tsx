import { useMemo } from "react";
import type { ReactTable, RowData } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { type DataTableFeatures } from "./features";

const PAGE_SIZE_OPTIONS = [
  { label: "15", value: 15 },
  { label: "30", value: 30 },
  { label: "45", value: 45 },
  { label: "60", value: 60 },
];

export interface DataTablePaginationProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>;
  loading: boolean;
}

export function DataTablePagination<TData extends RowData>({
  table,
  loading,
}: DataTablePaginationProps<TData>) {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  // Number of rows currently rendered in datatable on the current page
  const currentRowsCount = table.getRowModel().rows.length;
  const currentPage = table.state.pagination.pageIndex + 1;
  const totalPages = Math.max(1, table.getPageCount());

  const pageOptions = useMemo(
    () =>
      Array.from({ length: totalPages }, (_, i) => ({
        label: String(i + 1),
        value: i + 1,
      })),
    [totalPages],
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 px-2.5 py-2 sm:flex-row transition-opacity duration-150",
        loading && "opacity-40 pointer-events-none select-none",
      )}
    >
      <div className="w-full text-center text-xs text-muted-foreground sm:w-auto sm:min-w-48 sm:text-left tabular-nums">
        <span className="font-medium tabular-nums">{selectedCount}</span> of{" "}
        <span className="font-medium tabular-nums">{currentRowsCount}</span> row(s) selected.
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-6">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium">Rows per page</p>
          <Select
            items={PAGE_SIZE_OPTIONS}
            value={table.state.pagination.pageSize}
            onValueChange={(val) => {
              if (val) table.setPageSize(Number(val));
            }}
          >
            <SelectTrigger className="h-7 w-18 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" className="min-w-18">
              <SelectGroup>
                {PAGE_SIZE_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span>Page</span>
          <Select
            items={pageOptions}
            value={currentPage}
            onValueChange={(val) => {
              if (val != null) table.setPageIndex(Number(val) - 1);
            }}
            disabled={totalPages <= 1}
          >
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="center" className="min-w-16 max-h-48">
              <SelectGroup>
                {pageOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span>of {totalPages}</span>
        </div>
        <ButtonGroup aria-label="Pagination navigation">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="hidden sm:inline">Next</span>
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
