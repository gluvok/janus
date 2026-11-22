"use client";

import * as React from "react";
import { downloadWeighmentReceipt, type ReceiptMode } from "@/components/weighment-receipt";

export function useWeighmentPdfDownload() {
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);

  const downloadReceipt = React.useCallback(
    async (mode: ReceiptMode, weighment: { id: number; vehicle_number: string }) => {
      setDownloadingId(weighment.id);
      try {
        await downloadWeighmentReceipt({ mode, weighment });
      } catch {
        // Error already notified by toast in downloadWeighmentReceipt
      } finally {
        setDownloadingId(null);
      }
    },
    [],
  );

  return {
    downloadReceipt,
    downloadingId,
    isDownloading: downloadingId !== null,
  };
}
