"use client"

import * as React from "react"
import { ChevronRight, LoaderCircle } from "lucide-react"

const join = (...tokens: (string | undefined)[]) => tokens.filter(Boolean).join(" ")

export function Separator({ orientation = "horizontal", className, ...props }: React.ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return <div role="separator" aria-orientation={orientation} className={join("ng-separator", "ng-separator-" + orientation, className)} {...props} />
}
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden="true" className={join("ng-skeleton", className)} {...props} />
}
export function Spinner({ className, ...props }: React.ComponentProps<typeof LoaderCircle>) {
  return <LoaderCircle aria-label="Loading" role="status" className={join("ng-spinner", className)} {...props} />
}
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd className={join("ng-kbd", className)} {...props} />
}

export function Alert({ className, tone = "default", ...props }: React.ComponentProps<"div"> & { tone?: "default" | "success" | "warning" | "danger" }) {
  return <div role={tone === "danger" ? "alert" : "note"} className={join("ng-alert", "ng-alert-" + tone, className)} {...props} />
}
export function AlertTitle({ className, ...props }: React.ComponentProps<"h4">) {
  return <h4 className={join("ng-alert-title", className)} {...props} />
}
export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={join("ng-alert-description", className)} {...props} />
}

export function Avatar({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={join("ng-avatar", className)} {...props} />
}
export function AvatarImage({ className, alt = "", ...props }: React.ComponentProps<"img">) {
  return <img alt={alt} className={join("ng-avatar-image", className)} {...props} />
}
export function AvatarFallback({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={join("ng-avatar-fallback", className)} {...props} />
}

export function Progress({ className, value = 0, max = 100, ...props }: React.ComponentProps<"progress">) {
  return <progress className={join("ng-progress", className)} value={value} max={max} {...props} />
}
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={join("ng-native-select", className)} {...props} />
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <div className="ng-table-scroller"><table className={join("ng-table", className)} {...props} /></div>
}
export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={join("ng-table-header", className)} {...props} />
}
export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={join("ng-table-body", className)} {...props} />
}
export function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <tfoot className={join("ng-table-footer", className)} {...props} />
}
export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={join("ng-table-row", className)} {...props} />
}
export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return <th className={join("ng-table-head", className)} {...props} />
}
export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={join("ng-table-cell", className)} {...props} />
}
export function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={join("ng-table-caption", className)} {...props} />
}

export function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return <nav aria-label="Breadcrumb" className={join("ng-breadcrumb", className)} {...props} />
}
export function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return <ol className={join("ng-breadcrumb-list", className)} {...props} />
}
export function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={join("ng-breadcrumb-item", className)} {...props} />
}
export function BreadcrumbLink({ className, ...props }: React.ComponentProps<"a">) {
  return <a className={join("ng-breadcrumb-link", className)} {...props} />
}
export function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return <span aria-current="page" className={join("ng-breadcrumb-page", className)} {...props} />
}
export function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) {
  return <li aria-hidden="true" className={join("ng-breadcrumb-separator", className)} {...props}>{children ?? <ChevronRight size={13} />}</li>
}

export function EmptyState({ title, description, action, className }: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return <section className={join("ng-empty-state", className)}>
    <h3>{title}</h3>{description ? <p>{description}</p> : null}{action}
  </section>
}
export function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={join("ng-field", className)} {...props} />
}
export function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={join("ng-field-description", className)} {...props} />
}
export function FieldError({ className, ...props }: React.ComponentProps<"p">) {
  return <p role="alert" className={join("ng-field-error", className)} {...props} />
}
