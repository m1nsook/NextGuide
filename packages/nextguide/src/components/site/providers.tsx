"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { TooltipProvider } from "../../ui/interactive.js";

export function Providers({ children, defaultTheme = "dark", enableSystem = false }: { children: React.ReactNode; defaultTheme?: "light" | "dark" | "system"; enableSystem?: boolean }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      disableTransitionOnChange
      enableColorScheme
    >
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    </NextThemesProvider>
  );
}
