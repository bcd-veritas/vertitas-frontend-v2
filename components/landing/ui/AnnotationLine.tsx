import { MonoLabel } from "./MonoLabel";

export function AnnotationLine({
  label,
  side,
  className = "",
}: {
  label: string;
  side: "left" | "right";
  className?: string;
}) {
  const line = (
    <span aria-hidden="true" className="flex items-center">
      <span className="block h-px w-16 bg-accent/40" />
      <span className="block w-1 h-1 rounded-full bg-accent/70" />
    </span>
  );
  return (
    <div
      className={`flex items-center gap-3 ${
        side === "right" ? "flex-row-reverse" : ""
      } ${className}`}
    >
      {line}
      <MonoLabel className="text-accent/80 whitespace-nowrap">{label}</MonoLabel>
    </div>
  );
}
