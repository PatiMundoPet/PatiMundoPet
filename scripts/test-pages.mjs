import assert from 'node:assert/strict';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, '.pages-dist');

const allowedFiles = [
  'assets/css/styles.css',
  'assets/css/tailwind.min.css',
  'assets/img/galeria/golden-dupla-bolinha-full.jpg',
  'assets/img/galeria/golden-dupla-bolinha-thumb.jpg',
  'assets/img/galeria/golden-husky-banco-full.jpg',
  'assets/img/galeria/golden-husky-banco-thumb.jpg',
  'assets/img/galeria/golden-husky-grama-full.jpg',
  'assets/img/galeria/golden-husky-grama-thumb.jpg',
  'assets/img/galeria/grupo-caes-parque-full.jpg',
  'assets/img/galeria/grupo-caes-parque-thumb.jpg',
  'assets/img/galeria/passeio-coleiras-full.jpg',
  'assets/img/galeria/passeio-coleiras-thumb.jpg',
  'assets/img/galeria/passeio-trio-sentado-full.jpg',
  'assets/img/galeria/passeio-trio-sentado-thumb.jpg',
  'assets/img/galeria/pati-banho-full.jpg',
  'assets/img/galeria/pati-banho-thumb.jpg',
  'assets/img/galeria/pati-cachorro-jardim-full.jpg',
  'assets/img/galeria/pati-cachorro-jardim-thumb.jpg',
  'assets/img/galeria/pati-dupla-preta-full.jpg',
  'assets/img/galeria/pati-dupla-preta-thumb.jpg',
  'assets/img/galeria/pati-filhote-golden-full.jpg',
  'assets/img/galeria/pati-filhote-golden-thumb.jpg',
  'assets/img/galeria/pati-golden-husky-full.jpg',
  'assets/img/galeria/pati-golden-husky-thumb.jpg',
  'assets/img/galeria/pati-retrato-full.jpg',
  'assets/img/galeria/pati-retrato-thumb.jpg',
  'assets/img/galeria/pati-sao-bernardo-full.jpg',
  'assets/img/galeria/pati-sao-bernardo-thumb.jpg',
  'assets/img/galeria/rottweiler-retrato-full.jpg',
  'assets/img/galeria/rottweiler-retrato-thumb.jpg',
  'assets/js/boot.js',
  'assets/js/main.js',
  'assets/js/scheduling-api.js',
  'assets/js/scheduling.js',
  'index.html',
  'privacy.html',
  'robots.txt',
];

const forbiddenTopLevel = new Set([
  '.git',
  '.github',
  'admin-apps-script',
  'apps-script',
  'content',
  'docs',
  'scripts',
  'src',
]);
const forbiddenFiles = new Set([
  'CNAME',
  'package.json',
  'package-lock.json',
  'sitemap.xml',
]);
const sourceExtensions = new Set(['.md', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.map', '.json', '.yml', '.yaml', '.toml']);

async function collectFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(base, absolute).split(path.sep).join('/');
    const stats = await lstat(absolute);
    assert.equal(stats.isSymbolicLink(), false, `Link simbólico não permitido: ${relative}`);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolute, base));
    } else {
      assert.equal(entry.isFile(), true, `Entrada não é arquivo regular: ${relative}`);
      files.push(relative);
    }
  }
  return files;
}

function localReference(value) {
  if (!value || value.startsWith('#')) return null;
  if (/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(value)) return null;
  const parsed = new URL(value, 'https://pages.local/');
  if (parsed.origin !== 'https://pages.local') return null;
  const pathname = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'index.html';
  return pathname;
}

function referencesFromHtml(html) {
  const refs = [];
  const pattern = /\b(?:src|href)\s*=\s*(?:(['"])(.*?)\1|([^\s"'>]+))/gi;
  for (const match of html.matchAll(pattern)) {
    const ref = localReference(match[2] ?? match[3]);
    if (ref) refs.push(ref);
  }
  return refs;
}

const actualFiles = (await collectFiles(dist)).sort();
assert.deepEqual(actualFiles, allowedFiles, 'O artefato deve conter exatamente os nove arquivos permitidos');
assert.ok(actualFiles.includes('index.html'), 'index.html deve ficar na raiz do artefato');
assert.equal(actualFiles.includes('sitemap.xml'), false, 'sitemap.xml não deve estar no artefato');

for (const relativePath of actualFiles) {
  const topLevel = relativePath.split('/')[0];
  assert.equal(forbiddenTopLevel.has(topLevel), false, `Área interna proibida publicada: ${relativePath}`);
  assert.equal(forbiddenFiles.has(relativePath), false, `Arquivo interno proibido publicado: ${relativePath}`);
  assert.equal(sourceExtensions.has(path.extname(relativePath)), false, `Fonte/configuração/documentação publicada: ${relativePath}`);
  const stats = await lstat(path.join(dist, relativePath));
  assert.equal(stats.isSymbolicLink(), false, `Link simbólico não permitido: ${relativePath}`);
  assert.equal(stats.isFile(), true, `Entrada não é arquivo regular: ${relativePath}`);
  assert.ok(stats.size > 0, `Arquivo vazio no artefato: ${relativePath}`);
}

const [index, privacy, robots] = await Promise.all([
  readFile(path.join(dist, 'index.html'), 'utf8'),
  readFile(path.join(dist, 'privacy.html'), 'utf8'),
  readFile(path.join(dist, 'robots.txt'), 'utf8'),
]);

for (const [name, html] of [['index.html', index], ['privacy.html', privacy]]) {
  assert.match(html, /<meta\s+name=["']robots["']\s+content=["']noindex, nofollow["']/i, `${name} deve manter noindex, nofollow`);
  for (const ref of referencesFromHtml(html)) {
    assert.ok(allowedFiles.includes(ref), `${name} referencia caminho local ausente do artefato: ${ref}`);
  }
}

assert.match(robots, /(?:^|\n)Disallow:\s*\/(?:\n|$)/, 'robots.txt deve bloquear rastreamento com Disallow: /');

const configMatch = index.match(/<script\s+id=["']scheduling-integration-config["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i);
assert.ok(configMatch, 'index.html deve incorporar a configuração pública de agendamento');
const config = JSON.parse(configMatch[1]);
assert.equal(config.mode, 'live', 'A integração pública deve permanecer em modo live');
const webAppUrl = new URL(config.webAppUrl);
assert.equal(webAppUrl.protocol, 'https:');
assert.equal(webAppUrl.hostname, 'script.google.com');
assert.ok(webAppUrl.pathname.endsWith('/exec'), 'A URL pública deve terminar em /exec');
assert.equal(webAppUrl.username + webAppUrl.password + webAppUrl.search + webAppUrl.hash, '');

console.log('Pacote público do GitHub Pages validado com sucesso.');
for (const relativePath of actualFiles) console.log(relativePath);
