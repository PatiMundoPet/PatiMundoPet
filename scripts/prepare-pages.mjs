import { constants } from 'node:fs';
import { access, copyFile, lstat, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, '.pages-dist');

const allowedFiles = [
  'index.html',
  'privacy.html',
  'robots.txt',
  'assets/css/styles.css',
  'assets/css/tailwind.min.css',
  'assets/js/boot.js',
  'assets/js/main.js',
  'assets/js/scheduling-api.js',
  'assets/js/scheduling.js',
];

function resolveInsideRoot(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Caminho fora do repositório: ${relativePath}`);
  }
  return absolutePath;
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const relativePath of allowedFiles) {
  const source = resolveInsideRoot(relativePath);
  const destination = path.join(outputDir, relativePath);
  let stats;

  try {
    stats = await lstat(source);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(`Arquivo obrigatório ausente: ${relativePath}`);
    }
    throw error;
  }

  if (stats.isSymbolicLink()) {
    throw new Error(`Link simbólico não permitido no pacote Pages: ${relativePath}`);
  }
  if (!stats.isFile()) {
    throw new Error(`Origem não é arquivo regular: ${relativePath}`);
  }
  if (stats.size <= 0) {
    throw new Error(`Arquivo obrigatório vazio: ${relativePath}`);
  }

  await access(source, constants.R_OK);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

console.log(`Pacote público do GitHub Pages preparado em ${path.relative(root, outputDir)}`);
for (const relativePath of allowedFiles) console.log(relativePath);
