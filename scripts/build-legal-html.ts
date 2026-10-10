/**
 * Renders docs/ from lib/legal.ts.
 *
 * Play needs the privacy policy and the deletion instructions at a public URL,
 * and rejects a listing whose hosted policy disagrees with the app. Generating
 * both from the same module is what keeps them honest.
 *
 * Run: npm run legal:html
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import {
  PRIVACY_POLICY,
  DELETION_NOTICE,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_CONTACT_EMAIL,
  APP_NAME,
  type LegalSection,
} from '../lib/legal';

const OUT = resolve(__dirname, '../docs');

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderSections(sections: LegalSection[]): string {
  return sections
    .map((s) => {
      const body = s.body.map((p) => `    <p>${escape(p)}</p>`).join('\n');
      const bullets = s.bullets
        ? `    <ul>\n${s.bullets.map((b) => `      <li>${escape(b)}</li>`).join('\n')}\n    </ul>`
        : '';
      return `    <h2>${escape(s.heading)}</h2>\n${body}${bullets ? '\n' + bullets : ''}`;
    })
    .join('\n\n');
}

function page(title: string, sections: LegalSection[]): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} — ${escape(APP_NAME)}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      max-width: 42rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem;
      font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #23201a; background: #f5efe0;
    }
    h1 { font-size: 1.9rem; margin: 0 0 .35rem; }
    h2 { font-size: 1.15rem; margin: 2rem 0 .5rem; }
    .meta { color: #6d675c; font-size: .9rem; margin: 0 0 2rem; }
    ul { padding-left: 1.2rem; }
    li { margin: .4rem 0; }
    a { color: #b4571f; }
    @media (prefers-color-scheme: dark) {
      body { color: #ece6da; background: #1b1916; }
      .meta { color: #9a9284; }
      a { color: #e8a06a; }
    }
  </style>
</head>
<body>
  <main>
    <h1>${escape(title)}</h1>
    <p class="meta">${escape(APP_NAME)} · Effective ${escape(LEGAL_EFFECTIVE_DATE)} · <a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a></p>

${renderSections(sections)}
  </main>
</body>
</html>
`;
}

const index = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${APP_NAME}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      max-width: 42rem; margin: 0 auto; padding: 3rem 1.25rem;
      font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #23201a; background: #f5efe0;
    }
    a { color: #b4571f; }
    @media (prefers-color-scheme: dark) {
      body { color: #ece6da; background: #1b1916; }
      a { color: #e8a06a; }
    }
  </style>
</head>
<body>
  <h1>${APP_NAME}</h1>
  <p>A social app for logging bird sightings.</p>
  <ul>
    <li><a href="privacy.html">Privacy policy</a></li>
    <li><a href="delete-account.html">Delete your account</a></li>
  </ul>
  <p><a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a></p>
</body>
</html>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'privacy.html'), page('Privacy Policy', PRIVACY_POLICY));
writeFileSync(resolve(OUT, 'delete-account.html'), page('Delete Your Account', DELETION_NOTICE));
writeFileSync(resolve(OUT, 'index.html'), index);
// GitHub Pages runs Jekyll by default, which skips files it does not understand.
writeFileSync(resolve(OUT, '.nojekyll'), '');

console.log('Wrote docs/index.html, docs/privacy.html, docs/delete-account.html');
