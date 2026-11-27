import * as React from "react";
import axios from "axios";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { useFactoryStore } from "@/stores/use-factory-store";
import type { EntityMode } from "@/stores/use-mode-store";
import type { Factory } from "@/app/settings/types";
import { automaticWeighmentSchema, manualWeighmentSchema } from "@/app/weighments/types";
import { automaticEntrySchema, manualEntrySchema } from "@/app/entries/types";
import { generateReceiptPdf } from "./generate-pdf";
import { WeighmentReceiptView, EntryReceiptView } from "../views/receipt-view";
import type { WeighmentReceiptData, EntryReceiptData } from "../types";

interface ReceiptRecordIdentity {
  id: number;
  vehicle_number: string;
}

export interface DownloadWeighmentReceiptOptions {
  weighment: ReceiptRecordIdentity;
  mode: EntityMode;
}

export interface DownloadEntryReceiptOptions {
  entry: ReceiptRecordIdentity;
  mode: EntityMode;
}

export interface DownloadWeighmentsBatchReceiptOptions {
  weighments: ReceiptRecordIdentity[];
  mode: EntityMode;
}

async function executeReceiptPdfDownload<T extends ReceiptRecordIdentity>({
  endpoint,
  entityLabel,
  record,
  parseRecord,
  buildFileName,
  renderReceipt,
}: {
  endpoint: string;
  entityLabel: string;
  record: ReceiptRecordIdentity;
  parseRecord: (raw: unknown) => T;
  buildFileName: (verified: T) => string;
  renderReceipt: (verified: T, factory: Factory) => React.ReactElement;
}): Promise<void> {
  toast.add({
    type: "info",
    title: "Preparing Receipt for Print",
    description: `Preparing ${entityLabel.toLowerCase()} slip for ${record.vehicle_number}...`,
  });

  try {
    const response = await axios.get<{
      data: unknown[];
      totalCount: number;
    }>(endpoint, {
      params: { id: record.id, limit: 1 },
    });

    const items = response.data?.data;
    const rawRecord = Array.isArray(items)
      ? items.find(
          (item): item is { id: number } =>
            typeof item === "object" && item !== null && "id" in item && item.id === record.id,
        )
      : null;

    if (!rawRecord) {
      throw new Error(`${entityLabel} #${record.id} could not be found.`);
    }

    const verified = parseRecord(rawRecord);

    const factory = useFactoryStore.getState().factory;
    if (!factory) {
      throw new Error("Factory configuration not found. Please log in again.");
    }

    const fileName = buildFileName(verified);
    await generateReceiptPdf(renderReceipt(verified, factory), fileName);

    toast.add({
      type: "success",
      title: "Print Dialog Opened",
      description: `Print preview ready for ${verified.vehicle_number}.`,
    });
  } catch (err) {
    toast.add({
      type: "error",
      title: "Print Failed",
      description: getErrorMessage(
        err,
        `Failed to prepare ${entityLabel.toLowerCase()} receipt for printing.`,
      ),
    });
  }
}

export async function downloadWeighmentReceipt({
  weighment,
  mode,
}: DownloadWeighmentReceiptOptions): Promise<void> {
  return executeReceiptPdfDownload<WeighmentReceiptData>({
    endpoint: `/api/weighments/${mode}`,
    entityLabel: "Weighment",
    record: weighment,
    parseRecord: (raw) =>
      mode === "automatic" ? automaticWeighmentSchema.parse(raw) : manualWeighmentSchema.parse(raw),
    buildFileName: (verified) => `weighment-${verified.id}-${verified.vehicle_number}.pdf`,
    renderReceipt: (verified, factory) => (
      <WeighmentReceiptView weighment={verified} mode={mode} factory={factory} />
    ),
  });
}

export async function downloadEntryReceipt({
  entry,
  mode,
}: DownloadEntryReceiptOptions): Promise<void> {
  return executeReceiptPdfDownload<EntryReceiptData>({
    endpoint: `/api/entries/${mode}`,
    entityLabel: "Entry",
    record: entry,
    parseRecord: (raw) =>
      mode === "automatic" ? automaticEntrySchema.parse(raw) : manualEntrySchema.parse(raw),
    buildFileName: (verified) => `entry-${verified.id}-${verified.vehicle_number}.pdf`,
    renderReceipt: (verified, factory) => (
      <EntryReceiptView entry={verified} mode={mode} factory={factory} />
    ),
  });
}

export async function downloadWeighmentsBatchReceipt({
  weighments,
  mode,
}: DownloadWeighmentsBatchReceiptOptions): Promise<void> {
  if (weighments.length === 0) {
    return;
  }

  toast.add({
    type: "info",
    title: "Preparing Receipts for Print",
    description: `Preparing ${weighments.length} weighment slip${weighments.length > 1 ? "s" : ""}...`,
  });

  try {
    const ids = weighments.map((w) => w.id);
    const response = await axios.get<{
      data: unknown[];
      totalCount: number;
    }>(`/api/weighments/${mode}`, {
      params: { id: ids.join(","), limit: ids.length },
    });

    const rawItems = Array.isArray(response.data?.data) ? response.data.data : [];
    const byId = new Map<number, unknown>();
    for (const item of rawItems) {
      if (
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "number"
      ) {
        byId.set(item.id, item);
      }
    }

    const schema = mode === "automatic" ? automaticWeighmentSchema : manualWeighmentSchema;
    const verifiedItems: WeighmentReceiptData[] = weighments.map((w) => {
      const rawRecord = byId.get(w.id);
      if (!rawRecord) {
        throw new Error(`Weighment #${w.id} could not be found.`);
      }
      return schema.parse(rawRecord);
    });

    const factory = useFactoryStore.getState().factory;
    if (!factory) {
      throw new Error("Factory configuration not found. Please log in again.");
    }

    await generateReceiptPdf(
      <>
        {verifiedItems.map((w) => (
          <WeighmentReceiptView key={w.id} weighment={w} factory={factory} mode={mode} />
        ))}
      </>,
      `weighments-batch-${verifiedItems.length}.pdf`,
    );

    toast.add({
      type: "success",
      title: "Print Dialog Opened",
      description: `Print preview ready for ${verifiedItems.length} weighment${verifiedItems.length > 1 ? "s" : ""}.`,
    });
  } catch (err) {
    toast.add({
      type: "error",
      title: "Print Failed",
      description: getErrorMessage(err, "Failed to prepare weighment receipts for printing."),
    });
  }
}
