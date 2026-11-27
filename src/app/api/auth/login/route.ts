import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { encrypt } from "@/lib/auth";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 10;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function getRateLimitKey(request: Request, email: string): string {
  const fwd = request.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown";
  return `${ip}:${email.trim().toLowerCase()}`;
}

function checkRateLimit(key: string): number | null {
  const now = Date.now();
  const entry = failedAttempts.get(key);
  if (!entry) return null;
  if (now > entry.resetAt) {
    failedAttempts.delete(key);
    return null;
  }
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  }
  return null;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const entry = failedAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    failedAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
  if (failedAttempts.size > 5000) {
    for (const [k, v] of failedAttempts.entries()) {
      if (now > v.resetAt) failedAttempts.delete(k);
    }
  }
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const rateKey = getRateLimitKey(request, String(email));
    const retryAfter = checkRateLimit(rateKey);
    if (retryAfter !== null) {
      return NextResponse.json(
        { error: "Too many failed login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).trim() },
    });

    if (!user) {
      recordFailure(rateKey);
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (user.isActive === false) {
      return NextResponse.json({ error: "Account has been deactivated" }, { status: 403 });
    }

    const isPasswordValid = await bcrypt.compare(String(password), user.password);
    if (!isPasswordValid) {
      recordFailure(rateKey);
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    failedAttempts.delete(rateKey);

    const sessionToken = await encrypt({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      photo: user.photo,
      canManageMaintenance: user.canManageMaintenance,
      canViewTeamLogs: user.canViewTeamLogs,
      preferredLocale: user.preferredLocale,
      preferredTheme: user.preferredTheme,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        canManageMaintenance: user.canManageMaintenance,
        canViewTeamLogs: user.canViewTeamLogs,
        preferredLocale: user.preferredLocale,
        preferredTheme: user.preferredTheme,
      },
    });

    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    if (user.preferredLocale === "en" || user.preferredLocale === "id") {
      response.cookies.set("locale", user.preferredLocale, {
        sameSite: "lax",
        maxAge: 31536000,
        path: "/",
      });
    }
    if (user.preferredTheme === "light" || user.preferredTheme === "dark") {
      response.cookies.set("theme", user.preferredTheme, {
        sameSite: "lax",
        maxAge: 31536000,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Server error occurred" }, { status: 500 });
  }
}
