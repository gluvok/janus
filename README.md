This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Application Navigation

The application features a responsive sidebar (`AppSidebar`) driven by a centralized navigation registry in [`lib/navigation.ts`](lib/navigation.ts) and rendered via the unified [`NavGroup`](components/nav-group.tsx) component across main and secondary sections:

- **Main Navigation** (`mainNavItems`):
  - `Centers` (`/centers`)
  - `Entries` (`/entries`)
  - `Weighments` (`/weighments`)
  - `Customers` (`/customers`)
  - `Users` (`/users`)
- **Secondary Navigation** (`secondaryNavItems`):
  - `Settings` (Interactive modal trigger opening `SettingsDialog` for factory configuration)
  - `Tickets` (`/tickets`)
  - `Support` (`/support`)
  - `Services` (`/services`)
- **User Navigation** (`NavUser`):
  - User avatar with dynamic profile details, initials, and interactive dropdown menu.
  - Interactive **Account Settings Dialog** (`AccountDialog`): Clicking "Account" opens a modal displaying the user's role badge, member since date, and last updated date, with real-time profile editing (Full Name, Username, and optional Password) validated via Zod (`passwordSchema`) and synchronized with `/api/users/me`.
  - Notifications and Log out options.

Navigation routes, metadata, and icons are centrally defined in [`lib/navigation.ts`](lib/navigation.ts) and [`lib/icons.ts`](lib/icons.ts).

The layout integrates `SidebarProvider` and `SidebarInset` with a collapsible sidebar trigger and a dynamic header page title (`AppBreadcrumb`) that reflects the current route without breadcrumb arrows. The sidebar's collapsed/expanded state is persisted across route navigations and page reloads via server-read cookies (`sidebar_state`).

## Design System & Theme Standards

The platform adopts a unified **Rikyū-cha (利休茶)** Japanese roasted matcha / tea-moss green color scheme with subtle Wabi-Sabi warm undertones:

- **Primary Accent (`#66684F`)**: Authoritative Rikyū matcha moss green with pure white text (`#FFFFFF`) and `#52543D` hover states in light mode; softer elevated matcha (`#8A8D6E`) with dark charcoal text (`#14160F`) in dark mode.
- **Ambient Wabi-Sabi Surfaces (`app/globals.css`)**:
  - **Light Mode**: Warm rice-paper/alabaster background (`oklch(0.992 0.005 105)`), subtle tea-wash borders (`oklch(0.915 0.012 105)`), soft muted backgrounds, and crisp card surfaces.
  - **Dark Mode**: Deep forest tea-charcoal background (`oklch(0.155 0.010 105)`), dark matcha card surfaces (`oklch(0.205 0.014 105)`), and soft sage borders.
- **Active Navigation Styling (`components/nav-group.tsx`)**: Active sidebar items receive a soft tea-moss wash (`bg-primary/10`), crisp bold matcha text (`text-primary font-semibold`), and highlighted primary icons.
- **Single Source of Truth Role Badges (`components/role-badge.tsx`)**:
  Enforces an **Earthy Japanese Tea & Botanical Palette** that harmonizes with Rikyū-cha across table columns, account settings, and dialogs:
  - **Admin**: Sumi charcoal ink (`text-zinc-900 border-zinc-300 bg-zinc-600/10 dark:text-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/40`) with `CrownIcon`.
  - **Operator**: Signature Rikyū-cha tea-moss green (`text-primary border-primary/30 bg-primary/10 dark:text-primary dark:border-primary/40 dark:bg-primary/15`) with `HeadsetIcon`.
  - **Manager**: Warm Hōjicha roasted tea bronze (`text-amber-900 border-amber-300/80 bg-amber-600/10 dark:text-amber-200 dark:border-amber-800/50 dark:bg-amber-950/30`) with `Briefcase01Icon`.
  - **Base**: Unglazed warm stone (`text-stone-700 border-stone-300/80 bg-stone-500/10 dark:text-stone-300 dark:border-stone-700/80 dark:bg-stone-900/30`) with `UserIcon`.
- **Interactive Criteria Chips (`components/data-table/`)**: Active date range filters (`DataTableDateRangeChip`) and multi-column sort chips (`SortableSortChip`) feature subtle matcha-tinted borders and backgrounds (`border-primary/25 bg-primary/10 text-primary`) for clear hierarchy and instant visual scanning.
- **Toast Feedback**: Top-right anchored (`top-4 right-4`) with `font-heading` titles and semantic status colors.

## Centers Module & Data Table

The `/centers` route provides a full-featured data table built with **TanStack Table v9** powered by server-side execution directly against Supabase:

- **Backend Endpoint**: `GET /api/centers`
  - Slicing and exact counting: `?page=<N>&pageSize=<N>` (`.range()` + `{ count: "exact" }`)
  - Server-side text search: `?search=<text>` (`.ilike("name", ...)`)
  - Server-side created date range: `?from=<ISO>&to=<ISO>` (`.gte("created_at", ...)`, `.lte("created_at", ...)`)
  - Server-side multi-column sorting: `?sort=col1.asc,col2.desc` (defaults to `id.desc`, sequentially executed via `.order()`)
- **Schema Mapping**: Maps directly to `centers` table in `schema.sql` (`id`, `name`, `created_at`, `updated_at`). 1:1 hardware relationship with `devices` (`id`, `center_id`, `api_key_hash`).
- **Features**:
  - **Server-Side Multi-Column Sorting**: Support for sorting across multiple columns simultaneously with defined precedence (e.g., `Name` -> `Created At` -> `ID`).
  - **Draggable Sort Priority Reordering (`@dnd-kit`)**: When 2 or more sorts are active, sorting chips in the Unified Criteria Bar display drag handles and can be reordered via drag-and-drop powered by `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities`. Dropping a chip immediately reorders sort priority indices (`#1`, `#2`, `#3`), re-queries the backend with the updated precedence (`?sort=...`), and persists to `mesto_tables_state` cookies. Fully touch-ready for mobile/tablet with press-and-hold activation constraints (`TouchSensor`: 250ms hold, 5px tolerance) so swiping to scroll horizontally remains smooth, and desktop pointer distance thresholds (`PointerSensor`: 5px).
  - **Default Backend Ordering**: The backend endpoint defaults to ordering by `id` descending (newest ID first) when no explicit sorting criteria is provided. The frontend initializes with an empty sort state (displaying no default sort chips or header badges) to eliminate user confusion; sort badges and criteria chips appear only when columns are actively sorted.
  - **Unified Active Criteria Bar**: Filters and active sort badges render together in a single compact bar (`Filters: [📅 Date Range (x)] | Sorts: [#1 # ID: ↓ Desc (x)] [#2 📅 Created At: ↑ Asc (x)] Clear all`) with individual dismiss controls and full reset actions. Filter chips display column and option icons, and sort chips display column and directional sort icons (`ArrowUp01Icon`, `ArrowDown01Icon`).
  - **Scoped Datatable Loading & Scoped Refresh (`DataTableRefreshButton`)**: Toolbar (search, combobox, datepicker), active criteria badges, and pagination remain permanently mounted; the loading spinner is scoped exclusively to the table card area, eliminating focus loss and toolbar flicker during searches or pagination. Scoped `<DataTableRefreshButton>` re-executes table queries on demand without whole-page reloads.
  - **Comfortable Density & Remodeled Viewport Layout**: Reclaimed ~50–60px of vertical space by eliminating redundant page-level headings (`<h1>` + `<p>`) and whole-page reloads in favor of route context in `<AppBreadcrumb />` in the top layout bar, allowing datatables and pagination to comfortably fit inside the viewport without page scrolling.
  - **Axios API Client**: Native `fetch` replaced with typed `axios.get()` requests.
  - **Centralized API Query Engine (`lib/api-query.ts`) & `http-status-codes`**: Standardized server-side pagination powered by Zod `.catch().default()` schemas (`parsePagination` with zero fallback math), multi-column sorting (`parseSorting`), date range filtering with inclusive end-of-day normalization (`applyDateRange`), and response formatting (`formatPaginatedResponse`) across all datatable endpoints, along with strict HTTP status code enums (`StatusCodes` from `http-status-codes`) eliminating magic numbers and duplicate routines.
  - **Centralized Utilities (`lib/utils.ts`)**:
    - `getErrorMessage(err, fallback)`: Canonical Axios and Error object message extractor, replacing duplicated 6-line error extraction ternaries across dialogs, cards, and data-table hooks.
    - `formatDateTime(isoString)`: Canonical date-time formatter using `Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" })` with null/invalid-date safeguarding, replacing duplicated inline formatters across column definitions and settings cards.
  - **Modular Scalable Data Table Layer (`components/data-table/`)**: Extracted a fully reusable component layer designed to support any current or future entity data tables (`centers`, `factories`, `users`, `tickets`, etc.) while keeping `components/ui/` primitives completely untouched:
    - **Unified Barrel Export (`components/data-table/index.ts`)**: All components, hooks, and types are exported through an authoritative barrel file, allowing clean consolidated imports (`import { ... } from "@/components/data-table"`).
    - `useDataTable`: Generic, strongly-typed custom hook managing Zustand store persistence, date range conversion, debounced search (300ms), API query serialization, error handling via `getErrorMessage`, auto-fetching, and TanStack Table (`useTable`) instantiation. Eliminates hundreds of lines of duplicate data table setup across pages.
    - `DataTableHydrationCard`: Seamless centered spinner fallback component (zero white box or card border) displayed while dynamic filter options resolve.
    - `DataTableDateRangeChip`: Standardized active date range filter badge consuming `DataTableFilterChip` with formatted date interval and clear button, unifying duplicate chips across all entity tables.
    - `DataTableFilterChip`: Reusable active filter badge engineered at a standardized `h-6` (24px) height with `rounded-md` corners, unified calm natural stone styling (`border-stone-300/80 bg-stone-500/5`), and subtle colored semantic accent icons/dots (`stone`, `emerald`, `orange`, `amber`, `primary`, `zinc`).
    - `SortableSortChip`: Reusable `@dnd-kit` sort priority capsule pill engineered at the exact same `h-6` (24px) height with `rounded-full` corners, tea-moss wash, and compact `size-3.5` numbered priority disks (`#1`, `#2`).
    - `DataTableSearchInput`: Search input with search icon, compact text-xs typography, keyboard-friendly focus management, and dedicated focus ring clearance.
    - `DataTableFacetedFilter`: Authoritative, unified multi-select combobox filter powered by official shadcn Base UI primitives (`components/ui/combobox.tsx`) with inline dismissible chips (`ComboboxChips`, `ComboboxChip`, `ComboboxChipsInput`), dynamic search icon swap (`appIcons.search` when active/focused; leading entity icon when idle), formatted `#Id` prefix (`w-6 mr-1 font-mono tabular-nums text-left shrink-0`), and dynamic placeholder (`All <plural>`, `Search <plural>...`, `Add <singular>...`). Automatically serializes comma-separated entity IDs (e.g. `?center_id=1,2`, `?customer_id=3,4`, `?role=admin,operator`) for cookies and API requests, with selected chips removable via individual `(x)` buttons and omitting duplicate chips from the Criteria Bar. Consolidates all table filter comboboxes (Centers, Customers, Creators, Roles) into a single reusable component.
    - `DataTableCriteriaBar`: Unified active criteria bar structured into 2 dedicated unboxed horizontal lines: a Filter Line with `FilterIcon` and a scoped `Clear filters` button, and an accent Sort Line with `Sorting05Icon`, `@dnd-kit` drag-and-drop sort reordering, and a scoped `Clear sorts` button, with zero enclosing box wrappers for maximum vertical compactness.
    - `DataTableContent`: Reusable TanStack Table container engineered with a content-hugging card (`h-fit max-h-full`) inside a `flex-1 min-h-0` viewport space, eliminating empty card space on small result sets while providing internal scrolling and sticky headers (`sticky top-0 bg-card z-10 shadow-xs`) on 50-row datasets, with a clean centered loading spinner without enclosing card borders and `SearchVisualIcon` empty state when filters yield zero records.
    - `DataTablePagination`: Permanently anchored bottom pagination bar with row selection count, rows-per-page selector (default 15 rows with multiples of 15: 15, 30, 45, 60), interactive Page jump Select dropdown (jumping to any page 1 to totalPages, disabled on 1-page tables), and connected `ButtonGroup` Previous/Next navigation controls, maintaining fixed viewport positioning with muted opacity (`opacity-40 pointer-events-none`) during data loading for zero layout jump.
    - `DataTableViewOptions`: Column visibility dropdown menu.
  - **Clear Typography, Icons & Legibility**: Toolbar controls maintain clean compact sizing, while Base UI combobox popover options and trigger render leading circular status icons (`size-3.5`) alongside `text-xs` option labels for effortless scanning and selection.
  - **Strict shadcn `<Button>` Compliance**: All interactive buttons—including date range dismiss buttons, filter chip remove crosses, sortable chip remove triggers, photo count badges, and `ButtonGroup` navigation items—strictly utilize shadcn `<Button>` primitives (`variant="ghost" size="icon-xs"` or `variant="outline" size="sm"`) with zero raw `<button>` HTML elements.
  - **Clean Responsive 2-Tier Toolbar Layout**: Pure Tailwind CSS responsive layout separating search and primary view actions from entity filtering:
    - **Row 1 (Search & View Controls)**: Dedicated to `DataTableSearchInput` on the left, with `DatePickerWithRange` (`Pick a date`) and `DataTableViewOptions` (Columns dropdown) on the right.
    - **Row 2 (Filters)**: Groups all entity filters (`Center`, `Customer`, `Created by`, `Source`) on the left.
    - **Dynamic Filter Hydration Guard & Coordinated Load**: Displays `<DataTableHydrationCard />` (unified page-centered spinner) on initial mount / reload until a coordinated `Promise.all()` fetching filter options and table entries resolves. Validates stored cookie filters against active database entities and cleans deleted entities to `"all"`. For maximum performance and responsive UX, subsequent pagination, sorting, and search debouncing run exclusively against `/api/entries` without redundant filter re-fetches.
  - **Date Range Picker with Responsive Dual-Calendar & Presets**: Pure Tailwind CSS adaptive popover layout with zero JS hooks: on mobile screens (`< sm`), displays a single-month calendar (`numberOfMonths={1}`) with top horizontal scrollable preset chips; on tablet/desktop (`sm+`), displays a dual-month calendar (`numberOfMonths={2}`) with left vertical preset sidebar. Eliminates horizontal popover clipping and layout shifts during hydration.
  - **Two-Tier Boxless Criteria Lines & Equal Height Chips**: Active filter chips (calm stone container with `rounded-md`) and sort priority chips (tea-moss capsule with `rounded-full`) share an exact matching `h-6` (24px) height, differing strictly by corner radius. Rendered on two dedicated unboxed lines, saving vertical space so the datatable and pagination fit entirely in view without page scrolling.
  - **Photos Column & Interactive Carousel Dialog**:
    - Column header renders dedicated `Image01Icon` with `DataTableColumnHeader`.
    - Rows with photos display an interactive pill badge (`<Button variant="outline" size="xs">`) with `Image01Icon` and photo count.
    - Clicking the photo badge (or selecting "View Photos" in the row actions dropdown) opens `EntryPhotosDialog`, powered by shadcn `Carousel` (`embla-carousel-react`). Features slide navigation arrows, keyboard arrow control, photo counter badge ("Photo 1 of 3"), vehicle details, and jump-to-slide thumbnail navigation dots.
  - **Fluid Responsive Pagination with ButtonGroup**: Clean 2-row layout on mobile viewports: selection summary on row 1 and spaced rows-per-page, page count, and icon-only previous/next controls connected in a unified `ButtonGroup` on row 2, smoothly transitioning to single-line on desktop.
  - **Server-Side Pagination**: TanStack Table `manualPagination` defaulting to 15 rows per page with multiples-of-15 rows-per-page selector (`15, 30, 45, 60`), interactive Page jump Select dropdown (`1` to `totalPages`), and connected Previous/Next buttons via `ButtonGroup`.
  - **Accurate & Stabilized Selection Counter**: Selection count displays `{selectedCount} of {currentRowsCount} row(s) selected.` inside a locked `sm:min-w-48` container with `tabular-nums` formatting, preventing layout shifts or control movement when transitioning between 0, single-digit, and double-digit row counts.
  - **Smart-Grouped Multi-Table Cookie Persistence (`mesto_tables_state`)**: Powered by a server-synchronized cookie store (`stores/use-data-table-store.ts`, `lib/table-cookie.ts`). Retains user preferences (`search`, `filters`, `dateRange`, `sorting`, `pagination.pageSize`, and `columnVisibility`) per entity using a smart-grouped JSON structure:
    ```json
    {
      "mode": "automatic",
      "entries": { "automatic": { ... }, "manual": { ... } },
      "weighments": { "automatic": { ... }, "manual": { ... } },
      "tickets": { "automatic": { ... }, "manual": { ... } },
      "centers": { ... },
      "users": { ... },
      "customers": { ... }
    }
    ```
    Dual-mode status is derived directly from the cookie schema definition (`isDualModeRoute`), eliminating hardcoded route constants. Strictly enforces clean target schemas with zero backward compatibility fallbacks (Rule 19).
  - **Instant SSR Hydration & Zero Layout Shift**: Server Components in `app/layout.tsx` read `mesto_tables_state` synchronously before generating HTML, eliminating client-side hydration delay. Tables and toolbars render immediately on first paint with 0ms mount delay.
  - **Column Visibility & Actions**: Columns dropdown toggle, indeterminate select-all checkbox, and row actions dropdown (`Copy Center ID`, `Copy Center Name`).

## Entries Module & Data Table

The `/entries` route provides an inspection-focused data table for transport and weighbridge entry records built with **TanStack Table v9** powered by server-side execution directly against Supabase:

- **Backend Endpoints**:
  - `GET /api/entries/automatic`: Dedicated endpoint for hardware-captured entries querying `automatic_entries` with joins to `centers`, `users` (customer), and `devices`. Supports search on confirmed plate, detected plate, and weight.
  - `PATCH /api/entries/automatic`: Conditional updates for hardware entries. `vehicle_number` can only be updated if it matches `detected_vehicle_number` (locked once corrected); `customer_id` can only be updated if it is unassigned (`null`). Validates `vehicle_number` against `INDIAN_PLATE_REGEX` and `STATE_CODES`.
  - `GET /api/entries/manual`: Dedicated endpoint for operator-entered entries querying `manual_entries` with joins to `centers`, `users` (customer), and `users` (creator). Schema strictly excludes `factory_id` and `detected_vehicle_number`. Search strictly covers `vehicle_number` and numeric `weight`. Updation of manual entries is not supported.
- **Schema Mapping**: Segregated into symmetrical table pairs in `schema.sql`:
  - `automatic_entries`: Hardware captured via `device_id REFERENCES devices(id)`, `center_id`, `customer_id`, `detected_vehicle_number TEXT NOT NULL DEFAULT 'NO_PLATE_DETECTED'`, `vehicle_number`, `weight`, `images`.
  - `manual_entries`: Operator captured via `creator_id REFERENCES users(id)`, `center_id`, `customer_id`, `vehicle_number`, `weight`, `images`. Strictly omits redundant `factory_id` (resolved via `center_id`) and `detected_vehicle_number`.
  - Corresponding split tables for weighments (`automatic_weighments`, `manual_weighments`) and a consolidated support tickets table (`tickets` linked strictly to `automatic_entries`).
- **Validation & Registration Numbers (`lib/validation/helpers.ts`)**:
  - `INDIAN_PLATE_REGEX`: Validates Indian commercial vehicle registration numbers (`[State Code 2 letters][RTO 1-2 digits][Series 0-3 letters][Number 1-4 digits]`). Non-commercial BH (Bharat) and VA (Vintage) series are strictly excluded.
  - `STATE_CODES`: 40 state/UT codes as `const`.
  - Auto-normalizes vehicle numbers on input/blur by removing whitespace and hyphens, and converting to uppercase.
  - `vehicleNumberSchema`: Zod validator transforming and verifying plate syntax and state codes.
- **Entry Editing Dialog (`AutomaticEntryEditDialog`)**:
  - Supports editing automatic entries (conditionally enabling vehicle plate or customer dropdown based on lock state). Locked fields are displayed as read-only cards with a subtle lock icon.
  - Wired into automatic entry row actions menu via reusable `createActionsColumn`. Manual entries do not support editing.
- **Features & UX**:
  - **Top Layout Header Mode Toggle (`HeaderModeToggle`)**: Powered by the canonical shadcn `ToggleGroup` and `ToggleGroupItem` components with Base UI (`components/ui/toggle-group.tsx`). Connected segmented buttons (`spacing={0}`) inside a recessed container (`bg-muted/60`) with an elevated active card. Dynamically scoped using `isDualModeRoute(pathname)` derived from `DEFAULT_TABLES_COOKIE` in `lib/table-cookie.ts`, rendering strictly on dual-mode routes (`/entries`, `/weighments`, `/tickets`, `/`) and automatically hidden on single-mode pages (`/centers`, `/users`, `/customers`). Enforces mandatory single selection and immediately switches `mode` in the unified table store and cookie.
  - **Full-Screen Booting Up Splash Screen (`BootingScreen`) & Favicon**: Displays a warm minimalist full-screen splash screen (official Mesto brand logo image, delicate spinner, and "Booting up..." text) on browser reload or initial load until client cookie preferences and store hydration complete, unmounting immediately with 0ms delay. The official brand logo is integrated as the application favicon via `app/icon.png` and `metadata.icons`.
  - **Official Brand Logo Integration (`public/logo.png`)**: Displays the official Mesto icon across `BootingScreen`, `AppSidebar` header, and browser favicon.
  - **Combobox Column Alignment**: Center combobox menu items enforce a fixed width (`w-8 tabular-nums`) on `#ID` prefixes to keep center names vertically aligned without horizontal shift across 1-digit, 2-digit, and 3-digit IDs.
  - **Shared Form & Dialog Primitives (`components/form-primitives.tsx`)**: Centralized `FormRequiredNotice`, `FormErrorBanner`, `DialogIconBadge`, and `DialogActionFooter` primitives eliminating duplicate class strings and boilerplate across `UserDialogShell`, `AccountDialog` (compact 2-column Full Name and Username layout), `SettingsDialog`, and `FactoryForm`.
  - **Shared Data Table Column Helpers (`components/data-table/`)**: Standardized `createSelectColumn` helper eliminating duplicate selection checkbox definitions across `Centers`, `Users`, and `Entries` tables.
  - **Centralized Entries API Query Deduplication (`lib/entries-query.ts`)**: Centralizes shared query routines across `/api/entries/automatic` and `/api/entries/manual` (`parseNumericWeight`, `applyIdFilters`, `sortEntriesRelational`, `paginateInMemory`), eliminating duplicate filter parsing, in-memory sorting, and procedural mode branching via declarative mode registries.
  - **Strict Compositional Typing (`app/entries/types.ts`)**: Models entries with `BaseEntry`, `AutomaticEntry`, and `ManualEntry` united as `type Entry = AutomaticEntry | ManualEntry`, accompanied by type guards `isAutomaticEntry` and `isManualEntry`.
  - **Modular Feature Architecture (`components/entries/`)**: Extracted focused, single-responsibility components with unified barrel exports (`components/entries/index.ts`):
    - `EntriesToolbar`: 2-tier responsive layout encapsulating Row 1 search box, refresh button, date range picker, column visibility options, and Row 2 faceted filters with integrated multi-sort priority chips (hidden when `sorting.length <= 1`, completely eliminating the empty 3rd row and saving ~36px vertical space). Supports `sort=none` for natural table ordering upon sort removal.
    - `EntriesErrorState`: Clean error card with retry button.
    - `EntryPhotosDialog`: Embla Carousel dialog for photo browsing.
  - **Multi-Select Center Combobox with Inline Chips**: Center filter uses official shadcn Base UI Combobox primitives (multiple selection with inline chips, individual remove `(x)` triggers, and integrated text search). Serializes multi-center selection as comma-separated IDs (e.g. `?center_id=12,15`) querying Supabase via `.in("center_id", ids)`, with duplicate Center chips omitted from the Criteria Bar to keep active criteria clean and compact.
  - **Zero-Flash Synchronous Render State Sync**: `useDataTable` synchronously synchronizes `initialData` into state during render, eliminating the 1-frame post-paint empty table state and flash of "No entries found" on page reload. `EntriesDataTable` holds `<DataTableHydrationCard />` until both loading completes and initial data is populated.
  - **Smooth Debounced Search & Race-Condition Sequencing**:
    - Keyboard-first search input debounced at 300ms, allowing users to type, edit, and clear terms naturally with standard keyboard shortcuts without redundant API calls.
    - `useDataTable` and `loadInitialData` enforce request sequence tracking (`requestIdRef`), guaranteeing that stale out-of-order responses can never overwrite newer search queries or clears.
  - **Multi-Field Search**: Instant search matching confirmed plate, detected plate, or numeric scale weight on Automatic entries, and vehicle number or weight on Manual entries.
  - **Clean Focused Columns**:
    - **Automatic Mode**: Focused directly on core scale metrics (ID, Vehicle Number, Weight, Center, Customer, Photos, Created At, Updated At) without redundant device columns.
    - **Manual Mode**: Displays `Created By` column with operator name.
  - **Coordinated `Promise.all()` & Dynamic Filter Validation**: Concurrently fetches filter options (`/api/centers`, `/api/users`) and entries in a single `Promise.all()` round-trip on mount behind `<DataTableHydrationCard />`. When an active dynamic filter is present, each page switch validates entity existence, automatically falling back to `"all"` if deleted.
  - **Unified Iconography**:
    - **Customer**: Standardized to `UserGroupIcon` across combobox trigger, dropdown options, table column header, and active criteria chips.
    - **Center**: Standardized to `Building01Icon`.
    - **Device**: Standardized to `CpuIcon`.
  - **Horizontal Scroll Containment**: Constrained with `min-w-0 overflow-x-hidden` on `SidebarInset` and `w-full min-w-0` on table containers, guaranteeing that `min-w-full w-max` tables scroll horizontally strictly inside the data table card with zero window-level horizontal overflow.
  - **Clean Vehicle Number Cell**: Clickable-free, crisp mono font plate typography (`font-mono text-xs font-semibold`).
  - **Updated At Column**: Dedicated sortable timestamp tracking record modifications, formatted with `formatDateTime`.
  - **Row Actions Menu**: Row-level dropdown menu providing one-click "Copy Vehicle Number", "Copy Weight", and "Copy Entry ID".
  - **Full TanStack Table v9 Capabilities**: Drag-and-drop sort priority reordering (`@dnd-kit`), date range picker with presets, column visibility toggling, row selection counter, and responsive `ButtonGroup` pagination.

## Settings Module & Factory Configuration

The `/settings` route provides facility configuration controls powered by the unified `/api/factories` endpoint:

- **Backend Endpoint**: `GET /api/factories` and `PATCH /api/factories`
  - Current-tenant preview hardcoded to Factory ID `1` (architected for seamless migration to session-based authentication).
  - Strict validation using **Zod** (`updateFactorySchema.strict()`): validates `name` (min 1 character) and `receipt_images_per_row` (integer between 1 and 6). Strict rejection with HTTP 400 on unexpected or invalid keys.
- **Schema Mapping**: Maps to `factories` table in `schema.sql` (`id`, `name`, `receipt_images_per_row`, `created_at`, `updated_at`). `camera_crops` and `check_center_on_merge` have been removed from the schema and recorded in `migration.sql`.
- **Features & UX**:
  - **Cohesive Constrained Layout (`max-w-3xl`)**: Constrained layout width prevents overly stretched form fields on wide displays and aligns `<DataTableRefreshButton>` directly with the top right of `<FactoryCard>`.
  - **Clean Loading State**: Renders a centered `<Spinner />` with status message during initial data fetching, eliminating empty card shells.
  - **Dedicated Iconography**: Factory card uses `Factory01Icon` (distinct from Center's `Building01Icon`), Receipt Images uses `ImagesIcon` in the field label (distinct from the 1 per row option `Image01Icon`), and each receipt image row option (1–6) renders specialized layout/grid icons (`Image01Icon`, `LayoutTwoColumnIcon`, `LayoutThreeColumnIcon`, `Grid2x2Icon`, `Layout05Icon`, `Grid3x2Icon`) with dynamic trigger synchronization.
  - **Input Controls**: `<Input>` for factory name and searchable Base UI combobox (`components/ui/combobox.tsx`, values 1–6) for receipt snapshot row layout.
  - **Base UI Toast Feedback**: Integrated notification system powered by `@base-ui/react/toast` with `<Toaster />` anchored at the **top-right** (`top-4 right-4`), featuring fluid downward stack animations, upward swipe dismiss, custom typography (`font-heading` for titles and `font-sans` for descriptions), and semantic status colors (Emerald for success, Amber for warning, Destructive red for error, and Sky blue for info).
  - **Client-Side Zod Validation**: Form validates against `updateFactorySchema` before dispatching updates.
  - **Dirty State Tracking**: Save Changes and Reset buttons detect client form changes with disabled controls when pristine, `<Spinner>` indicators during requests, and inline timestamp tracking.

## Users Administration

Administrative and operational users (`/users`) are managed via `/api/users` and `UsersDataTable`:

- **Backend Endpoints**: `GET`, `POST`, `PATCH`, `DELETE /api/users`, `GET`, `PATCH /api/users/me`
  - **`GET /api/users/me`**: Fetches the active factory administrative account (`admin1`, Factory 1) with complete role, factory, and creation metadata for user profile inspection.
  - **`PATCH /api/users/me`**: Updates the logged-in user's profile (`name`, `username`, and optional `password`). Validates username uniqueness and password length via Zod, re-hashes credentials with Argon2id, and synchronizes profile state across the sidebar and user avatar.
  - **`GET /api/users`**: Multi-column sorting (`id`, `username`, `name`, `role`, `created_at`, `updated_at`), search (across `name` and `username`), role filter, date range filter, and server-side pagination with exact total counts. Excludes `password_hash` from the response. Hardware devices authenticate via `devices.api_key_hash` rather than user accounts.
  - **`POST /api/users`**: Strict Zod validation (`username`, `name`, `role`, `password`), enforces username uniqueness across active accounts (`deleted_at IS NULL`), hashes passwords with Argon2id, and provisions the user for Factory ID 1.
  - **`PATCH /api/users`**: Validates input, verifies username uniqueness if updated, optionally resets and re-hashes passwords with Argon2id when provided, and updates user profile and role.
  - **`DELETE /api/users`**: Supports single (`id`) and bulk (`ids`) deletion. Performs constant O(1) batched pre-flight integrity checks verified against `manual_entries.creator_id` and `manual_tickets.user_id`. Blocks deletion with HTTP 409 Conflict if linked historical records exist. Soft-deletes (`deleted_at: NOW()`) when safe.
  - **Scoped Datatable Refresh**: Includes `<DataTableRefreshButton>` in the toolbar action group for fast, single-click table refreshing.
  - **Modular Architecture & Service Extraction**: Decomposed large files into single-responsibility modules:
    - `app/api/users/service.ts`: Centralizes database queries, Argon2id hashing, and constant O(1) batched conflict checks, keeping `app/api/users/route.ts` as a sleek HTTP routing controller.
    - `app/settings/factory-form.tsx`: Encapsulates the 2-column configuration grid and a clean 2-column metadata strip (Created On, Last Modified).
  - **Design System & Japanese Aesthetic Theme (Rikyū-cha 利休茶)**:
    - Root primary accent uses authentic **Rikyū-cha** roasted matcha / tea moss green (`#66684F` / `rgb(102, 104, 79)`) with pure white text (`#FFFFFF`) and dark hover state (`#52543D`).
    - Dark mode dynamically switches to luminous tea moss (`#8A8D6E`) with charcoal foreground (`#1A1C14`) ensuring optimal readability and contrast across all card and modal surfaces.
    - Synchronized across buttons, sidebar active navigation pills, focus rings, and action highlights.
  - **Shared Form Dirty State Indicator (`components/form-dirty-indicator.tsx`)**:
    - Extracted a reusable, zero-prop-bloat indicator component encapsulating the pulsing status dot (`bg-amber-500 animate-pulse` when dirty vs `bg-emerald-500` when clean) and status label (`"You have unsaved changes."` vs `"All changes saved."`).
    - Standardized across `app/settings/factory-card.tsx` and `app/users/user-dialog-primitives.tsx` (`UserDialogShell`).
  - **Standardized Centered Loading State (`components/loading-state.tsx`)**:
    - Reusable transparent loading pane (`<LoadingState className="..." />`) encapsulating the centered `Spinner` (`size-6 text-primary`), with zero white box, border, or text caption, eliminating any flash of white boxes during data loading or hydration.
    - Consistently used across `components/data-table/data-table-content.tsx` and `components/data-table/data-table-hydration-card.tsx`.
  - **Service Layer Deduplication (`app/api/users/service.ts`)**:
    - Single-source column projection constant (`USER_SELECT_PROJECTION = "id, username, name, role, factory_id, created_at, updated_at"`).
    - Unified username availability assertion helper (`assertUsernameAvailable(username, excludeId)`), eliminating ~35 lines of duplicated query logic and error-handling boilerplate.
    - Generalized relational frequency counting helper (`countOccurrences(items, key)`), eliminating 3 repetitive counting loops in `deleteUserAccounts`.
    - Enforced `StatusCodes` from `http-status-codes` across all error paths, eliminating raw numeric status literals.
  - **Zero-Branching Component & Type Architecture (Strict DRY Compliance)**:
    - **Atomic Form Primitives (`app/users/user-dialog-primitives.tsx`)**: Extracted `UserDialogShell`, `FullNameField`, `CredentialsFields`, and `SystemRoleSelect`.
    - **Dedicated Staff User Dialog (`StaffUserDialog`)**: Renders Full Name & System Role side-by-side, plus Username & Password side-by-side (`sm:grid-cols-2`), validated by `getUserFormSchema`. Both username and password are strictly mandatory for all staff accounts.
    - **Single Clean Schema Architecture (`app/users/types.ts`)**:
      - `createUserSchema` and `updateUserSchema` strictly enforce mandatory username and password hashing across all roles (`admin`, `manager`, `operator`, `base`), completely eliminating discriminated unions or conditional portal access flags.
    - **Declarative API Routing & Domain Services**:
      - `app/api/users/route.ts`: Uses `ROLE_ENTITY_LABELS` lookup dictionary for staff roles.
      - `app/api/users/service.ts`: Enforces mandatory credential creation, password hashing via Argon2id, and relational safety checks against linked weighbridge and audit records with standardized `StatusCodes` from `http-status-codes`.
  - **Universal Comboboxes & Subtle Role Iconography**:
    - System Role dropdown utilizes Base UI combobox (`components/ui/combobox.tsx`) with search and leading role icons (`Admin`: `CrownIcon`, `Manager`: `Briefcase01Icon`, `Operator`: `HeadsetIcon`, `Base`: `UserIcon`).
    - Subtly tinted badges in the data table: Admin uses refined Slate/Neutral (violet/purple removed), and Manager, Operator, Base use gentle 5% background tints and soft muted borders.
  - **Universal React Hook Form & Zod Architecture**:
    - **Form State Delegation (`react-hook-form` + `@hookform/resolvers/zod`)**: All user modals (`StaffUserDialog`) and settings forms (`FactoryCard`) manage state and submission via `useForm` paired with `zodResolver`, eliminating ad-hoc dirty tracking and manual validation branches.
    - **Inline Field Validation (`<FieldError>`)**: Inputs, comboboxes, and password fields render contextual inline `<FieldError>` messages dynamically as users type or change values.
    - **API Search Parameter Delegation (`lib/api-query.ts`)**: Pagination (`page`, `pageSize`) and date range filters are validated and coerced via centralized Zod schemas (`paginationQuerySchema`), eliminating raw fallback arithmetic.
    - **Visual Mandatory Asterisks (`*`) & Notice**: Required fields display `<span className="text-destructive font-semibold">*</span>`, accompanied by `"Fields marked with * are required."` in dialog and card headers.
    - **Direct Zod-Driven Button State (`isValid`) & Zero Layout Shift**: The Save Changes button remains visible in modal footers to prevent jarring layout shifts, is strictly disabled (`disabled={!isDirty || !isValid || isSubmitting}`) until form state evaluates to valid, and retains a constant label with an icon-swap `<Spinner>` during submission for a stable 0px width delta.
    - **Responsive Side-by-Side Layout (`sm:grid-cols-2`)**: Full Name + System Role side-by-side, and Username + Password side-by-side on desktop/tablet, stacking naturally on mobile (`sm:max-w-lg` container).
    - Far-left pinned dirty state badge using `<FormDirtyIndicator>` in modal and card footers.
    - Error banner renders leading `AlertCircleIcon` with accessible alert styling.
    - `Cancel01Icon` leading icon on all modal Cancel buttons.
    - Compact, single-line field descriptions designed for clear scanning without wrapping.

## Customers Module & Data Table

The `/customers` route provides a dedicated data table for managing transport, logistics, and weighbridge customer profiles, cleanly decoupled from user authentication:

- **Backend Endpoint**: `GET /api/customers`, `POST /api/customers`, `PATCH /api/customers`, `DELETE /api/customers`
  - Slicing and exact counting: `?page=<N>&pageSize=<N>` (`.range()` + `{ count: "exact" }`)
  - Server-side text search: `?search=<text>` (`.ilike("name", ...)`)
  - Server-side created date range: `?from=<ISO>&to=<ISO>` (`.gte("created_at", ...)`, `.lte("created_at", ...)`)
  - Server-side multi-column sorting: `?sort=col1.asc,col2.desc` (defaults to `id.desc`)
  - Full list retrieval: `?all=true` for filter dropdown hydration across Entries and Weighments
- **Schema Mapping**: Maps directly to dedicated `customers` table in `schema.sql` (`id`, `name`, `factory_id`, `created_at`, `updated_at`) with unique index on `(factory_id, name)`.
- **Minimal Form Modal (`CustomerFormDialog`)**: Prompts exclusively for **Customer Name**, eliminating credentials or auth requirements. Validated using `createCustomerSchema` with `react-hook-form` and `zodResolver`.
- **Hard Deletion & Foreign Key Protection**: Deleting a customer executes a hard delete enforced by database `ON DELETE RESTRICT` constraints (blocking deletion if linked entries exist) with confirmation dialog and toast notifications.

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Database Seeding

To seed the database with test data matching `schema.sql`:

```bash
# Onboard a new client (provisions a new Factory, auto-indexed Admin, Center, and 1:1 Hardware Pi)
pnpm run seed

# Onboard a client with options (custom factory name, multiple centers, etc.)
pnpm run seed -- --factory "Acme Logistics" --centers 2

# Seed full test demo fixtures (idempotent / additive)
pnpm run seed:test

# Clean reset and re-seed all tables & sequence counters with test fixtures
pnpm run seed:test:clean
```

### High-Volume Test Data & Pagination

Running `pnpm run seed:test` or `pnpm run seed:test:clean` provisions high-volume fixtures specifically tailored for testing TanStack Table pagination, column sorting, and filtering:

- **Zero N+1 Batch Architecture**: All database seeding routines strictly enforce constant O(1) batched lookups (`.in(...)`) and bulk insertions (`.insert([...])`) across factories, users, centers, customers, entries, weighments, and tickets.
- **Factories**: 2 (`Default Factory`, `Apex Agro Logistics`)
- **Users**: Staff accounts in `users` table (`admin`, `manager`, `operator`)
- **Centers**: 50 (35 in Factory 1, 15 in Factory 2) with staggered `created_at` dates (ideal for testing 10, 20, 30, 40, and 50 page sizes)
- **Customers**: 50 customer profiles (`customers` table)
- **Automatic & Manual Entries**: 170 entries (85 automatic entries + 85 manual entries; 60 paired cycles and 50 standalone entries)
- **Automatic & Manual Weighments**: 60 linked inbound/outbound cycles (30 automatic + 30 manual)
- **Automatic & Manual Tickets**: 40 support tickets (20 automatic tickets and 20 manual tickets, linked to entries or weighments with XOR check constraints)

### Seeded Test Credentials

**Factory 1 (`Default Factory`)**:

- **Admin**: `admin1` / `admin123`
- **Manager**: `manager1` / `manager123`
- **Operator**: `operator1`, `operator3`, `operator4`, `operator5` / `operator123`
- **Hardware (Edge Scale)**: `pi1`, `pi3`, `pi4`, `pi5`, `pi6` / `hardware123`

**Factory 2 (`Apex Agro Logistics`)**:

- **Admin**: `admin2` / `admin123`
- **Manager**: `manager2` / `manager123`
- **Operator**: `operator2`, `operator6` / `operator123`
- **Hardware (Edge Scale)**: `pi2`, `pi7`, `pi8` / `hardware123`

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
