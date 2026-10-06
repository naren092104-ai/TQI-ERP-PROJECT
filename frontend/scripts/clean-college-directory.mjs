import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(root, 'frontend', 'src', 'data', 'tamilNaduColleges.json');
const backupPath = path.join(root, 'frontend', 'src', 'data', 'tamilNaduColleges.raw-backup.json');
const reportPath = path.join(root, 'docs', 'college-data-quality-report.md');
const duplicatePath = path.join(root, 'docs', 'college-duplicate-review.csv');
const questionablePath = path.join(root, 'docs', 'college-name-review.csv');
const writeChanges = process.argv.includes('--write');

const namedEntities = new Map([
  ['amp', '&'], ['nbsp', ' '], ['quot', '"'], ['apos', "'"],
  ['lt', '<'], ['gt', '>'], ['rsquo', '’'], ['lsquo', '‘'],
  ['rdquo', '”'], ['ldquo', '“'], ['ndash', '–'], ['mdash', '—'],
]);

const decodeEntities = (value) => value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, token) => {
  if (token[0] === '#') {
    const codePoint = token[1].toLowerCase() === 'x'
      ? Number.parseInt(token.slice(2), 16)
      : Number.parseInt(token.slice(1), 10);
    try { return String.fromCodePoint(codePoint); } catch { return match; }
  }
  return namedEntities.get(token.toLowerCase()) ?? match;
});

const normalizeText = (value) => decodeEntities(value)
  .normalize('NFC')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
  .replace(/[\r\n\t\f\v]+/g, ' ')
  .replace(/\s*,\s*/g, ', ')
  .replace(/(?:,\s*){2,}/g, ', ')
  .replace(/\s*&\s*/g, ' & ')
  .replace(/\s+([,;:])/g, '$1')
  .replace(/([,;:])(?=\S)/g, '$1 ')
  .replace(/\s+/g, ' ')
  .replace(/(?:,\s*)+$/g, '')
  .trim();

const searchKey = (value) => normalizeText(String(value ?? ''))
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('en')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const makeCsv = (headers, rows) => [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
const groupBy = (rows, keyFor) => {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    if (!key) continue;
    const items = groups.get(key) ?? [];
    items.push(row);
    groups.set(key, items);
  }
  return [...groups.entries()].filter(([, items]) => items.length > 1);
};

if (!fs.existsSync(sourcePath)) throw new Error(`College source JSON not found: ${sourcePath}`);
const original = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (!Array.isArray(original)) throw new Error('College source must be a JSON array.');

const correctionCounts = new Map();
let correctedRecords = 0;
const cleaned = original.map((sourceRecord) => {
  const record = { ...sourceRecord };
  let recordChanged = false;
  for (const [field, value] of Object.entries(record)) {
    if (field === 'id' || typeof value !== 'string') continue;
    const normalized = normalizeText(value);
    if (normalized !== value) {
      correctionCounts.set(field, (correctionCounts.get(field) ?? 0) + 1);
      recordChanged = true;
      record[field] = normalized;
    }
  }
  if (recordChanged) correctedRecords += 1;
  return record;
});

const duplicateNames = groupBy(cleaned, (row) => searchKey(row.name));
const duplicateComposite = groupBy(cleaned, (row) => [
  row.name, row.district, row.university, row.type, row.collegeType, row.institutionCategory,
].map(searchKey).join('|'));
const duplicateIds = groupBy(cleaned, (row) => String(row.id ?? '').trim());
const duplicateRows = duplicateComposite.flatMap(([key, rows], index) => rows.map((row) => ({
  candidate_group: `DUP-${String(index + 1).padStart(4, '0')}`,
  id: row.id,
  name: row.name,
  district: row.district,
  university: row.university,
  type: row.type,
  collegeType: row.collegeType,
  match_key: key,
  review_status: 'Candidate only — not merged; verify institution identity',
})));

const questionablePatterns = [
  ['Likely source spelling variant', /\b(?:univeristy|polyteh?cnic|denal|ophthamology|rersearch|seience|cience|pharmcy|physioherapy)\b/i],
  ['Possible joined words or missing spaces', /\b(?:artsand|scienceand|collegeof|instituteof|schoolof|collegeand|hospitaland)\b/i],
  ['Possibly incomplete source name', /(?:\b(?:and|of)\s*$|&\s*$|,\s*$)/i],
  ['Unusual internal capitalization', /\b[a-z][a-z]*[A-Z][a-z]+\b/],
  ['Repeated punctuation', /(?:,{2,}|\.{2,}|-{2,})/],
];
const questionableRows = [];
for (const row of cleaned) {
  const reason = questionablePatterns
    .filter(([, pattern]) => pattern.test(String(row.name ?? '')))
    .map(([label]) => label);
  if (reason.length) questionableRows.push({
    id: row.id,
    source_name: row.name,
    district: row.district,
    university: row.university,
    type: row.type,
    collegeType: row.collegeType,
    reason: reason.join('; '),
    review_status: 'Needs authoritative verification — source name retained',
  });
}

const missing = (field) => cleaned.filter((row) => !String(row[field] ?? '').trim()).length;
const missingAnyType = cleaned.filter((row) => !String(row.type ?? '').trim() && !String(row.collegeType ?? '').trim()).length;
const categoryCounts = Object.fromEntries(['C', 'S', 'U', 'R', 'other'].map((prefix) => [
  prefix,
  cleaned.filter((row) => prefix === 'other' ? !/^[CSUR]-/.test(String(row.id ?? '')) : String(row.id ?? '').startsWith(`${prefix}-`)).length,
]));
const normalizedRows = cleaned.length;
const requiredValidRows = cleaned.filter((row) => String(row.id ?? '').trim() && String(row.name ?? '').trim() && String(row.district ?? '').trim()).length;
const fileSourceSha = (await import('node:crypto')).createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
const localDate = new Date();
const now = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
const correctionSummary = [...correctionCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([field, count]) => `| ${field} | ${count} |`).join('\n') || '| None | 0 |';

const report = `# Tamil Nadu College Directory — Data Quality Report\n\nGenerated: ${now}\nSource: \`frontend/src/data/tamilNaduColleges.json\` (the repository contains no CSV source; this local JSON is what the backend endpoint actually reads).\n\n## Full-dataset audit\n\n- Original records: **${original.length}**\n- Valid records (stable ID, name, and district present): **${requiredValidRows}**\n- Records after cleaning: **${normalizedRows}**\n- Records added: **0**\n- Records deleted: **0**\n- Duplicates detected by normalized name: **${duplicateNames.length} candidate groups**\n- Same normalized name + district + university + source type/category: **${duplicateComposite.length} candidate groups**\n- Duplicate records merged: **0** (automatic merging was intentionally avoided because similarly named colleges, campuses, and source IDs require identity verification)\n- Duplicate IDs: **${duplicateIds.length} groups**\n- Records with safe formatting changes: **${correctedRecords}**\n- Individual field formatting corrections: **${[...correctionCounts.values()].reduce((sum, count) => sum + count, 0)}**\n- Missing college names: **${missing('name')}**\n- Missing district: **${missing('district')}**\n- Missing university: **${missing('university')}**\n- Missing source \`type\`: **${missing('type')}**\n- Missing source \`collegeType\`: **${missing('collegeType')}**\n- Both source type fields missing: **${missingAnyType}**\n- Names flagged by conservative review heuristics: **${questionableRows.length}**\n- Official names independently verified against UGC/AICTE/government/college websites: **0**; all source names are therefore treated as unverified and retained unless a safe formatting-only cleanup applied.\n- Stable IDs preserved: **yes**.\n- Source ID-prefix counts: \`${JSON.stringify(categoryCounts)}\`.\n- SHA-256 of pre-cleaning source: \`${fileSourceSha}\`.\n\n## Source fields\n\n\`id\`, \`name\`, \`district\`, \`university\`, \`type\`, \`collegeType\`, \`institutionCategory\`.\n\n## Safe formatting operations\n\nUnicode NFC normalization; HTML entity decoding; zero-width/non-breaking space cleanup; newline/tab folding; whitespace collapse; redundant comma cleanup; consistent spacing around commas, colons, and ampersands; trimming. No names were expanded, title-cased, translated, or replaced with guessed official names. IDs and metadata values were not reclassified.\n\n## Corrections by field\n\n| Field | Records changed |\n| --- | ---: |\n${correctionSummary}\n\n## Review artifacts\n\n- \`docs/college-duplicate-review.csv\`: duplicate candidates with IDs and metadata; no merge decisions made.\n- \`docs/college-name-review.csv\`: conservatively flagged names requiring source/official verification; source spellings were retained.\n`;

if (writeChanges) {
  if (!fs.existsSync(backupPath)) fs.copyFileSync(sourcePath, backupPath);
  fs.writeFileSync(sourcePath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, 'utf8');
  fs.writeFileSync(duplicatePath, makeCsv(
    ['candidate_group', 'id', 'name', 'district', 'university', 'type', 'collegeType', 'match_key', 'review_status'],
    duplicateRows.map((row) => Object.values(row)),
  ), 'utf8');
  fs.writeFileSync(questionablePath, makeCsv(
    ['id', 'source_name', 'district', 'university', 'type', 'collegeType', 'reason', 'review_status'],
    questionableRows.map((row) => Object.values(row)),
  ), 'utf8');
}

console.log(JSON.stringify({
  mode: writeChanges ? 'write' : 'dry-run',
  records: original.length,
  validRecords: requiredValidRows,
  recordsWithFormattingChanges: correctedRecords,
  fieldCorrections: Object.fromEntries(correctionCounts),
  duplicateNameGroups: duplicateNames.length,
  duplicateCompositeGroups: duplicateComposite.length,
  merged: 0,
  missingName: missing('name'),
  missingDistrict: missing('district'),
  missingUniversity: missing('university'),
  missingTypeAndCollegeType: missingAnyType,
  questionableReviewRows: questionableRows.length,
  backup: writeChanges ? path.relative(root, backupPath) : null,
  report: writeChanges ? path.relative(root, reportPath) : null,
}, null, 2));
