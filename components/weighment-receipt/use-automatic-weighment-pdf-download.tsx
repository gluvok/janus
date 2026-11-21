"use client";

import * as React from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { useFactoryStore } from "@/stores/use-factory-store";
import { AutomaticWeighmentReceiptView } from "./automatic-weighment-receipt-view";
import { completedAutomaticWeighmentSchema, type AutomaticWeighment } from "@/app/weighments/types";

export function useAutomaticWeighmentPdfDownload() {
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);

  const downloadAutomaticPdf = React.useCallback(
    async (weighment: AutomaticWeighment | { id: number; vehicle_number: string }) => {
      setDownloadingId(weighment.id);
      toast.add({
        type: "info",
        title: "Generating Receipt PDF",
        description: `Preparing receipt for ${weighment.vehicle_number}...`,
      });

      let offscreenContainer: HTMLDivElement | null = null;
      let root: ReturnType<typeof createRoot> | null = null;

      try {
        const response = await axios.get<{ data: AutomaticWeighment[]; totalCount: number }>(
          "/api/weighments/automatic",
          { params: { id: weighment.id } },
        );

        const verifiedWeighment =
          response.data?.data?.find((w) => w.id === weighment.id) ??
          response.data?.data?.[0] ??
          weighment;

        const completedWeighment = completedAutomaticWeighmentSchema.parse(verifiedWeighment);
        const factory = useFactoryStore.getState().factory;
        if (!factory) {
          throw new Error("Factory configuration not found. Please log in again.");
        }

        offscreenContainer = document.createElement("div");
        offscreenContainer.style.position = "fixed";
        offscreenContainer.style.left = "-9999px";
        offscreenContainer.style.top = "0";
        offscreenContainer.style.zIndex = "-9999";
        offscreenContainer.className = "font-sans antialiased";
        document.body.appendChild(offscreenContainer);

        root = createRoot(offscreenContainer);
        root.render(
          <AutomaticWeighmentReceiptView weighment={completedWeighment} factory={factory} />,
        );

        await new Promise((resolve) => setTimeout(resolve, 400));

        const pageElements = offscreenContainer.querySelectorAll<HTMLElement>(".receipt-page");
        if (!pageElements || pageElements.length === 0) {
          throw new Error("Unable to locate receipt template pages for rendering.");
        }

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

        const fileName = `automatic-weighment-${verifiedWeighment.id}-${verifiedWeighment.vehicle_number}.pdf`;
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
    },
    [],
  );

  return {
    downloadAutomaticPdf,
    downloadingId,
    isDownloading: downloadingId !== null,
  };
}
