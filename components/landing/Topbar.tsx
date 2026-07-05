import { MonoLabel } from "./ui/MonoLabel";

export function Topbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-30 flex items-center justify-between px-5 sm:px-8 h-14 border-b border-line bg-bg/70 backdrop-blur-sm">
      <span className="font-pixel text-xl tracking-widest text-fg">VERITAS</span>
      <a href="/home" className="pill pill-solid">Launch App</a>
      <button />
      <span className="hidden sm:flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" aria-hidden="true" />
        <MonoLabel>markets.online // oracle.ready</MonoLabel>
      </span>
    </header>
  );
}
