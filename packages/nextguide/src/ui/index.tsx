"use client"

import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values))
}

export const buttonVariants = cva("ng-button", {
  variants: {
    variant: {
      default: "ng-button--default",
      secondary: "ng-button--secondary",
      destructive: "ng-button--destructive",
      outline: "ng-button--outline",
      ghost: "ng-button--ghost",
      link: "ng-button--link",
    },
    size: { default: "ng-button--md", sm: "ng-button--sm", lg: "ng-button--lg", icon: "ng-button--icon" },
  },
  defaultVariants: { variant: "default", size: "default" },
})

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ className, variant = "default", size = "default", asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button"
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card" className={cn("ng-card", className)} {...props} />
}
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("ng-card-header", className)} {...props} />
}
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("ng-card-title", className)} {...props} />
}
export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("ng-card-content", className)} {...props} />
}
export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("ng-card-footer", className)} {...props} />
}
export function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="badge" className={cn("ng-badge", className)} {...props} />
}
export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" type={type} className={cn("ng-input", className)} {...props} />
}
export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("ng-label", className)} {...props} />
}
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn("ng-textarea", className)} {...props} />
}
