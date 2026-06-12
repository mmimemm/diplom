const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\mimem\\Desktop\\gogogo\\it-mania\\public';
const exts = ['.html', '.css', '.js'];

function walk(d) {
  const entries = fs.readdirSync(d, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      walk(p);
    } else if (e.isFile() && exts.some(x => e.name.endsWith(x))) {
      const c = fs.readFileSync(p, 'utf-8');
      const lines = c.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/mini\.png/i.test(lines[i])) {
          const rel = path.relative(dir, p);
          console.log(`${rel}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
  }
}

walk(dir);
