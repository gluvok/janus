import * as React from "react";
import axios from "axios";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { useFactoryStore } from "@/stores/use-factory-store";
import { generateReceiptPdf } from "./generate-pdf";
import { AutomaticWeighmentReceiptView, ManualWeighmentReceiptView } from "../views/receipt-view";
import {
  completedAutomaticWeighmentSchema,
  manualWeighmentSchema,
  type AutomaticWeighment,
  type ManualWeighment,
} from "@/app/weighments/types";

export type ReceiptMode = "automatic" | "manual";

export interface DownloadWeighmentReceiptOptions {
  mode: ReceiptMode;
  weighment: { id: number; vehicle_number: string };
}

export async function downloadWeighmentReceipt({
  mode,
  weighment,
}: DownloadWeighmentReceiptOptions): Promise<void> {
  toast.add({
    type: "info",
    title: "Generating Receipt PDF",
    description: `Preparing receipt for ${weighment.vehicle_number}...`,
  });

  try {
    const endpoint = mode === "automatic" ? "/api/weighments/automatic" : "/api/weighments/manual";

    const response = await axios.get<{
      data: (AutomaticWeighment | ManualWeighment)[];
      totalCount: number;
    }>(endpoint, {
      params: { id: weighment.id },
    });

    const items = response.data?.data;
    const verifiedWeighment = Array.isArray(items)
      ? items.find((w) => w?.id === weighment.id)
      : null;

    if (!verifiedWeighment) {
      throw new Error(`Weighment #${weighment.id} could not be found.`);
    }

    const factory = useFactoryStore.getState().factory;
    if (!factory) {
      throw new Error("Factory configuration not found. Please log in again.");
    }

    let receiptElement: React.ReactElement;
    let fileName: string;

    if (mode === "automatic") {
      const completedWeighment = completedAutomaticWeighmentSchema.parse(verifiedWeighment);
      fileName = `automatic-weighment-${completedWeighment.id}-${completedWeighment.vehicle_number}.pdf`;
      receiptElement = (
        <AutomaticWeighmentReceiptView weighment={completedWeighment} factory={factory} />
      );
    } else {
      const recordToValidate = {
        ...verifiedWeighment,
        creator_id:
          (verifiedWeighment as { creator_id?: number }).creator_id ??
          (verifiedWeighment as any).creator?.id,
      };
      const manualWeighment = manualWeighmentSchema.parse(recordToValidate);
      fileName = `manual-weighment-${manualWeighment.id}-${manualWeighment.vehicle_number}.pdf`;
      receiptElement = <ManualWeighmentReceiptView weighment={manualWeighment} factory={factory} />;
    }

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
