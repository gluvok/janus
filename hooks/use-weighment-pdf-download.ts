"use client";

import * as React from "react";
import {
  downloadWeighmentReceipt,
  downloadEntryReceipt as downloadEntryReceiptPdf,
} from "@/components/weighment-receipt";
import { downloadWeighmentsBatchReceipt } from "@/components/weighment-receipt/pdf/download-receipt";
import type { EntityMode } from "@/stores/use-mode-store";

export function useWeighmentPdfDownload() {
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);
  const [isBatchPrinting, setIsBatchPrinting] = React.useState(false);

  const runDownload = React.useCallback(async (id: number, task: () => Promise<void>) => {
    setDownloadingId(id);
    try {
      await task();
    } catch {
      // Error already notified by toast in download helper
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const downloadReceipt = React.useCallback(
    async (weighment: { id: number; vehicle_number: string }, mode: EntityMode) =>
      runDownload(weighment.id, () => downloadWeighmentReceipt({ weighment, mode })),
    [runDownload],
  );

  const downloadEntryReceipt = React.useCallback(
    async (entry: { id: number; vehicle_number: string }, mode: EntityMode) =>
      runDownload(entry.id, () => downloadEntryReceiptPdf({ entry, mode })),
    [runDownload],
  );

  const downloadBatchReceipts = React.useCallback(
    async (weighments: Array<{ id: number; vehicle_number: string }>, mode: EntityMode) => {
      if (weighments.length === 0) return;
      setIsBatchPrinting(true);
      try {
        await downloadWeighmentsBatchReceipt({ weighments, mode });
      } catch {
        // Error already notified by toast in download helper
      } finally {
        setIsBatchPrinting(false);
      }
    },
    [],
  );

  return {
    downloadReceipt,
    downloadEntryReceipt,
    downloadBatchReceipts,
    downloadingId,
    isDownloading: downloadingId !== null,
    isBatchPrinting,
  };
}
