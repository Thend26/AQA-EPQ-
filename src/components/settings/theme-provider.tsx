"use client";

import { type ReactNode, useEffect } from "react";

import { defaultUserSettings, type UserSettings } from "@/lib/settings/schema";
import { themeVariables } from "@/lib/settings/theme";

export function ThemeProvider({
  children,
  settings = defaultUserSettings,
}: {
  children: ReactNode;
  settings?: UserSettings;
}) {
  useEffect(() => {
    const variables = themeVariables(settings);
    for (const [name, value] of Object.entries(variables)) {
      document.documentElement.style.setProperty(name, value);
    }
  }, [settings]);

  return <>{children}</>;
}
