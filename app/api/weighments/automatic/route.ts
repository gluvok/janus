import { executeAutomaticWeighmentsQuery } from "@/lib/weighments-query";

export async function GET(request: Request) {
  return executeAutomaticWeighmentsQuery(request);
}
