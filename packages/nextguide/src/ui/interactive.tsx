"use client"

import * as React from "react"
import {
  Accordion as AccordionPrimitive, Checkbox as CheckboxPrimitive,
  Collapsible as CollapsiblePrimitive, ContextMenu as ContextMenuPrimitive,
  Dialog as DialogPrimitive, DropdownMenu as DropdownPrimitive,
  HoverCard as HoverCardPrimitive, Popover as PopoverPrimitive,
  RadioGroup as RadioPrimitive, ScrollArea as ScrollPrimitive,
  Select as SelectPrimitive, Switch as SwitchPrimitive,
  Tabs as TabsPrimitive, Toggle as TogglePrimitive,
  ToggleGroup as ToggleGroupPrimitive, Tooltip as TooltipPrimitive,
} from "radix-ui"
import { Check, ChevronDown, ChevronRight, Circle } from "lucide-react"
const cn = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ")

export const Tabs = TabsPrimitive.Root
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("ng-tabs-list", className)} {...props} />
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={cn("ng-tabs-trigger", className)} {...props} />
}
export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("ng-tabs-content", className)} {...props} />
}
export const Accordion = AccordionPrimitive.Root
export function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn("ng-accordion-item", className)} {...props} />
}
export function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return <AccordionPrimitive.Header className="ng-accordion-heading">
    <AccordionPrimitive.Trigger className={cn("ng-accordion-trigger", className)} {...props}>
      {children}<ChevronDown size={16} aria-hidden="true" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
}
export function AccordionContent({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return <AccordionPrimitive.Content className={cn("ng-accordion-content", className)} {...props} />
}

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="ng-dialog-overlay" />
    <DialogPrimitive.Content className={cn("ng-dialog-content", className)} {...props}>{children}</DialogPrimitive.Content>
  </DialogPrimitive.Portal>
}
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("ng-dialog-title", className)} {...props} />
}
export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("ng-dialog-description", className)} {...props} />
}
export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("ng-dialog-footer", className)} {...props} />
}
export const AlertDialog = Dialog
export const AlertDialogTrigger = DialogTrigger
export const AlertDialogContent = DialogContent

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export function PopoverContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return <PopoverPrimitive.Portal><PopoverPrimitive.Content className={cn("ng-popover-content", className)}
    sideOffset={sideOffset} {...props} /></PopoverPrimitive.Portal>
}
export const PopoverClose = PopoverPrimitive.Close

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger
export function TooltipContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content className={cn("ng-tooltip-content", className)} sideOffset={sideOffset} {...props} />
  </TooltipPrimitive.Portal>
}

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger
export function DropdownMenuContent({ className, sideOffset = 5, ...props }: React.ComponentProps<typeof DropdownPrimitive.Content>) {
  return <DropdownPrimitive.Portal><DropdownPrimitive.Content className={cn("ng-menu-content", className)}
    sideOffset={sideOffset} {...props} /></DropdownPrimitive.Portal>
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Item>) {
  return <DropdownPrimitive.Item className={cn("ng-menu-item", className)} {...props} />
}
export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label className={cn("ng-menu-label", className)} {...props} />
}
export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn("ng-menu-separator", className)} {...props} />
}
export function DropdownMenuCheckboxItem({ className, children, ...props }: React.ComponentProps<typeof DropdownPrimitive.CheckboxItem>) {
  return <DropdownPrimitive.CheckboxItem className={cn("ng-menu-item", className)} {...props}>
    <DropdownPrimitive.ItemIndicator><Check size={14} aria-hidden="true" /></DropdownPrimitive.ItemIndicator>{children}
  </DropdownPrimitive.CheckboxItem>
}
export const DropdownMenuGroup = DropdownPrimitive.Group
export const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup
export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof DropdownPrimitive.RadioItem>) {
  return <DropdownPrimitive.RadioItem className={cn("ng-menu-item", className)} {...props}>
    <DropdownPrimitive.ItemIndicator><Circle size={7} fill="currentColor" aria-hidden="true" /></DropdownPrimitive.ItemIndicator>{children}
  </DropdownPrimitive.RadioItem>
}

export const CheckboxRoot = CheckboxPrimitive.Root
export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return <CheckboxPrimitive.Root className={cn("ng-checkbox", className)} {...props}>
    <CheckboxPrimitive.Indicator><Check size={14} aria-hidden="true" /></CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
}
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return <SwitchPrimitive.Root className={cn("ng-switch", className)} {...props}><SwitchPrimitive.Thumb className="ng-switch-thumb" /></SwitchPrimitive.Root>
}
export const RadioGroup = RadioPrimitive.Root
export function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioPrimitive.Item>) {
  return <RadioPrimitive.Item className={cn("ng-radio", className)} {...props}>
    <RadioPrimitive.Indicator><Circle size={8} fill="currentColor" aria-hidden="true" /></RadioPrimitive.Indicator>
  </RadioPrimitive.Item>
}
export const Collapsible = CollapsiblePrimitive.Root
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger
export const CollapsibleContent = CollapsiblePrimitive.Content
export const HoverCard = HoverCardPrimitive.Root
export const HoverCardTrigger = HoverCardPrimitive.Trigger
export function HoverCardContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return <HoverCardPrimitive.Portal><HoverCardPrimitive.Content className={cn("ng-popover-content", className)} sideOffset={sideOffset} {...props} /></HoverCardPrimitive.Portal>
}
export const Toggle = TogglePrimitive.Root
export const ToggleGroup = ToggleGroupPrimitive.Root
export function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return <ToggleGroupPrimitive.Item className={cn("ng-toggle-item", className)} {...props} />
}

export const Select = SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value
export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return <SelectPrimitive.Trigger className={cn("ng-select-trigger", className)} {...props}>
    {children}<SelectPrimitive.Icon><ChevronDown size={15} aria-hidden="true" /></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
}
export function SelectContent({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content className={cn("ng-select-content", className)} {...props}>
    <SelectPrimitive.Viewport>{props.children}</SelectPrimitive.Viewport>
  </SelectPrimitive.Content></SelectPrimitive.Portal>
}
export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item className={cn("ng-select-item", className)} {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator><Check size={14} aria-hidden="true" /></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
}
export const SelectGroup = SelectPrimitive.Group
export const SelectLabel = SelectPrimitive.Label
export const SelectSeparator = SelectPrimitive.Separator

export const ScrollArea = ScrollPrimitive.Root
export function ScrollAreaViewport({ className, ...props }: React.ComponentProps<typeof ScrollPrimitive.Viewport>) {
  return <ScrollPrimitive.Viewport className={cn("ng-scroll-viewport", className)} {...props} />
}
export function ScrollBar({ className, orientation = "vertical", ...props }: React.ComponentProps<typeof ScrollPrimitive.Scrollbar>) {
  return <ScrollPrimitive.Scrollbar className={cn("ng-scrollbar", className)}
    orientation={orientation} {...props}>
    <ScrollPrimitive.Thumb className="ng-scroll-thumb" />
  </ScrollPrimitive.Scrollbar>
}

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger
export function ContextMenuContent({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return <ContextMenuPrimitive.Portal><ContextMenuPrimitive.Content className={cn("ng-menu-content", className)} {...props} /></ContextMenuPrimitive.Portal>
}
export const ContextMenuItem = ContextMenuPrimitive.Item

export function Sheet({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />
}
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export function SheetContent({ side = "right", className, children, ...props }:
  React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "left" | "right" | "top" | "bottom" }) {
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="ng-dialog-overlay" />
    <DialogPrimitive.Content data-side={side} className={cn("ng-sheet-content", className)} {...props}>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
}
export const SheetTitle = DialogTitle
export const SheetDescription = DialogDescription

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("ng-sheet-header", className)} {...props} />
}
export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("ng-sheet-footer", className)} {...props} />
}
