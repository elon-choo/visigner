# Color-forward palettes — impact, not harmony

The system's default gravity is toward timid, harmony-first, single-accent palettes (a near-neutral base with color only on the CTA). That is the exact "safe but colorless/ugly" output users reject. This file is the counterweight: **named palettes that each MANDATE one saturated color field owning a whole section**, with type reversed out of it. Reach for one of these in the plan step's **COLOR COMMITMENT** decision.

**How to use:** pick ONE palette (or derive a grounded equivalent from the subject's own materials). The `field` color is not a mere accent — a full section owns that color. The other roles stay disciplined but hold the same color *position*; they do not retreat to neutral. Transcribe into the page's Tailwind v4 `@theme` as OKLCH. **Vary the DEVICE, not just the hue.** "One full-bleed band with type reversed out" is the default, not the only, way to own color — a dominant saturated surface, a duotone-photography ground, or a structural color system across several sections all qualify. If every page you build uses the identical full-bleed-band-plus-reversed-type move, that device has itself become a template tell (the taste jury scores rote, subject-blind composition DOWN); ground the color POSITION in the subject and let its form vary.

> **Rule of thumb for chroma:** a committed field wants OKLCH chroma **≥ 0.12** (many below want 0.14–0.18). Chroma **0.06–0.12 is under-committed** — it counts as monochrome-timid UNLESS that color still floods a full section field; a mid-chroma color used only as an accent does not clear the floor. If every color in your plan sits under ~0.06 chroma, you are in the monochrome trap — push at least one up. **Where this is checked:** the ≥0.12 chroma is a PLAN / `@theme`-source target — verify it from the OKLCH token values, NOT by eyeballing a JPEG/PNG tile (chroma is not recoverable from a screenshot). The grader judges color *commitment* visually from the tiles (does a saturated field own a section?); the numeric chroma is confirmed from source. "Impact, not harmony" (Awwwards): a slightly *risky* pairing beats a safe complementary one.

---

## 1 · Saturated Field (highest color-confidence — the sim winner's family)
A saturated warm field owns whole sections; ink-black bands cut it; one hot accent for CTAs. Bold, editorial, unmistakably not-monochrome.
- `field` **marigold** `oklch(0.80 0.16 78)` ≈ `#F5A623` — full section bands, type reversed out
- `ink` **near-black** `oklch(0.20 0.02 60)` ≈ `#231A10` — alternating cut bands + body text
- `paper` **warm cream** `oklch(0.96 0.02 85)` ≈ `#F6EFE2` — quiet sections
- `accent` **tomato** `oklch(0.62 0.20 32)` ≈ `#E24E2B` — CTA + focal marks
- `line` ink @ 14%. **Best for:** energetic makers, food/coffee, crowdfunding hype.

## 2 · Jewel Luxe (premium, restraint that still has color)
Deep near-black ground + one jewel that appears STRUCTURALLY (a full emerald band, not just the button), brass hairlines for finish.
- `ground` **espresso-black** `oklch(0.19 0.015 150)` ≈ `#151A16`
- `field` **emerald** `oklch(0.52 0.13 160)` ≈ `#1E7A5A` — owns the hero or one proof band, reversed type
- `paper` **bone** `oklch(0.95 0.012 120)` ≈ `#F0F1EC`
- `accent` **brass** `oklch(0.72 0.11 82)` ≈ `#C39A54` — hairlines, numerals, focal
- **Best for:** heritage goods, tools, premium physical products. (Swap emerald→**sapphire** `oklch(0.48 0.15 255)` ≈ `#1E5F9E` or **amethyst** `oklch(0.50 0.16 300)` ≈ `#7A3FA0` for a different mood — but if you pick a violet, ground it in real proof artifacts so it never reads AI-purple.)

## 3 · Colorful Quiet Luxury (warm analog + one decisive pop)
Answers "I want warm/calm but not sad-beige." Rich earthy base with real depth + ONE saturated joy-color that does emotional work.
- `surface` **clay** `oklch(0.90 0.03 70)` ≈ `#E9DAC6`
- `deep` **cocoa** `oklch(0.34 0.05 55)` ≈ `#4E3626` — bands + text
- `field` **persimmon** `oklch(0.68 0.18 45)` ≈ `#E8722F` — one section owns it, reversed type
- `accent` **teal-pop** `oklch(0.62 0.12 200)` ≈ `#2E9C99` — unexpected-but-right against the warm base
- **Best for:** lifestyle, wellness, food where "warm" is the brief but timidity is the risk.

## 4 · Acid Editorial (Gen-Z / trend-forward energy)
High-key, near-clashing pairing on off-white; oversized type; the tension IS the design.
- `paper` **off-white** `oklch(0.97 0.01 100)` ≈ `#F7F5EF`
- `field` **electric-cobalt** `oklch(0.52 0.20 262)` ≈ `#2649D6` — full bands, reversed type
- `accent` **acid-lime** `oklch(0.88 0.19 128)` ≈ `#C7E23A` — focal, marks, CTA fill
- `ink` **near-black** `oklch(0.22 0.02 262)` ≈ `#1A1E28`
- **Best for:** youthful brands, tech/creator products, anything that must feel *now*. Discipline: exactly one clash, held consistently.

## 5 · Ink & Vermilion (29CM-editorial, monochrome done RIGHT)
The legitimate near-mono lane — but it earns it: pure black/white editorial layout, photo-first, and ONE reserved hot accent used sparingly and decisively (not on every button).
- `paper` **paper-white** `oklch(0.99 0 0)` ≈ `#FDFDFD`
- `ink` **true-black** `oklch(0.18 0 0)` ≈ `#111111` — type does the work; 0px radius, no shadow system
- `accent` **vermilion** `oklch(0.62 0.22 28)` ≈ `#EF3B24` — discount badge / one focal mark ONLY
- **Best for:** fashion, design objects, curatorial commerce. **Only use if** the layout is genuinely editorial (oversized photography, EN category labels at display size, whitespace as the material). Without that discipline this collapses into sad-beige's cousin — do not pick it as an escape hatch from committing color.

---

## Baseline-reject (do NOT ship these as a page's identity)
- **Single-hue / monochrome** (all brown, all beige, all one warm tint) with color only on the CTA. Usable as ONE supporting band, never the whole page.
- **Neutral base + one desaturated accent** (chroma < 0.06) presented as "sophisticated restraint." Restraint is only #5 above, and only with the editorial discipline that earns it.
- **Pure-harmony safe pairing** (brand-blue + grey; analogous pastels) that avoids all tension — "impact, not harmony."

If the subject's real materials point somewhere else, derive a grounded palette instead — but apply the same test: **at least one committed saturated field, chroma ≥ 0.12, owning a section.** Absence of color is not restraint; it is the trap. **The single sanctioned exception to the ≥0.12-field rule is palette #5 (Ink & Vermilion), and only when its editorial-restraint discipline is demonstrably met in the tiles** (see #5 above and the §A editorial-restraint exception in `review-rubric.md`).
