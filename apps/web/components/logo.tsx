import { cn } from "@ariadocs/components"

/**
 * Official NextGuide NG monogram, supplied by the project author.
 * Monochrome SVG uses currentColor in both light and dark themes.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-5 shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1072 1072"
      fill="currentColor"
      role="img"
      aria-label="NextGuide"
    >
      <path fillRule="evenodd" d="M536.000,80.1000 C284.711,80.1000 80.1000,284.711 80.1000,536.000 C80.1000,787.289 284.711,991.000 536.000,991.000 C633.072,991.000 723.028,960.580 796.900,908.784 L399.640,389.877 L397.750,389.877 L397.750,745.000 L396.848,734.147 L396.848,745.159 L321.464,745.159 L321.464,277.499 L402.372,277.499 L675.166,616.453 L673.1000,616.000 L828.963,807.551 L864.101,851.212 C864.134,851.178 864.166,851.142 864.199,851.108 L915.496,914.516 C818.461,1011.801 684.262,1072.000 536.000,1072.000 C239.975,1072.000 -0.000,832.025 -0.000,536.000 C-0.000,239.975 239.975,-0.000 536.000,-0.000 C738.087,-0.000 914.048,111.841 1005.377,276.1000 L910.120,276.1000 C827.974,158.566 691.051,80.1000 536.000,80.1000 ZM750.036,277.499 L750.036,600.965 L673.1000,501.653 L673.1000,276.1000 L674.652,277.565 L674.652,277.499 L750.036,277.499 Z" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>NextGuide</span>
    </span>
  )
}
