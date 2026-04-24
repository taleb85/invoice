interface LogoProps {
  variant?: 'full' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const iconSize = { sm: 28, md: 40, lg: 56 }
const textSize = { sm: 'text-xl', md: 'text-2xl', lg: 'text-3xl' }
const tagSize  = { sm: 'text-[7px]', md: 'text-[8px]', lg: 'text-[10px]' }

/** Arrow-pair icon rendered as an inline SVG — no external font dependency. */
function ArrowIcon({ px }: { px: number }) {
  const s = px / 28 // scale factor relative to base 28px
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      {/* Up arrow (cyan) */}
      <path
        d="M6 19.5 L9 7 L12 19.5 L10.5 19.5 L10.5 22 L7.5 22 L7.5 19.5 Z"
        fill="#22d3ee"
      />
      {/* Down arrow (indigo-violet) */}
      <path
        d="M12 8.5 L15 21 L18 8.5 L16.5 8.5 L16.5 6 L13.5 6 L13.5 8.5 Z"
        fill="#7c9dfc"
      />
    </svg>
  )
}

export function SmartPairLogo({
  variant = 'full',
  size = 'md',
  className = '',
}: LogoProps) {
  const px = iconSize[size]

  if (variant === 'icon') {
    return <ArrowIcon px={px} />
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ArrowIcon px={px} />
      <div className="flex flex-col leading-none">
        <span className={`${textSize[size]} font-family-outfit font-semibold tracking-tight`}>
          <span className="text-[#22d3ee]">Smart</span>
          <span className="text-[#e2f8ff]"> Pair</span>
        </span>
        <span className={`${tagSize[size]} font-semibold uppercase tracking-[0.18em] text-[#22d3ee] opacity-50`}>
          Invoice Management
        </span>
      </div>
    </div>
  )
}
