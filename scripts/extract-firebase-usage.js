/**
 * Statically inventories every Firestore and Storage path the app touches.
 *
 * This is what turns rules testing from anecdotal into provable: instead of
 * remembering to write a test per screen, we enumerate the call sites and
 * assert every one is covered by a rule and (where needed) an index.
 *
 * Run standalone:  node scripts/extract-firebase-usage.js
 * Consumed by:     __tests__/config/coverage.test.ts
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SEARCH_DIRS = ['app', 'lib', 'components', 'store'];
const EXTS = new Set(['.ts', '.tsx']);

function walk(dir, out = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(rel, out);
    } else if (EXTS.has(path.extname(entry.name))) {
      out.push(rel);
    }
  }
  return out;
}

/** First path segment of a collection(db, 'x', ...) / doc(db, 'x', ...) call. */
function collectFirestorePaths(source) {
  const found = new Set();
  const re = /\b(?:collection|doc)\s*\(\s*(?:db|firestore)\s*,\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(source))) found.add(m[1].split('/')[0]);
  return found;
}

/**
 * Subcollection ids, e.g. collection(db, 'users', uid, 'pushTokens').
 *
 * Firestore paths alternate collection/document, so after the `db` argument the
 * EVEN-indexed segments are collections and the odd ones are document ids. That
 * parity is what distinguishes collection(db,'users',uid,'pushTokens') from
 * doc(db,'species','taxonomy') — the latter's 'taxonomy' is a document, not a
 * collection, and must not be expected to have its own rule block.
 */
function collectSubcollections(source) {
  const found = new Set();
  const re = /\b(?:collection|doc)\s*\(\s*(?:db|firestore)\s*,\s*((?:['"`][^'"`]*['"`]|[A-Za-z0-9_.$]+)\s*(?:,\s*(?:['"`][^'"`]*['"`]|[A-Za-z0-9_.$]+)\s*)*)\)/g;
  let m;
  while ((m = re.exec(source))) {
    const args = m[1].split(',').map((p) => p.trim()).filter(Boolean);

    // Expand slash-joined literals so parity is counted per path segment.
    const segments = [];
    for (const arg of args) {
      if (/^['"`]/.test(arg)) {
        for (const seg of arg.replace(/['"`]/g, '').split('/')) segments.push({ literal: true, value: seg });
      } else {
        segments.push({ literal: false, value: arg });
      }
    }

    segments.forEach((seg, i) => {
      if (i > 0 && i % 2 === 0 && seg.literal && seg.value) found.add(seg.value);
    });
  }
  return found;
}

/** Top-level prefix of a ref(storage, `photos/${uid}/...`) call. */
function collectStoragePrefixes(source) {
  const found = new Set();
  const re = /\bref\s*\(\s*storage\s*,\s*['"`]([^'"`$]*)/g;
  let m;
  while ((m = re.exec(source))) {
    const prefix = m[1].split('/')[0];
    if (prefix) found.add(prefix);
  }
  return found;
}

/**
 * Query shapes that may need a composite index: the equality/`in` fields plus
 * the orderBy field. Best-effort — it reads the constraint list inside query().
 */
function collectQueryShapes(source, file) {
  const shapes = [];
  const re = /query\s*\(([\s\S]*?)\)\s*;/g;
  let m;
  while ((m = re.exec(source))) {
    const body = m[1];
    const collMatch = body.match(/collection\s*\(\s*(?:db|firestore)\s*,\s*['"`]([^'"`]+)['"`](?:\s*,\s*[^,)]+)*\)/);
    if (!collMatch) continue;
    const segments = collMatch[1].split('/');
    const trailing = [...body.matchAll(/collection\s*\(\s*(?:db|firestore)\s*,([^)]*)\)/g)][0];
    let collectionId = segments[segments.length - 1];
    if (trailing) {
      const parts = trailing[1].split(',').map((p) => p.trim()).filter(Boolean);
      const lastLiteral = [...parts].reverse().find((p) => /^['"`]/.test(p));
      if (lastLiteral) collectionId = lastLiteral.replace(/['"`]/g, '').split('/').pop();
    }

    const equality = [...body.matchAll(/where\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`](==|in)['"`]/g)].map(
      (w) => w[1],
    );
    const ranges = [...body.matchAll(/where\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`](<|<=|>|>=|!=)['"`]/g)].map(
      (w) => w[1],
    );
    const order = [...body.matchAll(/orderBy\s*\(\s*['"`]([^'"`]+)['"`](?:\s*,\s*['"`](asc|desc)['"`])?/g)].map(
      (o) => ({ field: o[1], direction: o[2] === 'desc' ? 'DESCENDING' : 'ASCENDING' }),
    );

    // A composite index is required for 2+ equality fields, or any equality
    // combined with an orderBy on a different field.
    const needsIndex =
      equality.length >= 2 ||
      (equality.length >= 1 && order.some((o) => !equality.includes(o.field))) ||
      (ranges.length >= 1 && order.some((o) => !ranges.includes(o.field)));

    shapes.push({ file, collectionId, equality, ranges, order, needsIndex });
  }
  return shapes;
}

function extract() {
  const files = SEARCH_DIRS.flatMap((d) => walk(d));
  const collections = new Set();
  const subcollections = new Set();
  const storagePrefixes = new Set();
  const queryShapes = [];

  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    collectFirestorePaths(source).forEach((c) => collections.add(c));
    collectSubcollections(source).forEach((c) => subcollections.add(c));
    collectStoragePrefixes(source).forEach((p) => storagePrefixes.add(p));
    queryShapes.push(...collectQueryShapes(source, file));
  }

  return {
    filesScanned: files.length,
    collections: [...collections].sort(),
    subcollections: [...subcollections].sort(),
    storagePrefixes: [...storagePrefixes].sort(),
    queryShapes,
  };
}

module.exports = { extract };

if (require.main === module) {
  const result = extract();
  console.log(JSON.stringify(result, null, 2));
}
