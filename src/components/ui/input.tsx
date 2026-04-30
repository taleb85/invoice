'use client'

import * as React from 'react'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={`flex min-h-[2.625rem] w-full rounded-xl border border-app-line-35 app-workspace-inset-bg-soft px-3 py-2 text-sm tabular-nums text-app-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-app-line-10 [color-scheme:dark] placeholder:text-app-fg-placeholder focus:border-app-a-55 focus:outline-none focus:ring-2 focus:ring-app-a-35 disabled:cursor-not-allowed disabled:opacity-55 ${className ?? ''}`}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
