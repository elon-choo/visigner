// view-capture.js — build a one-click HTML viewer that stitches a capture's tiles
// into the full page. Works on any dir produced by capture-reference*.js or shoot.js
// (tile_*.png/.jpg or desktop-tile_*.png). No deps.
// Usage: node view-capture.js <captureDir>   ->  writes <captureDir>/index.html
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('usage: node view-capture.js <captureDir>'); process.exit(1); }
const files = fs.readdirSync(dir)
  .filter((f) => /^(?:desktop-)?tile_\d+\.(png|jpg|jpeg)$/i.test(f))
  .sort();
if (!files.length) { console.error('no tile_*.png/.jpg found in ' + dir); process.exit(1); }

let d = {};
try { d = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8')); } catch (_) {}
try { if (!d.pageHeight) d = { ...JSON.parse(fs.readFileSync(path.join(dir, 'capture.json'), 'utf8')), ...d }; } catch (_) {}

const imgs = files.map((f) => `<img src="${f}" loading="lazy" alt="${f}">`).join('\n');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>capture viewer — ${d.title || dir}</title>
<style>body{margin:0;background:#222;font-family:-apple-system,sans-serif}
header{position:sticky;top:0;background:#111;color:#eee;padding:12px 16px;font-size:13px;line-height:1.5;border-bottom:1px solid #333;z-index:9}
header b{color:#F4A43A}.page{max-width:760px;margin:0 auto;background:#fff}img{display:block;width:100%}</style></head><body>
<header><b>${d.title || path.basename(dir)}</b><br>${d.url || ''} · pageHeight ${d.pageHeight || '?'}px · 타일 ${files.length}개 · 이미지 ${d.imageCount ?? '?'}</header>
<div class="page">
${imgs}
</div></body></html>`;
const out = path.join(dir, 'index.html');
fs.writeFileSync(out, html);
console.log('viewer: ' + out + '  (open it in a browser; tiles=' + files.length + ')');
