import { formatDateTime } from "@/lib/utils";

interface TransitDetailsData {
  vehicle_number: string;
  in_time: string;
  out_time: string;
  in_center: { id: number; name: string };
  out_center: { id: number; name: string };
}

interface ReceiptTransitDetailsProps {
  weighment: TransitDetailsData;
}

function ScaleLocationColumn({
  label,
  time,
  center,
  isLast = false,
}: {
  label: string;
  time: string;
  center: { id: number; name: string };
  isLast?: boolean;
}) {
  return (
    <div
      className={`col-span-12 sm:col-span-4 flex flex-col gap-0.5 min-w-0 ${isLast ? "sm:pl-4" : "sm:px-4"}`}
    >
      <span className="font-heading text-3xs text-zinc-400 font-semibold">{label}</span>
      <div className="flex flex-col min-w-0">
        <span className="font-mono text-xs font-bold text-zinc-900 tabular-nums">
          {formatDateTime(time)}
        </span>
        <span className="text-3xs text-zinc-500 truncate">
          [#{center.id}] {center.name}
        </span>
      </div>
    </div>
  );
}

export function ReceiptTransitDetails({ weighment }: ReceiptTransitDetailsProps) {
  return (
    <div className="py-1.5 border-b border-zinc-200/80 rounded-none">
      <div className="grid grid-cols-12 gap-3 sm:gap-0 sm:divide-x divide-zinc-200/60 items-center">
        {/* Col 1: Vehicle Identifier */}
        <div className="col-span-12 sm:col-span-4 sm:pr-4 flex flex-col gap-0.5 min-w-0">
          <span className="font-heading text-3xs text-zinc-400 font-semibold">Vehicle No.</span>
          <span className="font-mono text-sm sm:text-base font-bold text-zinc-950 tracking-wider truncate">
            {weighment.vehicle_number}
          </span>
        </div>

        {/* Col 2: Scale In Timestamp & Location */}
        <ScaleLocationColumn
          label="Scale In"
          time={weighment.in_time}
          center={weighment.in_center}
        />

        {/* Col 3: Scale Out Timestamp & Location */}
        <ScaleLocationColumn
          label="Scale Out"
          time={weighment.out_time}
          center={weighment.out_center}
          isLast
        />
      </div>
    </div>
  );
}
