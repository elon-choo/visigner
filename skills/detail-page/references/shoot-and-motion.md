## 5 · Shoot (look at the pixels — the PixelRAG step)

Render and screenshot your own output, then actually read the images:
```bash
${CLAUDE_PLUGIN_ROOT}/bin/shoot <file-or-url> [outDir]   # the short wrapper — resolves the global node_modules (Playwright/axe) + the script path
# fallback (no wrapper on PATH): NODE_PATH=$(npm root -g) node scripts/shoot.js <file-or-url> [outDir]
```
It saves a full-page PNG + viewport tiles. Read the tiles and critique what you SEE: hierarchy, rhythm, alignment, the banned-default tells, mobile legibility. To ground the design in a real reference first (competitor / exemplar), capture it the same way: `node scripts/capture-reference.js <url> [outDir]` or, for harder Wadiz/Akamai pages, `MAX_TILES=120 node scripts/capture-reference-patchright.js <url> [outDir]`. Reference captures are valid only when the output reports `coveredHeight >= pageHeight` or the page is intentionally capped. See `scripts/README.md`.

**Prove the motion, don't assert it** (all additive, flag-guarded — the default shoot and every existing gate are unchanged):
```bash
# Entrance filmstrip — now also captured at the 390px mobile context (filmstrip-mobile-*.png + run.json.motion.mobileFrames[]);
# the desktop strip (filmstrip-*.png / run.json.motion.frames) is unchanged.
FILMSTRIP=1 ${CLAUDE_PLUGIN_ROOT}/bin/shoot <file-or-url> [outDir]
# Reduced-motion HONESTY gate (implied by FILMSTRIP=1/MOTION=1): emulates prefers-reduced-motion:reduce, lets @media
# re-resolve, and asserts EVERY active transition/animation collapses to ~0. A @media(reduce) block that's a no-op
# duplicate FAILS (run.json.motion.reducedMotionHonored=false; offenders in reducedMotionOffenders[]) — the gate now
# ALSO fails on a still-running WAAPI/Framer animation under reduce (offender carries source:'waapi'), and SHOOTS
# reduced-motion-*.png frames as pixel proof (run.json.motion.reducedMotionFilmstrip[]). Adds gate check
# reducedMotion (severity block); honored=null (eval threw) reads as unknown and never silently passes.
REDUCED_MOTION=1 ${CLAUDE_PLUGIN_ROOT}/bin/shoot <file-or-url> [outDir]
# Interaction motion — films a ~600ms window around a triggered state, then runs the same layout-property audit
# (warns if a triggered element animates a layout prop) SCOPED to the triggered subtree. Records
# run.json.motion.interactions[]; gate check motionInteraction (severity warn) now reports pass:false (was
# vacuously true) when the trigger selector isn't found or captures no frames — detail adds `unproven=N`.
# Pipe-separate several; default event is click.
MOTION_TRIGGER='a:click|.menu:hover' ${CLAUDE_PLUGIN_ROOT}/bin/shoot <file-or-url> [outDir]
# SCROLL-into-view mode — MOTION_TRIGGER='scroll:<selector>' films the element OFF-screen, scrolls it into view, and
# captures pre + a ~600ms reveal window into interact-scroll_<sel>-*.png, running the SAME duration/easing/layout audit
# as a scroll-reveal. Still pipe-separable and still supports the 'selector:event' form above.
MOTION_TRIGGER='scroll:.reveal|a:click' ${CLAUDE_PLUGIN_ROOT}/bin/shoot <file-or-url> [outDir]
```
**Easing is now graded from real data.** `run.json.motion` carries `easings[]` — one `{sel, enter, exit, fn}` per animated element (resolved entrance/exit timing functions + the raw computed `fn`) — alongside the existing `durations[]`. The motion audit emits two easing reasons in `motion.warnings[]`: `linear-or-default-entrance` (entrance ease is `linear` or the CSS-default `cubic-bezier(0.25,0.1,0.25,1)`) and `no-enter-exit-asymmetry` (`enter===exit`, severity `warn`, never blocks — transitions are inherently symmetric so it fires broadly; informational). The off-token **duration band** is derived from the page's own `--dur-*`/`--duration-*` tokens unioned with the fallback `[120,150,200,250,320,400,700]` (now includes **150**), so a committed 150ms motion token no longer reads as off-token. The off-token **>600ms too-long** warning now EXEMPTS infinite/looping animations (`animation-iteration-count:infinite`, e.g. a skeleton pulse) — off-token-duration warnings still apply. **Script-generated WAAPI/Framer animations are captured too:** `run.json.motion.jsAnimations[]` records one `{sel,durationMs,easing,props,iterations,playState}` per entry from `document.getAnimations()` (script-generated only), on both the full-page audit and each `interactions[]` entry, so a JS-driven animation is graded with the same band/easing/layout rules as a CSS one. `design-critic MODE=motion` reads these fields directly.
**`STATIC=1` lint refined** (the no-browser source pass): raw-color now matches only valid 3/6/8-digit hex inside inline `style="…"` and Tailwind `[#…]` values (so visible text like order no. `#1042` no longer false-positives), plus three new checks surfaced in `run.json.static` — **block** `aiDefaultColors` (the AI-default hex families `#7c3aed/#6366f1/#8b5cf6/#a855f7/#4f46e5` + oklch/hsl purples in hue 270–310 with chroma ≥ 0.04) and **warns** `lowContrast` (naive <4.5 WCAG on inline color+bg pairs) and `structuralSlop` (centered ≥5 blocks · ≥3 sibling-equal cards · big-number hero) — the two new warns are non-blocking. **Four false-positive fixes:** (1) it now **strips HTML comments before every heuristic**, so `NOT Inter` in a comment no longer trips the banned-font check and a commented-out `<img>` no longer trips `imgMissingAlt`; (2) **banned-font detection is scoped to actual `font-family` declaration VALUES + font-CDN `family=` params with word boundaries**, so `Inter` inside `interface` no longer false-fails; (3) the `structuralSlop` **card counter only counts card-like class signatures** (a class carrying a `card`/`tile` token), so repeated utility classes like `text-muted`/`nav-item` are no longer miscounted as a card grid; (4) the **centered-everything count excludes heading elements (h1–h6)** — a centered `<h2>` is normal hierarchy, not the "center everything" tell.

