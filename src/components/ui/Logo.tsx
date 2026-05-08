import Image from 'next/image';

interface LogoProps {
  width?: number;
  className?: string;
  priority?: boolean;
}

/**
 * Via Mood brand logo — public/via-mood-logo.svg referansı.
 * Yükseklik width'e göre otomatik (SVG aspect ratio).
 */
export function Logo({ width = 120, className = '', priority = false }: LogoProps) {
  // SVG'nin gerçek viewBox'ı 254.18 × 156.78 → ratio ~1.62
  const height = Math.round(width / 1.62);
  return (
    <Image
      src="/via-mood-logo.svg"
      alt="Via Mood"
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
