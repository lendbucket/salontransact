export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "unknown";

export function CardBrandIcon({
  brand,
  size = 32,
}: {
  brand: CardBrand;
  size?: number;
}) {
  const h = size;
  const w = Math.round(h * 1.5);

  if (brand === "visa") {
    return (
      <svg
        width={w}
        height={h}
        viewBox="0 0 48 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="48" height="32" rx="4" fill="#1A1F71" />
        <path
          d="M19.5 21H17L18.9 11H21.4L19.5 21ZM15.2 11L12.8 18.1L12.5 16.6L12.5 16.6L11.7 12C11.7 12 11.6 11 10.3 11H6.1L6 11.2C6 11.2 7.5 11.5 9.2 12.5L11.4 21H14L18 11H15.2ZM38 21L35.8 11H33.7C32.6 11 32.3 11.8 32.3 11.8L28.5 21H31.1L31.6 19.5H34.8L35.1 21H38ZM32.3 17.5L33.7 13.5L34.5 17.5H32.3ZM28.5 13.5L28.8 11.8C28.8 11.8 27.5 11.3 26.1 11.3C24.6 11.3 21 12 21 15.2C21 18.2 25.2 18.2 25.2 19.8C25.2 21.3 21.5 21 20.2 20L19.8 21.8C19.8 21.8 21.2 22.5 23.1 22.5C25.1 22.5 28.5 21.3 28.5 18.4C28.5 15.4 24.2 15.1 24.2 13.8C24.2 12.5 27.1 12.7 28.5 13.5Z"
          fill="white"
        />
      </svg>
    );
  }

  if (brand === "mastercard") {
    return (
      <svg
        width={w}
        height={h}
        viewBox="0 0 48 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="48" height="32" rx="4" fill="#252525" />
        <circle cx="19" cy="16" r="9" fill="#EB001B" />
        <circle cx="29" cy="16" r="9" fill="#F79E1B" />
        <path
          d="M24 9.3A8.96 8.96 0 0 1 27 16a8.96 8.96 0 0 1-3 6.7A8.96 8.96 0 0 1 21 16a8.96 8.96 0 0 1 3-6.7Z"
          fill="#FF5F00"
        />
      </svg>
    );
  }

  if (brand === "amex") {
    return (
      <svg
        width={w}
        height={h}
        viewBox="0 0 48 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="48" height="32" rx="4" fill="#006FCF" />
        <path
          d="M7 14L10 8H13L16 14H13.5L13 13H10L9.5 14H7ZM10.5 11.5H12.5L11.5 9.5L10.5 11.5ZM16 14V8H19L21 12L23 8H26V14H24V10L22 14H20L18 10V14H16ZM27 14V8H34V9.5H29V10.5H33.5V12H29V12.5H34V14H27ZM7 23V17H10L11.5 19.5L13 17H16V23H14V19L12 22H11L9 19V23H7ZM17 23L20 17H23L26 23H23.5L23 22H20L19.5 23H17ZM20.5 20.5H22.5L21.5 18.5L20.5 20.5ZM26 23V17H29L32 21V17H34V23H31L28 19V23H26ZM35 23V17H42V18.5H37V19.5H41.5V21H37V21.5H42V23H35Z"
          fill="white"
        />
      </svg>
    );
  }

  if (brand === "discover") {
    return (
      <svg
        width={w}
        height={h}
        viewBox="0 0 48 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="48" height="32" rx="4" fill="#fff" />
        <path d="M0 0h48v16H28a8 8 0 0 1 0 16H0V0Z" fill="#F3F4F6" />
        <circle cx="28" cy="16" r="7" fill="#F47216" />
        <text
          x="8"
          y="19"
          fill="#111827"
          fontSize="8"
          fontWeight="bold"
          fontFamily="Inter, sans-serif"
        >
          DISCOVER
        </text>
      </svg>
    );
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 48 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0.5"
        y="0.5"
        width="47"
        height="31"
        rx="3.5"
        fill="#1f2937"
        stroke="#374151"
      />
      <rect x="8" y="10" width="32" height="3" rx="1.5" fill="#374151" />
      <rect x="8" y="17" width="20" height="3" rx="1.5" fill="#374151" />
    </svg>
  );
}

export function AcceptedCardsBadges() {
  const brands: CardBrand[] = ["visa", "mastercard", "amex", "discover"];
  return (
    <div className="flex items-center gap-2">
      {brands.map((brand) => (
        <div
          key={brand}
          className="rounded overflow-hidden"
          style={{
            opacity: 0.7,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <CardBrandIcon brand={brand} size={22} />
        </div>
      ))}
    </div>
  );
}
