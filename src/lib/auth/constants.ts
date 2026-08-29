// Cookie names live in their own file: middleware (edge runtime) only needs the names for coarse
// checks and must not pull in modules that depend on node:crypto / Prisma into the edge bundle.
// Legacy names retained through a rebrand — changing them invalidates all existing sessions, do not edit.
export const ACCESS_COOKIE = "navsite_access";
// Legacy name (see above), do not edit.
export const REFRESH_COOKIE = "navsite_refresh";
