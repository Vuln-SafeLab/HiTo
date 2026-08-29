import { Prisma } from "@prisma/client";
import { DatabaseNotConfiguredError } from "@/lib/db";

export interface FriendlyDbError {
  code: string;
  message: string;
}

// Never leak stack traces or connection strings in production; single funnel for DB error output
export function toFriendlyDbError(error: unknown): FriendlyDbError {
  if (error instanceof DatabaseNotConfiguredError) {
    return {
      code: "NOT_CONFIGURED",
      message: "Database is not configured yet. Complete the setup wizard at /setup.",
    };
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    const errorCode = error.errorCode ?? "INIT";
    switch (errorCode) {
      case "P1000":
        return {
          code: "P1000",
          message: "The database rejected the credentials. Check the user and password.",
        };
      case "P1001":
        return {
          code: "P1001",
          message:
            "Could not reach the database server. Check that MySQL is running and the host/port are correct (local dev: `docker compose up -d`).",
        };
      case "P1003":
        return {
          code: "P1003",
          message: "The database exists but the schema is missing. Run `pnpm db:deploy`.",
        };
      case "P1017":
        return {
          code: "P1017",
          message: "The database server closed the connection. Check pool limits and server timeouts.",
        };
      default:
        return {
          code: errorCode,
          message: "Could not initialize the database connection. Check DATABASE_URL.",
        };
    }
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return {
        code: "P2021",
        message: "A required table is missing. Run `pnpm db:deploy` to apply migrations.",
      };
    }
    return { code: error.code, message: "The database rejected the operation." };
  }
  return { code: "UNKNOWN", message: "Unexpected database error. Check the server logs." };
}
