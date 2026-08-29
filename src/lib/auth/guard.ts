import { cache } from "react";
import type { Role } from "@/lib/app-enums";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/constants";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { findValidSessionById, findValidSessionByToken } from "@/lib/auth/session";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  sessionId: string;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();

  const accessToken = store.get(ACCESS_COOKIE)?.value;
  if (accessToken !== undefined && accessToken !== "") {
    const payload = await verifyAccessToken(accessToken);
    if (payload !== null) {
      const session = await findValidSessionById(payload.sid).catch(() => null);
      if (session !== null && session.user.isActive && session.userId === payload.sub) {
        return toSessionUser(session.user, session.id);
      }
    }
  }

  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (refreshToken !== undefined && refreshToken !== "") {
    const session = await findValidSessionByToken(refreshToken).catch(() => null);
    if (session !== null && session.user.isActive) {
      return toSessionUser(session.user, session.id);
    }
  }

  return null;
});

function toSessionUser(
  user: { id: string; username: string; email: string; role: string },
  sessionId: string
): SessionUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role as Role,
    sessionId,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user === null) {
    redirect("/admin/login");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    forbidden();
  }
  return user;
}
