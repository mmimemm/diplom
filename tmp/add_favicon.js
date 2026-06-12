const fs = require('fs');
const path = require('path');

const publicDir = 'c:\\Users\\mimem\\Desktop\\gogogo\\it-mania\\public';
const iconPath = 'images/favicon.ico';

function getRelativePath(filePath) {
  const rel = path.relative(path.dirname(filePath), path.join(publicDir));
  // Normalize to forward slashes
  return rel.replace(/\\/g, '/') + '/' + iconPath;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.')) {
      walk(p);
    } else if (e.isFile() && e.name.endsWith('.html')) {
      let content = fs.readFileSync(p, 'utf-8');
      
      // Check if favicon link already exists
      if (/rel=["'](?:shortcut )?icon["']/i.test(content)) {
        console.log(`SKIP (already has icon): ${path.relative(publicDir, p)}`);
        continue;
      }
      
      const relPath = getRelativePath(p);
      const faviconTag = `<link rel="icon" href="${relPath}" type="image/x-icon">`;
      
      // Insert after <title> or after <meta charset>
      let newContent;
      const titleMatch = content.match(/<\/title>/i);
      if (titleMatch) {
        const idx = titleMatch.index + titleMatch[0].length;
        newContent = content.slice(0, idx) + '\n  ' + faviconTag + content.slice(idx);
      } else {
        // Fallback: after charset meta
        const charsetMatch = content.match(/<meta[^>]+charset[^>]+>/i);
        if (charsetMatch) {
          const idx = charsetMatch.index + charsetMatch[0].length;
          newContent = content.slice(0, idx) + '\n  ' + faviconTag + content.slice(idx);
        } else {
          // After <head>
          const headMatch = content.match(/<head>/i);
          if (headMatch) {
            const idx = headMatch.index + headMatch[0].length;
            newContent = content.slice(0, idx) + '\n  ' + faviconTag + content.slice(idx);
          } else {
            console.log(`ERROR: no <head> in ${path.relative(publicDir, p)}`);
            continue;
          }
        }
      }
      
      fs.writeFileSync(p, newContent, 'utf-8');
      console.log(`ADDED: ${path.relative(publicDir, p)}  →  ${relPath}`);
    }
  }
}

walk(publicDir);
console.log('\nDone!');
