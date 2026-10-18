<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- Always read `schema.sql` before writing any code to understand the existing database structure, types, and constraints.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. JavaScript / TypeScript / Node Quality & Verification Gates

**Always enforce the verification loop. Use `pnpm` exclusively (never `npm`, `yarn`, or `bun`).**

For any JavaScript / TypeScript / Node modifications:

1. **Package Manager**: Use `pnpm` explicitly for all package installations and script executions. Do not use `npm`, `yarn`, or `bun`.
2. **Lint & Code Style**: Run `pnpm lint` and `pnpm fmt`. Fix any remaining issues cleanly without disabling rules.
3. **Type Checking**: Run `pnpm type-check` (`tsc --noEmit`). Fix type diagnostics cleanly without using `@ts-ignore` or arbitrary `any`.
4. **Test Suite**: Run `pnpm test` (`vitest run`) to confirm all tests pass without regression.
5. **Build Verification**: Run `pnpm run build` (`next build`) to confirm production builds compile cleanly.
6. **Iterative Verification**: Keep looping through `pnpm lint`, `pnpm fmt`, `pnpm type-check`, `pnpm test`, and `pnpm run build` until all yield **0 errors, 0 warnings, and clean builds**.

**The mandatory commands that must always pass:**

- `pnpm run lint` (0 errors, 0 warnings)
- `pnpm run fmt` (0 formatting issues)
- `pnpm run type-check` (0 errors, 0 warnings)
- `pnpm test` (all tests pass)
- `pnpm run build` (clean exit 0)

## 6. Update README.md

**Always keep `README.md` in sync with codebase changes.**

- Explicitly update `README.md` whenever adding, modifying, or removing features, API endpoints, environment variables, dependencies, or workflows.
- Ensure all setup instructions, configuration options, and usage examples remain accurate and up-to-date.

## 7. Database Schema & Migrations

**Read `schema.sql` before writing code. Track changes in `migration.sql`.**

- **Inspect schema first**: Always read `schema.sql` before writing any code to understand the existing database tables, columns, relationships, types, and constraints. Never assume database structures.
- **Update migrations on schema changes**: In case the schema is modified or new tables, columns, triggers, or policies are introduced, update `schema.sql` to reflect the target state and record the corresponding migration statements in `migration.sql`.

## 8. shadcn / UI Components & Documentation

**Official shadcn docs are in the `docs/` folder. Never manually create `components/ui/` files.**

- **Official Documentation**: Canonical shadcn / UI documentation for components in this repository is kept inside the `docs/` folder (e.g., `docs/datatable.md`, `docs/pagination.md`, `docs/spinner.md`, `docs/select.md`). Always consult `docs/` first for canonical component APIs, props, and design guidelines.
- **CLI Component Addition**: NEVER create components inside the `components/ui/` directory manually. Always install and scaffold UI components using the `pnpm shadcn` CLI command (e.g., `pnpm dlx shadcn@latest add <component>` or `pnpm shadcn add <component>`). If project-specific adjustments or imports need tuning after installation, edit the CLI-generated file rather than crafting it from scratch.
- **Strict Zero Raw HTML Tags in Feature Code**: NEVER use raw HTML tags when a shadcn component exists. This strictly includes:
  - `<button>` -> `<Button>` (This applies unconditionally to ALL buttons: search clear crosses, badge dismiss `(x)` buttons, icon toggles, dropdown triggers, and popover buttons must all use `<Button variant="ghost" size="icon-xs" ...>` or `<Button>`).
  - `<input>` -> `<Input>`
  - `<select>` -> `<Select>`
  - `<checkbox>` -> `<Checkbox>`
  - `<table>` -> `<Table>`
  - `<dialog>` -> `<Dialog>`
- **Strict Zero Arbitrary Bracket Values (e.g., `[70px]`, `[calc(...)]`)**: NEVER use raw bracket arbitrary values in class names (e.g., `w-[70px]`, `min-w-[70px]`, `max-w-[calc(...)]`, `h-[30px]`, `p-[12px]`, `[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden`).
  - Always use standard Tailwind design system scale utilities (e.g., `w-16`, `w-20`, `min-w-16`, `min-w-20`, `h-7`, `p-3`) or semantic theme tokens.
  - If a custom reusable CSS utility is required (such as hiding scrollbars), register it declaratively in `app/globals.css` using Tailwind v4 `@utility` (e.g. `@utility no-scrollbar { ... }`) instead of inlining brackets into JSX.

## 9. Responsive Architecture: Pure CSS Over JS Hooks

**Never use `useIsMobile()` JS hooks for responsive layout shifts.**

- Always use pure Tailwind CSS responsive utilities (`sm:`, `md:`, `lg:`, `hidden sm:flex`, `block sm:hidden`).
- Window-width JS hooks like `useIsMobile()` cause hydration mismatches, layout shifts during load, and flash of desktop layout on mobile devices.
- Pure CSS media queries render correctly on the server and hydrate with zero layout shift.

## 10. Strict Code DRY & Single Source of Truth

**Never duplicate code, types, navigation registries, or parallel component logic.**

- **Single Source of Truth**: Define entity routes, metadata, column titles, and navigation structures in centralized config files (e.g. `lib/navigation.ts`, `app/<entity>/types.ts`). Never maintain duplicate dictionaries or parallel arrays across components and pages.
- **Consolidate Identical Components**: If two or more components share identical or near-identical JSX structure (such as menu lists, buttons, or filters), generalize them into a single reusable component (e.g. `components/nav-group.tsx`, `components/page-refresh-button.tsx`) parameterized by props.
- **Eliminate Redundant Wrapper Files**: Do not keep pass-through wrapper components or legacy file aliases that only re-export or delegate to a generalized component. Delete redundant files directly and update imports at callers.
- **Audit for Duplication Before Coding**: Before implementing a feature or entity table, check if reusable abstractions already exist in `components/data-table/` or `components/`. Never copy-paste whole table files or sensor setups.
- **Centralized Backend API Query Utilities (`lib/api-query.ts`)**: Never duplicate API pagination, multi-column sorting, date filtering, or response formatting across route handlers (`app/api/**/route.ts`). All paginated entity endpoints MUST consume `lib/api-query.ts` (`parsePagination`, `parseSorting`, `applyDateRange`, `applySortingAndPagination`, `formatPaginatedResponse`). Entity routes must strictly contain only entity-specific projections, sort column whitelists, and custom filters. Zero inline duplication of pagination math or sort regexes.
- **Centralized Error Parsing (`lib/utils.ts`)**: NEVER write inline Axios/Error extraction ternaries (`axios.isAxiosError(err) ? err.response?.data?.error ...`). Always import and use `getErrorMessage(err, fallback)` from `@/lib/utils`.
- **Centralized Date Formatting (`lib/utils.ts`)**: NEVER instantiate `new Intl.DateTimeFormat(...)` ad-hoc across tables, cards, or components. Always import and use `formatDateTime(isoString)` from `@/lib/utils`.
- **Deduplicate Form Initial Values**: In forms utilizing `useForm` and `useEffect({ reset(...) })`, extract a single `getInitialValues(entity)` helper function rather than duplicating default value objects.
- **Payload Construction & Unified Toasts**: Avoid duplicating entire payload structures or toast invocations across `isEdit` branches; use object spreads (`...(isEdit && user ? { id: user.id } : {})`) and parameterized strings for toasts.
- **Prohibition of Redundant Variable Aliases**: NEVER declare alias variables (e.g. `const singularLabel = entityLabel; const pluralLabel = entityLabelPlural;`) that merely re-assign existing props or variables without transformation.
- **Strict Prohibition of Raw Magic HTTP Status Codes (`http-status-codes`)**: Always import and use `StatusCodes` from `http-status-codes` across all API route handlers and responses (e.g. `StatusCodes.OK`, `StatusCodes.CREATED`, `StatusCodes.BAD_REQUEST`, `StatusCodes.NOT_FOUND`, `StatusCodes.CONFLICT`, `StatusCodes.INTERNAL_SERVER_ERROR`). NEVER write raw numeric status literals like `200`, `201`, `400`, `404`, `409`, or `500` in `NextResponse.json(...)`.
- **Strict Prohibition of Parallel Entity Directories for Shared Tables**: When multiple domain concepts or user roles share the same underlying database table (e.g. `users` storing both staff and customers), NEVER create parallel feature directories with duplicated tables, dialogs, types, or schemas (e.g. `app/customers/` duplicating `app/users/`). Parameterize the single authoritative entity components (e.g. `UsersDataTable roleScope="staff" | "customer"`, `UserFormDialog fixedRole="customer"`) and render them directly in the respective page routes (`app/customers/page.tsx`).

## 11. Mandatory Pre-Completion Code Audit Gates

**Before declaring any task complete, verify these audits return 0 violations:**

1. **Audit for Raw HTML Tags**:
   ```bash
   git diff --name-only | grep -E '\.(tsx|jsx)$' | xargs grep -E '<(button|input|select|dialog)\b'
   # Must yield 0 lines.
   ```
2. **Audit for Arbitrary Bracket Classes**:
   ```bash
   git diff --name-only | grep -E '\.(tsx|jsx)$' | xargs grep -E '(w|h|max-w|min-w|p|m|text)-\[[^\]]+\]'
   # Must yield 0 lines.
   ```
3. **Audit for Inline Axios Error Parsing**:
   ```bash
   git diff --name-only | grep -E '\.(tsx|ts)$' | grep -v 'lib/utils.ts' | xargs grep -E 'err\.response' || true
   # Must yield 0 lines.
   ```
4. **Mandatory Quality Gates**:
   - `pnpm run lint` (0 errors, 0 warnings)
   - `pnpm run fmt` (0 formatting issues)
   - `pnpm run type-check` (0 errors, 0 warnings)
   - `pnpm test` (all tests pass)
   - `pnpm run build` (clean exit 0)

## 12. Strict Component Props Hygiene: Zero Uncalled Props

**Keep only props that are actively called and consumed by parent components.**

- **No Speculative or Pass-Through Props**: In custom and feature components (outside `components/ui/`), NEVER define or retain props, optional props (e.g. `className?: string`, `label?: string`), or catch-all spreads (`...props`, `extends ComponentProps<...>`) that are not passed by any parent component.
- **Prune Unused Prop Definitions**: When writing or refactoring components, inspect all parent call sites. If a prop is not passed by any caller, remove it completely from both the component parameters and its TypeScript props interface/type definition.
- **Zero Raw Spreads**: Do not add `...props` to internal custom components unless there is a concrete, actively used requirement across callers.
- **Parent-Driven API Design**: Components must expose the minimum prop surface required by their current usage in the application. Do not anticipate future callers by adding unused props.

## 13. Strict Prohibition of N+1 Queries & Batch Operations

**Strictly eliminate N+1 queries. Never execute queries or API calls inside iterative loops.**

- **Zero DB/API Calls in Loops**: NEVER run database queries (e.g. Supabase `.from(...)`, SQL `SELECT`/`UPDATE`/`DELETE`), HTTP requests, or asynchronous fetches inside `for`, `for...of`, `while`, `.map()`, or `.forEach()` loops.
- **Constant O(1) Batch Queries**: When checking, fetching, or mutating records for multiple identifiers or foreign keys, aggregate target IDs into an array and execute a single batch query (e.g. `.in("id", targetIds)`, `.in("user_id", targetIds)`, SQL `IN (...)`).
- **In-Memory Aggregation**: Aggregate counts, maps, lookups, or conflicts in application memory after fetching the batched result set rather than querying row-by-row.
- **Bulk Mutations**: Use bulk updates/deletions (`.in("id", targetIds).delete()` or `.in("id", targetIds).update(...)`) instead of individual per-record operations.

## 14. Form State & Zod Validation Delegation

**Standardize on `react-hook-form` + `zodResolver`. Delegate all boundary and conditional logic to Zod.**

- **Form State Management**: Use `react-hook-form` with `@hookform/resolvers/zod` (`useForm({ resolver: zodResolver(schema), mode: "onChange" })`) for all interactive forms. Never manage multiple input states via scattered `useState` or ad-hoc dirty checking.
- **Zod Schema Boundary Delegation**:
  - Delegate field requirements, optionality, dependent logic (e.g. credentials required only when portal access is toggled on via discriminated unions), and regexes strictly to Zod schemas.
  - Never duplicate validation checks in UI components if Zod already enforces them.
- **Zero Fallback Math for Schemas with Defaults**:
  - When a Zod schema defines defaults or fallbacks (`.default(...)`, `.catch(...)`), never write manual fallback arithmetic or nullish coalescing checks (`defaults?.page ?? 1`, `Math.max(1, ...)`). Rely directly on Zod's parse guarantees.
- **Inline Error Feedback**: Display inline `<FieldError>` messages dynamically beneath fields bound to `errors.<field>?.message`. Indicate mandatory fields with visual asterisks (`*`) in field labels.

## 15. Strict Brand Theme Color Compliance & Earth-Tones Palette

**Never introduce arbitrary or off-theme colors. Always adhere strictly to the project's Rikyū-cha theme and warm earth-tones palette.**

- **Project Brand Foundation**: The application is anchored on a warm alabaster cream background (`oklch(0.992 0.005 105)`) and signature Rikyū-cha tea-moss green (`--primary: #66684f` / dark: `#8a8d6e`).
- **Strict Prohibition of Off-Theme Colors**: NEVER introduce arbitrary, saturated primary or accent colors (such as neon violet, purple, fuchsia, cyan, magenta, or royal blue) into components or styles.
- **Two-Tier Color Strategy Hierarchy**:
  - **Tier 1: Filter Chips & Criteria Controls**: All active filter chips share a unified calm natural stone container (`border-stone-300/80 bg-stone-500/5 hover:bg-stone-500/10 text-stone-800`), using subtle colored accent icons or indicator dots for entity differentiation (e.g., emerald icon for Customer, orange icon for Hardware, amber icon for Date Range, stone icon for Center). This maintains serene visual rhythm without creating multi-colored background clutter.
  - **Tier 2: Table Row Status & Role Badges**: Vibrant earth tones are reserved strictly for row-level entity classification and status tags:
    - **Signature Tea-Moss / Primary**: `--primary` (`#66684f`), `bg-primary/10`, `border-primary/30`, `text-primary` (active navigation, sort priority capsules, operator role, primary actions).
    - **Terracotta Orange**: `text-orange-900 border-orange-300/80 bg-orange-600/10 dark:text-orange-200 dark:border-orange-800/50 dark:bg-orange-950/30` (Hardware source, hardware creator accounts, and hardware role).
    - **Deep Forest Emerald**: `text-emerald-900 border-emerald-300/80 bg-emerald-600/10 dark:text-emerald-200 dark:border-emerald-800/50 dark:bg-emerald-950/30` (Customers and customer role).
    - **Golden Honey Amber**: `text-amber-900 border-amber-300/80 bg-amber-600/10 dark:text-amber-200 dark:border-amber-800/50 dark:bg-amber-950/30` (Date range filters and Manager role).
    - **Warm Natural Stone**: `text-stone-800 border-stone-300/80 bg-stone-500/10 dark:text-stone-200 dark:border-stone-700/80 dark:bg-stone-900/30` (Centers and Base user role).
    - **Monochrome Zinc**: `text-zinc-900 border-zinc-300 bg-zinc-600/10 dark:text-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/40` (Admin role and neutral utility controls).

## 16. Unified Feature Module Barrel Exports (`index.ts`)

**In reusable feature modules (such as `components/data-table/`), maintain an authoritative `index.ts` barrel file.**

- **Module-Level Exports**: All public components, hooks, utilities, and types within a reusable feature module must be exported from its root `index.ts`.
- **Clean Call Sites**: Callers MUST import directly from the module root (e.g. `@/components/data-table`) rather than scattering multi-line deep imports (e.g. `@/components/data-table/data-table-content`, `@/components/data-table/use-data-table`).
- **Unified Surface**: Keeps imports cohesive, clean, and prevents circular dependencies or duplicate definitions across consuming pages and components.

## 17. Strict Zero Default Fallback Props in Component Signatures

**Never assign speculative default fallback values to component props in parameter destructuring.**

- **No Masking Caller Intent**: In custom and feature components, NEVER assign arbitrary default values in prop destructuring (e.g. `isValid = true`, `submitLabel = "Save Changes"`, `title = "Default"`, `showIcon = true`).
- **Explicit Call Sites**: Every prop that controls behavioral flow, validation, action labels, or callback triggers must be declared strictly mandatory (`isValid: boolean`, `submitLabel: string`) in the TypeScript interface and explicitly passed by each consuming component.
- **Minimum Prop Surface**: If a value is constant or never varied across callers, hardcode it directly in the component rather than adding a configurable prop with a default fallback.

## 18. Universal Zod Validation Across Codebase (Zero Manual Parsing/Validation)

**Across the entire codebase outside `components/ui/`, all validation must strictly use Zod schemas.**

- **Zero Manual Parsing/Validation**: Strictly prohibit manual `isNaN(...)` checks, ad-hoc string splitting or regex parsing without Zod schemas, manual range checks, or custom type-assertion checks.
- **Query Parameter Validation**: Validate all URL search parameters (pagination, sorting, date ranges, entity IDs, comma-separated lists, enum filters, search strings) using declared, typed Zod schemas with `.parse()` or `.safeParse()`.
- **Payload & Body Validation**: Validate all API request bodies (POST, PATCH, DELETE) and cookie payloads using strict Zod schemas with descriptive error messages.
- **Frontend Filter Sanitization**: Validate and transform active table filter states, options matching, and fallback derivations through Zod schemas.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
