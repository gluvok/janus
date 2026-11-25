"use client";

import * as React from "react";
import {
  downloadWeighmentReceipt,
  downloadEntryReceipt as downloadEntryReceiptPdf,
} from "@/components/weighment-receipt";
import type { EntityMode } from "@/stores/use-mode-store";

export function useWeighmentPdfDownload() {
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);

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

  return {
    downloadReceipt,
    downloadEntryReceipt,
    downloadingId,
    isDownloading: downloadingId !== null,
  };
}
