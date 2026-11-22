import * as React from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

export async function generateReceiptPdf(
  receiptElement: React.ReactElement,
  fileName: string,
): Promise<void> {
  const offscreenContainer = document.createElement("div");
  offscreenContainer.style.position = "fixed";
  offscreenContainer.style.left = "-9999px";
  offscreenContainer.style.top = "0";
  offscreenContainer.style.zIndex = "-9999";
  offscreenContainer.className = "font-sans antialiased";
  document.body.appendChild(offscreenContainer);

  const root = createRoot(offscreenContainer);
  try {
    root.render(receiptElement);

    // Synchronize font loading and settle DOM layout
    if (typeof document !== "undefined" && document.fonts?.ready) {
      await document.fonts.ready;
    }

    // Wait for all img elements in container to finish loading
    const images = Array.from(offscreenContainer.querySelectorAll("img"));
    if (images.length > 0) {
      await Promise.all(
        images.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) {
                resolve(true);
              } else {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
              }
            }),
        ),
      );
    }

    // Allow DOM layout to settle
    await new Promise((resolve) => setTimeout(resolve, 200));

    const pageElements = offscreenContainer.querySelectorAll<HTMLElement>(".receipt-page");
    if (pageElements.length === 0) {
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

    pdf.save(fileName);
  } finally {
    root.unmount();
    if (document.body.contains(offscreenContainer)) {
      document.body.removeChild(offscreenContainer);
    }
  }
}
