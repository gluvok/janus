import { executeWeighmentsQuery } from "@/lib/weighments-query";

export async function GET(request: Request) {
  return executeWeighmentsQuery(request);
}
