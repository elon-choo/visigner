# Visigner v2 reference corpus store

Each exemplar has one record at records/<id>/record.json. The record is the
source of truth and its capture_dir is relative to references/.

corpus-index.json is derived output only. Rebuild it with:

    node scripts/corpus-index.js build

Validate every stored record with:

    node scripts/corpus-validate.js

The validator follows the nine provenance-envelope invariants in SCHEMA.md.
For an individual record or a test fixture, pass its JSON path as the argument.
Do not hand-edit corpus-index.json; change a record and rebuild instead.

## Capture-drift discipline

Capture tiles and `styles.json` in the **same session**. Before recording any style data, verify that `capture.json`’s `pageHeight` agrees with `styles.json`’s `pageHeightPx`; if it does not, withhold the style fields and recapture both together. Pages change over time: Wadiz `400620` grew 13,673px between its tile capture and later style read, so its style data is correctly withheld.
