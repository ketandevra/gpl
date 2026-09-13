import Image from "next/image";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

type BrandLogoProps = {
  /** Compact mark for sticky headers */
  variant?: "mark" | "full";
  /** Link to home */
  href?: string | null;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  variant = "mark",
  href = "/",
  className = "",
  priority = false,
}: BrandLogoProps) {
  const image =
    variant === "full" ? (
      <Image
        src="/brand/gpl-logo.jpg"
        alt={APP_NAME}
        width={1024}
        height={1000}
        priority={priority}
        className={`h-auto w-full max-w-[112px] object-contain sm:max-w-[128px] ${className}`}
        sizes="(max-width: 640px) 112px, 128px"
      />
    ) : (
      <Image
        src="/brand/gpl-logo.jpg"
        alt={APP_NAME}
        width={64}
        height={62}
        priority={priority}
        className={`h-8 w-8 rounded-full object-cover object-[center_35%] ring-2 ring-[#f5b830]/80 sm:h-9 sm:w-9 ${className}`}
        sizes="36px"
      />
    );

  if (!href) return image;

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2aa7ad] focus-visible:ring-offset-2"
      aria-label={APP_NAME}
    >
      {image}
    </Link>
  );
}
