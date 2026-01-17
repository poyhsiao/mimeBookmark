'use client'

import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { type VariantProps, cva } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const toggleGroupVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'hover:bg-muted hover:text-muted-foreground',
        outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-3 py-2',
        sm: 'h-9 px-2.5',
        lg: 'h-11 px-5',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        class: '[data-state="on"]:bg-primary [data-state="on"]:text-primary-foreground [data-state="on"]:hover:bg-primary/90 [data-state="off"]:bg-transparent',
      },
      {
        variant: 'outline',
        class: '[data-state="on"]:bg-accent [data-state="on"]:text-accent-foreground [data-state="on"]:border-input [data-state="off"]:bg-transparent',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleGroupVariants>>({
  size: 'default',
  variant: 'default',
})

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleGroupVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupContext.Provider value={{ variant, size }}>
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn('flex items-center justify-center gap-1', className)}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  </ToggleGroupContext.Provider>
))
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleGroupVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleGroupVariants({ variant: variant || context.variant, size: size || context.size }),
        'flex-1', // Make each item take equal space
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
