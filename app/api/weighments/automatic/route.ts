import { handleApiRoute } from "@/lib/api-handler";
import { executeAutomaticWeighmentsQuery } from "@/lib/weighments-query";

export const GET = handleApiRoute(async (request: Request) => {
  return executeAutomaticWeighmentsQuery(request);
});
