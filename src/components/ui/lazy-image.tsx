import { cn } from '@/lib/utils';

interface LazyImageProps {
  alt: string;
  src: string;
  className?: string;
  containerClassName?: string;
  fallback?: string;
  ratio: number;
  inView?: boolean;
}

export function LazyImage({
  alt,
  src,
  ratio,
  fallback,
  className,
  containerClassName,
}: LazyImageProps) {
  return (
    <div
      className={cn(
        'relative size-full overflow-hidden rounded-lg border border-[#8c7355]/30',
        containerClassName,
      )}
      style={{ aspectRatio: String(ratio) }}
    >
      <img
        alt={alt}
        src={src}
        className={cn('size-full rounded-lg object-cover', className)}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          if (fallback) e.currentTarget.src = fallback;
        }}
      />
    </div>
  );
}
