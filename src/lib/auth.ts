import { SignJWT, jwtVerify } from "jose";

const DEV_FALLBACK_JWT_SECRET = "super-secret-key-for-jwt-development";

function getEncodedSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable must be set in production");
    }
    return new TextEncoder().encode(DEV_FALLBACK_JWT_SECRET);
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  photo?: string | null;
  canManageMaintenance?: boolean;
  canViewTeamLogs?: boolean;
  preferredLocale?: string;
  preferredTheme?: string;
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(getEncodedSecret());
}

export async function decrypt(session: string | undefined = ""): Promise<SessionPayload | null> {
  try {
    if (!session) return null;
    const { payload } = await jwtVerify(session, getEncodedSecret(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Determine whether the active session has Maintenance & Asset Admin permissions.
 * Uses database-backed `canManageMaintenance` flag and Admin role.
 */
export function isMaintenanceAdmin(
  session: { role?: string | null; canManageMaintenance?: boolean | null } | null | undefined
): boolean {
  if (!session) return false;
  if (session.canManageMaintenance) return true;
  return session.role?.toLowerCase() === "admin";
}

/**
 * Authorize scheduled cron endpoint calls. Fails closed if CRON_SECRET is unset.
 * Accepts either `Authorization: Bearer <secret>` (Docker cron) or `x-cron-secret: <secret>`.
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret === expected) return true;

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() === expected;
  }

  return false;
}
