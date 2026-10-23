/**
 * @file lib/constants/routes.ts
 * @description Route constants and route protection groupings.
 */

export const AppRoutes = {
  HOME: "/",
  LOGIN: "/login",
  ACCOUNT: "/account",
  SERVICES: "/services",
  TICKETS: "/tickets",
  SUPPORT: "/support",
  FEEDBACK: "/support",
} as const;

export type AppRoute = (typeof AppRoutes)[keyof typeof AppRoutes];
export type AppRoutes = AppRoute;

export const ApiRoutes = {
  AUTH_LOGIN: "/api/auth/login",
  AUTH_LOGOUT: "/api/auth/logout",
  AUTH_ME: "/api/auth/me",
  CUSTOMERS: "/api/customers",
  CENTERS: "/api/centers",
  RATES: "/api/rates",
  ENTRIES: "/api/entries",
  WEIGHMENTS: "/api/weighments",
  COMMODITIES: "/api/commodities",
  USERS: "/api/users",
  SETTINGS: "/api/settings",
  TICKETS: "/api/tickets",
  HEALTH: "/api/health",
  DATA: "/api/data",
} as const;

export type ApiRoute = (typeof ApiRoutes)[keyof typeof ApiRoutes];
export type ApiRoutes = ApiRoute;

export const AUTH_ROUTES: readonly string[] = [AppRoutes.LOGIN];
export const PUBLIC_ROUTES: readonly string[] = [AppRoutes.SERVICES];
export const PUBLIC_API_ROUTES: readonly string[] = [
  ApiRoutes.AUTH_LOGIN,
  ApiRoutes.HEALTH,
  ApiRoutes.DATA,
];
