"use client";

import * as React from "react";
import { useWeighmentPdfDownload } from "@/hooks/use-weighment-pdf-download";
import type { ManualWeighment } from "@/app/weighments/types";

export function useManualWeighmentPdfDownload() {
  const { downloadReceipt, downloadingId, isDownloading } = useWeighmentPdfDownload();

  const downloadManualPdf = React.useCallback(
    async (weighment: ManualWeighment | { id: number; vehicle_number: string }) => {
      await downloadReceipt("manual", weighment);
    },
    [downloadReceipt],
  );

  return {
    downloadManualPdf,
    downloadingId,
    isDownloading,
  };
}
