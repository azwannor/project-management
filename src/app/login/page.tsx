"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  Activity,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useI18n } from "@/i18n";

function sanitizeCallbackUrl(raw: string | null): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(raw)
  ) {
    return "/dashboard";
  }
  try {
    const parsed = new URL(raw, "https://app.local");
    if (parsed.origin !== "https://app.local") {
      return "/dashboard";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/dashboard";
  }
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get("callbackUrl"));

  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(
          res.status === 401
            ? t.auth.invalidCredentials
            : data.error || t.auth.invalidCredentials
        );
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError(t.auth.serverError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[var(--bg-canvas)] cad-grid-pattern flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Subtle architectural concentric orbital rings */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-[-120px] top-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full border border-[var(--border-subtle)]/70 hidden lg:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-[-50px] top-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-[var(--brand-stroke)]/60 hidden lg:block"
      />

      {/* Floating Nimbus Glass Top Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto nimbus-glass rounded-full px-4 sm:px-6 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <Image
            src="/brand/crown-rmp.png"
            alt="Royal Medica"
            width={24}
            height={24}
            className="w-6 h-6 object-contain"
            priority
          />
          <span className="font-heading font-bold text-sm sm:text-[15px] tracking-tight text-[var(--text-ink)]">
            ROYAL MEDICA
          </span>
          <span className="hidden sm:inline-flex font-mono-code text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)]">
            {t.common.appName.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-full p-0.5">
            {(["en", "id"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLocale(lang)}
                className={`font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                  locale === lang
                    ? "bg-[var(--brand)] text-white dark:text-[#161A26]"
                    : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex items-center gap-1.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] rounded-full px-3 py-1.5 font-mono-code text-[10px] font-bold text-[var(--text-ink2)] transition-colors"
          >
            {theme === "dark" ? (
              <>
                <Moon className="w-3.5 h-3.5 text-[var(--brand)]" />
                <span className="hidden sm:inline">{t.common.dark}</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-[var(--warn)]" />
                <span className="hidden sm:inline">{t.common.light}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Split Stage */}
      <main className="relative z-10 w-full max-w-6xl mx-auto my-auto py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Editorial Engineering Summary (Desktop) */}
        <section className="lg:col-span-7 space-y-6 text-left">
          <div className="space-y-3">
            <p className="font-mono-code text-[11px] font-bold tracking-[0.26em] text-[var(--brand)] uppercase">
              PT. ROYAL MEDICALINK PHARMALAB
            </p>
            <h1 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-[42px] leading-[1.12] tracking-tight text-[var(--text-ink)]">
              {t.auth.title}
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-ink2)] max-w-xl leading-relaxed">
              {t.auth.subtitle}
            </p>
          </div>

          <div className="hidden md:grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
            <div className="bg-[var(--bg-surface)]/90 border border-[var(--border-subtle)] rounded-2xl p-4 space-y-1.5">
              <Activity className="w-4 h-4 text-[var(--brand)]" />
              <p className="font-heading font-bold text-xs text-[var(--text-ink)]">
                {t.auth.cardProjectsTitle}
              </p>
              <p className="text-[11.5px] text-[var(--text-muted)] leading-snug">
                {t.auth.cardProjectsDesc}
              </p>
            </div>
            <div className="bg-[var(--bg-surface)]/90 border border-[var(--border-subtle)] rounded-2xl p-4 space-y-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--ok)]" />
              <p className="font-heading font-bold text-xs text-[var(--text-ink)]">
                {t.auth.cardSupportTitle}
              </p>
              <p className="text-[11.5px] text-[var(--text-muted)] leading-snug">
                {t.auth.cardSupportDesc}
              </p>
            </div>
            <div className="bg-[var(--bg-surface)]/90 border border-[var(--border-subtle)] rounded-2xl p-4 space-y-1.5">
              <QrCode className="w-4 h-4 text-[var(--lavender)]" />
              <p className="font-heading font-bold text-xs text-[var(--text-ink)]">
                {t.auth.cardAssetsTitle}
              </p>
              <p className="text-[11.5px] text-[var(--text-muted)] leading-snug">
                {t.auth.cardAssetsDesc}
              </p>
            </div>
          </div>
        </section>

        {/* Right Sign-In Card */}
        <section className="lg:col-span-5 w-full max-w-md mx-auto lg:max-w-none">
          <div className="bg-[var(--bg-surface)] liquid-metal-border rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/30">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-heading font-bold text-xl text-[var(--text-ink)]">
                  {t.auth.signIn}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t.auth.sessionMeta}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-stroke)] text-[var(--ok)]">
                <CheckCircle2 className="w-3 h-3" />
                LIVE
              </span>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] text-xs font-semibold px-3.5 py-3 rounded-xl flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block font-mono-code text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-ink2)] mb-1.5">
                  {t.auth.email}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@royalmedicalink.id"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono-code text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-ink2)] mb-1.5">
                  {t.auth.password}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-ink)] p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>{t.auth.signIn}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <span>
          &copy; {new Date().getFullYear()} PT. Royal Medicalink Pharmalab · Internal IT Division
        </span>
        <span className="font-mono-code text-[10px]">
          Self-Hosted PostgreSQL 17 · MinIO S3 · PWA Ready
        </span>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4 text-sm text-[var(--text-muted)]">
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
