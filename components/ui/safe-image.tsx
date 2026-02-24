"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface SafeImageProps {
  src?: string
  alt: string
  width?: number
  height?: number
  className?: string
  fallback?: React.ReactNode
  priority?: boolean
}

export function SafeImage({
  src,
  alt,
  width = 150,
  height = 40,
  className,
  fallback,
  priority = false,
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleError = () => {
    setHasError(true)
    setIsLoading(false)
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  if (!src || hasError) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        {fallback || <div className="text-gray-400 text-sm">{alt}</div>}
      </div>
    )
  }

  return (
    <div className={cn("relative", className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn("transition-opacity duration-200", isLoading ? "opacity-0" : "opacity-100")}
        onError={handleError}
        onLoad={handleLoad}
        priority={priority}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
          <div className="bg-gray-200 rounded w-full h-full" />
        </div>
      )}
    </div>
  )
}
