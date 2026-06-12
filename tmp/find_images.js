const fs = require('fs');
const path = require('path');

const extensions = ['.html', '.css', '.js'];
const imagesInCode = new Set();
const workDir = path.join(__dirname, '..', 'public');

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && extensions.some(e => entry.name.endsWith(e))) {
      const rel = path.relative(workDir, fullPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      // Pattern for src/href attributes
      const re1 = /["']((?:\.\.\/)*images\/[^"'\s?]+\.(?:png|jpg|jpeg|gif|svg|ico|webp))/gi;
      let m;
      while ((m = re1.exec(content)) !== null) {
        imagesInCode.add(m[1]);
      }
      // Pattern for url() in CSS
      const re2 = /url\(["']?((?:\.\.\/)*images\/[^"'\s?\)]+\.(?:png|jpg|jpeg|gif|svg|ico|webp))/gi;
      while ((m = re2.exec(content)) !== null) {
        imagesInCode.add(m[1]);
      }
    }
  }
}

walkDir(workDir);

// Normalize paths
const normalized = new Set();
for (let p of imagesInCode) {
  p = p.replace(/\\/g, '/');
  while (p.startsWith('../')) p = p.slice(3);
  while (p.startsWith('./')) p = p.slice(2);
  normalized.add(p);
}

console.log('=== ИЗОБРАЖЕНИЯ, НА КОТОРЫЕ ЕСТЬ ССЫЛКИ В КОДЕ ===');
const sorted = [...normalized].sort();
for (const p of sorted) console.log(p);

console.log('\n=== ФАКТИЧЕСКИЕ ФАЙЛЫ В public/images/ ===');
const imagesDir = path.join(__dirname, '..', 'public', 'images');
const actual = new Set();
if (fs.existsSync(imagesDir)) {
  for (const f of fs.readdirSync(imagesDir)) {
    actual.add('images/' + f);
    console.log('images/' + f);
  }
}

console.log('\n=== ОТСУТСТВУЮЩИЕ (есть в коде, нет на диске) ===');
const missing = [...normalized].filter(p => !actual.has(p));
if (missing.length) {
  for (const p of missing.sort()) console.log('  MISSING: ' + p);
} else {
  console.log('  Нет отсутствующих');
}

console.log('\n=== ЛИШНИЕ (есть на диске, нет в коде) ===');
const extra = [...actual].filter(p => !normalized.has(p));
if (extra.length) {
  for (const p of extra.sort()) console.log('  EXTRA: ' + p);
} else {
  console.log('  Нет лишних');
}
