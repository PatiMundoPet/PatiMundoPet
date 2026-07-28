import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const required = ['Code.gs', 'Index.html', 'Styles.html', 'App.html', 'appsscript.json', 'README.md'];
for (const file of required) {
  if (!fs.existsSync(new URL(`admin-apps-script/${file}`, root))) throw new Error(`Arquivo ausente: ${file}`);
}

const code = read('admin-apps-script/Code.gs');
const app = read('admin-apps-script/App.html');
const index = read('admin-apps-script/Index.html');
const manifest = JSON.parse(read('admin-apps-script/appsscript.json'));

new vm.Script(code, { filename: 'Code.gs' });
new vm.Script(app.replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, ''), { filename: 'App.html' });

for (const name of ['carregarDadosIniciais', 'listarSolicitacoes', 'listarClientes', 'listarPagamentos', 'consultarAgendaDia', 'consultarAgendaSemana', 'listarBloqueios']) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(code)) throw new Error(`Função de leitura ausente: ${name}`);
}
for (const view of ['inicio', 'solicitacoes', 'agenda', 'bloqueios', 'clientes', 'pagamentos']) {
  if (!index.includes(`id="view-${view}"`)) throw new Error(`Módulo ausente: ${view}`);
}
for (const forbidden of ['setValue(', 'setValues(', 'appendRow(', 'createEvent(', 'createAllDayEvent(', 'deleteEvent(']) {
  if (code.includes(forbidden)) throw new Error(`Operação de escrita encontrada: ${forbidden}`);
}
if (/painel\.html/.test(read('index.html'))) throw new Error('O site público referencia o painel.');
if (fs.existsSync(new URL('painel.html', root))) throw new Error('O protótipo ainda está na raiz.');
if (!code.includes("WORKDAY_START_TIME !== '08:30'") || !code.includes("WORKDAY_END_TIME !== '18:00'") || !code.includes('interval !== 30')) throw new Error('Regras operacionais ausentes.');
if (!app.includes('while (current < end)')) throw new Error('A grade deve excluir 18:00 como início.');
if (!code.includes('Session.getActiveUser().getEmail()')) throw new Error('Autorização por usuário ausente.');
if (manifest.runtimeVersion !== 'V8' || manifest.timeZone !== 'America/Sao_Paulo') throw new Error('Manifesto inválido.');
if (manifest.oauthScopes.some((scope) => !scope.endsWith('.readonly') && !scope.endsWith('userinfo.email'))) throw new Error('Escopo não mínimo encontrado.');
console.log('Admin Apps Script: estrutura, sintaxe, leitura, segurança e agenda validadas.');
