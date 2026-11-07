"use client"

import * as React from "react"
import { ThemeProvider } from "next-themes"
import { TooltipProvider } from "./ui/tooltip.js"

/** Account Mode is a separate Base UI surface; public docs keep their own providers. */
export function AccountProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delay={250}>{children}</TooltipProvider>
    </ThemeProvider>
  )
}
