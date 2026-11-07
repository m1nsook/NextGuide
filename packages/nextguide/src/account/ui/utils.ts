import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Account-only shadcn class merging; does not alter public docs styling. */
export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values))
}
