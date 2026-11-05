import { fileURLToPath } from "node:url"

/**
 * The normal site runs in Next.js server mode.
 * The Pages workflow sets NEXTGUIDE_PAGES=1 for a read-only static export.
 * Do not enable this for the account-based CMS when it is implemented.
 *
 * @type {import("next").NextConfig}
 */
const forPages = process.env.NEXTGUIDE_PAGES === "1"

const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  turbopack: {
    root: fileURLToPath(new URL("../../", import.meta.url)),
  },
  ...(forPages ? {
    output: "export",
    basePath: "/NextGuide",
    trailingSlash: true,
    images: { unoptimized: true },
  } : {}),
}

export default nextConfig
