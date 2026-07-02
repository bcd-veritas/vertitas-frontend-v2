# Veritas v2 — Landing Page Design

**Date:** 2026-07-02
**Status:** Approved
**Scope:** Marketing landing page at `/` in veritas-v2 (fresh Next.js 16 project). No equivalent exists in v1.

## Purpose

A landing page that introduces the Veritas prediction market before the app itself is ported to v2. Design direction comes from three references:

1. **zen.ai (variant.com share)** — layout skeleton: a huge centered object with technical annotation callouts, monospace system labels framing the viewport, giant wordmark as an identity moment.
2. **FOXTROVE (variant.com share)** — visual skin: warm near-black + pale pink palette, pixelated bitmap display font, dot-grid background, wireframe mesh terrain waves in the hero, monospace status chips, pixel-number entrance loader.
3. **oryzo.ai (Lusion)** — scroll behavior: one persistent 3D object that travels and transforms through the content sections as the user scrolls.

The central object is a **3D wireframe crypto token (coin) with a "$" on its faces** — replacing zen.ai's noise circle, built in the mesh-line design language of FOXTROVE.

## Visual system

### Palette (CSS variables in `globals.css`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#1A1616` | Page background (warm near-black) |
| `--surface` | `#221D1D` | Cards / panels |
| `--accent` | `#F6DCD4` | Pale pink: CTAs, token material, highlights |
| `--fg` | `#F2EFED` | Headings |
| `--muted` | `#A89F9C` | Body text |
| borders | white @ ~8% | Hairlines |

Yes/No market colors (green/red) appear only inside the market-card teasers, desaturated to fit the theme.

### Typography

- **Display:** pixelated bitmap font for headlines (candidate: Pixelify Sans or a VT323-style face; final pick during implementation based on closest render to the FOXTROVE reference).
- **Body:** clean grotesque (Inter or Geist).
- **System labels:** monospace (Geist Mono or JetBrains Mono), uppercase, letter-spaced.

### Furniture

- Faint dot-grid background across the page.
- `+` registration marks at section corners.
- Monospace micro-labels framing content: `SYS.ID: VRT-LANDING-01`, `STATUS: LIVE`, `MARKETS.ONLINE // ORACLE.READY`.
- Thin technical annotation lines with labels pointing at the token (zen.ai style).

## Entrance loader

- Fixed overlay in `--bg`; bottom-right pixel-font number counts 0→100.
- Eased, ~2s, tied to actual canvas readiness with a minimum duration (no flash).
- At 100: overlay wipes upward; hero staggers in (headline lines rise, token scales/fades in with a spin-up).
- Skipped (instant reveal) for `prefers-reduced-motion`.
- Plays once per session (`sessionStorage` flag).

## Page structure — five sections

1. **Hero** — Monospace topbar (VERITAS wordmark left, status chip right). 3D token large center-right; wireframe mesh terrain waves behind it (hero only). Technical annotation callouts point at the token ("MESH.TOKEN — USDC COLLATERAL", "PROBABILITY ENGINE"). Left column: monospace eyebrow (`FOR FORECASTERS, NOT GAMBLERS` — placeholder, copy refined in implementation), giant pixel headline **"TRADE WHAT COMES NEXT."**, one-line subcopy, pale-pink pill CTA **Launch App** + ghost pill **How It Works** (anchor to section 2).
2. **How it works** — Three annotated technical cards: ① Pick a market ② Buy Yes or No shares — price = probability in ¢ ③ Correct shares redeem $1.
3. **Live markets teaser** — 3–4 static market cards in v2 theme (title, big mono Yes %, mini sparkline, volume). Hardcoded sample data; no API dependency.
4. **Resolution & trust** — How markets settle: oracle feeds + community dispute/vote, rendered as a horizontal mono-labeled stepper of the market lifecycle (created → trading closes → resolution → dispute window → community vote → finalized), matching v1's admin lifecycle model.
5. **Final CTA** — Token returns front-and-center at hero scale; giant pixel wordmark **VERITAS** beneath it (zen.ai "primary identity mark" moment); Launch App button; minimal footer.

CTAs link to `/markets` (future app route; acceptable as a dead route for now).

## 3D token & scroll choreography

### Token

- Wireframe cylinder coin: pale-pink emissive lines over a barely-visible dark fill so the lines glow.
- Extruded **$** glyph proud of both faces.
- Idle: gentle rotation + mouse-tilt parallax in the hero.
- Budget: ~2–3k triangles.

### Canvas

One fixed, full-viewport, transparent react-three-fiber canvas overlays the page; content scrolls beneath it. The token is the only persistent element. Mesh waves exist only in the hero and dissolve on leaving it.

### Scroll script (GSAP ScrollTrigger, scrubbed, one master timeline)

| Transition | Token behavior |
|---|---|
| Hero → How it works | Shrinks, glides left, flips edge-on, settles beside step cards; soft spin "tick" as each step passes |
| How it works → Markets | Banks right, tilts to coin-on-table perspective above the cards, slow pre-flip spin |
| Markets → Resolution | Slides along the lifecycle stepper line with scroll; quick scale-pulse "stamp" at finalize |
| Resolution → Final CTA | Sweeps to dead center, scales to hero size, straightens face-on, eases into slow rotation above the VERITAS wordmark |

### Reduced motion

`prefers-reduced-motion`: token renders statically in the hero only, no scroll choreography, sections use plain fades, loader skipped.

### Mobile

Token remains, but choreography simplifies to scale/opacity keyframes only (no x-travel). Waves at reduced density.

## Architecture

### Dependencies to add

`three`, `@react-three/fiber`, `@react-three/drei`, `gsap`, `@gsap/react`. No framer-motion — GSAP is the single animation system.

### Component structure

```
app/page.tsx                     server shell
components/landing/
  LandingPage.tsx                client orchestrator
  Loader.tsx                     entrance counter overlay
  TokenCanvas.tsx                R3F scene root (fixed, transparent)
    Token.tsx                    coin mesh + $ glyph + idle motion
    MeshWaves.tsx                displaced wireframe plane (hero only)
  useTokenScrollTimeline.ts      ALL ScrollTrigger keyframes in one place
  sections/
    Hero.tsx  HowItWorks.tsx  MarketsTeaser.tsx  Resolution.tsx  FinalCta.tsx
  ui/
    PixelHeading.tsx  MonoLabel.tsx  AnnotationLine.tsx
```

Theme tokens as CSS variables in `app/globals.css` (Tailwind v4 `@theme`).

### Performance

- Canvas `dpr` capped (e.g. `[1, 1.75]`).
- Waves: single low-poly plane with vertex displacement.
- Rendering paused when the tab is hidden.
- Loader gates reveal until the canvas has produced its first frames.

## Error handling

- WebGL unavailable/context-lost: hide the canvas, keep the full HTML content usable (the page must read fine with no 3D at all).
- Fonts load via `next/font` (no FOUT flash against the loader).

## Testing / verification

Visual work — verification is:
1. `npm run build` passes clean.
2. Live preview walkthrough: loader plays once, all five sections render, token choreography tracks scroll in both directions.
3. `prefers-reduced-motion` emulation: no loader, static token, content readable.
4. Mobile viewport (~375px): layout intact, simplified choreography.

**Constraint:** this Next.js version has breaking changes — read the relevant guides in `node_modules/next/dist/docs/` before writing code (per AGENTS.md).

## Out of scope

- Porting any v1 app functionality (markets, trading, admin) — separate projects.
- Real market data on the landing page.
- The `/markets` app route the CTAs point to.
