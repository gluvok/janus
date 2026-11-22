"use client";

import * as React from "react";
import { useWeighmentPdfDownload } from "@/hooks/use-weighment-pdf-download";
import type { AutomaticWeighment } from "@/app/weighments/types";

export function useAutomaticWeighmentPdfDownload() {
  const { downloadReceipt, downloadingId, isDownloading } = useWeighmentPdfDownload();

  const downloadAutomaticPdf = React.useCallback(
    async (weighment: AutomaticWeighment | { id: number; vehicle_number: string }) => {
      await downloadReceipt("automatic", weighment);
    },
    [downloadReceipt],
  );

  return {
    downloadAutomaticPdf,
    downloadingId,
    isDownloading,
  };
}
