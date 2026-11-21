"use client";

import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar01Icon,
  Clock01Icon,
  Image01Icon,
  ImagesIcon,
  Layout2ColumnIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { cn, formatDateTime } from "@/lib/utils";
import { type Factory } from "./types";

const RECEIPT_IMAGE_OPTIONS = [
  {
    value: "1",
    label: "1 per row",
    description: "2x1 vertical photo grid",
    icon: Image01Icon,
  },
  {
    value: "2",
    label: "2 per row (Default)",
    description: "2-column photo grid (up to 3 rows)",
    icon: Layout2ColumnIcon,
  },
] as const;

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
    <div className="flex flex-col gap-5">
      {/* Field 1: Factory Name (Full Width) */}
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

      {/* Field 2: Receipt Images Per Row (Full Width Stacked Radio Group) */}
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
        <RadioGroup
          value={String(receiptImagesPerRow)}
          onValueChange={(val) => {
            if (val) onReceiptImagesPerRowChange(Number(val));
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {RECEIPT_IMAGE_OPTIONS.map((opt) => {
            const isSelected = receiptImagesPerRow === Number(opt.value);
            return (
              <label
                key={opt.value}
                htmlFor={`receipt-img-${opt.value}`}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-2xs"
                    : "border-border/80 bg-background hover:bg-accent/30 hover:border-border text-muted-foreground",
                )}
              >
                <RadioGroupItem
                  id={`receipt-img-${opt.value}`}
                  value={opt.value}
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-foreground">
                    <HugeiconsIcon
                      icon={opt.icon}
                      className="size-3.5 text-muted-foreground shrink-0"
                    />
                    <span className={cn(isSelected && "text-primary font-semibold")}>
                      {opt.label}
                    </span>
                  </div>
                  <span className="text-2xs text-muted-foreground leading-normal">
                    {opt.description}
                  </span>
                </div>
              </label>
            );
          })}
        </RadioGroup>
        {receiptImagesError && <FieldError errors={[{ message: receiptImagesError }]} />}
        <FieldDescription>Photos per ticket row.</FieldDescription>
      </Field>

      {/* Metadata Stat Strip (Created On & Last Modified) */}
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
