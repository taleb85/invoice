import type { ButtonHTMLAttributes } from 'react'
import {
  STANDARD_BUTTON_BASE,
  STANDARD_BUTTON_DANGER,
  STANDARD_BUTTON_PRIMARY,
  STANDARD_BUTTON_SECONDARY,
  BTN_SIZE_XL,
  BTN_SIZE_MD,
  BTN_SIZE_SM,
  BTN_SIZE_XS,
  STANDARD_BUTTON_SIZE_SM_PRIMARY,
  STANDARD_BUTTON_SIZE_SM_SECONDARY,
} from '@/components/ui/standard-button-classes'

type Variant = 'primary' | 'secondary' | 'danger'
type Size = 'xl' | 'md' | 'sm' | 'xs'

export type StandardButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

const SIZE_MAP: Record<Size, string> = {
  xl: BTN_SIZE_XL,
  md: BTN_SIZE_MD,
  sm: BTN_SIZE_SM,
  xs: BTN_SIZE_XS,
}

export function StandardButton({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: StandardButtonProps) {
  const v =
    variant === 'primary'
      ? STANDARD_BUTTON_PRIMARY
      : variant === 'secondary'
        ? STANDARD_BUTTON_SECONDARY
        : STANDARD_BUTTON_DANGER
  const sz = SIZE_MAP[size]
  return <button type={type} className={`${STANDARD_BUTTON_BASE} ${v} ${sz} ${className}`.trim()} {...rest} />
}

/** Classi complete per `<Link>` (o `<a>`) con look primario/secondario. */
export function standardLinkButtonClassName(variant: Variant = 'primary', size: Size = 'md'): string {
  const v =
    variant === 'primary'
      ? STANDARD_BUTTON_PRIMARY
      : variant === 'secondary'
        ? STANDARD_BUTTON_SECONDARY
        : STANDARD_BUTTON_DANGER
  const sz = SIZE_MAP[size]
  return `${STANDARD_BUTTON_BASE} ${v} ${sz}`.trim()
}
