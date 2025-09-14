
const fs = require('fs');
const path = require('path');

function listFiles(dir, exts, out=[]) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) listFiles(p, exts, out);
    else if (exts.includes(path.extname(p))) out.push(p);
  }
  return out;
}

const root = process.cwd();
const files = listFiles(root, ['.ts','.tsx','.js','.jsx']);
let total = 0;
for (const f of files) {
  try {
    const txt = fs.readFileSync(f, 'utf8');
    // Count suspicious ellipses (not followed by identifier char)
    const matches = (txt.match(/\.\.\.(?![A-Za-z_\$])/g) || []).length;
    if (matches > 0) {
      console.log(`[ellipsis] ${f}: ${matches}`);
      total += matches;
    }
  } catch {}
}
console.log(`Remaining suspicious ellipses: ${total}`);
