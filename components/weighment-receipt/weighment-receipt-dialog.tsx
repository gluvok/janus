"use client";

import * as React from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon, PrinterIcon } from "@hugeicons/core-free-icons";
import { useFactoryStore } from "@/stores/use-factory-store";
import { getErrorMessage } from "@/lib/utils";
import { WeighmentReceiptView } from "./weighment-receipt-view";
import { useWeighmentPdfDownload } from "./use-weighment-pdf-download";
import type { Weighment, WeighmentMode } from "@/app/weighments/types";

interface WeighmentReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weighment: Weighment | null;
  mode: WeighmentMode;
}

export function WeighmentReceiptDialog({
  open,
  onOpenChange,
  weighment,
  mode,
}: WeighmentReceiptDialogProps) {
  const factory = useFactoryStore((state) => state.factory);
  const [verifiedWeighment, setVerifiedWeighment] = React.useState<Weighment | null>(weighment);
  const { downloadPdf, isDownloading } = useWeighmentPdfDownload();

  // Validate session against mode-specific weighment API and refresh weighment data
  React.useEffect(() => {
    if (!open || !weighment) return;

    setVerifiedWeighment(weighment);
    let isMounted = true;

    const fetchVerifiedData = async () => {
      try {
        const endpoint = mode === "manual" ? "/api/weighments/manual" : "/api/weighments/automatic";
        const res = await axios.get<{ data: Weighment[]; totalCount: number }>(endpoint, {
          params: { id: weighment.id },
        });

        if (isMounted && res.data?.data?.[0]) {
          setVerifiedWeighment(res.data.data[0]);
        }
      } catch (err) {
        if (isMounted) {
          toast.add({
            type: "error",
            title: "Validation Error",
            description: getErrorMessage(err, "Failed to verify weighment record."),
          });
        }
      }
    };

    fetchVerifiedData();
    return () => {
      isMounted = false;
    };
  }, [open, weighment, mode]);

  if (!weighment) return null;

  const activeWeighment = verifiedWeighment ?? weighment;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    downloadPdf(activeWeighment, mode);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        {/* Header Toolbar */}
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border">
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-sm font-semibold">
              Weighment Receipt #{activeWeighment.id}
            </DialogTitle>
            <DialogDescription className="text-2xs text-muted-foreground">
              Vehicle: {activeWeighment.vehicle_number} •{" "}
              {mode === "manual" ? "Manual" : "Automatic"}
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handlePrint}
              className="gap-1.5 cursor-pointer text-2xs"
            >
              <HugeiconsIcon icon={PrinterIcon} className="size-3.5" />
              <span>Print</span>
            </Button>
            <Button
              type="button"
              variant="default"
              size="xs"
              onClick={handleDownload}
              disabled={isDownloading}
              className="gap-1.5 cursor-pointer text-2xs min-w-28"
            >
              {isDownloading ? (
                <>
                  <Spinner className="size-3" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Download01Icon} className="size-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Printable Receipt Canvas */}
        <div className="flex-1 overflow-y-auto pt-2 pb-1 pr-1 flex justify-center">
          <WeighmentReceiptView
            weighment={activeWeighment}
            factoryName={factory?.name}
            imagesPerRow={factory?.receipt_images_per_row ?? 3}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
