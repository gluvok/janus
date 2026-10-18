import {
  Briefcase01Icon,
  Building01Icon,
  ClipboardListIcon,
  CustomerSupportIcon,
  Factory01Icon,
  ImagesIcon,
  Layers01Icon,
  Settings01Icon,
  Ticket01Icon,
  UserGroupIcon,
  UserIcon,
  WeightScale01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

export const appIcons = {
  centers: Building01Icon,
  factory: Factory01Icon,
  receiptImages: ImagesIcon,
  entries: ClipboardListIcon,
  weighments: WeightScale01Icon,
  customers: UserGroupIcon,
  users: UserIcon,
  settings: Settings01Icon,
  tickets: Ticket01Icon,
  support: CustomerSupportIcon,
  services: Briefcase01Icon,
  allFilter: Layers01Icon,
  search: Search01Icon,
} as const;

export type AppIconKey = keyof typeof appIcons;
