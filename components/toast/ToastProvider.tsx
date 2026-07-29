"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { usePrefersReducedMotion } from "../landing/usePrefersReducedMotion";

gsap.registerPlugin(useGSAP);

type ToastTone = "yes" | "no" | "accent";

type Toast = {
  id: number;
  title: string;
  body?: ReactNode;
  tone?: ToastTone;
  href?: string;
  /** Set once dismissed → the card plays its exit tween, then removes itself. */
  leaving?: boolean;
};

type ToastInput = Omit<Toast, "id" | "leaving">;

const ToastContext = createContext<{ push: (t: ToastInput) => void } | null>(
  null,
);

/** Fire a toast from anywhere under <ToastProvider>. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const HOLD_MS = 5000;
const MAX_VISIBLE = 4;

/**
 * App-wide toast host. Stacks up to a few toasts top-right, each auto-dismissing
 * after a hold (or on click/✕). Portals to <body> so nothing clips it. Enter and
 * exit are GSAP tweens; a dismissed toast is only removed from state once its
 * exit tween's onComplete fires, so the animation always finishes.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current;
      setToasts((ts) => [...ts, { ...input, id }].slice(-MAX_VISIBLE));
      window.setTimeout(() => dismiss(id), HOLD_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} onExited={remove} />
    </ToastContext.Provider>
  );
}

function Toaster({
  toasts,
  onDismiss,
  onExited,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  onExited: (id: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  // Defer to client so the portal target (document.body) exists.
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,20rem)] flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          toast={t}
          onDismiss={() => onDismiss(t.id)}
          onExited={() => onExited(t.id)}
        />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({
  toast,
  onDismiss,
  onExited,
}: {
  toast: Toast;
  onDismiss: () => void;
  onExited: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();

  const tone =
    toast.tone === "yes"
      ? "var(--color-yes)"
      : toast.tone === "no"
        ? "var(--color-no)"
        : "var(--color-accent)";

  // Enter — slide in from the right + fade (reduced motion: fade only). useGSAP
  // runs in a layout effect, so the from-state applies before paint (no flash).
  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.from(
        ref.current,
        reduce
          ? { autoAlpha: 0, duration: 0.18, ease: "power1.out" }
          : { autoAlpha: 0, x: 16, scale: 0.98, duration: 0.28, ease: "power3.out" },
      );
    },
    { scope: ref },
  );

  // Exit — fires when `leaving` flips true; removes from the list on complete so
  // the tween is never cut short by an early unmount.
  useGSAP(
    () => {
      if (!toast.leaving || !ref.current) return;
      gsap.to(
        ref.current,
        reduce
          ? { autoAlpha: 0, duration: 0.15, ease: "power1.in", onComplete: onExited }
          : {
              autoAlpha: 0,
              x: 16,
              scale: 0.98,
              duration: 0.18,
              ease: "power2.in",
              onComplete: onExited,
            },
      );
    },
    { dependencies: [toast.leaving], scope: ref },
  );

  const card = (
    <div
      ref={ref}
      className="pointer-events-auto border border-line bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      style={{ borderLeft: `2px solid ${tone}` }}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ color: tone }}
          >
            {toast.title}
          </p>
          {toast.body != null && (
            <p className="mt-1 font-mono text-[12px] leading-relaxed text-fg/80">
              {toast.body}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
          className="shrink-0 text-muted transition-colors hover:text-fg"
        >
          ✕
        </button>
      </div>
    </div>
  );

  return toast.href ? (
    <a href={toast.href} onClick={onDismiss} className="block">
      {card}
    </a>
  ) : (
    card
  );
}
