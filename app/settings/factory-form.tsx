"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar01Icon,
  Clock01Icon,
  Grid2x2Icon,
  Grid3x2Icon,
  Image01Icon,
  ImagesIcon,
  Layout05Icon,
  Layout3ColumnIcon,
  Layout2ColumnIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { formatDateTime } from "@/lib/utils";
import { type Factory } from "./types";

const RECEIPT_IMAGE_OPTIONS = [
  { value: "1", label: "1 per row", icon: Image01Icon },
  { value: "2", label: "2 per row", icon: Layout2ColumnIcon },
  { value: "3", label: "3 per row (Default)", icon: Layout3ColumnIcon },
  { value: "4", label: "4 per row", icon: Grid2x2Icon },
  { value: "5", label: "5 per row", icon: Layout05Icon },
  { value: "6", label: "6 per row", icon: Grid3x2Icon },
];

interface FactoryFormProps {
  factory: Factory | null;
  name: string;
  onNameChange: (name: string) => void;
  nameError?: string;
  receiptImagesPerRow: number;
  onReceiptImagesPerRowChange: (val: number) => void;
  receiptImagesError?: string;
}

export function FactoryForm({
  factory,
  name,
  onNameChange,
  nameError,
  receiptImagesPerRow,
  onReceiptImagesPerRowChange,
  receiptImagesError,
}: FactoryFormProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* 2-Column Responsive Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1: Factory Name */}
        <Field data-invalid={Boolean(nameError)}>
          <FieldLabel htmlFor="factory-name">
            <HugeiconsIcon icon={TextFontIcon} className="size-3.5 text-muted-foreground" />
            <span>
              Factory Name{" "}
              <span className="text-destructive font-semibold" aria-hidden="true">
                *
              </span>
            </span>
          </FieldLabel>
          <Input
            id="factory-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Enter factory name..."
            aria-invalid={Boolean(nameError)}
            className="h-8 w-full text-xs"
          />
          {nameError && <FieldError errors={[{ message: nameError }]} />}
          <FieldDescription>Primary processing facility title.</FieldDescription>
        </Field>

        {/* Column 2: Receipt Images Per Row */}
        <Field data-invalid={Boolean(receiptImagesError)}>
          <FieldLabel htmlFor="receipt-images">
            <HugeiconsIcon icon={ImagesIcon} className="size-3.5 text-muted-foreground" />
            <span>
              Receipt Images per Row{" "}
              <span className="text-destructive font-semibold" aria-hidden="true">
                *
              </span>
            </span>
          </FieldLabel>
          <Select
            items={RECEIPT_IMAGE_OPTIONS}
            value={String(receiptImagesPerRow)}
            onValueChange={(val) => {
              if (val) onReceiptImagesPerRowChange(Number(val));
            }}
          >
            <SelectTrigger
              id="receipt-images"
              className="h-8 w-full text-xs font-normal cursor-pointer"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" className="min-w-44">
              <SelectGroup>
                {RECEIPT_IMAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs cursor-pointer">
                    <HugeiconsIcon
                      icon={opt.icon}
                      className="mr-1.5 size-3.5 shrink-0 text-muted-foreground"
                    />
                    <span>{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {receiptImagesError && <FieldError errors={[{ message: receiptImagesError }]} />}
          <FieldDescription>Photos per ticket row.</FieldDescription>
        </Field>
      </div>

      {/* 2-Column Metadata Stat Strip (Created On & Last Modified) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3.5 text-xs border border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 border border-primary/20 text-primary">
            <HugeiconsIcon icon={Calendar01Icon} className="size-3.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xs text-muted-foreground">Created On</span>
            <span className="font-medium text-foreground">
              {factory ? formatDateTime(factory.created_at) : "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 border border-primary/20 text-primary">
            <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xs text-muted-foreground">Last Modified</span>
            <span className="font-medium text-foreground">
              {factory ? formatDateTime(factory.updated_at) : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
