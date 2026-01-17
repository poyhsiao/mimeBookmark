import * as React from "react"
import { cn } from "@/lib/utils"

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  // asChild prop removed as it was not implemented
}

export interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  alt: string; // Make alt explicitly required
  onError?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
)
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  AvatarImageProps
>(({ className, onError, alt, ...props }, ref) => {
  const [hasError, setHasError] = React.useState(false)

  // Reset hasError when src changes to allow new images to load
  React.useEffect(() => {
    setHasError(false)
  }, [props.src])

  const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true)
    onError?.(event)
  }

  if (hasError) {
    return null // Allow AvatarFallback to be displayed
  }

  return (
    <img
      ref={ref}
      className={cn("aspect-square h-full w-full", className)}
      alt={alt}
      onError={handleError}
      {...props}
    />
  )
})
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
