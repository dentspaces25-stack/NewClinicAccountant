"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const v = useTranslations("validation");
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2) errors.name = v("nameMin");
    if (form.name.trim().length > 100) errors.name = v("nameMax");
    const phoneClean = form.phone.trim();
    if (phoneClean.length < 8) errors.phone = v("phoneMin");
    if (phoneClean.length > 20) errors.phone = v("phoneMax");
    if (!/^[\d+\-\s()]+$/.test(phoneClean)) errors.phone = v("phoneInvalid");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = v("emailInvalid");
    const pw = form.password;
    if (pw.length < 8) errors.password = v("passwordMin");
    else if (pw.length > 128) errors.password = v("passwordMax");
    else if (!/[A-Z]/.test(pw)) errors.password = v("passwordUppercase");
    else if (!/[a-z]/.test(pw)) errors.password = v("passwordLowercase");
    else if (!/[0-9]/.test(pw)) errors.password = v("passwordDigit");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateForm()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) setError(v("tooManyAttempts"));
        else if (res.status === 409) setError(v("accountExists"));
        else if (data.details) {
          const mapped: Record<string, string> = {};
          for (const [field, msgs] of Object.entries(data.details)) mapped[field] = (msgs as string[])[0] || v("required");
          setFieldErrors(mapped);
        } else setError(v("serverError"));
        return;
      }
      router.push("/login?registered=true");
    } catch { setError(v("networkError")); }
    finally { setLoading(false); }
  };

  const inputClass = (field: string) => fieldErrors[field] ? "border-red-400 focus-visible:ring-red-500" : "";

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
            <CardTitle className="text-2xl">{t("registerTitle")}</CardTitle>
            <CardDescription>{t("registerSubtitle")}</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
              )}

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="block">{t("name")}</Label>
                <Input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  required
                  autoComplete="name"
                  className={`text-right ${inputClass("name")}`}
                />
                {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="block">{t("phone")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="1XXXXXXXXX"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  required
                  autoComplete="tel"
                  dir="ltr"
                  className={`text-right ${inputClass("phone")}`}
                />
                {fieldErrors.phone && <p className="text-xs text-red-600">{fieldErrors.phone}</p>}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="block">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  autoComplete="email"
                  dir="ltr"
                  className={`text-right ${inputClass("email")}`}
                />
                {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="block">{t("password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    required
                    autoComplete="new-password"
                    dir="ltr"
                    className={`text-right ps-10 ${inputClass("password")}`}
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
                <p className="text-xs text-gray-500">{t("passwordRequirements")}</p>
                {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("register")}
              </Button>
              <p className="text-sm text-gray-500">
                {t("hasAccount")}{" "}
                <Link href="/login" className="text-teal-600 font-medium hover:underline">{t("login")}</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
