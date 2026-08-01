"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { Frame } from "@/components/terminal/Frame";
import { ProgressModal, stepsFromIndex } from "@/components/common/ProgressModal";
import { getMarketCategories } from "@/lib/markets/data";
import {
  Field,
  Segmented,
  TextArea,
  TextInput,
  Toggle,
} from "@/components/admin/form/fields";

type ResolverType = "ADMIN" | "CHAINLINK_DATA_FEED" | "CHAINLINK_DATA_STREAM" | "UMA";
type Comparison =
  | "ABOVE"
  | "BELOW"
  | "UP_FROM_START"
  | "DOWN_FROM_START"
  | "RANGE";

const RESOLVER_OPTIONS: { value: ResolverType; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "CHAINLINK_DATA_FEED", label: "Chainlink Feed" },
  { value: "CHAINLINK_DATA_STREAM", label: "Chainlink Stream" },
  { value: "UMA", label: "UMA" },
];

const COMPARISON_OPTIONS: { value: Comparison; label: string }[] = [
  { value: "ABOVE", label: "Above" },
  { value: "BELOW", label: "Below" },
  { value: "UP_FROM_START", label: "Up from start" },
  { value: "DOWN_FROM_START", label: "Down from start" },
  { value: "RANGE", label: "Range" },
];

const isChainlink = (t: ResolverType) =>
  t === "CHAINLINK_DATA_FEED" || t === "CHAINLINK_DATA_STREAM";

type FormState = {
  title: string;
  description: string;
  category: string;
  isFeatured: boolean;
  closesAt: string; // datetime-local
  priceCents: string;
  shares: string;
  tickCents: string;
  minShares: string;
  maxShares: string;
  feeBps: string;
  resolverType: ResolverType;
  resolutionSource: string;
  feedAddress: string;
  comparison: Comparison;
  targetPrice: string;
  maxStalenessSec: string;
  rangeThresholds: string;
  umaQuestion: string;
  resolutionReward: string;
};

const INITIAL: FormState = {
  title: "",
  description: "",
  category: "",
  isFeatured: false,
  closesAt: "",
  priceCents: "50",
  shares: "1000",
  tickCents: "1",
  minShares: "1",
  maxShares: "",
  feeBps: "0",
  resolverType: "ADMIN",
  resolutionSource: "",
  feedAddress: "",
  comparison: "ABOVE",
  targetPrice: "",
  maxStalenessSec: "3600",
  rangeThresholds: "",
  umaQuestion: "",
  resolutionReward: "",
};

/** A titled Frame section with a staggered load-in. */
function Section({
  label,
  right,
  delay,
  children,
}: {
  label: string;
  right?: ReactNode;
  delay: number;
  children: ReactNode;
}) {
  return (
    <div className="reveal-rise" style={{ animationDelay: `${delay}ms` }}>
      <Frame label={label} right={right} className="p-4">
        {children}
      </Frame>
    </div>
  );
}

function durationSeconds(closesAt: string): number | null {
  if (!closesAt) return null;
  const ms = new Date(closesAt).getTime() - Date.now();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function humanDuration(seconds: number): string {
  if (seconds <= 0) return "in the past";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, !d && m && `${m}m`].filter(Boolean).join(" ") || "<1m";
}

/** Assembled request shape — the contract for the (later) backend wiring. */
function buildPayload(f: FormState) {
  const num = (s: string) => Number(s);
  const opt = (s: string) => (s.trim() === "" ? undefined : Number(s));

  const resolver =
    f.resolverType === "ADMIN"
      ? {}
      : isChainlink(f.resolverType)
        ? {
            feedAddress: f.feedAddress,
            comparison: f.comparison,
            targetPrice: f.targetPrice,
            maxStalenessSec: num(f.maxStalenessSec),
            ...(f.comparison === "RANGE"
              ? {
                  thresholds: f.rangeThresholds
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }
              : {}),
          }
        : { question: f.umaQuestion };

  return {
    title: f.title.trim(),
    description: f.description.trim() || undefined,
    category: f.category.trim() || undefined,
    isFeatured: f.isFeatured,
    durationSeconds: durationSeconds(f.closesAt),
    priceCents: num(f.priceCents),
    shares: num(f.shares),
    tickCents: num(f.tickCents),
    minShares: num(f.minShares),
    maxShares: opt(f.maxShares),
    feeBps: opt(f.feeBps),
    resolverType: f.resolverType,
    resolutionSource: f.resolutionSource.trim() || undefined,
    resolver,
    // Only UMA pays the reward out (to the winning proposer). For ADMIN/Chainlink
    // the pool would just strand Treasury VTK, so never submit it.
    resolutionReward: f.resolverType === "UMA" ? opt(f.resolutionReward) : undefined,
  };
}

function validate(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title.trim()) e.title = "Required";
  const dur = durationSeconds(f.closesAt);
  if (dur == null) e.closesAt = "Required";
  else if (dur <= 0) e.closesAt = "Must be in the future";
  const price = Number(f.priceCents);
  if (!(price > 0 && price < 100)) e.priceCents = "Between 1 and 99";
  if (!(Number(f.shares) > 0)) e.shares = "Must be > 0";
  if (!(Number(f.tickCents) > 0)) e.tickCents = "Must be > 0";
  if (!(Number(f.minShares) > 0)) e.minShares = "Must be > 0";

  if (isChainlink(f.resolverType)) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(f.feedAddress.trim()))
      e.feedAddress = "Valid 0x… feed address required";
    if (f.comparison === "RANGE") {
      if (!f.rangeThresholds.trim()) e.rangeThresholds = "Comma-separated thresholds required";
    } else if (!f.targetPrice.trim()) {
      e.targetPrice = "Required for Above/Below";
    }
    if (!(Number(f.maxStalenessSec) > 0)) e.maxStalenessSec = "Must be > 0";
  }
  if (f.resolverType === "UMA") {
    if (!f.umaQuestion.trim()) e.umaQuestion = "Question required";
    if (!/^\d+$/.test(f.resolutionReward.trim()) || Number(f.resolutionReward) <= 0)
      e.resolutionReward = "Whole VTK amount > 0 — unrewarded UMA markets may never get a proposal";
  }

  return e;
}

/** Mirrors the backend's CREATE_MARKET_STEPS (admin.model.ts) in the exact
 *  order the server emits them over SSE. */
const CREATE_STEPS = [
  { id: "onchain-create", label: "Creating market on-chain" },
  { id: "db-write", label: "Writing market to database" },
  { id: "book-register", label: "Registering order book" },
  { id: "mint", label: "Minting complete set on-chain" },
  { id: "position-sync", label: "Syncing position ledger" },
  { id: "exchange-approve", label: "Approving exchange for settlement" },
  { id: "seed", label: "Seeding two-sided order book" },
] as const;

type StepPhase = "running" | "success" | "error" | null;

/** Parse a fetch response's SSE body, dispatching each `event:`/`data:` frame.
 *  Frames are `\n\n`-separated; data is JSON. Tolerates partial chunks. */
async function readSseStream(
  stream: ReadableStream<Uint8Array>,
  handlers: {
    onStep: (stepId: string) => void;
    onDone: (data: unknown) => void;
    onError: (message: string) => void;
  },
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (event === "step") {
        handlers.onStep((parsed as { step: string }).step);
      } else if (event === "done") {
        handlers.onDone(parsed);
      } else if (event === "error") {
        handlers.onError(
          (parsed as { error?: string }).error ?? "Market creation failed",
        );
      }
    }
  }
}

export function CreateMarketForm() {
  const [f, setF] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [payload, setPayload] = useState<object | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stepPhase, setStepPhase] = useState<StepPhase>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    data?: unknown;
  } | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const { data: categories } = useQuery({
    queryKey: ["market-categories"],
    queryFn: getMarketCategories,
    staleTime: 5 * 60_000,
  });

  const dur = durationSeconds(f.closesAt);
  const yesCents = Number(f.priceCents) || 0;
  const noCents = 100 - yesCents;

  const chainlink = isChainlink(f.resolverType);

  const created =
    result?.ok && result.data && typeof result.data === "object"
      ? (result.data as { marketId?: string; marketAddress?: string })
      : null;
  const shortHex = (h?: string) =>
    h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "—";

  // Success closes the flow AND clears the form (a fresh market next time);
  // an error leaves the form intact so the operator can fix and retry.
  const closeStepModal = () => {
    const wasSuccess = result?.ok === true;
    setStepPhase(null);
    if (wasSuccess) {
      setF(INITIAL);
      setErrors({});
      setPayload(null);
      setResult(null);
      setStepIndex(0);
    }
  };

  const successSummary = result?.ok ? (
    <>
    <p className="mb-2.5 text-[10px] uppercase tracking-[0.16em] text-muted/60">
      summary
    </p>
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12px]">
      <dt className="text-muted/70">Title</dt>
      <dd className="truncate text-right text-fg">{f.title || "—"}</dd>
      <dt className="text-muted/70">Outcomes</dt>
      <dd className="text-right">
        <span className="text-yes">Yes {yesCents}¢</span>{" "}
        <span className="text-muted/40">·</span>{" "}
        <span className="text-no">No {noCents}¢</span>
      </dd>
      <dt className="text-muted/70">Closes</dt>
      <dd className="text-right text-fg">
        {f.closesAt ? f.closesAt.replace("T", " ") : "—"}
      </dd>
      <dt className="text-muted/70">Resolver</dt>
      <dd className="text-right text-fg">{f.resolverType}</dd>
      <dt className="text-muted/70">Seed</dt>
      <dd className="text-right text-fg">{f.shares || "—"} sh / side</dd>
      {created?.marketId ? (
        <>
          <dt className="text-muted/70">Market</dt>
          <dd className="text-right">
            <a
              href={`/markets/${created.marketId}`}
              className="text-accent underline underline-offset-2 hover:brightness-110"
            >
              view ↗
            </a>
          </dd>
        </>
      ) : null}
      <dt className="text-muted/70">On-chain</dt>
      <dd className="text-right font-mono text-fg/70">
        {shortHex(created?.marketAddress)}
      </dd>
    </dl>
    </>
  ) : null;

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate(f);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      setPayload(null);
      setResult(null);
      return;
    }
    const body = buildPayload(f);
    setPayload(body);
    setResult(null);
    setSubmitting(true);
    // Open the stepper on step 1; SSE events advance it from here.
    setStepIndex(0);
    setStepPhase("running");
    try {
      const res = await fetch("/api/admin/create-market", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      // Auth/validation/upstream failures come back as ordinary JSON, not SSE.
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const message = data?.error ?? `Request failed (${res.status})`;
        setStepPhase("error");
        setResult({ ok: false, message });
        return;
      }

      await readSseStream(res.body, {
        onStep: (stepId) => {
          const idx = CREATE_STEPS.findIndex((s) => s.id === stepId);
          if (idx >= 0) setStepIndex(idx);
        },
        onDone: (data) => {
          setStepPhase("success");
          setResult({ ok: true, message: "Market created & seeded.", data });
        },
        onError: (message) => {
          setStepPhase("error");
          setResult({ ok: false, message });
        },
      });
    } catch (err) {
      setStepPhase("error");
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const err = (k: keyof FormState) => errors[k] ?? null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {/* 1. Definition */}
      <Section label="Market Definition" delay={0}>
        <div className="flex flex-col gap-4">
          <Field label="Title" required error={err("title")}>
            <TextInput
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Will BTC close above $120k this quarter?"
            />
          </Field>
          <Field label="Description" hint="Resolution wording / details">
            <TextArea
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Resolves YES if…"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <TextInput
                list="admin-market-categories"
                value={f.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Crypto"
              />
              <datalist id="admin-market-categories">
                {(categories ?? []).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <div className="flex items-end pb-2">
              <Toggle
                checked={f.isFeatured}
                onChange={(v) => set("isFeatured", v)}
                label="Featured"
                hint="Surface in featured / ranking"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* 2. Timing */}
      <Section
        label="Timing"
        delay={60}
        right={
          dur != null ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              closes {humanDuration(dur)}
            </span>
          ) : null
        }
      >
        <Field label="Closes at" required error={err("closesAt")} hint="When trading ends and the market can resolve">
          <TextInput
            type="datetime-local"
            className="date-input"
            value={f.closesAt}
            onChange={(e) => set("closesAt", e.target.value)}
          />
        </Field>
      </Section>

      {/* 3. Outcomes */}
      <Section label="Outcomes" delay={120}>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="border border-line px-2 py-1 uppercase tracking-wider text-muted">Binary</span>
          <span className="text-no">No</span>
          <span className="text-muted/40">/</span>
          <span className="text-yes">Yes</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted/50">fixed · CLOB is binary-only</span>
        </div>
      </Section>

      {/* 4. Liquidity seed */}
      <Section
        label="Liquidity Seed"
        delay={180}
        right={
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            <span className="text-yes">Yes {yesCents}¢</span> · <span className="text-no">No {noCents}¢</span>
          </span>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Launch price (¢)" required error={err("priceCents")} hint="Seeds both books; 50 = 50/50 launch">
            <TextInput
              type="number"
              min={1}
              max={99}
              value={f.priceCents}
              onChange={(e) => set("priceCents", e.target.value)}
            />
          </Field>
          <Field label="Seed size (shares)" required error={err("shares")} hint="Minted per side + depth posted on each book">
            <TextInput
              type="number"
              min={1}
              value={f.shares}
              onChange={(e) => set("shares", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* 5. Trading rules */}
      <Section label="Trading Rules" delay={240}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tick size (¢)" required error={err("tickCents")} hint="Minimum price increment">
            <TextInput
              type="number"
              min={1}
              value={f.tickCents}
              onChange={(e) => set("tickCents", e.target.value)}
            />
          </Field>
          <Field label="Min order (shares)" required error={err("minShares")} hint="Smallest allowed order">
            <TextInput
              type="number"
              min={1}
              value={f.minShares}
              onChange={(e) => set("minShares", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* 6. Resolution */}
      <Section label="Resolution" delay={300}>
        <div className="flex flex-col gap-4">
          <Field label="Resolver type" required>
            <Segmented
              ariaLabel="Resolver type"
              value={f.resolverType}
              onChange={(v) => set("resolverType", v)}
              options={RESOLVER_OPTIONS}
            />
          </Field>

          <Field
            label="Resolution source"
            hint='Human label — e.g. "AdminResolver", "Chainlink BTC/USD", or the UMA question'
          >
            <TextInput
              value={f.resolutionSource}
              onChange={(e) => set("resolutionSource", e.target.value)}
              placeholder="AdminResolver"
            />
          </Field>

          {f.resolverType === "ADMIN" ? (
            <p className="border-l-2 border-line pl-3 font-mono text-[11px] text-muted">
              No extra config. You resolve manually later via <span className="text-fg">setOutcome</span>.
            </p>
          ) : null}

          {chainlink ? (
            <div className="flex flex-col gap-4 border-l-2 border-accent/40 pl-3">
              <Field label="Feed address" required error={err("feedAddress")} hint="Chainlink AggregatorV3 proxy for the pair">
                <TextInput
                  value={f.feedAddress}
                  onChange={(e) => set("feedAddress", e.target.value)}
                  placeholder="0x…"
                  spellCheck={false}
                />
              </Field>
              <Field label="Comparison" required>
                <Segmented
                  ariaLabel="Comparison"
                  value={f.comparison}
                  onChange={(v) => set("comparison", v)}
                  options={COMPARISON_OPTIONS}
                />
              </Field>
              {f.comparison === "RANGE" ? (
                <Field
                  label="Thresholds"
                  required
                  error={err("rangeThresholds")}
                  hint="Comma-separated, ascending, in feed decimals"
                >
                  <TextInput
                    value={f.rangeThresholds}
                    onChange={(e) => set("rangeThresholds", e.target.value)}
                    placeholder="100000, 120000, 150000"
                  />
                </Field>
              ) : (
                <Field
                  label="Target price"
                  required
                  error={err("targetPrice")}
                  hint="Human value; scaled to the feed's decimals (usually 8)"
                >
                  <TextInput
                    type="number"
                    value={f.targetPrice}
                    onChange={(e) => set("targetPrice", e.target.value)}
                    placeholder="120000"
                  />
                </Field>
              )}
              <Field label="Max staleness (s)" required error={err("maxStalenessSec")} hint="Max accepted age of the feed answer">
                <TextInput
                  type="number"
                  min={1}
                  value={f.maxStalenessSec}
                  onChange={(e) => set("maxStalenessSec", e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {f.resolverType === "UMA" ? (
            <div className="flex flex-col gap-4 border-l-2 border-accent/40 pl-3">
              <Field label="Question / ancillary data" required error={err("umaQuestion")} hint="The optimistic-oracle question text">
                <TextArea
                  value={f.umaQuestion}
                  onChange={(e) => set("umaQuestion", e.target.value)}
                  placeholder="Did BTC close above $120,000 on the deadline per…?"
                />
              </Field>
              <Field
                label="Resolution reward (VTK)"
                required
                error={err("resolutionReward")}
                hint="Paid to the winning UMA proposer; pulled from the Treasury at creation"
              >
                <TextInput
                  type="number"
                  min={1}
                  value={f.resolutionReward}
                  onChange={(e) => set("resolutionReward", e.target.value)}
                  placeholder="100"
                />
              </Field>
            </div>
          ) : null}
        </div>
      </Section>

      {/* 7. Advanced */}
      <div className="reveal-rise" style={{ animationDelay: "360ms" }}>
        <details open className="group border border-line bg-surface/40">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
            Advanced (economics)
            <span className="text-muted/50 transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="grid gap-4 border-t border-line px-4 py-4 sm:grid-cols-2">
            <Field label="Max order (shares)" hint="Optional cap per order">
              <TextInput type="number" min={0} value={f.maxShares} onChange={(e) => set("maxShares", e.target.value)} placeholder="—" />
            </Field>
            <Field label="Fee (bps)" hint="100 bps = 1%">
              <TextInput type="number" min={0} value={f.feeBps} onChange={(e) => set("feeBps", e.target.value)} />
            </Field>
          </div>
        </details>
      </div>

      {/* Submit */}
      <div className="reveal-rise flex flex-col gap-3" style={{ animationDelay: "420ms" }}>
        {Object.keys(errors).length > 0 ? (
          <p className="font-mono text-xs text-no">Fix {Object.keys(errors).length} field(s) above.</p>
        ) : null}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer border border-accent bg-accent px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create & Seed Market"}
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted/60">
            {submitting
              ? "Deploying + seeding on-chain…"
              : chainlink
                ? "Chainlink resolvers aren’t wired yet — expect a 501"
                : "Posts to /admin/create-market"}
          </span>
        </div>
      </div>

      {result ? (
        <div className="reveal-rise">
          <Frame
            label={result.ok ? "Created" : "Error"}
            accent={result.ok ? "var(--color-yes)" : "var(--color-no)"}
            className="p-4"
          >
            <p
              className={`font-mono text-xs ${result.ok ? "text-yes" : "text-no"}`}
            >
              {result.message}
            </p>
            {result.data ? (
              <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-fg/70">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            ) : null}
          </Frame>
        </div>
      ) : null}

      {payload ? (
        <details className="reveal-rise border border-line bg-surface/40">
          <summary className="cursor-pointer list-none px-4 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
            Request payload
          </summary>
          <pre className="overflow-x-auto border-t border-line px-4 py-3 font-mono text-[11px] leading-relaxed text-fg/70">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>
      ) : null}

      <ProgressModal
        phase={stepPhase}
        steps={
          stepPhase ? stepsFromIndex(CREATE_STEPS, stepIndex, stepPhase) : []
        }
        title={{
          running: "creating market",
          success: "market created",
          error: "creation failed",
        }}
        caption={{
          running: "running on-chain + off-chain steps…",
          success: "all steps complete",
          error: "stopped — nothing left half-created past this point",
        }}
        message={result && !result.ok ? result.message : null}
        summary={successSummary}
        onClose={closeStepModal}
      />
    </form>
  );
}
