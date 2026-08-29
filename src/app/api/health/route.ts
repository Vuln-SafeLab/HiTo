import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { toFriendlyDbError } from "@/lib/db-errors";

// Probe must hit the DB every request; no route caching.
export const dynamic = "force-dynamic";

interface HealthOk {
  status: "ok";
  db: { connected: true; latencyMs: number };
}

interface HealthError {
  status: "error";
  db: { connected: false; code: string; message: string };
}

export async function GET(): Promise<NextResponse<HealthOk | HealthError>> {
  const startedAt = Date.now();
  try {
    // Don't return SELECT VERSION(): DB version is a deployment fingerprint; not exposed on a public endpoint.
    await getDb().$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: {
        connected: true,
        latencyMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    const friendly = toFriendlyDbError(error);
    return NextResponse.json(
      {
        status: "error",
        db: { connected: false, code: friendly.code, message: friendly.message },
      },
      { status: 503 }
    );
  }
}
