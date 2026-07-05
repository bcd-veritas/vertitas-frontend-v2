const positions = [
  "top-4 left-4",
  "top-4 right-4",
  "bottom-4 left-4",
  "bottom-4 right-4",
];

export function CornerMarks() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {positions.map((pos) => (
        <span
          key={pos}
          className={`absolute ${pos} font-mono text-muted/50 text-sm leading-none select-none`}
        >
          +
        </span>
      ))}
    </div>
  );
}
