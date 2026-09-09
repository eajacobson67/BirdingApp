# Testing

## Why this exists

Firestore and Storage security rules are enforced **server-side**. TypeScript
cannot see them, and a mocked Firestore test cannot either — a mock returns
whatever it is told to return, so the rules never execute. Every permission bug
this app has shipped was invisible to the compiler and only discoverable by
manually opening the affected screen.

The suite below closes that gap. The emulator tests are the important ones.

## Layout

| Project  | Location              | Needs emulator | What it covers |
|----------|-----------------------|----------------|----------------|
| `unit`   | `__tests__/unit/`     | no             | Pure logic: clustering, rarity, points, coord extraction, auth error copy, bird style integrity |
| `api`    | `__tests__/api/`      | no             | External API contracts: BirdNET, BirdVision, iNaturalist — happy path, non-2xx, malformed shapes, auth, network failure |
| `config` | `__tests__/config/`   | no             | Coverage guards: every path has a rule, every composite query has an index, Maps key resolves, Play Store readiness |
| `rules`  | `__tests__/rules/`    | **yes**        | The permission matrix: real rules vs real queries across four actor roles |

## Commands

```bash
npm test            # unit + api + config (fast, no emulator)
npm run test:unit
npm run test:api
npm run test:config
npm run test:rules  # starts the Firebase emulator, runs the permission matrix
npm run test:all    # everything

npm run audit:firebase   # print the extracted Firestore/Storage inventory
```

### `test:rules` requires Java

The Firestore emulator is a Java process. This machine has no standalone JDK,
but Android Studio ships one. Set it for the shell first:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npm run test:rules
```

Setting `JAVA_HOME` from Git Bash does not work — the JBR path contains spaces
and does not survive translation to the spawned process. Use PowerShell.

## The coverage guards

`__tests__/config/coverage.test.ts` is what stops permission bugs being found
one screen at a time. It runs `scripts/extract-firebase-usage.js`, which walks
the app source and extracts every collection, subcollection, Storage prefix and
query shape, then asserts:

- every top-level collection has a `match` block in `firestore.rules`
- every subcollection has one too
- every Storage prefix has one in `storage.rules`
- every query needing a composite index has one in `firestore.indexes.json`
- the rules contain no blanket allow-all and are not in expiring test mode

**Add a new collection without a rule and this fails**, rather than a user
hitting `Missing or insufficient permissions` on their phone.

Firestore paths alternate collection/document, so the extractor treats
even-indexed segments as collections. That is what distinguishes
`collection(db,'users',uid,'pushTokens')` — where `pushTokens` is a collection —
from `doc(db,'species','taxonomy')`, where `taxonomy` is a document id.

## Rules are not filters

The single most important test in the suite:

```ts
test('querying another user without an isPublic filter is DENIED', ...)
```

Firestore permits a query only if its constraints **prove** every possible match
is readable. It does not filter out documents you cannot read — it rejects the
whole query. So with a rule like:

```
allow read: if resource.data.isPublic == true || resource.data.userId == request.auth.uid;
```

`where('userId','==', someoneElse)` fails, because nothing proves `isPublic`.
Adding `where('isPublic','==',true)` makes it pass. Any new query over
`sightings` must carry that constraint unless it is scoped to the caller's own
uid.

## Deploying rules and indexes

The repo is now the source of truth. After changing either:

```bash
npx firebase-tools deploy --only firestore:rules
npx firebase-tools deploy --only firestore:indexes
npx firebase-tools deploy --only storage
```

Run `npm run test:rules` before deploying.
