"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { User, Lock, Globe, HelpCircle, LogOut } from "lucide-react";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const router = useRouter();

  // Profile state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Language state
  const [currentLocale, setCurrentLocale] = useState("ar");

  useEffect(() => {
    setCurrentLocale(document.documentElement.lang || "ar");
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setName(data.name || "");
        setEmail(data.email || "");
      }
    } catch {
      // Silently fail - user can retry
    }
  }

  async function handleProfileSave() {
    setProfileLoading(true);
    setProfileMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfileMessage({ type: "success", text: tc("success") });
      } else {
        setProfileMessage({ type: "error", text: data.error || tc("error") });
      }
    } catch {
      setProfileMessage({ type: "error", text: tc("error") });
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordChange() {
    setPasswordLoading(true);
    setPasswordMessage(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMessage({ type: "success", text: t("passwordChanged") });
        setCurrentPassword("");
        setNewPassword("");
      } else {
        setPasswordMessage({ type: "error", text: data.error || tc("error") });
      }
    } catch {
      setPasswordMessage({ type: "error", text: tc("error") });
    } finally {
      setPasswordLoading(false);
    }
  }

  function handleLanguageToggle(locale: string) {
    document.cookie = `locale=${locale};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Strict`;
    setCurrentLocale(locale);
    router.refresh();
  }

  return (
    <div>
      <Header title={t("title")} />
      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-teal-600" />
              {t("updateProfile")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{ta("name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{ta("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {profileMessage && (
              <p className={`text-sm ${profileMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                {profileMessage.text}
              </p>
            )}
            <Button onClick={handleProfileSave} disabled={profileLoading}>
              {profileLoading ? tc("loading") : tc("save")}
            </Button>
          </CardContent>
        </Card>

        {/* Change Password Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-teal-600" />
              {t("changePassword")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("newPassword")}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-gray-500">{ta("passwordRequirements")}</p>
            </div>
            {passwordMessage && (
              <p className={`text-sm ${passwordMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                {passwordMessage.text}
              </p>
            )}
            <Button onClick={handlePasswordChange} disabled={passwordLoading}>
              {passwordLoading ? tc("loading") : tc("save")}
            </Button>
          </CardContent>
        </Card>

        {/* Language Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-teal-600" />
              {t("language")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                variant={currentLocale === "ar" ? "default" : "outline"}
                onClick={() => handleLanguageToggle("ar")}
              >
                {t("arabic")}
              </Button>
              <Button
                variant={currentLocale === "en" ? "default" : "outline"}
                onClick={() => handleLanguageToggle("en")}
              >
                {t("english")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Support Ticket */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-teal-600" />
              {t("openTicket")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => router.push("/tickets?new=true")}
            >
              <HelpCircle className="h-4 w-4" />
              {t("openTicket")}
            </Button>
          </CardContent>
        </Card>

        {/* Logout */}
        <Card>
          <CardContent className="pt-6">
            <Button
              variant="destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full"
            >
              <LogOut className="h-4 w-4" />
              {ta("logout")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
