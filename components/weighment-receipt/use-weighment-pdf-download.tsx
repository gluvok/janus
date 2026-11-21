"use client";

import * as React from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { useFactoryStore } from "@/stores/use-factory-store";
import { WeighmentReceiptView } from "./weighment-receipt-view";
import type { Weighment, WeighmentMode } from "@/app/weighments/types";

export function useWeighmentPdfDownload() {
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);

  const downloadPdf = React.useCallback(async (weighment: Weighment, mode: WeighmentMode) => {
    setDownloadingId(weighment.id);
    toast.add({
      type: "info",
      title: "Generating Receipt PDF",
      description: `Preparing receipt for ${weighment.vehicle_number}...`,
    });

    let offscreenContainer: HTMLDivElement | null = null;
    let root: ReturnType<typeof createRoot> | null = null;

    try {
      // 1. Query the mode-specific weighment API to validate session and get fresh data
      const endpoint = mode === "manual" ? "/api/weighments/manual" : "/api/weighments/automatic";
      const response = await axios.get<{ data: Weighment[]; totalCount: number }>(endpoint, {
        params: { id: weighment.id },
      });

      const verifiedWeighment =
        response.data?.data?.find((w) => w.id === weighment.id) ??
        response.data?.data?.[0] ??
        weighment;
      const factory = useFactoryStore.getState().factory;

      // 2. Mount receipt view off-screen
      offscreenContainer = document.createElement("div");
      offscreenContainer.style.position = "fixed";
      offscreenContainer.style.left = "-9999px";
      offscreenContainer.style.top = "0";
      offscreenContainer.style.zIndex = "-9999";
      offscreenContainer.className = "font-sans antialiased";
      document.body.appendChild(offscreenContainer);

      root = createRoot(offscreenContainer);
      root.render(
        <WeighmentReceiptView
          weighment={verifiedWeighment}
          factoryName={factory?.name}
          imagesPerRow={factory?.receipt_images_per_row ?? 2}
          mode={mode}
        />,
      );

      // Allow DOM layout and images to settle
      await new Promise((resolve) => setTimeout(resolve, 400));

      const pageElements = offscreenContainer.querySelectorAll<HTMLElement>(".receipt-page");
      if (!pageElements || pageElements.length === 0) {
        throw new Error("Unable to locate receipt template pages for rendering.");
      }

      // 3. Construct A4 PDF by rendering each discrete page without pixel slicing
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];
        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }

      const fileName = `weighment-receipt-${verifiedWeighment.id}-${verifiedWeighment.vehicle_number}.pdf`;
      pdf.save(fileName);

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
      if (root) {
        root.unmount();
      }
      if (offscreenContainer && document.body.contains(offscreenContainer)) {
        document.body.removeChild(offscreenContainer);
      }
      setDownloadingId(null);
    }
  }, []);

  return {
    downloadPdf,
    downloadingId,
    isDownloading: downloadingId !== null,
  };
}
