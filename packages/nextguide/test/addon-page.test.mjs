import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Markdown } from "../dist/components/markdown.js"

test("installed Markdown renderer escapes raw HTML and never creates scripts",()=>{
  const output=renderToStaticMarkup(React.createElement(Markdown,{
    children:"# Reviewed page\n\n<script>alert('xss')</script>\n\n<img src=x onerror=alert(1)>\n\n[unsafe](javascript:alert(1))\n\n**Safe text**"
  }))
  assert.doesNotMatch(output,/<script|<img[^>]*onerror|href="javascript:/i)
  assert.match(output,/&lt;script&gt;/)
  assert.match(output,/&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.match(output,/Safe text/)
})

test("safe Markdown links remain URL-sanitized and external links are nofollow",()=>{
  const output=renderToStaticMarkup(React.createElement(Markdown,{
    children:"Visit [the website](https://example.com/docs) or [documentation](/docs)."
  }))
  assert.match(output,/href="https:\/\/example\.com\/docs"/)
  assert.match(output,/rel="noopener noreferrer nofollow"/)
  assert.match(output,/href="\/docs"/)
  assert.doesNotMatch(output,/dangerouslySetInnerHTML/)
})
