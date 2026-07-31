"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

import { Frame } from "@/components/terminal/Frame";
import { CHART_PALETTE } from "@/components/charts/palette";
import { getAdminTimeseries } from "@/lib/admin/data";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export function ActivityChart() {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ReturnType<typeof echarts.init> | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-timeseries", "7d", "day"],
    queryFn: () => getAdminTimeseries("7d", "day"),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!ref.current) return;
    chart.current = echarts.init(ref.current);
    const onResize = () => chart.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chart.current || !data) return;
    const days = data.buckets.map((b) => b.t.slice(5, 10)); // MM-DD
    const trades = data.buckets.map((b) => b.trades);
    const shares = data.buckets.map((b) => Number(b.volume) / 1e6); // 1e6 share scale → units
    chart.current.setOption({
      grid: { left: 40, right: 40, top: 20, bottom: 24 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: days, axisLine: { lineStyle: { color: "#555" } } },
      yAxis: [
        { type: "value", name: "Trades", splitLine: { lineStyle: { color: "#222" } } },
        { type: "value", name: "Shares", position: "right", splitLine: { show: false } },
      ],
      series: [
        { name: "Trades", type: "bar", data: trades, itemStyle: { color: CHART_PALETTE[0] } },
        { name: "Shares", type: "line", yAxisIndex: 1, data: shares, itemStyle: { color: CHART_PALETTE[1] }, smooth: true },
      ],
    });
  }, [data]);

  return (
    <Frame label="Activity · 7d" className="p-4">
      <div ref={ref} className="h-64 w-full" />
    </Frame>
  );
}
