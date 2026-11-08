import assert from "node:assert/strict"
import test from "node:test"
import { buildDocsChatGPTPrompt } from "../dist/components/docs/page-tools.js"

test("Ask ChatGPT includes the exact deployed documentation page URL", () => {
  const prompt = buildDocsChatGPTPrompt({
    title: "Writing MDX",
    markdown: "# Writing MDX\n\nThis page explains MDX.",
    pageUrl: "https://m1nsook.github.io/NextGuide/docs/mdx/?utm_campaign=docs#heading",
  })
  assert.match(prompt, /Page title: Writing MDX/)
  assert.match(prompt, /Source URL: https:\/\/m1nsook\.github\.io\/NextGuide\/docs\/mdx\//)
  assert.doesNotMatch(prompt, /utm_campaign|#heading/)
  assert.match(prompt, /# Writing MDX/)
})

test("Ask ChatGPT retains distinct pages and local development URLs", () => {
  const prompt = buildDocsChatGPTPrompt({
    title: "Manifest reference",
    markdown: "# Manifest reference",
    pageUrl: "http://localhost:4310/addons/manifest",
  })
  assert.match(prompt, /Source URL: http:\/\/localhost:4310\/addons\/manifest/)
  assert.match(prompt, /Open the source URL/)
})

test("Ask ChatGPT includes the source URL even for long excerpts", () => {
  const prompt = buildDocsChatGPTPrompt({
    title: "API",
    markdown: "x".repeat(5000),
    pageUrl: "https://docs.example.com/reference/api",
  })
  assert.ok(prompt.includes("Source URL: https://docs.example.com/reference/api"))
  assert.match(prompt, /\[Excerpt truncated\]/)
  assert.ok(prompt.length < 3000)
})

test("Ask ChatGPT only accepts web page URLs", () => {
  assert.throws(() => buildDocsChatGPTPrompt({
    title: "Unsafe", markdown: "hi", pageUrl: "javascript:alert(1)",
  }), /HTTP\(S\)/)
})
