import Link from "next/link"
import { cn } from "@/lib/utils"

const LOGO_SRC = {
  /** Full-color logo (light backgrounds) */
  default: "/images/growteq-logo.svg",
  /** White logo for green sidebar */
  sidebar: "/images/growteq-logo-white.svg",
  /** Compact mark when sidebar is collapsed */
  collapsed: "/images/growteq-logo-collapsed.svg",
} as const

export type GrowteqLogoVariant = keyof typeof LOGO_SRC

export interface GrowteqLogoProps {
  variant?: GrowteqLogoVariant
  className?: string
  /** If set, wraps the logo in a Next.js Link */
  href?: string
  /** e.g. close mobile menu after navigation */
  onNavigate?: () => void
}

/**
 * Official Growteq brand marks from `/public/images`.
 * Use `sidebar` on `#387F43` backgrounds; `default` on white/light headers.
 */
export function GrowteqLogo({ variant = "default", className, href, onNavigate }: GrowteqLogoProps) {
  const src = LOGO_SRC[variant]
  const ringClass =
    variant === "sidebar" || variant === "collapsed"
      ? "focus-visible:ring-white/80"
      : "focus-visible:ring-[#387F43]/40"
  const img = (
    <img
      src={src}
      alt="Growteq"
      className={cn("h-10 w-auto max-w-full object-contain object-left", className)}
      width={160}
      height={40}
      decoding="async"
    />
  )

  if (href) {
    return (
      <Link
        href={href}
        onClick={() => onNavigate?.()}
        className={cn(
          "inline-flex shrink-0 focus:outline-none focus-visible:ring-2 rounded-sm",
          ringClass
        )}
      >
        {img}
      </Link>
    )
  }

  return img
}
