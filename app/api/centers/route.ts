import {
  withAuth,
  getPaginationParams,
  forbiddenError,
  hasPermission,
  fetchPaginatedResult,
} from "@/db/helpers";
import { ProjectSlug, PermissionKey } from "@/lib/constants/enums";
import { sanitizeSearchTerm } from "@/lib/services/common";

export const GET = withAuth(async (req, user, client) => {
  if (!hasPermission(user, ProjectSlug.CENTERS, PermissionKey.READ)) return forbiddenError();
  const pagination = getPaginationParams(req.nextUrl);
  const search = req.nextUrl.searchParams.get("search");
  const autoApprove = req.nextUrl.searchParams.get("auto_approve");
  const sortColumn = req.nextUrl.searchParams.get("sort_column") || "created_at";
  const sortDesc = req.nextUrl.searchParams.has("sort_desc")
    ? req.nextUrl.searchParams.get("sort_desc") === "true"
    : true;

  let query = client
    .from("centers")
    .select("*", { count: "exact" })
    .order(sortColumn, { ascending: !sortDesc })
    .eq("factory_id", user.factory_id)
    .is("deleted_at", null);

  if (autoApprove === "true" || autoApprove === "false") {
    query = query.eq("auto_approve", autoApprove === "true");
  }

  if (search) {
    const cleanSearch = sanitizeSearchTerm(search);
    if (cleanSearch) {
      const searchNum = parseInt(cleanSearch, 10);
      if (!isNaN(searchNum)) {
        query = query.or(`name.ilike.%${cleanSearch}%,id.eq.${searchNum}`);
      } else {
        query = query.ilike("name", `%${cleanSearch}%`);
      }
    }
  }

  return fetchPaginatedResult(query, pagination);
});
