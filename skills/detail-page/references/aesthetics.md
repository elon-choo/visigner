# Aesthetics — making a page look *chosen*, not templated

Adapted from Anthropic's `frontend-design` skill (Prithvi Rajasekaran, Alexander Bricken) + CRO/typography research. The mechanism to beat: **distributional convergence** — without explicit direction a model samples from the high-probability center of its training data, which *is* the "AI slop" look. Generic is the default failure mode, not a random one. You must push *away* from it with negative constraints, not just positive taste.

## The two-pass method (this is the whole game)

**Pass 1 — plan a compact token system** (in thinking, before any code):
- **Color**: 4–6 named hex values. Dominant + sharp accent, not 5 timid pastels. "Dominant colors with sharp accents outperform timid, evenly-distributed palettes."
- **Type**: typefaces for 2+ roles — a characterful **display** used with restraint, a complementary **body**, a **utility/mono** for captions/data if needed.
- **Layout**: a one-sentence concept + ASCII wireframe to compare options.
- **Signature**: the single unique element the page is remembered by, embodying the brief.

**Pass 2 — critique the plan against the brief**: work through what you'd produce for *any* similar prompt. Wherever your plan lands in the same place, that part is a default, not a choice — revise it and state what you changed and why. Only build once the plan is provably specific to this brief. Then derive every color/type decision from the plan.

> Do the planning and iteration in your thinking; only show the user output once you're confident it'll delight them.

## Ground it in the subject

The hero is a **thesis**: open with the most characteristic thing in the subject's world (a headline, image, animation, live demo, interactive moment). The subject's materials, instruments, artifacts, and vernacular are where distinctive choices come from. Build with the brief's real content throughout — placeholder copy makes a design feel as templated as placeholder visuals.

## Structure is information

Structural devices — numbering, eyebrows, dividers, labels — must encode something *true* about the content, not decorate it. `01 / 02 / 03` markers are only right if the content actually is a sequence (a real process, a timeline). Question each device before using it.

## Typography

- **Never**: Arial, Inter, Roboto, Open Sans, Lato, system defaults.
- **Pick one distinctive face and use it decisively.** Families by mood:
  - *Editorial / serif display*: Playfair Display, Fraunces, Crimson Pro, Newsreader, Gloock
  - *Startup / geometric sans*: Clash Display, Satoshi, Cabinet Grotesk, General Sans, Switzer
  - *Technical*: IBM Plex (Sans/Mono), Source Sans 3, Geist
  - *Code / mono accent*: JetBrains Mono, Fira Code, Space Grotesk, DM Mono
  - *Distinctive*: Bricolage Grotesque, Obviously, Boldonse
- **High contrast = interesting**: display + mono, serif + geometric sans, or one variable face across extreme weights.
- **Use extremes**: 100/200 weight vs 800/900 (not 400 vs 600). Size jumps of 3×+, not 1.5×.
- Self-warning: don't default to Space Grotesk (or Satoshi) just because it's the "safe distinctive" pick — that's convergence wearing a costume.
- Source free-for-commercial faces from **Fontshare** (`api.fontshare.com/v2/css?f[]=clash-display@600&f[]=general-sans@400,500&display=swap`) or Google Fonts.

## Color

- Commit to a cohesive aesthetic; drive it with CSS variables.
- **60-30-10**: 60% dominant surface, 30% secondary, 10% accent. The 10% accent is the brightest and marks the focal point — **reserve it for the primary CTA**. The rule's real job is removing color that competes with itself.
- Avoid clichéd schemes, **especially ungrounded purple gradients on white**. For AI/digital commerce, purple/blue can work only when it is part of a concrete artifact/proof system rather than a generic AI mood.
- Generate shade ramps in **OKLCH** by holding hue *roughly* fixed and stepping lightness in *near-even* steps (chroma may arc for vividness mid-ramp), not by naively lightening/darkening one hex. A clean ramp ≈ `oklch(L C H)` with L in near-even steps (e.g. .96/.90/.76/.56/.40/.27) at a near-fixed H (a small hue drift toward warmth as it darkens is fine).
- **Single token source — a Tailwind v4 `@theme` block.** Express every color/font/shadow token ONCE inside `@theme { --color-*: oklch(…); --font-*: …; --shadow-*: … }`; v4 turns each token into BOTH a CSS variable (`var(--color-ink)`) AND a utility (`bg-ink`/`text-ink`/`shadow-e2`), so there is no second config object or parallel `:root` hex list to drift out of sync. The starter (`assets/starter/index.html`) is wired this way via `@tailwindcss/browser@4` (`<style type="text/tailwindcss">`); for production compile the SAME `@theme` block with the Tailwind CLI. Never reintroduce a `tailwind.config` colors object alongside a separate `:root` list.
- Draw palettes from IDE themes, cultural aesthetics, or the subject's real-world materials. Tune live in **Realtime Colors**, then transcribe the result into the `@theme` block as OKLCH so no default class leaks through.
- **Dev/designer handoff:** the token system is also a deliverable. `tokens/` holds the DTCG source (compile with `scripts/build-tokens.js`); for any built page, `scripts/emit-tokens.js <page.html>` regenerates a `tokens.json` (OKLCH-native, DTCG) **and** a self-contained `spec.html` swatch/type/elevation sheet straight from its `@theme` — so engineering gets a spec that can't drift from what shipped.

## Spacing, scale, depth

- **8pt grid**: spacing tokens 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. No arbitrary px. Start with too much whitespace, then remove. Related items closer than unrelated (inner gap < outer gap).
- **Type scale** hand-picked, not a pure ratio: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 / 64. Adjacent steps must be visibly distinct; lock line-heights to a 4pt rhythm.
- **Hierarchy via weight + color first, size second.** De-emphasize by lowering contrast, not shrinking.
- **Elevation**: 3–4 named shadow tokens, never one-off box-shadows. Atmospheric backgrounds (layered gradient/pattern/texture matched to the aesthetic) beat flat solids — but match complexity to the vision.

## Motion

- One **orchestrated** moment (a page-load with staggered `animation-delay`, or one scroll reveal) lands harder than scattered micro-interactions. Extra animation is itself an AI-generated tell.
- CSS-only for HTML artifacts; the `motion` (Framer Motion) library for React.
- Always honor `prefers-reduced-motion`.

## Copy is design material

Words exist to make the design easier to understand. Write from the user's side of the screen; name things by what people control, not how the system is built. Active voice: a control says exactly what happens ("Save changes", not "Submit"), and keeps the same name through the whole flow (button "Publish" → toast "Published"). Errors never apologize and are never vague about what happened; empty states are an invitation to act. Specific always beats clever.

## Restraint & self-critique

Spend your boldness in **one** place — the signature — and keep everything around it quiet. Cut decoration that doesn't serve the brief. Critique as you build by taking **screenshots** (a picture is worth 1000 tokens). Chanel's rule: before leaving the house, remove one accessory. Watch CSS specificity collisions (`.section` vs `.cta` cancelling paddings/margins between sections). Quality floor, never announced: responsive to mobile, visible keyboard focus, reduced motion respected.

## Top 20 — what most separates professional from AI-generated

1. Plan a token system + a named **signature element** before coding.
2. Ban the 6 generic fonts; one distinctive display + body, high contrast; don't default to Space Grotesk.
3. Kill the unearned purple/blue-on-white gradient; one committed color + sharp accent, accent saturation < 80%, no neon glow. If AI/digital Wadiz uses purple, require proof modules and non-purple secondary accents.
4. 60-30-10; the 10% accent is for the primary CTA only.
5. Don't center everything — asymmetric / split / content-left+asset-right; center only short hero copy.
6. Ground the hero in the subject; ban the big-number+stats+gradient template hero.
7. One layout primitive, repeated, becomes the signature — not 3–7 mismatched cards.
8. No emoji as icons/bullets — one real icon set (Phosphor / Radix / Lucide).
9. 8pt spacing grid, hand-picked scale, zero arbitrary px.
10. Hand-picked type scale, extreme weight contrast, ≥3× size jumps for hierarchy.
11. Hierarchy via weight + color first; de-emphasize by lowering contrast, not shrinking.
12. Generous whitespace; group by proximity (inner < outer gaps).
13. One orchestrated entrance animation; honor reduced-motion; no scattered micro-interactions.
14. Atmospheric backgrounds, not flat solids.
15. 3–4 elevation tokens, never ad-hoc shadows; OKLCH shade ramps; all tokens defined ONCE in a Tailwind v4 `@theme` block (single source → both vars and utilities).
16. Spend boldness in exactly one place; keep the rest disciplined.
17. Copy is design: active voice, control-named buttons, specific > clever, no "Build the future".
18. Primary CTA above the fold + repeated; CTA = focal accent + verb + ≥44px touch target; trust signals adjacent.
19. Quality floor: responsive, visible focus, reduced motion, no CSS specificity conflicts.
20. For product pages, story-structure the body (PASONA / Wadiz arc) — story-structured pages convert ~2× higher. See `korean-detailpage.md`.

## Sources
- Anthropic `frontend-design` SKILL.md — github.com/anthropics/claude-code/tree/main/plugins/frontend-design
- Anthropic cookbook, *Prompting for Frontend Aesthetics* — platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics
- *Improving frontend design through Skills* — claude.com/blog/improving-frontend-design-through-skills
- Refactoring UI (spacing/scale/hierarchy), 60-30-10 (hype4.academy), 8pt grid (cieden.com)
- AI-slop tells — 925studios.co/blog/ai-slop-web-design-guide · prg.sh "Why Your AI Keeps Building the Same Purple Gradient Website"
