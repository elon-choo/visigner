# Design lexicon — the concrete-keyword library

The one thing that most reliably makes a page read as *authored* rather than *generated*: **each section is directed by a named technique chosen for that section's job**, not by an adjective. "Bold" samples the center of the word "bold" (which in 2026 is acid-green + mono eyebrows + a ghost numeral). A **noun** — `slab-serif price stamp`, `chiaroscuro portrait`, `duotone reportage photograph`, `vermilion single-accent` — collapses the model's sampling space to a point. This file is that library of nouns; `references/anti-ai-tells.md` is why each is needed; `references/design-process.md` is where in the pipeline you pick them.

## How to use it
1. In **stage 5–6** of `design-process.md`, give each section a target **feeling**, then pull 2–4 techniques from the matching shelf below (or query the machine copy):
   ```bash
   node scripts/keyword-picker.js pick  --section proof --mood credible,forensic   # one slot
   node scripts/keyword-picker.js plan  --mode detail --moods "hook:awe; empathy:quiet; proof:credible,forensic; cta:urgent"   # whole arc
   node scripts/keyword-picker.js search "duotone"      # find a term
   ```
   (The machine copy is `scripts/design-lexicon.json`; this markdown is its human-readable source.)
2. **Rules that prevent a new house style** (enforced by the process, worth stating here):
   - Adjacent sections may **not** share a feeling; no feeling appears more than twice on a page; **at least one quiet beat is mandatory**.
   - No technique (beyond ≤3 declared house constants) appears in more than **2 sections**.
   - Every technique you place must be **checkable in a screenshot** — if you can't point at it in the pixels, it isn't resolved yet.
3. **Anti-AI column legend:** `HIGH` = naming this strongly escapes the generic center (prioritize these); `MED` = helps in context; `LOW` = hygiene or a term whose value is knowing *not* to over-use it (it names the center itself — fence it into captions, don't build the identity on it).

---

## Typography

| Term | Effect | Use when | Anti-AI |
|---|---|---|---|
| **Grotesque sans / 그로테스크 산세리프** (Akzidenz lineage; Sandoll 고딕Neo1, Spoqa) | Workmanlike industrial warmth; "printed object" not "tech startup" | Hero/body for confident plainness, explicitly instead of Pretendard-by-default | MED |
| **Humanist sans / 휴머니스트** (Gill, Frutiger, Optima) | Warm, literate — "a person wrote this" | Long-form KR/Latin body, testimonials, humane credibility | MED |
| **Old-style / Garalde serif** (Garamond, Bembo, Caslon) | Bookish humanist authority; centuries-of-print gravitas | Editorial body, essay sections, "we actually read" credibility | HIGH |
| **Transitional serif** (Baskerville, Times) | Rational elegance; newspaper-of-record authority | Data-plus-prose, agenda tables, credibility blocks | MED-HIGH |
| **Didone / 디돈** (Didot, Bodoni) | Fashion-magazine glamour; expensive air | ONE super-scale display headline/numeral; never body | HIGH |
| **Slab serif / Egyptian** (Rockwell) | Sturdy vernacular hand-bill energy — loud without neon | Price/offer, deadline callouts, old-poster urgency | HIGH |
| **Clarendon** | Victorian-Americana warmth; friendly authority | FAQ headers, guarantee/refund sections | HIGH |
| **Fat face / 팻 페이스** (Thorowgood) | Circus-poster shout; maximal drama in one word | A single 1–2 word hook ('마감', 'LIVE') as the whole section | HIGH |
| **Reverse-contrast / Italian** (French Clarendon) | Deliberately "wrong"; unmissably intentional tension | One disruptive section header when the page risks monotony | HIGH |
| **Blackletter** (Fraktur, Textura) | Heraldic, subcultural, certificate weight | A single accent word or seal motif | HIGH |
| **Brush script** | The human hand present; speed, appetite | One annotation ('진짜예요') over set type, not wholesale headlines | MED-HIGH |
| **Stencil face** | Utilitarian, cargo/military, crate physicality | Logistics/준비물/deliverables; anything implying physical goods | HIGH |
| **Ink trap** (Whyte Inktrap) | Print-machinery honesty made decorative; craft-rooted modern | Display sizes wanting "modern" without geometric blandness; ration to one | HIGH (MED if over-used) |
| **Engraved / copperplate caps** | Institutional, diploma-grade trust | Guarantee, credentials, instructor-bio headers | MED-HIGH |
| **Optical sizing (opsz)** | Page reads "typeset", not "scaled" | Any serif/high-contrast family at both 16px and 120px | HIGH |
| **Oldstyle figures** | Numbers melt into text like words; bookish polish | Dates/quantities inside sentences | HIGH |
| **Tabular lining figures / ledger setting** | Columns of times/prices lock in; numbers feel audited | Agenda tables, pricing, countdowns, 비교표 — the ONLY place mono-adjacent styling belongs | MED |
| **Small caps (real)** | Labels whisper instead of shout; understated formality | **The replacement for mono eyebrows** — section labels, names, meta rows | HIGH |
| **Hanging punctuation** | Invisible refinement; compositor's hand | Pull quotes; large-quote settings | HIGH |
| **Discretionary ligatures & alternates** | A word becomes a drawn object; logotype quality without a logo | One hero word or event name | MED-HIGH |
| **Swash capitals** | Ceremonial flourish; invitation-card intimacy | Opening/closing lines, invitation-toned CTA | HIGH |
| **Tight-not-touching** (Lubalin school) | Dense confident headline mass — "bold" via spacing not weight | Short punchy Latin/numeral headlines | HIGH |
| **Negative leading** | Monolithic poster block; typography as architecture | 3–4 line manifesto headlines, section openers | HIGH |
| **Narrow editorial measure** (~KR 28–38자) | Book-page intimacy; slows the reader on purpose | Story/philosophy sections between conversion blocks | HIGH |
| **Justified block with hyphenation** (KR 어절 조정) | Newspaper/document gravity; text as a solid rectangle | Terms, syllabus, fine print where document-ness builds trust | HIGH |
| **Rag control** (구 단위 개행) | Left-set text stops looking auto-flowed | Every 2+ line headline | MED-HIGH |
| **Run-in head** | Dense editorial texture; kills label-then-box rhythm | FAQ, curriculum — anywhere using chip+card repetition | HIGH |
| **Type on a path** | Badge/emblem energy; hand-made composition | Seals, a circular text ring around a real photo | HIGH |
| **Rotated spine text** | Print-poster architecture; activates dead edges | Section numbers/running titles along the viewport edge instead of ghost numerals | HIGH |
| **Mixed-face (ransom) setting** | Cut-and-paste urgency, zine energy | One rebellious headline max per page | HIGH |
| **Variable-font axis play** | Type that breathes; one family generating its own drama | Progress indicators, hover states, weight-ramp headlines | MED-HIGH |
| **Custom / Hangul lettering** | Unrepeatable, ownable; a literal human artifact | The event wordmark or one hero hangul word; once; if not affordable, fall back to named-face-stack — never a filtered system serif | HIGH |
| **Myeongjo / 명조체** (산돌 정체, 순바탕, Noto Serif KR) | Literary sincerity, premium warmth — opposite of app-UI voice | Headlines + long copy on story/emotional sections | HIGH — AI KR pages default to bold gothic; myeongjo alone shifts register |
| **Named-face stack / 명명 서체 스택** (no system fallback) | The hero reads typeset by intent; kills filter-over-fallback fake lettering and glyph accidents | Every display myeongjo or lettering moment; verify the webfont painted, never feTurbulence over an unnamed serif | MED |
| **Gyeon-gothic / 견고딕·견출고딕** | 1980–90s Korean print punch; vernacular urgency | Retro-newsprint promos, price/deadline shouts | HIGH |
| **Talnemo / 탈네모꼴** (안상수체 lineage) | Experimental, design-literate Korean modernism | Manifesto headlines for design-aware audiences | HIGH |
| **Vertical setting / 세로쓰기** | Pre-modern gravity; a vertical line acts like a seal/spine | One heritage moment: epigraph, certificate, closing statement, edge-rail | HIGH |
| **Heritage signboard lettering / 옛 간판체** | 장인/노포 authenticity; analog-city warmth | 현장/craftsmanship narratives; anti-corporate tone | HIGH |
| **Panbon / 판본체** (훈민정음 언해본) | Founding-document authority; museum-grade Koreanness | Heritage branding, opening declarations, seal lockups | HIGH |
| **Brush calligraphy accent / 붓글씨** (갈필 dry-brush) | Breath and body; emotional-peak marking | The single most emotional claim — once | MED-HIGH |
| **Hanja garnish / 한자 병기** (現場, 記錄) | Masthead gravitas; intellectual density | Section markers — '記錄 一' **instead of** '기록 01' in Plex Mono | HIGH |
| **Rubrication / 주서(朱書)·붉은 먹 강조** | One ink change carries section hierarchy inside the document genre | Replace mono kickers, coverlines, 기록 NN labels on document/archival pages; share the vermilion ink with the seal | HIGH |
| **Mixed-script typesetting / 국영문 혼용** | The KR/Latin seam disappears; internationally art-directed | 한글 owns emotion, EN owns data — one consistent secondary style, not scattered labels | HIGH |
| **Condensed display / 장체** | Urgency, poster energy; controlled shouting | Agenda timelines, date/venue lockups | MED-HIGH |
| **Type as container / 글자 속 조판** | The big glyph earns its size by carrying cargo | The one big numeral the page deserves — **the upgrade for the ghost-numeral** | HIGH |
| **Kicker done right / 어깨제목** (in the text face, small caps) | Newsroom taxonomy, not techwear garnish | Only when the category adds information — **the corrective for tell #1** | MED |
| **Monospace / 모노스페이스** | Machine log, raw data | ONLY literal code/data; as a decorative eyebrow it is the #1 AI tell — **ban it there** | LOW (value = naming what to remove) |
| **Neo-grotesque** (Helvetica, Univers) | Anonymous, systematic, invisible | Only when neutrality IS the point (wayfinding); never the whole identity | LOW — this IS the AI center; fence into captions |

## Color

| Term | Effect | Use when | Anti-AI |
|---|---|---|---|
| **Tone-on-tone / 톤온톤** (one hue across a lightness/chroma ladder, hue drift, no black/white) | Quiet luxury; bold color without poster-shout | **The way to keep a green identity without kelly+black** | HIGH — the hue-drift/no-black nerve is what AI ramps lack |
| **Jewel tones / 주얼 톤** (emerald, sapphire, ruby, amethyst) | Opulent, nocturnal, velvet-curtain | Evening/live-event framing, premium "theater" mood | HIGH — "emerald" lands where acid-green never goes |
| **Earth / clay palette / 어스·클레이** (terracotta, ochre, umber, moss) | Grounded, tactile, artisanal trust; anti-digital by temperature | Craftsmanship, 현장, sustainability narratives | HIGH |
| **Split-complementary** | Vibrant but controllable tension | Energy across sections without one screaming accent | MED-HIGH |
| **Analogous palette** | Enveloping atmospheric harmony | Mood-setting hero/closing where calm immersion beats contrast | MED |
| **Tetradic** (two complementary pairs, one dominant) | Festival-poster abundance when area-weighted | Multi-track agenda where each track earns a hue | MED |
| **Duotone / 듀오톤** | Photography becomes graphic; unifies mixed-quality photos | Real event/speaker photos of varying quality; one ink pair sitewide | HIGH as a bridge for real photos; MED as a look (vary the pair) |
| **Pastel with grit / 그릿 파스텔** | Soft but not sweet; nursery colors with zine attitude | Approachable-but-credible education; softening hard topics | HIGH |
| **High-key palette** | Airy morning-light optimism; huge perceived whitespace | Opening sections, fresh-start positioning | MED-HIGH |
| **Low-key palette** (e.g. three different near-blacks) | Cinema-dark intimacy; anything light becomes precious | Studio-at-night live framing; countdowns | HIGH |
| **Color blocking** (large hard-edged solid planes, 70/20/10) | Architectural confidence; sections become rooms | Chapter differentiation IF proportions vary asymmetrically | MED (degrades into equal bands without the asymmetry) |
| **Flat spot color / 별색** (one ink + black + paper) | Letterpress economy; restraint reads as conviction | Whole-page systems | HIGH — a constraint, not a vibe |
| **International Klein Blue (IKB)** | Art-historical monastic intensity; a blue with an author | One immersive full-bleed pause section | HIGH — a named pigment beats "a bold color" |
| **Signature brand color** (Hermès-orange class) | Instant recognizability; luxury discipline | Pick the exact hue before design; forbid neighbors | HIGH |
| **Overprint / multiply / 오버프린트** | Layered depth with honest color logic — overlaps mean something | Venn diagrams, image-over-type, duotone stacks | HIGH |
| **Muted field + one hot accent / 저채도+단일 강조** | The accent detonates; color = information | CTA discipline page-wide (accent = CTA/price only) | HIGH — inverts the flood-accent ratio that defines the AI look |
| **Chromatic grays / 유채색 회색** (greige, slate, green-gray) | Alive atmospheric neutrals; page feels lit, not rendered | All "gray" UI — pick a temperature and commit | HIGH — pure-neutral ramps are a machine tell |
| **Paper-white / warm ground / 미색** (ivory, cream, kraft) | Print-object materiality; screens stop glowing | Default ground for editorial/heritage; pure white only inside photos | HIGH — one hex swap removes the screen-native feel |
| **Tinted near-black / 먹색** (blue-black, brown-black, never #000) | Ink depth; darks harmonize | Every dark element — **the fix for the black half of the acid cliché** | HIGH |
| **Obangsaek / 오방색** (청·적·황·백·흑) | Ceremonial Koreanness; festivity | Heritage positioning, 명절 timing, cultural content | HIGH |
| **Dancheong palette / 단청** | Ornate sacred rhythm; Korean maximalism with strict rules | Borders, pattern bands, festival accents on heritage pages | HIGH |
| **Natural-dye Korean hues / 쪽빛·치자·꼭두서니** | Hanbok-cloth softness; heritage without loudness | Calmer KR-heritage palettes where 오방색 would shout | HIGH |
| **Palette from photograph / 사진 추출** | Uncanny cohesion — UI and imagery share DNA | Photography-led pages: ground from shadows, accent from brightest object | HIGH |
| **Color gel lighting / 컬러 젤 조명** | Bold committed color WITH depth, falloff, shadow — color as LIGHT | When the brand needs a strong color field — **shoot the color instead of flooding a div** | HIGH — the definitive answer to the acid flood |
| **Teal & orange grade** | Photos read "cinema"; unifies a mixed set | Mixed-source photos needing one filmic treatment; low intensity (~15%) | MED (cliché at high intensity) |
| **Film stock color (Portra look)** | Human nostalgic warmth with a named referent | All people photography on trust pages — name the stock in the brief | HIGH |
| **Equiluminant vibration** (Op-art) | Electric intentional discomfort | Tiny doses: a 'LIVE' badge, a hover; never body surfaces | HIGH |
| **Selective color / 부분 채색** | Sin-city focus; the colored object becomes the subject | Product/prop emphasis inside real photography | MED-HIGH |
| **OKLCH perceptual ramp** | Ramps without dead/neon steps; dark-mode stays on-brand | Engineering any palette into tokens | MED |
| **Acid / neon brights** | Rave shock — now shorthand for "AI trying to look bold" | Almost never as a field; ≤2% sliver inside a muted system | LOW — the confirmed cliché; the term enforces the area cap |

## Layout / Editorial

| Term | Effect | Use when | Anti-AI |
|---|---|---|---|
| **Manuscript grid** | Slows the reader; literary seriousness | Maker story, founder letter, long-form 공감 AI would cardify | HIGH |
| **Broken / deconstructed grid** | Tension reads authored because the order stays legible | Exactly ONE climactic section (reveal, offer) — never page-wide | HIGH |
| **Asymmetric balance** | Dynamic, editorial, alive; symmetric = template | Heroes/openers: headline mass off-axis, small counterweight far edge | HIGH — center-stacked heroes are the #1 AI composition |
| **Rule of odds** (groups of 3/5, one dominant) | One protagonist; composed, not inventoried | Benefits, credentials, proof — item 1 at 2× size | MED |
| **Rabatment of the rectangle** | Feels "right" without being centered or thirds-obvious | Positioning headline/subject in full-bleed heroes | HIGH — an obscure rule AI never produces |
| **Golden-section layout** (~61.8/38.2) | Classical inevitability vs arbitrary 50/50 | Two-element sections; text measure vs viewport | MED |
| **Asymmetric diptych / 비대칭 펼침면** (70/30 fold) | The size ratio itself becomes the editorial opinion | 지금까지/이제부터, before/after, us/them pairs — never two equal-width bordered boxes | HIGH |
| **Full-bleed / 풀블리드** | Immersion and confidence; un-boxed | One hero photo + at most one mid-page break | HIGH with photography; LOW as flat color flood (that IS the cliché) |
| **Margin drama / 여백 드라마** (40% empty as statement) | Luxury; emptiness reads as paid-for real estate | Premium sections, price reveal, closing statement | HIGH — AI fills space symmetrically |
| **Cross-gutter overlap** | Depth by occlusion, no drop shadows | Photo+caption pairs, headline over image edge, stamp over a seam | HIGH — AI keeps everything in separate lanes |
| **Diagonal axis composition / 사선 구도** | Motion and urgency without animation | Agenda/timelines; before→after transitions | HIGH — AI sections are all horizontal bands |
| **Scale drama / 스케일 대비** (10×+ size difference) | Visceral hierarchy — a shout and a whisper | The one number/word carrying the argument | MED alone; HIGH paired with type-as-container |
| **Whitespace as asset / 여백=자산** | The isolated element gains value; premium-KR reset | Around the single accent, price, brand name; a near-empty 100vh before CTA | HIGH — AI abhors a vacuum |
| **Text runaround** (shape-outside) | Type and image physically coexist; print-native | Maker story with a cut-out portrait/silhouette | HIGH — practically never in AI output |
| **Magazine cover logic** (masthead, cover line, issue date) | A published periodical artifact, not a landing page | Event heroes: the event is 'Issue 01', the speaker is the cover subject; coverlines cluster as one block — see coverline-block | HIGH — a complete alternative hero grammar |
| **Coverline block / 커버라인 클러스터** | Hero emptiness reads composed around a dense cluster instead of unfinished sparseness | Hero rails carrying 3+ meta items under magazine-cover logic; anchor 3–5 short lines to masthead or trim edge | MED |
| **Editorial spread layout** (dominant image, cross-column headline, drop cap, pull-quote) | Reads as published journalism | Instructor story or long-form '왜' as one feature | HIGH — dismantles the label→content band |
| **Editorial spread logic / 펼침면 사고** (element begun in N resolves in N+1) | Scroll momentum; sections become pages of one story | 공감→해결 transitions; a rule/thread crossing the section break | HIGH — attacks self-contained-band monotony directly |
| **Pull-quote** (display scale, hung quotes) | Skimmers get the thesis; a second louder voice | Testimonials/story — pull the customer's most SPECIFIC sentence at 4× | HIGH (with real hung punctuation and scale) |
| **Sidenote / marginalia / 방주** (Tufte) | Scholarly intimacy; density without clutter | Caveats, survey n's, '왜 이 가격인가' honesty beside claims | HIGH — margins are unused AI territory |
| **TOC device** (real anchors, folio numbers, dot leaders) | Publication feel; self-selection | Long pages (8+ sections); doubles as agenda pacing | MED (must carry real function) |
| **Masthead / 제호** | The event becomes a title; institutional authority | Top of page only, at that scale; '제1호/창간호' framing | MED-HIGH |
| **Deck / standfirst / 리드문** (written as argument) | Carries skimmers across each fold; real 3-tier hierarchy | Under every major headline, replacing the gray subheadline blob | HIGH — a written-through standfirst is an editor's fingerprint |
| **Drop cap / 드롭캡** | "The story starts here"; strongest one-character print cue | Opening of the one long-form story — once per page, ever | HIGH — nearly absent from AI output |
| **Interview Q&A format** | Claims become testimony; reader eavesdrops (29CM staple) | Speaker intro, FAQ upgrade, 증명 — bullets converted to asked-and-answered | HIGH — restructures information flow |
| **Contact sheet device** (frames, sprocket edges, one grease-penciled select) | Abundance of real material + an editor's choice | 현장 사진, recaps, deliverable iterations | HIGH — presupposes real photography; antidote to repeated mockups |
| **Catalog plate layout / 도판** (object, plate number, precise caption) | Any item becomes an artifact; caption precision = credibility | Deliverables wall: each item a numbered plate with real specs | HIGH — replaces outline-chip grids |
| **Footnote apparatus** (superscripts → sources at section foot) | Marketing claims inherit academic accountability | 통계·성과 claims; price conditions | MED-HIGH — real citations are unfakeable |
| **Caption discipline** (write the caption FIRST) | Photos become evidence with provenance | All photography — '2026.5.14 밤 10시, 3기 종료 직후' | HIGH — falsifiable specificity; also displaces mono metadata |
| **Colophon / 판권면** (who made this, with what typefaces, when) | Closes the artifact like a book; craft transparency | Footer, replacing the link farm | HIGH — self-aware craft AI never volunteers |
| **Bleed crop** | The subject reads larger than the page; contained = timid | Hero portraits, product shots, numerals cut by the edge | HIGH |
| **Column / modular / baseline grid** | Order with variety felt per section; dense info feels curated | Any multi-section page — the anti-AI move is **varied span/occupancy**, not one card width | MED |
| **Bento — and the escape / 탈벤토** | Standard bento reads Apple-derivative; broken version keeps density, regains authorship | Feature roundups only if cells become truly unequal and one item refuses its cell | LOW as-is; MED broken |
| **Z-pattern / F-pattern scan** | Predictable CTA landing / front-loaded meaning | Hero + sparse sections / curriculum, FAQ, long 증명 (payoff word first) | LOW — hygiene |

## Motion

| Term | Effect | Use when | Anti-AI |
|---|---|---|---|
| **Scroll choreography** (ONE held moment, all else quiet) | Pacing like edited film | Plan on paper per-section BEFORE building | HIGH — AI's uniform fade-up is motion monotone |
| **Ken Burns / slow push-in** (≤5–6% zoom) | A still photo acquires cinema's breathing | Full-bleed photographic heroes instead of autoplay video | HIGH — cannot be applied to flat vector; forces photography in |
| **Mask / clip-path reveal** (image scaling 1.08→1.0) | Editorial "page uncovered" vs generic fade | Hero images, big pull-quotes, chapter breaks | MED |
| **Scroll-scrubbed animation** | Time becomes tactile; reader in physical control | ONE hero-grade sequence per page max | MED — restraint separates it from parallax spam |
| **Scrollytelling / pinned section** | One idea at a time gets full attention | The single hardest-to-explain concept — exactly one | MED-HIGH — breaks rhythm monotony |
| **Dolly-in / push-in** (1.0→1.12 on scroll-in) | Viewer drawn INTO content | Entering the core-offer section; the 본론 transition | MED — cinema physics |
| **Kinetic type moment** (variable weight 300→900 on entry) | The word performs itself; memorable because singular | Hero or pivot claim only; must actually move and couple to semantics | MED — decorative wiggle reads template |
| **Morph transition (FLIP)** | Object identity preserved; UI feels solid | Tab switches, card→detail expansion | MED — AI hard-swaps states |
| **Hover micro-state** (drawn underline, B&W→color flood) | "Someone cared about the 2% interactions" | Links, cards, CTA — not generic lift+shadow | MED |
| **Staggered / cascade reveal** (40–90ms) | Rhythm and reading order | Restrict to ONE list; consider zero entrance animation as the distinctive choice | LOW — common now; restraint is the move |
| **Duration hierarchy** (fast/medium/slow, 3 tiers) | One physical system with mass, not equal pops | Define once before animating | LOW — uniform-300ms-everything is the subtle tell |
| **ease-out-expo** / **spring (drag only)** / **anticipation** / **follow-through** | Craft settle; physical mass; intentional motion | Entrances / drag-toggle-drawer only / press states / card entrances | LOW — invisible craft |

## Film grammar

| Term | Effect | Use when | Anti-AI |
|---|---|---|---|
| **Establishing shot** (full-bleed environmental hero) | The reader knows WHERE before reading anything | Page-opening hero for anything with a real venue/scene | HIGH — demands a real environmental photograph |
| **Extreme close-up / macro crop** | Intimacy and evidence: you can't fake this close | Proof — deliverable, tool, instructor's hands at work | HIGH — unreproducible in flat vector |
| **Insert shot** (cutaway to a detail object) | Tangible evidence punctuation; rhythm like a comma | Between long text: one small photographed detail instead of an icon | HIGH — replaces the browser-mockup device |
| **Chiaroscuro** (subject emerging from deep shadow) | Gravitas, spotlight reverence; mastery and stakes | Instructor-authority sections — one lit face out of darkness instead of an avatar chip | HIGH — directed light, polar opposite of flat flood fields |
| **Jump cut rhythm** (sections change register violently) | Attention jolted awake; edited-by-a-human-with-opinions | Act breaks: after image-dense proof, cut to a stark screen with one 12px line | HIGH — counter to same-band-every-section |
| **Match cut** (a form echoed transformed in the next section) | Sections authored as one continuous thought | Problem→solution: the falling red curve returns rising | HIGH — cross-section planning AI cannot do |
| **Montage sequence** (dense burst of small real photos) | Volume and momentum in one glance | Track record: 20+ small real images beat 3 mockups | HIGH — needs genuine varied assets |
| **Practical light** (visible in-frame source) | The scene explains its own light; documentary-true | Workspace/현장: faces lit by their actual monitors | HIGH — guarantees environmental realism |
| **Halation** (film highlight bleed, CineStill) | Warm chemical highlights vs digital clipping; analog nostalgia | Night/neon/screen-glow treatments; shot-on-film heroes | HIGH — emulsion physics asserts a photochemical world |
| **Shallow DOF / bokeh** | Physically impossible in vector; certifies a camera was present | Instructor portraits, product heroes, venue atmosphere | HIGH — fastest one-image cure for everything-flat |
| **Rack focus** (focal plane shifts A→B) | Attention physically pulled | Before/after, problem/solution as layered photographs | HIGH |
| **Rule of thirds / leading lines** | Tension and direction; the eye is steered | Hero composition; photography that aims at the headline/button | MED (needs real images) |
| **Letterbox / 2.39:1** | Content borrows cinema's authority; a "screening" moment | One key image per page; letterboxed stills as chapter dividers | MED — breaks card monotony |
| **Dutch angle** (2–5° off-axis) | Unease, energy, grid disruption | Problem sections; ONE rotated element against a strict grid | MED |
| **End-credits sequence** (small-caps role/name columns) | Ceremonial closure; everyone becomes cast | Team/thanks/speaker roster at page end — **replaces avatar grids** | MED-HIGH |

## Photography / Art direction

| Term | Effect | Use when | Anti-AI |
|---|---|---|---|
| **Rembrandt lighting** (45° key, triangle on the shadow cheek) | Classical painterly credibility | The single main instructor/founder portrait — brief this exact word | HIGH — a named spec forces a real directed shoot |
| **Rim / edge light** (bright silhouette line, Apple look) | Sculptural premium-tech pop from darkness | Dark-mode product/deliverable heroes | HIGH — kills flat-vector and flood-green at once |
| **Hard vs soft light** (one temperament for all page photos) | Hard = graphic punch; soft = calm trust | Set once so the set feels art-directed, not stock-assembled | HIGH — the strongest "there was an art director" signal |
| **Golden hour** | Instant warmth, nostalgia, optimism — bypasses copy | Lifestyle/outcome imagery; closing sections before CTA | HIGH — a time-of-day spec no vector counterfeits |
| **Blue hour** (deep-blue ambient + warm artificial) | Cinematic "night shift" dedication mood | Grind/problem sections; live-at-night framing | HIGH — also supplies a real (non-acid) blue-green source |
| **Low-key lighting** | Mystery, exclusivity, insider-knowledge mood | "What most people don't know" / closed-door method sections | HIGH |
| **High-key lighting** | Openness, honesty, nothing-to-hide | Pricing/guarantee/refund; welcoming instructor imagery | MED |
| **Flat lay / 플랫레이** (90° overhead) | Inventory-as-story; casually credible completeness | '무엇을 받게 되나' — photograph the actual kit instead of listing chips | HIGH |
| **Knolling** (like objects grouped, every edge 90°) | Obsessive order = professional rigor | Curriculum/toolkit; numbered-callout knolling replaces '첨부 01/02/03' | HIGH |
| **Hero product macro** (material detail larger than life) | Engineered, inspectable; detail = confidence | Top-of-page/offer — print the ebook, shoot the paper grain | HIGH — the opposite of flat mockups |
| **Environmental / lifestyle** (real context of use) | Viewer projects themselves in; context persuades | Audience-identification, instructor credibility | HIGH — real mess and light |
| **In-situ mockup** (design composited into a real photographed device) | Software becomes an object in the world | Every screenshot — **replaces the flat browser frame** | HIGH — direct cure for repeated window-chrome |
| **Still life / tabletop + cast shadow** (hard directional light, long shadow) | "Someone spent an afternoon lighting it"; the shadow proves 3D | Deliverables, kits, books on colored seamless grounds | HIGH — the anti-flood-fill |
| **Direct-flash snapshot** | Immediacy and honesty; anti-corporate cool | Behind-the-scenes, 현장의 하루 real moments | HIGH — the imperfections are the credibility |
| **Reportage photography** (hands, screens mid-task, whiteboards) | "This actually happens" — strongest 증명 for education | Replace every repeated mockup with photos OF the tool in use, dated | HIGH |
| **B&W reportage / documentary grain** (Magnum tradition) | Gravity and truth-claim; history being recorded | Origin-story; contrast against a colorful page | HIGH |
| **Archival ephemera / scanned object** (tickets, receipts, notes, tape) | Forensic authenticity; a scrapbook of a real history | 증명/story: scan the actual handwritten notes, the first hand-drawn curriculum; requires >=1 captured artifact — simulated-only pastiche is banned (tell #21 instance) | HIGH — requires possessing physical objects |
| **Hand-drawn annotation / 손그림 주석** (marker circles, arrows) | A teacher personally pointed at THIS part | Screenshot walkthroughs — instead of geometric callout boxes | HIGH — wobbly line quality reads human |
| **Hands-in-frame / 손 등장** | Scale, ownership, warmth; a held object is real | Every deliverable shot — phone held, workbook written-in | HIGH — skin and grip are hardest to counterfeit |
| **Color gel lighting** (studio lights through gels) | Bold committed color WITH depth and shadow | When the brand demands a strong field — shoot the color as light | HIGH — the definitive answer to the acid flood |
| **Dragged shutter / motion blur** | Elapsed time frozen — the room was ALIVE | Live-event proof: instructor sharp, note-taking hands flowing | HIGH — temporal physics certifies a real event |
| **Scanography** (objects on a flatbed scanner) | Clinical-poetic specimen look; archival evidence | Course materials, notes, tools as artifacts | HIGH — almost never in AI output |
| **Prop styling** (3–5 named props encoding the customer's world) | Context whispers the story | Any staged photo (영수증 뭉치, 도장, 믹스커피) | HIGH — AI props are generically wrong |
| **Silhouette / contre-jour** | Poster-like drama; aspirational gesture | Closing "become this person" imagery before final CTA | HIGH — extreme contrast without acid-green |
| **Portra / named film stock look** | Human warmth with a named verifiable target | All people photography on trust pages | HIGH — replaces "make it warm" |
| **Behind-the-scenes candid** / **overhead tabletop scene** / **instant-film frame** / **specular highlight** / **vignette** | Transparency; credible clutter; kept-snapshot warmth; material finish; optical focus | Trust/process/community sections; product shoots | HIGH / HIGH / MED / HIGH / MED |

## Branding

| Term | Effect | Use when | Anti-AI |
|---|---|---|---|
| **Art direction** (one concept sentence + a non-web referent) | Styled vs directed; coherence with a point of view | Write '이 페이지는 ___처럼 보인다' before tokens — **the root-cause fix** | HIGH — a positive concrete referent replaces "be bold" |
| **Brand world / 세계관** (places, rituals, objects, vocabulary) | Every asset feels excerpted from one continuous reality | Write 5 lines of the world; every section must be shootable inside it | HIGH — a declared world GENERATES specific choices |
| **Graphic motif** (one ownable device DERIVED from meaning, 3+ roles) | Recognition compounds; sections cohere through the motif, not sameness | Derive from the subject (a red grease-pencil circle doing three jobs) | HIGH — derived is specific; borrowed chips are not |
| **Monogram / seal system / 모노그램·도장 시스템** | Identity marks read carved and owned; roles become artifacts of the document world | Team and role rosters, approval marks, signature blocks — each seal differs in cut, all share one ink and impression texture | HIGH |
| **Tone of voice** (do/don't pairs, one castable speaker) | Mixed registers are a subtle AI tell | Pick the speaker ('후배에게 말하는 10년차'), rewrite every heading in that mouth | HIGH — verbal specificity forces visual specificity |
| **Visual identity vs logo** (survives the crop test) | Systemic, not cosmetic, distinctiveness | Audit: hide the logo — could this section be anyone's? | MED |
| **Tagline vs descriptor** | Clarity and feeling coexist | Hero lockup: descriptor small, tagline at display size; never two vague lines | MED — kills the double-vague-headline stack |
| **Illustration language** (a named style, era, line weight) | Illustration becomes a brand asset | Only when a real style is affordable ('1970s 과학교과서 도해'); else photography | MED-HIGH |
| **Texture library** (YOUR scanned paper, YOUR noise) | Sections feel printed by the same shop on the same stock | Assemble once per brand; reuse | MED |
| **Iconography system — or NONE** | Feature-icon rows are core AI-slop furniture | Consider replacing icons with numerals, photographs, or typographic marks | LOW-MED — the higher-value move is usually deletion |

## Web-UI

| Term | Effect | Use when | Anti-AI |
|---|---|---|---|
| **Section rhythm / pacing / 완급 조절** (score section volumes before building) | Scroll fatigue vanishes; each section lands by contrasting its neighbor | LOUD hero → quiet text → dense proof → near-empty 여백 → LOUD offer | HIGH — direct attack on structural monotony |
| **Hero thesis** (one claim + one evidence + one action) | 3-second comprehension; everything below proves it | Write the sentence before visuals; 4+ hero elements = no thesis | MED — kills the badge+headline+sub+2CTA pileup |
| **Focal hierarchy** (one #1 per viewport; squint test) | Instant legibility of intent | QA per viewport: if #1 isn't obvious in 1s, demote something | MED |
| **Sticky buy-bar** (price/deadline + CTA, quiet styling) | Zero-cost conversion path at any depth | Pages over ~5 viewports; suppress in hero; no pulsing, no red | MED — restraint of styling is the premium signal |
| **Above-the-fold priority / thumb zone / anchor nav** | First-screen discipline; one-handed reach; explorable long pages | Every build / mobile CTA / 8+ sections | LOW–MED — hygiene |

## Korean commerce

| Term | Effect | Use when | Anti-AI |
|---|---|---|---|
| **29CM PT format / 브랜드 프레젠테이션** (webzine story, specs late, buy module last) | Selling by world-building; documented sales lifts | The structural referent for premium 상세페이지 | HIGH — a named, studied KR-native template replacing ten abstract rules |
| **Empathy section / 공감** (the customer's pain in their own concrete words) | '내 얘기다' recognition; earns the right to pitch | After the hook; from real interviews, actual phrasing quoted | HIGH — verifiable specificity generated copy can't supply |
| **Proof stack / 증명** (numbers → named/dated testimonials → third-party → footnotes) | Converts the skeptical majority; the gradient matters more than volume | After 해결; screenshots as scanned evidence | HIGH — real artifacts can't be prompted into existence |
| **Maker story / 메이커 스토리** (first-person why, failures, real artifacts) | Parasocial trust; Wadiz funding hinges on it | Mid-page: manuscript grid + drop cap + scanned artifacts + signature | HIGH |
| **Rationed editorial EN label / 편집형 EN 라벨 (배급제)** | At 1–2 per page: imported-magazine sophistication; at every section: the cosplay tell | Masthead + at most one divider; all else 한글 in the body face | HIGH — **the rationing rule IS the fix** |
| **Hook (3-second open) / 후킹** | Determines read-through of everything below | Lead with the reader's own moment; product name arrives one viewport later | MED — specificity of the scene is the content |
| **Solution reveal / 해결** (single pivot, product enters as answer) | Relief dynamics; deserves its one broken-grid/held moment | Once, after 공감 peaks; visually discontinuous | MED |
| **Reward tiers / 리워드 티어** (2–4 tiers, one recommended, caps as facts) | Anchoring/urgency through structure, not red banners | Wadiz offers; sold-out struck honestly | MED — honesty of presentation is the premium marker |
| **Comparison table / 비교표** (concede at least one cell) | Does the shopper's homework; most-revisited block | Vs 독학/유튜브/타강의; a footnote explains the tradeoff | MED — the honest concession is the human tell |
| **Trust badges / 신뢰 배지** (one monochrome row, real, dated, linked) | Borrowed authority | Near price/CTA | MED — restraint separates premium from 오픈마켓 |
| **CTA placement rhythm** (peaks only; verb varies by readiness) | Asking at the right beats reads confident | ≤3 in-flow CTAs + sticky bar | MED |
| **Cut-out / 누끼 컷** (isolated on a color field, real shadow kept) | Photographic realness + full layout control | Offer stacks, price sections | MED — shadow fidelity decides crafted vs not |
| **Calm-fact deadline / 담백한 마감 고지** (folio line) | Scarcity inherits the credibility of documented fact instead of countdown theatre | Replace 4-box countdown grids in offer/CTA; date, time, seat cap as plain text with tabular figures | HIGH |
| **Smart-store tells (BAN)** — red timers, rainbow badges, drop-shadow card grids, 형광 강조, 100% 만족 | Reads 저가 오픈마켓; caps the price point | Hard ban at QA; restate urgency as a calm fact (folio line) | HIGH as negative knowledge — the SECOND cliché pole |

## Material-texture

| Term | Effect | Use when | Anti-AI |
|---|---|---|---|
| **Film grain / 필름 그레인** (3–6% over images AND flat fields) | Time, air, physicality; a grained field no longer reads vector flood | Cheapest depth insurance; dark mood sections | HIGH — direct counter to zero-texture |
| **Halftone / 망점** (~20 lpi, decisively coarse) | Newsprint mechanical warmth; images become artifacts | Retro-editorial photo treatment; dot gradients as graphics | HIGH as a named period system |
| **Uncoated paper / 비도공지 overlay** (~8% multiply) | The page becomes a printed thing; outlaws shadow/glow at once | Whole-page finish for editorial/heritage; over color bands and cards | HIGH |
| **Risograph / 리소그래프** (fluoro spot inks, misregistration, overprint) | Zine warmth, hand-run physicality; imperfection as process proof | Community/indie tones; a riso 2-color numeral replaces the ghost outline | HIGH (ration — climbing the trend curve) |
| **CMYK / registration misprint** (magenta plate 3px off) | Print-shop humanity; energy on static type | One display headline or numeral — **a concrete ghost-numeral replacement** | HIGH |
| **Grain gradient** (heavy dithered noise) | Analog spray-paint blends instead of digital ramps | Backgrounds, a sprayed halo behind the price instead of a smooth glow | HIGH (ration) |
| **Texture close-up / 질감 클로즈업** | Pure tactility; a sense of touch | Section-break interstitials; where AI would place flat color | HIGH — literal injection of the missing depth |
| **Letterpress impression / 형압** | Tactile luxury; manufactured, not composited | Seal moments, ticket-stub CTA, certificate guarantees — tiny doses | MED — skeuomorphic overuse dates fast |

---

## Anti-AI Tell Additions

| Tell | Counter | Keywords |
|---|---|---|
| **#22 Uniform document-frame loop** — same hairline rectangle as the only container primitive | Cap identical border signatures at <=4/page; use tint, whitespace, overlap, plate layout, or paper-layer depth; only one real scanned artifact earns a frame | `background tint shift` · `whitespace grouping` · `cross-gutter overlap` · `catalog plate layout` · `paper-layer collage depth` |
| **#23 Typeset fake hand-annotation** — rotated serif slip cosplaying handwriting | Use real scanned handwriting/brush calligraphy, or honest unrotated marginalia; never tilt type to fake a hand | `hand-drawn annotation (real scan)` · `brush calligraphy accent` · `sidenote / marginalia` · `archival ephemera (flatbed scan)` |
| **#21 instance: archival-ephemera pastiche** — simulated document world with zero captured artifacts | Require >=1 real captured artifact per archival-genre section; flag when simulated-paper devices outnumber captured artifacts | `scanography` · `archival ephemera (real flatbed scan)` · `reportage photography` · `insert shot` |

---

## Section × Feeling × Effect map

The selection infrastructure in table form. Per section: pick ONE feeling (adjacent sections must differ; no feeling more than twice; one quiet beat mandatory), then 2–4 effect keywords from its shelf + name the banned default. No technique (beyond ≤3 house constants) in more than 2 sections. This is exactly what `keyword-picker.js plan` emits.

### Hook / Hero — feelings: `awe·현장 스케일 (LOUD)` · `매거진 커버 권위` · `내 얘기다 첫 문장`
Shelf: establishing shot (full-bleed 현장 photo + film grain) · magazine cover logic · hero thesis · fact-first/dateline/quote-hook opener · myeongjo display set off-grid, overlapping the photo edge · bleed crop through the subject · rabatment/rule-of-thirds placement · negative-leading stack · palette from photograph · Ken Burns push-in · line-mask split-text (hero only).
**Banned:** badge/eyebrow above H1 · centered symmetric stack · acid flood · ghost numeral · Space Grotesk/Inter.

### Empathy / Pain — feelings: `조용한 공감 (HUSHED)` · `내 얘기다` · `밤의 답답함`
Shelf: manuscript grid, narrow measure · warm paper ground + warm ink black · verbatim quotes, typos intact · pull-quote of the reader's own words · hand-drawn pencil underline on one phrase · blue-hour / practical-light photography · direct-flash snapshot vignettes · drop cap (the once-per-page use) · low-key lighting · marginalia for the survey n.
**Banned:** benefit cards · mono eyebrows · boxed chips · "It's not X, it's Y" cadence.

### Mechanism / Solution — feelings: `명료한 전환 (MEDIUM)` · `안도` · `질서`
Shelf: whitespace pivot (near-empty viewport, one sentence) · jump cut (light after dark) · pinned scrollytelling for the ONE hard concept · match cut (falling curve returns rising) · type as container (solid numeral carrying the steps) · true timeline device · named illustration language for the diagram · editorial spread logic bridging 공감→해결.
**Banned:** STEP 01/02/03 scaffolding · ghost numerals · 3-card feature row · bento reflex.

### Proof / Evidence — feelings: `만져지는 신뢰 (MEDIUM-DENSE)` · `물증` · `규모`
Shelf: reportage photography (over-shoulder, dated captions) · annotated screenshot (red marker + 손글씨) · scanned-object/archival ephemera · contact sheet with one grease-penciled select · montage mosaic of 24 small real images · KakaoTalk capture proof · footnote apparatus · caption discipline · count-up stat with tabular figures · polaroid frames taped · dragged-shutter live shot · named+dated+photographed testimonials.
**Banned:** repeated browser-chrome mockups · letter-square avatars · avatar-card testimonial grid · 100% 만족 claims.

### Product-visual / Deliverables — feelings: `물성·갖고 싶음` · `정밀함` · `구성의 풍성함`
Shelf: still life with cast shadow on colored seamless · hero product macro · flat lay/knolling with thin captions · in-situ mockup (real device, reflections kept) · hands-in-frame · rim light on dark ground · seamless sweep in the brand color · specular highlight kept · 누끼 with real grounding shadow + big type behind · catalog plate layout · color gel lighting.
**Banned:** empty window-chrome frames · flat vector mockups · icon rows for deliverables · outline chips.

### Story / Maker — feelings: `진정성·육성 (INTIMATE)` · `세월` · `사람`
Shelf: manuscript grid + drop cap · interview Q&A · B&W reportage of the 무명 시절, caption = year only · scanned pencil signature on paper stock · marginalia asides · editorial spread (big portrait, 2-col body, pull-quote) · behind-the-scenes candid strip · chiaroscuro/Rembrandt portrait · Portra grading on all people photos · spoken-register headlines.
**Banned:** SaaS founder-quote card · em-dash-chain copy · stock-smiling portraits.

### Offer / Pricing — feelings: `명료한 가치 (ORDERED)` · `정직` · `무게`
Shelf: modular grid ledger with tabular figures · comparison table with an honest concession · reward tiers (recommended marked with the grease-pencil motif, sold-out struck) · margin drama (half the viewport empty around the price) · scale drama (one solid cropped '0원' at 30vw, conditions inside the 0) · slab-serif/fat-face price stamp, 2° off on kraft · footnoted conditions · broken grid (the price block's one earned violation) · monochrome trust-badge row.
**Banned:** rainbow badge rows · red countdown bombs · drop-shadow card grids · glow borders.

### CTA — feelings: `긴박한 결단 (LOUD — the page's ONLY saturation spike)` · `초대` · `당신 차례`
Shelf: single restrained accent appearing here and nowhere else (vermilion on 신청하기 + deadline only) · condensed display countdown at poster scale · ink-stamp/letterpress pressed button state · calm-fact deadline as a folio line · silhouette contre-jour or golden-hour closing image · swash capital opening the invitation line · near-empty 90vh palate-cleanser immediately before · sticky buy-bar in bone-white · type-on-a-path seal.
**Banned:** pulsing/blinking urgency · a button after every band · generic gradient CTA · tracked micro-label above the button.

### FAQ / Guarantee — feelings: `실무적 안심 (QUIET)` · `정직한 마무리`
Shelf: run-in heads (「환불 규정.」 bold, body follows) · Clarendon Q&A heads with thin double rules · verdict-first answers ('환불됩니다 —' then detail) · justified two-column fine print with a column rule · footnotes on every conditional · high-key instructor photo beside the refund policy · interview-format upgrade · colophon as the true final section.
**Banned:** uniform accordion chips · outline pills · gray centered disclaimer lines.

---
Machine copy: `scripts/design-lexicon.json` (consumed by `scripts/keyword-picker.js`). Sources: research corpus (2024–2026 practitioner/trend/process writing) — see `references/anti-ai-tells.md` §Sources.
