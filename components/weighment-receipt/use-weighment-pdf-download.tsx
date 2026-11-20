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
  const [isDownloading, setIsDownloading] = React.useState(false);

  const downloadPdf = React.useCallback(async (weighment: Weighment, mode: WeighmentMode) => {
    setIsDownloading(true);
    toast.add({
      type: "info",
      title: "Generating Receipt PDF",
      description: `Preparing receipt for ${weighment.vehicle_number}...`,
    });

    // Temporary off-screen container for off-screen rendering
    let offscreenContainer: HTMLDivElement | null = null;
    let root: ReturnType<typeof createRoot> | null = null;

    try {
      // 1. Query the mode-specific weighment API to validate session and get verified data
      const endpoint = mode === "manual" ? "/api/weighments/manual" : "/api/weighments/automatic";
      const response = await axios.get<{ data: Weighment[]; totalCount: number }>(endpoint, {
        params: { id: weighment.id },
      });

      const verifiedWeighment = response.data?.data?.[0] ?? weighment;
      const factory = useFactoryStore.getState().factory;

      // 2. Mount receipt view off-screen
      offscreenContainer = document.createElement("div");
      offscreenContainer.style.position = "fixed";
      offscreenContainer.style.left = "-9999px";
      offscreenContainer.style.top = "0";
      offscreenContainer.style.zIndex = "-9999";
      document.body.appendChild(offscreenContainer);

      root = createRoot(offscreenContainer);
      root.render(
        <WeighmentReceiptView
          weighment={verifiedWeighment}
          factoryName={factory?.name}
          imagesPerRow={factory?.receipt_images_per_row ?? 3}
        />,
      );

      // Allow DOM layout and images to settle
      await new Promise((resolve) => setTimeout(resolve, 350));

      const element = offscreenContainer.querySelector<HTMLElement>("#printable-receipt");
      if (!element) {
        throw new Error("Unable to locate receipt template for rendering.");
      }

      // 3. Rasterize DOM to canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      // 4. Construct A4 PDF with multi-page slicing and pagination
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;
      const pageCanvasHeight = (canvas.width * pdfHeight) / pdfWidth;
      const totalPages = Math.ceil(canvas.height / pageCanvasHeight);

      if (totalPages <= 1) {
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const renderedHeightMm = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, renderedHeightMm);

        pdf.setFontSize(8);
        pdf.setTextColor(140, 140, 140);
        pdf.text(
          `Page 1 of 1 • Weighment #${verifiedWeighment.id} • Official Record • ${factory?.name ?? "Mesto"}`,
          pdfWidth / 2,
          pdfHeight - 6,
          { align: "center" },
        );
      } else {
        for (let i = 0; i < totalPages; i++) {
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          const remainingHeight = canvas.height - i * pageCanvasHeight;
          pageCanvas.height = Math.min(pageCanvasHeight, remainingHeight);

          const ctx = pageCanvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(
              canvas,
              0,
              i * pageCanvasHeight,
              canvas.width,
              pageCanvas.height,
              0,
              0,
              canvas.width,
              pageCanvas.height,
            );

            const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);
            if (i > 0) pdf.addPage();
            const renderedHeightMm = (pageCanvas.height * pdfWidth) / canvas.width;
            pdf.addImage(pageImgData, "JPEG", 0, 0, pdfWidth, renderedHeightMm);

            pdf.setFontSize(8);
            pdf.setTextColor(140, 140, 140);
            pdf.text(
              `Page ${i + 1} of ${totalPages} • Weighment #${verifiedWeighment.id} • Official Record • ${factory?.name ?? "Mesto"}`,
              pdfWidth / 2,
              pdfHeight - 6,
              { align: "center" },
            );
          }
        }
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
      setIsDownloading(false);
    }
  }, []);

  return {
    downloadPdf,
    isDownloading,
  };
}
