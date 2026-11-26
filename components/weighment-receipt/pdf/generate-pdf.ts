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
  offscreenContainer.style.backgroundColor = "#f7f6f2";
  offscreenContainer.style.color = "#1f241d";
  offscreenContainer.style.colorScheme = "light";
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
        backgroundColor: "#f7f6f2",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      if (i > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    }

    pdf.autoPrint();
    const blob = pdf.output("blob");
    const blobUrl = URL.createObjectURL(blob);

    const openFallbackWindow = () => {
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    };

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    iframe.title = fileName;

    const cleanup = () => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      URL.revokeObjectURL(blobUrl);
    };

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) {
          openFallbackWindow();
          return;
        }
        win.focus();
        win.print();
      } catch {
        openFallbackWindow();
      } finally {
        setTimeout(cleanup, 60_000);
      }
    };

    iframe.onerror = () => {
      openFallbackWindow();
      setTimeout(cleanup, 60_000);
    };

    iframe.src = blobUrl;
    document.body.appendChild(iframe);
  } finally {
    root.unmount();
    if (document.body.contains(offscreenContainer)) {
      document.body.removeChild(offscreenContainer);
    }
  }
}
