#!/usr/bin/env node
'use strict';

/*
 * G5.4k: build the one gallery tile that is supposed to fail — and make the failure visible.
 *
 * Rounds 1-7 shipped a gallery whose tiles were all pages the gate had passed, which asks the
 * reader to take the refusal on faith. This makes the refusal a photograph too, and it does it
 * without hand-authoring a page: it takes a selection the composer really produced from a brief
 * (case-saas-release) and repeats section 2 immediately after itself. Nothing else changes —
 * same modules, same copy, same order otherwise.
 *
 * FIRST ATTEMPT, AND WHY IT WAS WRONG. The first version of this script copied section 1's five
 * variation axes onto section 2 instead. The gate refused that selection with five violations, so
 * on paper it worked. The tile did not: the refused page and the passing page came out with the
 * SAME md5 (e529af451b8608e2d55b8a3601f9ee34), because the two page.html files differ by exactly
 * one line — the data-variant-* attributes — and no CSS in the assembled page keys off those
 * attributes. The variation axes are declared metadata that the grammar gate reads; they do not
 * by themselves move a pixel. What actually gives a section its face is which MODULE it is. A
 * tile of that violation would have been a picture of nothing, which is the exact defect this
 * round exists to remove.
 *
 * So the injected violation is now one that a reader can see: the same module, with the same
 * copy, rendered twice in a row. That trips
 *   adjacent-same-type, adjacent-layout-archetype, adjacent-variant-diversity, type-archetype-repeat
 * and it looks like what those rules are named after.
 *
 * The assembler does NOT enforce the composition grammar — that is a separate gate that runs after
 * assembly — so this selection still assembles into a complete page, and the page is what gets
 * photographed. The gate's exit code is recorded next to the tile in the shot manifest.
 *
 * The composer's own selector would never emit this: composer-select.js filters candidates through
 * the same rules while it searches, so a brief cannot ask for it. That is why the violation is
 * injected here, downstream of selection, rather than written into a brief.
 *
 * usage: node v3/scripts/g54k-make-refusal-case.js
 */

const fs = require('fs');
const path = require('path');

const V3_ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(V3_ROOT, 'composer', 'case-saas-release', 'selection.json');
const TARGET_DIR = path.join(V3_ROOT, 'composer', 'case-saas-release-refused');
const REPEATED_INDEX = 1; // section 2 of the source selection

function fail(message) {
  process.stderr.write(`g54k-make-refusal-case: ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(SOURCE)) fail(`${path.relative(V3_ROOT, SOURCE)} does not exist; run the composer for that brief first`);
const selection = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
if (!Array.isArray(selection.sections) || selection.sections.length < 2) fail('source selection needs at least two sections');

const repeated = JSON.parse(JSON.stringify(selection.sections[REPEATED_INDEX]));
repeated.selectionReason = 'g54k-make-refusal-case.js repeated the previous section verbatim to break the composition grammar on purpose';
repeated.purpose = `${repeated.purpose} (앞 섹션과 같은 모듈·같은 카피를 그대로 반복하도록 강제된 위반본)`;
selection.sections.splice(REPEATED_INDEX + 1, 0, repeated);
selection.sections.forEach((section, index) => { section.order = index + 1; });

selection.selectionStage = {
  ...selection.selectionStage,
  method: 'derived-violation',
  derivedFrom: 'v3/composer/case-saas-release/selection.json',
  derivation: `sections.splice(${REPEATED_INDEX + 1}, 0, structuredClone(sections[${REPEATED_INDEX}]))`,
  note: 'This selection is not something composer-select.js can emit. It exists so the grammar gate has something real to refuse, and so a reader can see what it refused.'
};

fs.mkdirSync(TARGET_DIR, { recursive: true });
const target = path.join(TARGET_DIR, 'selection.json');
fs.writeFileSync(target, `${JSON.stringify(selection, null, 2)}\n`);
process.stdout.write(`wrote ${path.relative(V3_ROOT, target)}\n`);
process.stdout.write(`sections: ${selection.sections.map((s) => s.moduleId).join(' | ')}\n`);
