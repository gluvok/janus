import { formatDateTime } from "@/lib/utils";

interface TransitDetailsData {
  vehicle_number: string;
  in_time: string;
  out_time: string;
  in_center_id: number;
  in_center_name: string;
  out_center_id: number;
  out_center_name: string;
}

interface ReceiptTransitDetailsProps {
  weighment: TransitDetailsData;
}

function ScaleLocationColumn({
  label,
  time,
  centerId,
  centerName,
  isLast = false,
}: {
  label: string;
  time: string;
  centerId: number;
  centerName: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={`col-span-12 sm:col-span-4 flex flex-col gap-0.5 min-w-0 ${isLast ? "sm:pl-4" : "sm:px-4"}`}
    >
      <span className="font-heading text-3xs text-[#5f6558] font-semibold">{label}</span>
      <div className="flex flex-col min-w-0">
        <span className="font-mono text-xs font-bold text-[#2f352b] tabular-nums">
          {formatDateTime(time)}
        </span>
        <span className="text-3xs text-[#5f6558] truncate">
          [#{centerId}] {centerName}
        </span>
      </div>
    </div>
  );
}

export function ReceiptTransitDetails({ weighment }: ReceiptTransitDetailsProps) {
  return (
    <div className="py-1.5 border-b border-[#e2dccb] rounded-none">
      <div className="grid grid-cols-12 gap-3 sm:gap-0 sm:divide-x divide-[#e2dccb] items-center">
        {/* Col 1: Vehicle Identifier */}
        <div className="col-span-12 sm:col-span-4 sm:pr-4 flex flex-col gap-0.5 min-w-0">
          <span className="font-heading text-3xs text-[#5f6558] font-semibold">Vehicle No.</span>
          <span className="font-mono text-sm sm:text-base font-bold text-[#1f241d] tracking-wider truncate">
            {weighment.vehicle_number}
          </span>
        </div>

        {/* Col 2: Scale In Timestamp & Location */}
        <ScaleLocationColumn
          label="Scale In"
          time={weighment.in_time}
          centerId={weighment.in_center_id}
          centerName={weighment.in_center_name}
        />

        {/* Col 3: Scale Out Timestamp & Location */}
        <ScaleLocationColumn
          label="Scale Out"
          time={weighment.out_time}
          centerId={weighment.out_center_id}
          centerName={weighment.out_center_name}
          isLast
        />
      </div>
    </div>
  );
}
