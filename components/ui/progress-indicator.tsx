import { cn } from "@/lib/utils"

interface ProgressIndicatorProps {
  value: number
  size?: "sm" | "md" | "lg"
  showValue?: boolean
  className?: string
}

export function ProgressIndicator({ value, size = "md", showValue = true, className }: ProgressIndicatorProps) {
  // Ensure value is between 0 and 100
  const safeValue = Math.max(0, Math.min(100, value))

  // Determine color based on value
  const getColorClass = () => {
    if (safeValue < 30) return "bg-red-500"
    if (safeValue < 70) return "bg-amber-500"
    return "bg-green-500"
  }

  // Determine size class
  const getSizeClass = () => {
    switch (size) {
      case "sm":
        return "h-1.5"
      case "lg":
        return "h-3"
      default:
        return "h-2"
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-between items-center mb-1">
        {showValue && <div className="text-sm font-medium">{safeValue}%</div>}
      </div>
      <div className={cn("w-full bg-gray-200 rounded-full overflow-hidden", getSizeClass())}>
        <div className={cn("rounded-full", getColorClass(), getSizeClass())} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  )
}
