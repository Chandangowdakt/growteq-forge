"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface SafeAvatarProps {
  src?: string
  alt: string
  fallback?: string
  className?: string
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)
}

export function SafeAvatar({ src, alt, fallback, className }: SafeAvatarProps) {
  const initials = fallback ?? getInitials(alt)

  return (
    <Avatar className={cn(className)}>
      {src && <AvatarImage src={src} alt={alt} />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}
