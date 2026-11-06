import { ArrowRight, BookOpenText, Braces, Check, Code2, FileText, Layers3, Sparkles } from "lucide-react"

export interface DocsLandingHeroProps {
  eyebrow?: string
  title: string
  description: string
  primaryHref?: string
  primaryLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
}

/**
 * Product-ready documentation homepage. The preview is decorative and
 * contains no scripts, image assets or mandatory external dependencies.
 */
export function DocsLandingHero({
  eyebrow = "DOCUMENTATION",
  title,
  description,
  primaryHref = "/docs/getting-started",
  primaryLabel = "Get started",
  secondaryHref = "/docs/components",
  secondaryLabel = "Explore components",
}: DocsLandingHeroProps) {
  return (
    <section className="ng-landing-hero" aria-labelledby="ng-landing-heading">
      <div className="ng-landing-hero-glow" aria-hidden="true" />
      <div className="ng-landing-content">
        <span className="ng-landing-eyebrow"><span className="ng-landing-eyebrow-mark"><Sparkles size={13} /></span>{eyebrow}</span>
        <h1 id="ng-landing-heading">{title}</h1>
        <p>{description}</p>
        <div className="ng-landing-actions">
          <a className="ng-landing-primary" href={primaryHref}>{primaryLabel}<ArrowRight size={16} aria-hidden="true" /></a>
          <a className="ng-landing-secondary" href={secondaryHref}>{secondaryLabel}<BookOpenText size={16} aria-hidden="true" /></a>
        </div>
      </div>
      <div className="ng-landing-preview" aria-hidden="true">
        <div className="ng-landing-preview-toolbar">
          <span className="ng-landing-preview-dots"><i /><i /><i /></span>
          <span className="ng-landing-preview-name"><Code2 size={12} /> docs.config.ts</span>
          <span className="ng-landing-preview-chip">NextGuide</span>
        </div>
        <div className="ng-landing-preview-main">
          <div className="ng-landing-preview-rail">
            <span><Layers3 size={14} /> Guides</span>
            <em className="ng-landing-preview-active"><FileText size={13} /> Introduction</em>
            <em><FileText size={13} /> Getting started</em>
            <em><Braces size={13} /> Components</em>
          </div>
          <div className="ng-landing-preview-document">
            <span className="ng-landing-preview-path">Overview / Introduction</span>
            <strong>Your docs, your way.</strong>
            <i className="ng-landing-preview-paragraph ng-landing-preview-line-1" />
            <i className="ng-landing-preview-paragraph ng-landing-preview-line-2" />
            <div className="ng-landing-preview-card"><span><Check size={13} /> Ready to ship</span><i /><i /></div>
            <div className="ng-landing-preview-code"><span>▸</span> bun run dev</div>
          </div>
        </div>
      </div>
    </section>
  )
}
