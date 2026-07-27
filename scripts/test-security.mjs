import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
for (const file of ['index.html', 'privacy.html']) {
  const html = await readFile(new URL('../' + file, import.meta.url), 'utf8');
  assert.doesNotMatch(html, /\{\{[^}]+\}\}/, `${file} não pode conter tokens`);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=|[^>]*type=["']application\/json["'])[^>]*>[\s\S]*?<\/script>/i, `${file} não pode conter JS inline`);
  for (const tag of html.match(/<a\b[^>]*target=["']_blank["'][^>]*>/gi) || []) {
    assert.match(tag, /rel=["'][^"']*\bnoopener\b[^"']*\bnoreferrer\b[^"']*["']/i, 'target blank deve ser isolado');
  }
}
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index.match(/<head>[\s\S]*?<\/head>/i)[0], /<script src="assets\/js\/boot\.js"><\/script>/);
const integration = JSON.parse(await readFile(new URL('../content/integration.json', import.meta.url), 'utf8'));
assert.equal(integration.mode, 'demo'); assert.equal(integration.webAppUrl, '');
console.log('Verificações estáticas de segurança concluídas.');
