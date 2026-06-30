// email.js — emit a ROBUST, ESP-pasteable responsive HTML email from a tiny JSON spec.
// No deps (Node fs only). Off-by-default sibling of shoot.js: nothing imports it; it is a CLI.
//
// Why this exists: the suite writes great email COPY but emitted nothing an ESP (Mailchimp/Klaviyo/
// HubSpot/SES) could paste. Email clients are NOT browsers — no flexbox/grid, no <style> reliability in
// Gmail/Outlook, Outlook (Word engine) needs MSO conditionals + VML for true bulletproof buttons. So this
// emits a 600px max **table-based** layout, every CSS property **inlined** on the element, a hidden
// preheader span, a bulletproof table+VML CTA button, and a dark-mode meta + color-scheme hint.
//
// Usage:   node email.js <spec.json> [out.html]
//          node email.js --help
//          (default out path: <spec-dir>/<spec-basename>.html ; "-" writes HTML to stdout)
//
// Spec JSON:
//   {
//     "subject":   "Welcome aboard",              // used in <title> (ESP overrides the real subject)
//     "preheader": "The inbox-preview line",       // hidden preview text; falls back to "" (empty span)
//     "brand": { "surface":"#ffffff", "ink":"#1a1a1a", "accent":"#c2410c",
//                "font":"Georgia, 'Times New Roman', serif" },   // all optional; sane defaults below
//     "blocks": [
//       { "type":"h1",      "text":"Heading" },
//       { "type":"p",       "text":"A paragraph. Plain text only." },
//       { "type":"cta",     "text":"Get started", "href":"https://example.com/start" },
//       { "type":"img",     "href":"https://cdn/x.png", "text":"alt text", "width":"560" },
//       { "type":"divider" }
//     ]
//   }
//
// Output: a complete <!DOCTYPE html> email. Pasteable into an ESP; screenshot-able by shoot.js.

const fs = require('fs');
const path = require('path');

const HELP = `email.js — emit a robust, ESP-pasteable responsive HTML email from a JSON spec.

USAGE
  node email.js <spec.json> [out.html]     write HTML (default: <spec>.html ; "-" = stdout)
  node email.js --help

SPEC (all fields optional except blocks)
  subject     string   -> <title> (ESP sets the real subject)
  preheader   string   -> hidden inbox-preview text
  brand       { surface, ink, accent, font }   colors as #hex; font as a CSS stack
  blocks[]    { type, text, href, width }
              type: h1 | p | cta | img | divider
                h1/p   -> text
                cta    -> text (label) + href (url)   [bulletproof table+VML button]
                img    -> href (src) + text (alt) + width (px, default 560)
                divider-> (no fields)

GUARANTEES
  600px max table layout (no flexbox/grid) · all CSS inlined · hidden preheader span ·
  bulletproof CTA (MSO/VML fallback for Outlook) · dark-mode meta + color-scheme.
`;

// ---- escaping -------------------------------------------------------------
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
// attribute-safe URL: block javascript:/data: schemes, escape quotes.
function escUrl(s) {
  const v = String(s == null ? '' : s).trim();
  if (/^\s*(javascript|data|vbscript):/i.test(v)) return '#';
  return esc(v);
}

// ---- block renderers (all return inlined-CSS table rows inside the 600px wrapper) ----
function renderH1(b, brand) {
  return `              <tr>
                <td style="padding:8px 32px 4px 32px;font-family:${brand.font};font-size:28px;line-height:1.25;font-weight:700;color:${brand.ink};">${esc(b.text)}</td>
              </tr>`;
}
function renderP(b, brand) {
  return `              <tr>
                <td style="padding:8px 32px;font-family:${brand.font};font-size:16px;line-height:1.6;color:${brand.ink};">${esc(b.text)}</td>
              </tr>`;
}
function renderDivider(b, brand) {
  return `              <tr>
                <td style="padding:12px 32px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${brand.hair};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>
                </td>
              </tr>`;
}
function renderImg(b, brand) {
  const w = String(b.width || 560).replace(/[^0-9]/g, '') || '560';
  const src = escUrl(b.href);
  const alt = esc(b.text || '');
  return `              <tr>
                <td style="padding:12px 32px;" align="center">
                  <img src="${src}" alt="${alt}" width="${w}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
                </td>
              </tr>`;
}
// Bulletproof CTA: padded <a> inside a rounded <td>, with MSO/VML roundrect fallback for Outlook.
function renderCta(b, brand) {
  const href = escUrl(b.href || '#');
  const label = esc(b.text || 'Learn more');
  return `              <tr>
                <td style="padding:20px 32px;" align="left">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="12%" strokecolor="${brand.accent}" fillcolor="${brand.accent}">
                    <w:anchorlock/>
                    <center style="color:${brand.onAccent};font-family:${brand.font};font-size:16px;font-weight:700;">${label}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-- -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td align="center" bgcolor="${brand.accent}" style="border-radius:6px;background:${brand.accent};mso-padding-alt:0;">
                      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${brand.font};font-size:16px;line-height:20px;font-weight:700;color:${brand.onAccent};text-decoration:none;border-radius:6px;background:${brand.accent};">${label}</a>
                    </td>
                  </tr></table>
                  <!--<![endif]-->
                </td>
              </tr>`;
}

const RENDERERS = { h1: renderH1, p: renderP, cta: renderCta, img: renderImg, divider: renderDivider };

// luminance-based readable text color on the accent button.
function onColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * bl) / 255;
  return lum > 0.6 ? '#1a1a1a' : '#ffffff';
}

function buildEmail(spec) {
  const b = spec.brand || {};
  const brand = {
    surface: b.surface || '#ffffff',
    ink: b.ink || '#1a1a1a',
    accent: b.accent || '#c2410c',
    font: b.font || "Georgia, 'Times New Roman', serif",
    hair: '#e5e5e5',
  };
  brand.onAccent = onColor(brand.accent);

  const blocks = Array.isArray(spec.blocks) ? spec.blocks : [];
  const rows = blocks.map((blk) => {
    const r = RENDERERS[blk && blk.type];
    return r ? r(blk, brand) : '';
  }).filter(Boolean).join('\n');

  const subject = esc(spec.subject || '');
  // preheader: hidden in body, shown as inbox preview. Trailing &zwnj;&nbsp; padding stops the client
  // from pulling following body text into the preview.
  const pre = esc(spec.preheader || '');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${subject}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    /* progressive enhancement only — every critical style is also inlined below */
    body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    img { -ms-interpolation-mode:bicubic; }
    @media only screen and (max-width:600px) {
      .email-container { width:100% !important; }
      .px { padding-left:20px !important; padding-right:20px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-bg { background:#111111 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;" class="email-bg">
  <!-- hidden preheader (inbox preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f4f4;opacity:0;">${pre}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;" class="email-bg">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="width:600px;max-width:600px;background:${brand.surface};border-radius:8px;">
${rows}
              <tr><td style="padding:16px 32px 28px 32px;font-family:${brand.font};font-size:12px;line-height:1.5;color:#8a8a8a;">You are receiving this email because you signed up. <a href="%unsubscribe_url%" style="color:#8a8a8a;text-decoration:underline;">Unsubscribe</a>.</td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// ---- CLI ------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP);
    process.exit(args.length === 0 ? 1 : 0);
  }
  const specPath = args[0];
  const outArg = args[1];
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  } catch (e) {
    console.error('FATAL could not read/parse spec JSON:', e.message);
    process.exit(2);
  }
  const html = buildEmail(spec);
  if (outArg === '-') {
    process.stdout.write(html);
    return;
  }
  const outPath = outArg || path.join(
    path.dirname(path.resolve(specPath)),
    path.basename(specPath).replace(/\.json$/i, '') + '.html'
  );
  fs.writeFileSync(outPath, html);
  console.log(JSON.stringify({ ok: true, outPath, blocks: (spec.blocks || []).length, bytes: html.length }, null, 2));
}

if (require.main === module) {
  try { main(); }
  catch (e) { console.error('FATAL', e.message); process.exit(2); }
}

module.exports = { buildEmail, onColor };
