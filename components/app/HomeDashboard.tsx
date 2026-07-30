"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import type { ApiMarket, FeaturedMarket } from "@/lib/markets/types";
import { Topbar } from "./Topbar";
import { DotScan } from "./DotScan";
import { Ticker } from "./Ticker";
import { FeaturedPlate } from "./FeaturedPlate";
import { MarketBoard } from "./MarketBoard";
import { SystemFooter } from "./SystemFooter";

export function HomeDashboard({
  markets,
  categories,
  featured,
}: {
  markets: ApiMarket[];
  categories: string[];
  featured: FeaturedMarket[];
}) {
  const [search, setSearch] = useState<string>("");
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const launchingRef = useRef(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    return () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
      document.body.style.overflow = "";
      if (root) root.style.willChange = "";
    };
  }, []);

  const startExplore = () => {
    if (launchingRef.current) return;
    launchingRef.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push("/explore");
      return;
    }

    const root = rootRef.current;
    if (!root) {
      router.push("/explore");
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const tunnel = root.querySelector("[data-tunnel]");
    let originX = rootRect.width / 2;
    let originY = rootRect.height / 2;
    if (tunnel) {
      const tunnelRect = tunnel.getBoundingClientRect();
      originX = tunnelRect.left + tunnelRect.width / 2 - rootRect.left;
      originY = tunnelRect.top + tunnelRect.height / 2 - rootRect.top;
    }

    root.style.transformOrigin = `${originX}px ${originY}px`;
    document.body.style.overflow = "hidden";
    root.style.willChange = "transform";

    const tl = gsap.timeline({
      onComplete: () => {
        router.push("/explore");
      },
    });
    timelineRef.current = tl;
    tl.to(root, { scale: 0.94, duration: 0.28, ease: "power2.out" }).to(
      root,
      { scale: 26, duration: 0.9, ease: "power3.in" },
    );
  };

  return (
    <div ref={rootRef} className="dot-grid min-h-screen relative flex flex-col">
      <DotScan />
      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <Topbar search={search} onSearch={setSearch} />
        <Ticker />
        <FeaturedPlate markets={featured} />
        <MarketBoard
          categories={categories}
          markets={markets}
          search={search}
          onResetSearch={() => setSearch("")}
          onExplore={startExplore}
        />
        <SystemFooter markets={markets} />
      </div>
    </div>
  );
}
