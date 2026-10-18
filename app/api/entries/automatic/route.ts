import { executeEntriesGetQuery } from "@/lib/entries-query";

export async function GET(request: Request) {
  return executeEntriesGetQuery(request, "automatic");
}
