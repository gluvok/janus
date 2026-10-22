import { executeEntriesGetQuery, executeEntriesDelete } from "@/lib/entries-query";

export async function GET(request: Request) {
  return executeEntriesGetQuery(request, "manual");
}

export async function DELETE(request: Request) {
  return executeEntriesDelete(request, "manual_entries");
}
