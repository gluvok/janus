"use client";

import * as React from "react";
import axios from "axios";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { useFactoryStore } from "@/stores/use-factory-store";
import { generateReceiptPdf } from "@/components/weighment-receipt/pdf/generate-pdf";
import { ManualWeighmentReceiptView } from "@/components/weighment-receipt/views/manual-receipt-view";
import { manualWeighmentSchema, type ManualWeighment } from "@/app/weighments/types";

export function useManualWeighmentPdfDownload() {
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);

  const downloadManualPdf = React.useCallback(
    async (weighment: ManualWeighment | { id: number; vehicle_number: string }) => {
      setDownloadingId(weighment.id);
      toast.add({
        type: "info",
        title: "Generating Receipt PDF",
        description: `Preparing receipt for ${weighment.vehicle_number}...`,
      });

      try {
        const response = await axios.get<{ data: ManualWeighment[]; totalCount: number }>(
          "/api/weighments/manual",
          { params: { id: weighment.id } },
        );

        const verifiedWeighment =
          response.data?.data?.find((w) => w.id === weighment.id) ??
          response.data?.data?.[0] ??
          weighment;

        const manualWeighment = manualWeighmentSchema.parse(verifiedWeighment);
        const factory = useFactoryStore.getState().factory;
        if (!factory) {
          throw new Error("Factory configuration not found. Please log in again.");
        }

        const fileName = `manual-weighment-${manualWeighment.id}-${manualWeighment.vehicle_number}.pdf`;
        await generateReceiptPdf(
          <ManualWeighmentReceiptView weighment={manualWeighment} factory={factory} />,
          fileName,
        );

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
      } finally {
        setDownloadingId(null);
      }
    },
    [],
  );

  return {
    downloadManualPdf,
    downloadingId,
    isDownloading: downloadingId !== null,
  };
}
