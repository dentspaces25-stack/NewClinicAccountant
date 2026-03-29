"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  Settings,
  HelpCircle,
  Shield,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";

interface SidebarProps {
  userRole: "DOCTOR" | "ADMIN";
  userName: string;
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: "/", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/clinics", label: t("clinics"), icon: Building2 },
    { href: "/transactions", label: t("transactions"), icon: Receipt },
    { href: "/settings", label: t("settings"), icon: Settings },
    { href: "/tickets", label: t("tickets"), icon: HelpCircle },
  ];

  if (userRole === "ADMIN") {
    links.push({ href: "/admin", label: t("admin"), icon: Shield });
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const navContent = (
    <>
      {/* Logo / App name */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-gray-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-lg">
          C
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">
            {userName}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {userRole === "ADMIN" ? "Admin" : "Doctor"}
          </p>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1 p-3">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActive(link.href) ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="sidebar-link w-full text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>{tAuth("logout")}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="fixed top-4 start-4 z-50 lg:hidden rounded-lg bg-white p-2 shadow-md border border-gray-200"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-40 w-64 bg-white border-e border-gray-200 transform transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0 rtl:-translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">{navContent}</div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:start-0 bg-white border-e border-gray-200">
        <div className="flex flex-col h-full">{navContent}</div>
      </aside>
    </>
  );
}
