interface LogoProps {
  variant?: 'full' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const iconSize = { sm: 28, md: 40, lg: 56 }
const textSize = { sm: 'text-xl', md: 'text-2xl', lg: 'text-3xl' }
const tagSize  = { sm: 'text-[7px]', md: 'text-[8px]', lg: 'text-[10px]' }

/** Arrow-pair icon rendered as an inline SVG — original paths from smart-pair-icon.svg. */
function ArrowIcon({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      {/* Up arrow (cyan) — original path */}
      <path d="M24 50 L30 18 L36 50 L33 50 L33 56 L27 56 L27 50 Z" fill="#22d3ee"/>
      {/* Down arrow (indigo-violet) — original path */}
      <path d="M36 22 L42 54 L48 22 L45 22 L45 16 L39 16 L39 22 Z" fill="#7c9dfc"/>
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
