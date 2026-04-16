import type { ButtonHTMLAttributes } from 'react'
import {
  STANDARD_BUTTON_BASE,
  STANDARD_BUTTON_DANGER,
  STANDARD_BUTTON_PRIMARY,
  STANDARD_BUTTON_SECONDARY,
  STANDARD_BUTTON_SIZE_SM_PRIMARY,
  STANDARD_BUTTON_SIZE_SM_SECONDARY,
} from '@/components/ui/standard-button-classes'

type Variant = 'primary' | 'secondary' | 'danger'
type Size = 'md' | 'sm'

export type StandardButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
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
  const sz =
    size === 'sm'
      ? variant === 'secondary'
        ? STANDARD_BUTTON_SIZE_SM_SECONDARY
        : STANDARD_BUTTON_SIZE_SM_PRIMARY
      : ''
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
  const sz =
    size === 'sm'
      ? variant === 'secondary'
        ? STANDARD_BUTTON_SIZE_SM_SECONDARY
        : STANDARD_BUTTON_SIZE_SM_PRIMARY
      : ''
  return `${STANDARD_BUTTON_BASE} ${v} ${sz}`.trim()
}
