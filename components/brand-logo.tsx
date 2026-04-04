import Image from 'next/image'
import Link from 'next/link'

type BrandLogoProps = {
  href?: string
  size?: 'sm' | 'md' | 'lg'
  priority?: boolean
  showWordmark?: boolean
  className?: string
  imageClassName?: string
  textClassName?: string
}

const LOGO_SIZES = {
  sm: { width: 128, height: 36 },
  md: { width: 164, height: 46 },
  lg: { width: 212, height: 60 },
} as const

export default function BrandLogo({
  href = '/',
  size = 'md',
  priority = false,
  showWordmark = false,
  className = '',
  imageClassName = '',
  textClassName = '',
}: BrandLogoProps) {
  const dimensions = LOGO_SIZES[size]

  return (
    <Link
      href={href}
      aria-label="Sovaio home"
      className={`inline-flex items-center gap-2 ${className}`.trim()}
    >
      <Image
        src="/sovaiologotransparent.png"
        alt="Sovaio"
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className={`h-auto w-auto max-w-full ${imageClassName}`.trim()}
      />
      {showWordmark ? (
        <span className={`text-lg font-semibold tracking-tight text-foreground ${textClassName}`.trim()}>
          Sovaio
        </span>
      ) : null}
    </Link>
  )
}
