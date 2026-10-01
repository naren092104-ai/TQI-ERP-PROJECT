# Tamil Nadu College Directory — Data Quality Report

Generated: 2026-10-02
Source: `frontend/src/data/tamilNaduColleges.json` (the repository contains no CSV source; this local JSON is what the backend endpoint actually reads).

## Full-dataset audit

- Original records: **4073**
- Valid records (stable ID, name, and district present): **4073**
- Records after cleaning: **4073**
- Records added: **0**
- Records deleted: **0**
- Duplicates detected by normalized name: **96 candidate groups**
- Same normalized name + district + university + source type/category: **30 candidate groups**
- Duplicate records merged: **0** (automatic merging was intentionally avoided because similarly named colleges, campuses, and source IDs require identity verification)
- Duplicate IDs: **0 groups**
- Records with safe formatting changes: **717**
- Individual field formatting corrections: **729**
- Missing college names: **0**
- Missing district: **0**
- Missing university: **973**
- Missing source `type`: **3179**
- Missing source `collegeType`: **973**
- Both source type fields missing: **79**
- Names flagged by conservative review heuristics: **54**
- Official names independently verified against UGC/AICTE/government/college websites: **0**; all source names are therefore treated as unverified and retained unless a safe formatting-only cleanup applied.
- Stable IDs preserved: **yes**.
- Source ID-prefix counts: `{"C":3100,"S":894,"U":67,"R":12,"other":0}`.
- SHA-256 of pre-cleaning source: `2b5811eb0772cb16176cffe53fc623d49689ac4cc0ac7a6f48ab6e23abec7627`.

## Source fields

`id`, `name`, `district`, `university`, `type`, `collegeType`, `institutionCategory`.

## Safe formatting operations

Unicode NFC normalization; HTML entity decoding; zero-width/non-breaking space cleanup; newline/tab folding; whitespace collapse; redundant comma cleanup; consistent spacing around commas, colons, and ampersands; trimming. No names were expanded, title-cased, translated, or replaced with guessed official names. IDs and metadata values were not reclassified.

## Corrections by field

| Field | Records changed |
| --- | ---: |
| name | 17 |
| university | 712 |

## Review artifacts

- `docs/college-duplicate-review.csv`: duplicate candidates with IDs and metadata; no merge decisions made.
- `docs/college-name-review.csv`: conservatively flagged names requiring source/official verification; source spellings were retained.
