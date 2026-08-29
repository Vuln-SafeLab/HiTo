import { timingSafeEqual } from "node:crypto";
import { getClientIp } from "@/lib/security/ip";

function allowedOverride(): string[] {
  return (process.env.SETUP_ALLOW_IPS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

function tokenAllowed(headers: Headers): boolean {
  const expectedToken = process.env.SETUP_TOKEN;
  if (expectedToken === undefined || expectedToken === "") return false;
  const provided = headers.get("x-setup-token");
  if (provided === null) return false;
  const expected = Buffer.from(expectedToken, "utf8");
  const got = Buffer.from(provided, "utf8");
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

export async function isSetupAllowed(headers: Headers): Promise<boolean> {
  const allowIps = allowedOverride();
  const hasToken = (process.env.SETUP_TOKEN ?? "").trim() !== "";
  // Default (no SETUP_ALLOW_IPS / no SETUP_TOKEN configured): the documented flow —
  // clone, start, walk the wizard from any address — must work out of the box.
  // The window is short (wizard locks permanently once installed). Operators on
  // exposed servers can opt into strict mode by setting either variable.
  if (allowIps.length === 0 && !hasToken) return true;

  const clientIp = getClientIp(headers);
  if (allowIps.includes(clientIp)) return true;
  if (tokenAllowed(headers)) return true;
  // Strict mode: setup authorization requires an explicit trust anchor. Never derive
  // the setup pin from XFF/X-Real-IP — those headers are client-controlled even with
  // TRUST_PROXY=true. This blocks the takeover path where a remote attacker spoofs
  // XFF to bind the setup pin to themselves and create the first admin.
  return false;
}
