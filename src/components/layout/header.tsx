"use client";

import { useTranslations } from "next-intl";
import { LanguageToggle } from "./language-toggle";

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function Header({ title, children }: HeaderProps) {
  const t = useTranslations("common");
  return (
    <header className="sticky top-0 z-30 glass border-b border-gray-200">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          {/* Spacer for mobile hamburger button */}
          <div className="w-10 lg:hidden" />
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {children}
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
