import { executeManualWeighmentsQuery } from "@/lib/weighments-query";

export async function GET(request: Request) {
  return executeManualWeighmentsQuery(request);
}
