import { siGithub } from "simple-icons"
export function GitHubIcon({ className = "size-[18px]" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} fill-current`}><path d={siGithub.path} /></svg>
}
