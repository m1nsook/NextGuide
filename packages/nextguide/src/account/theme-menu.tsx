"use client"

import { Check, Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "../ui/index.js"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/interactive.js"

/**
 * Compact shadcn-style appearance menu, shared by setup and Studio.
 * Uses the same Radix dropdown and next-themes provider as the docs.
 */
export function AccountThemeMenu() {
  const { theme, setTheme } = useTheme()
  const options = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
  ] as const
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon"
          aria-label="Change appearance" title="Change appearance"
          className="relative size-9 shrink-0 rounded-md border-border bg-background text-foreground shadow-none hover:bg-muted">
          <Sun aria-hidden="true" className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          <Moon aria-hidden="true" className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Change appearance</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {options.map(({ value, label, Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}
            className="flex items-center gap-2">
            <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
            <span className="flex-1">{label}</span>
            {theme === value ? <Check aria-hidden="true" className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
