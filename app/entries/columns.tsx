"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DataTableColumnHeader,
  createSelectColumn,
  type DataTableFeatures,
} from "@/components/data-table";
import { toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Building01Icon,
  Calendar01Icon,
  Clock01Icon,
  Copy01Icon,
  HashtagIcon,
  Image01Icon,
  MoreHorizontalIcon,
  TruckIcon,
  UserGroupIcon,
  UserIcon,
  WeightScale01Icon,
} from "@hugeicons/core-free-icons";
import { type Entry, type EntryMode, isManualEntry } from "./types";

const columnHelper = createColumnHelper<DataTableFeatures, Entry>();

export function getColumns(mode: EntryMode) {
  const allColumns = [
    createSelectColumn(columnHelper),
    columnHelper.accessor("id", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" icon={HashtagIcon} />
      ),
      cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("id")}</span>,
      meta: {
        title: "ID",
        icon: HashtagIcon,
      },
    }),
    columnHelper.accessor("vehicle_number", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Vehicle Number" icon={TruckIcon} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {row.original.vehicle_number}
        </span>
      ),
      meta: {
        title: "Vehicle Number",
        icon: TruckIcon,
      },
    }),
    columnHelper.accessor("weight", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Weight (kg)" icon={WeightScale01Icon} />
      ),
      cell: ({ row }) => {
        const weight = Number(row.getValue("weight"));
        return (
          <div className="flex items-baseline gap-1 font-mono text-xs">
            <span className="font-semibold text-foreground">{weight.toLocaleString()}</span>
            <span className="text-2xs text-muted-foreground">kg</span>
          </div>
        );
      },
      meta: {
        title: "Weight",
        icon: WeightScale01Icon,
      },
    }),
    ...(mode === "manual"
      ? [
          columnHelper.accessor((row) => (isManualEntry(row) ? row.created_by : undefined), {
            id: "created_by",
            header: ({ column }) => (
              <DataTableColumnHeader column={column} title="Created by" icon={UserIcon} />
            ),
            cell: ({ row }) => {
              const creator = isManualEntry(row.original) ? row.original.created_by_user : null;
              const createdBy = isManualEntry(row.original) ? row.original.created_by : null;
              if (!creator) {
                return <span className="text-2xs text-muted-foreground">User #{createdBy}</span>;
              }
              return <span className="text-xs text-muted-foreground">{creator.name}</span>;
            },
            meta: {
              title: "Created by",
              icon: UserIcon,
            },
            enableSorting: true,
          }),
        ]
      : []),
    columnHelper.accessor("center_id", {
      id: "center",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Center" icon={Building01Icon} />
      ),
      cell: ({ row }) => {
        const centerName = row.original.center?.name;
        if (!centerName) {
          return (
            <span className="text-2xs text-muted-foreground">Center #{row.original.center_id}</span>
          );
        }
        return (
          <Badge variant="secondary" className="text-xs font-normal">
            {centerName}
          </Badge>
        );
      },
      meta: {
        title: "Center",
        icon: Building01Icon,
      },
      enableSorting: true,
    }),
    columnHelper.accessor("customer_id", {
      id: "customer",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" icon={UserGroupIcon} />
      ),
      cell: ({ row }) => {
        const customer = row.original.customer;
        if (!customer) {
          return <span className="text-2xs text-muted-foreground italic">Unassigned</span>;
        }
        return <span className="text-xs font-medium text-foreground">{customer.name}</span>;
      },
      meta: {
        title: "Customer",
        icon: UserGroupIcon,
      },
      enableSorting: true,
    }),
    columnHelper.display({
      id: "images",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Photos" icon={Image01Icon} />
      ),
      cell: ({ row, table }) => {
        const count = row.original.images?.length ?? 0;
        if (count === 0) {
          return <span className="text-2xs text-muted-foreground">0</span>;
        }
        const onViewPhotos = (table.options.meta as { onViewPhotos?: (entry: Entry) => void })
          ?.onViewPhotos;
        return (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onViewPhotos?.(row.original)}
            className="h-5 gap-1 rounded-full px-2 py-0 text-2xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors cursor-pointer"
            title={`View ${count} photo${count > 1 ? "s" : ""}`}
          >
            <HugeiconsIcon icon={Image01Icon} className="size-3" />
            <span>{count}</span>
          </Button>
        );
      },
      meta: {
        title: "Photos",
        icon: Image01Icon,
      },
      enableSorting: false,
    }),
    columnHelper.accessor("created_at", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" icon={Calendar01Icon} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(row.getValue("created_at"))}
        </span>
      ),
      meta: {
        title: "Created At",
        icon: Calendar01Icon,
      },
    }),
    columnHelper.accessor("updated_at", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated At" icon={Clock01Icon} />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(row.getValue("updated_at"))}
        </span>
      ),
      meta: {
        title: "Updated At",
        icon: Clock01Icon,
      },
      enableSorting: true,
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row, table }) => {
        const entry = row.original;
        const onViewPhotos = (table.options.meta as { onViewPhotos?: (entry: Entry) => void })
          ?.onViewPhotos;

        const handleCopy = (text: string, label: string) => {
          navigator.clipboard.writeText(text);
          toast.add({
            type: "success",
            title: "Copied to Clipboard",
            description: `${label} copied.`,
          });
        };

        return (
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 p-0"
                    aria-label={`Actions for entry ${entry.id}`}
                    data-testid={`actions-entry-${entry.id}`}
                  >
                    <HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
                    <span className="sr-only">Open actions menu</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Entry #{entry.id}</DropdownMenuLabel>
                  {entry.images && entry.images.length > 0 && (
                    <DropdownMenuItem onClick={() => onViewPhotos?.(entry)}>
                      <HugeiconsIcon icon={Image01Icon} />
                      <span>View Photos ({entry.images.length})</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => handleCopy(entry.vehicle_number, "Vehicle Number")}
                  >
                    <HugeiconsIcon icon={Copy01Icon} />
                    <span>Copy Vehicle Number</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCopy(String(entry.weight), "Weight")}>
                    <HugeiconsIcon icon={Copy01Icon} />
                    <span>Copy Weight</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCopy(String(entry.id), "Entry ID")}>
                    <HugeiconsIcon icon={Copy01Icon} />
                    <span>Copy Entry ID</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    }),
  ];

  return columnHelper.columns(allColumns);
}

export const columns = getColumns("automatic");
