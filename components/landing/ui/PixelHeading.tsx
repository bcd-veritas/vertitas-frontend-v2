export function PixelHeading({
  as: Tag = "h2",
  children,
  className = "",
  ...rest
}: {
  as?: "h1" | "h2";
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <Tag
      className={`font-pixel uppercase leading-[0.95] tracking-wide text-fg ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
