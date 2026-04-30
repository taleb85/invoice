interface LogoProps {
  variant?: 'full' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const iconSize = { sm: 28, md: 40, lg: 56 }
const textSize = { sm: 'text-xl', md: 'text-2xl', lg: 'text-3xl' }
const tagSize  = { sm: 'text-[7px]', md: 'text-[8px]', lg: 'text-[10px]' }

/** Brand icon — paths from favicon.svg, transparent background. */
function ArrowIcon({ px }: { px: number }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      {/* Deep Aurora accent — sky `#38bdf8` + violet-blue */}
      <path
        d="M8 32 L22 18 L22 26 L42 26 L42 32"
        fill="none" stroke="#38bdf8" strokeWidth="5"
        strokeLinejoin="round" strokeLinecap="round"
      />
      <path
        d="M56 32 L42 46 L42 38 L22 38 L22 32"
        fill="none" stroke="#818cf8" strokeWidth="5"
        strokeLinejoin="round" strokeLinecap="round"
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
          <span className="text-[#38bdf8]">Smart</span>
          <span className="text-white"> Pair</span>
        </span>
        <span className={`${tagSize[size]} font-semibold uppercase tracking-[0.18em] text-[#94a3b8]`}>
          Invoice Management
        </span>
      </div>
    </div>
  )
}
