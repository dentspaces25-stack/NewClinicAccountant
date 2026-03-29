"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const t = useTranslations("auth");
  const v = useTranslations("validation");
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const phoneClean = phone.trim();
    if (phoneClean.length < 8) errors.phone = v("phoneMin");
    if (!/^[\d+\-\s()]+$/.test(phoneClean) && phoneClean.length > 0) errors.phone = v("phoneInvalid");
    if (!password) errors.password = v("required");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateForm()) return;
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        phone: phone.trim(),
        password,
        redirect: false,
        callbackUrl: "/",
      });

      if (!result) { setError(t("invalidCredentials")); return; }
      if (result.error) {
        setError(result.error === "ACCOUNT_LOCKED" || result.code === "ACCOUNT_LOCKED" ? t("accountLocked") : t("invalidCredentials"));
        return;
      }

      const sessionRes = await fetch("/api/profile");
      if (sessionRes.ok) {
        const profile = await sessionRes.json();
        if (profile.role === "ADMIN") { window.location.href = "/admin"; return; }
      }
      window.location.href = "/";
    } catch {
      setError(t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-teal-50 p-4">
      {/* Language toggle - top corner */}
      <div className="fixed top-4 end-4 z-50">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white font-bold text-2xl shadow-lg shadow-teal-200">
            C
          </div>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl">{t("loginTitle")}</CardTitle>
            <CardDescription>{t("loginSubtitle")}</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {justRegistered && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {t("registrationSuccess")}
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone" className="block">{t("phone")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="1XXXXXXXXX"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setFieldErrors((p) => { const n = { ...p }; delete n.phone; return n; }); }}
                  required
                  autoComplete="tel"
                  dir="ltr"
                  className={`text-right ${fieldErrors.phone ? "border-red-400 focus-visible:ring-red-500" : ""}`}
                />
                {fieldErrors.phone && <p className="text-xs text-red-600">{fieldErrors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="block">{t("password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => { const n = { ...p }; delete n.password; return n; }); }}
                    required
                    autoComplete="current-password"
                    dir="ltr"
                    className={`text-right ps-10 ${fieldErrors.password ? "border-red-400 focus-visible:ring-red-500" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("login")}
              </Button>
              <p className="text-sm text-gray-500">
                {t("noAccount")}{" "}
                <Link href="/register" className="text-teal-600 font-medium hover:underline">{t("register")}</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
