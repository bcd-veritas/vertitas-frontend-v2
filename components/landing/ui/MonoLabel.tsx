export function MonoLabel({
  children,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`font-mono text-[11px] uppercase tracking-[0.18em] text-muted ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
