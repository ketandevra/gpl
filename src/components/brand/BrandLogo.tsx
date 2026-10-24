import Image from "next/image";
import Link from "next/link";
import { APP_NAME, LOGO_PATH } from "@/lib/constants";

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
        src={LOGO_PATH}
        alt={APP_NAME}
        width={1024}
        height={1024}
        priority={priority}
        className={`h-auto w-full max-w-[148px] object-contain sm:max-w-[176px] ${className}`}
        sizes="(max-width: 640px) 148px, 176px"
      />
    ) : (
      <Image
        src={LOGO_PATH}
        alt={APP_NAME}
        width={96}
        height={96}
        priority={priority}
        className={`h-10 w-10 rounded-full object-cover sm:h-11 sm:w-11 ${className}`}
        sizes="44px"
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
