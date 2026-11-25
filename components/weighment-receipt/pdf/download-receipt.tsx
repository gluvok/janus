import * as React from "react";
import axios from "axios";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { useFactoryStore } from "@/stores/use-factory-store";
import type { EntityMode } from "@/stores/use-mode-store";
import { generateReceiptPdf } from "./generate-pdf";
import { WeighmentReceiptView } from "../views/receipt-view";
import {
  automaticWeighmentSchema,
  manualWeighmentSchema,
  type Weighment,
} from "@/app/weighments/types";

export interface DownloadWeighmentReceiptOptions {
  weighment: { id: number; vehicle_number: string };
  mode: EntityMode;
}

export async function downloadWeighmentReceipt({
  weighment,
  mode,
}: DownloadWeighmentReceiptOptions): Promise<void> {
  toast.add({
    type: "info",
    title: "Generating Receipt PDF",
    description: `Preparing receipt for ${weighment.vehicle_number}...`,
  });

  try {
    const response = await axios.get<{
      data: Weighment[];
      totalCount: number;
    }>(`/api/weighments/${mode}`, {
      params: { id: weighment.id },
    });

    const items = response.data?.data;
    const verifiedRecord = Array.isArray(items) ? items.find((w) => w?.id === weighment.id) : null;

    if (!verifiedRecord) {
      throw new Error(`Weighment #${weighment.id} could not be found.`);
    }

    const schema = mode === "automatic" ? automaticWeighmentSchema : manualWeighmentSchema;
    const verifiedWeighment = schema.parse(verifiedRecord);

    const factory = useFactoryStore.getState().factory;
    if (!factory) {
      throw new Error("Factory configuration not found. Please log in again.");
    }

    const fileName = `weighment-${verifiedWeighment.id}-${verifiedWeighment.vehicle_number}.pdf`;
    const receiptElement = <WeighmentReceiptView weighment={verifiedWeighment} factory={factory} />;

    await generateReceiptPdf(receiptElement, fileName);

    toast.add({
      type: "success",
      title: "Receipt Downloaded",
      description: `Saved as ${fileName}`,
    });
  } catch (err) {
    toast.add({
      type: "error",
      title: "Download Failed",
      description: getErrorMessage(err, "Failed to generate receipt PDF."),
    });
    throw err;
  }
}
