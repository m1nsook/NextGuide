export const ACCENTS = Object.freeze({
  blue: { light: "#135eac", dark: "#78b9ff" },
  red: { light: "#b42337", dark: "#ff8892" },
  green: { light: "#116738", dark: "#83e3ac" },
  purple: { light: "#6f38b8", dark: "#c39dff" },
  yellow: { light: "#765100", dark: "#ffd25a" },
  orange: { light: "#934700", dark: "#ffba79" },
  pink: { light: "#a92976", dark: "#ff9bd4" },
  teal: { light: "#006f71", dark: "#76e1d7" },
  cyan: { light: "#006b91", dark: "#7cd6f3" },
  gray: { light: "#4c5c70", dark: "#bec6d7" },
})

export const THEMES = Object.freeze(["light", "dark", "system"])

export function normalizeAppearance(options = {}) {
  const theme = options.theme ?? "system"
  const accent = options.accent ?? "blue"
  if (!THEMES.includes(theme)) throw new Error("Invalid default theme. Choose --light, --dark or --system.")
  if (!Object.hasOwn(ACCENTS, accent)) {
    throw new Error("Unknown accent '" + accent + "'. Available: " + Object.keys(ACCENTS).join(", "))
  }
  return { defaultTheme: theme, accent }
}

export function themeTokens(appearance) {
  const colors = ACCENTS[normalizeAppearance({
    theme: appearance?.defaultTheme,
    accent: appearance?.accent,
  }).accent]
  return "\n" +
    ".ng-site { --ng-accent: " + colors.light + "; --ng-on-accent: #ffffff; }\n" +
    ".ng-site[data-ng-theme=\"dark\"] { --ng-accent: " + colors.dark + "; --ng-on-accent: #0e1014; }\n" +
    "@media (prefers-color-scheme: dark) { .ng-site[data-ng-theme=\"system\"] { --ng-accent: " +
    colors.dark + "; --ng-on-accent: #0e1014; } }\n"
}
