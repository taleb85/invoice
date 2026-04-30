'use client'

import * as SwitchPrimitives from '@radix-ui/react-switch'
import * as React from 'react'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={`peer inline-flex h-7 w-12 shrink-0 cursor-pointer touch-manipulation items-center rounded-full border border-app-line-35 bg-app-line-30 shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] transition-colors outline-none ring-offset-0 focus-visible:ring-2 focus-visible:ring-app-a-55 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-cyan-500/55 data-[state=checked]:bg-cyan-500 ${className ?? ''}`}
    ref={ref}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className="pointer-events-none block h-[22px] w-[22px] translate-x-[3px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform duration-150 will-change-transform data-[state=checked]:translate-x-[23px]"
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
