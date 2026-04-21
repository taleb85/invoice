import Image from 'next/image'

interface LogoProps {
  variant?: 'full' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { full: { w: 140, h: 36 }, icon: { w: 28, h: 28 } },
  md: { full: { w: 210, h: 54 }, icon: { w: 44, h: 44 } },
  lg: { full: { w: 280, h: 72 }, icon: { w: 68, h: 68 } },
}

export function SmartPairLogo({
  variant = 'full',
  size = 'md',
  className = '',
}: LogoProps) {
  const dim = sizes[size][variant]
  const src = variant === 'full' ? '/smart-pair-logo.svg' : '/smart-pair-icon.svg'

  return (
    <Image
      src={src}
      alt="Smart Pair"
      width={dim.w}
      height={dim.h}
      className={className}
      priority
    />
  )
}
