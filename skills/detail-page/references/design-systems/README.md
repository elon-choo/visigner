# Persisted design systems

Each design system lives in `<slug>/`. Its `MASTER.md` is the locked global contract: palette, type pairing, spacing scale, and signature element. Treat those four values as the default for every page and every later session.

Page-specific decisions live in `<slug>/pages/<page>.md`. Each page begins with a `master_overrides` front-matter block. That list is authoritative: it names every MASTER key changed by that page; all keys not listed remain locked to `MASTER.md`.

Create a MASTER and a page override with the writer:

```sh
node skills/detail-page/scripts/design-system-persist.js \
  --slug studio-demo \
  --palette "charcoal, ivory, and vermilion" \
  --type-pairing "Manrope + IBM Plex Mono" \
  --spacing-scale "4, 8, 16, 24, 40, 64" \
  --signature-element "vermilion index rule" \
  --page pricing \
  --override "palette=midnight, mist, and lime"
```

The same fields may be supplied through `--input design-system.json`; the JSON form is `{ "slug", "master", "page" }`, where `master` uses `palette`, `typePairing`, `spacingScale`, and `signatureElement`, and `page` uses `name` plus an `overrides` object.

The writer is non-destructive. If the requested `MASTER.md` (or page file) already exists, it prints a `SKIP:` message and changes nothing. Pass `--force` only when intentionally replacing the stored decisions.
