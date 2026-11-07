import type { MDXComponents } from "nextguide/mdx"
import type { ComponentProps } from "react"
import { staticHref } from "@/lib/static-href"
import { CodeBlock, Docs, Markdown, MethodBadge, OpenAPI, Pre } from "nextguide/components"
import { Callout, Card, Cards } from "./callout"
import { ClientParseDemo } from "./demos/client-parse-demo"
import { ApiPreview, EdgeCasePreview, Preview } from "./demos/preview"
import { Install, Tab, Tabs } from "./install"
import { MdxLink } from "./mdx-link"
import { CodeWindow, CodeTabs, FileTree, Steps, Step, LinkCards, LinkCard as PackageLinkCard } from "nextguide/blocks"
import { Button, Badge, Alert, AlertTitle, AlertDescription, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Progress, Kbd, ScrollArea, ScrollAreaViewport, ScrollBar, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem, Accordion, AccordionItem, AccordionTrigger, AccordionContent, Tabs as UiTabs, TabsList, TabsTrigger, TabsContent, Separator, Skeleton, Input, Label, Switch, Checkbox, Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose, Textarea, NativeSelect, Spinner, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink as PackageBreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "nextguide/ui"

/** Preserve the official NextGuide MDX component, adjusting only its plain-anchor URL. */
function OfficialBreadcrumbLink(props: ComponentProps<typeof PackageBreadcrumbLink>) {
  return <PackageBreadcrumbLink {...props} href={typeof props.href === "string" ? staticHref(props.href) : props.href} />
}

function OfficialLinkCard(props: ComponentProps<typeof PackageLinkCard>) {
  return <PackageLinkCard {...props} href={staticHref(props.href)} />
}

/**
 * Components available in server-rendered MDX (live demos included).
 * `OpenAPI` and `Docs` are namespaces (`<OpenAPI.Operation />`), which MDX
 * supports but `MDXComponents`' types don't model, hence the cast.
 */
export const mdxComponents = {
  table: (props: React.ComponentProps<"table">) => (
    <div className="my-6 w-full overflow-x-auto">
      <table {...props} />
    </div>
  ),
  a: MdxLink,
  pre: Pre,
  Callout,
  Install,
  Tabs,
  Tab,
  Cards,
  Card,
  Preview,
  ApiPreview,
  EdgeCasePreview,
  ClientParseDemo,
  OpenAPI,
  Docs,
  CodeBlock,
  Markdown,
  MethodBadge,
  CodeWindow,
  CodeTabs,
  FileTree,
  Steps,
  Step,
  LinkCards,
  LinkCard: OfficialLinkCard,
  Button,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Progress,
  Kbd,
  ScrollArea,
  ScrollAreaViewport,
  ScrollBar,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  UiTabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Separator,
  Skeleton,
  Input,
  Label,
  Switch,
  Checkbox,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  Textarea,
  NativeSelect,
  Spinner,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink: OfficialBreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} as unknown as MDXComponents
