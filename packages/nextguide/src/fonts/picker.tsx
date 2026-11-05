"use client"

import * as React from "react"
import { DEFAULT_FONTS, FONT_FAMILIES, type FontSelection, type FontId } from "./catalog.js"

type FontField = keyof FontSelection

/** Reusable preview UI for the ownership-protected /setup wizard and future /admin. */
export function FontPicker({
  value, defaultValue = DEFAULT_FONTS, onChange,
}: {
  value?: FontSelection
  defaultValue?: FontSelection
  onChange?: (next: FontSelection) => void
}) {
  const [internal, setInternal] = React.useState<FontSelection>(defaultValue)
  const selected = value ?? internal
  function change(field: FontField, font: FontId) {
    const next = { ...selected, [field]: font }
    if (!value) setInternal(next)
    onChange?.(next)
  }
  return (
    <div className="ng-font-picker">
      {(["body", "heading", "code"] as const).map(field => (
        <fieldset key={field} className="ng-font-picker-group">
          <legend>{field === "body" ? "Body font" : field === "heading" ? "Heading font" : "Code font"}</legend>
          <div className="ng-font-picker-grid">
            {FONT_FAMILIES.filter(font => font.category === (field === "code" ? "mono" : "sans")).map(font => {
              const active = selected[field] === font.id
              return (
                <label key={font.id} className="ng-font-option" data-selected={active}>
                  <input type="radio" name={"nextguide-font-" + field} value={font.id}
                    checked={active} onChange={() => change(field, font.id)} />
                  <span className="ng-font-option-name">{font.label}</span>
                  <span className="ng-font-option-description">{font.description}</span>
                  <span className="ng-font-option-sample" style={{ fontFamily: font.family }}>
                    {field === "code" ? 'const hello = "NextGuide";' : field === "heading" ? "Build beautiful documentation" : "The quick brown fox jumps over the lazy dog."}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      <div className="ng-font-live-preview" aria-live="polite">
        <p className="ng-font-live-eyebrow">LIVE DOCUMENTATION PREVIEW</p>
        <h2 style={{ fontFamily: FONT_FAMILIES.find(font => font.id === selected.heading)?.family }}>
          Getting started with NextGuide
        </h2>
        <p style={{ fontFamily: FONT_FAMILIES.find(font => font.id === selected.body)?.family }}>
          Write expressive MDX pages, document APIs, and publish a beautiful website with Next.js.
        </p>
        <pre style={{ fontFamily: FONT_FAMILIES.find(font => font.id === selected.code)?.family }}>
          {'bun add nextguide\n// Ready to write docs'}
        </pre>
      </div>
    </div>
  )
}
