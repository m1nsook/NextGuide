# Account Mode UI (private to NextGuide Account Mode)

These components come from the user's `m1nsook@next` shadcn bootstrapper. They are only used by `/setup`, `/login`, and `/admin`.

The public docs UI and Developer Mode continue to use `src/ui`.

The `@source "./ui"` directive in `account.css` lets Tailwind v4 scan classes from the installed package's Account Mode UI. Keep the dependency list in the single `nextguide` package.
