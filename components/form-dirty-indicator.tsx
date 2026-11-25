import * as React from "react";
import { cn } from "@/lib/utils";

interface FormDirtyIndicatorProps {
  isDirty: boolean;
  className?: string;
}

export function FormDirtyIndicator({ isDirty, className }: FormDirtyIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2 text-2xs text-muted-foreground", className)}>
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          isDirty ? "animate-pulse bg-warning" : "bg-success",
        )}
      />
      <span>{isDirty ? "You have unsaved changes." : "All changes saved."}</span>
    </div>
  );
}
