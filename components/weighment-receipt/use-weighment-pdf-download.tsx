"use client";

import { useAutomaticWeighmentPdfDownload } from "./use-automatic-weighment-pdf-download";
import { useManualWeighmentPdfDownload } from "./use-manual-weighment-pdf-download";
import type {
  Weighment,
  WeighmentMode,
  ManualWeighment,
  AutomaticWeighment,
} from "@/app/weighments/types";

export { useAutomaticWeighmentPdfDownload } from "./use-automatic-weighment-pdf-download";
export { useManualWeighmentPdfDownload } from "./use-manual-weighment-pdf-download";

export function useWeighmentPdfDownload() {
  const { downloadAutomaticPdf, downloadingId: autoId } = useAutomaticWeighmentPdfDownload();
  const { downloadManualPdf, downloadingId: manualId } = useManualWeighmentPdfDownload();

  const downloadPdf = (weighment: Weighment, mode: WeighmentMode) => {
    if (mode === "manual") {
      downloadManualPdf(weighment as ManualWeighment);
    } else {
      downloadAutomaticPdf(weighment as AutomaticWeighment);
    }
  };

  return {
    downloadPdf,
    downloadingId: manualId ?? autoId,
    isDownloading: manualId !== null || autoId !== null,
  };
}
