import { executeWeighmentsGetQuery } from "@/lib/weighments-query";

export async function GET(request: Request) {
  return executeWeighmentsGetQuery(request, "automatic");
}
