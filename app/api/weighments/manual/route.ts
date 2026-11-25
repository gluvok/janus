import { handleApiRoute } from "@/lib/api-handler";
import { executeManualWeighmentsQuery } from "@/lib/weighments-query";

export const GET = handleApiRoute(async (request: Request) => {
  return executeManualWeighmentsQuery(request);
});
