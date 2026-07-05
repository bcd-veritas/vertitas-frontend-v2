import {
  Bitcoin, Landmark, Trophy, Briefcase, CandlestickChart, Cpu, Activity,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  crypto: Bitcoin,
  politics: Landmark,
  sports: Trophy,
  macro: Briefcase,
  equities: CandlestickChart,
  tech: Cpu,
};

export function CategoryIcon({
  category,
  size = 13,
  className = "text-accent",
}: {
  category: string | null;
  size?: number;
  className?: string;
}) {
  const Icon = (category && MAP[category.toLowerCase()]) || Activity;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
