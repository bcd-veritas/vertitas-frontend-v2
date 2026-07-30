/** The pixel-face counterpart to MonoLabel — shared across the /home board
 *  surfaces (SplitCard, MarketBoard, FeaturedPlate, Ticker, FilterDropdown).
 *  MonoLabel itself stays untouched since Topbar/SystemFooter/terminal/profile
 *  still depend on it. */
export function PixelLabel({
  children,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`font-terminal text-[13px] font-light uppercase tracking-[0.14em] text-muted ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
