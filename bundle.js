const fs = require('fs');
const { execSync } = require('child_process');

console.log('=== Starting Bundler ===');

let fbCode = fs.readFileSync('firebase-config.js', 'utf8');
let appCode = fs.readFileSync('app.js', 'utf8');

// Strip exports from firebase-config.js
fbCode = fbCode.replace(/export\s+async\s+function\s+/g, 'async function ');
fbCode = fbCode.replace(/export\s+function\s+/g, 'function ');
fbCode = fbCode.replace(/export\s+const\s+/g, 'const ');
fbCode = fbCode.replace(/export\s+let\s+/g, 'let ');
fbCode = fbCode.replace(/export\s+var\s+/g, 'var ');
fbCode = fbCode.replace(/export\s+default\s+/g, '');
fbCode = fbCode.replace(/export\s*\{[\s\S]*?\};?/g, '');

// Strip imports of firebase-config from app.js
appCode = appCode.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/firebase-config\.js['"];?/g, '// [Inlined from firebase-config.js]');

const combinedCode = `// ==========================================
// 1. FIREBASE CORE & REALTIME CLOUD STORE
// ==========================================
${fbCode}

// ==========================================
// 2. HELMY POS APPLICATION CONTROLLER
// ==========================================
${appCode}
`;

// Verify syntax of combined code using node --check on a temp mjs file
fs.writeFileSync('_temp_bundle.mjs', combinedCode, 'utf8');
try {
  execSync('node --check _temp_bundle.mjs', { stdio: 'pipe' });
  console.log('Syntax check of combined ES module passed successfully with zero errors!');
} catch (err) {
  console.error('Syntax error in combined script:', err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
} finally {
  if (fs.existsSync('_temp_bundle.mjs')) {
    fs.unlinkSync('_temp_bundle.mjs');
  }
}

// Read index.html
let html = fs.readFileSync('index.html', 'utf8');

if (html.includes('<!-- SCRIPT PLACEHOLDER -->')) {
  console.log('Replacing <!-- SCRIPT PLACEHOLDER --> with inline bundle...');
  html = html.replace('<!-- SCRIPT PLACEHOLDER -->', `<script type="module">\n${combinedCode}\n</script>`);
} else {
  const scriptTagRegex = /<script\s+type=["']module["']\s+src=["']\.\/app\.js["']\s*><\/script>/;
  if (scriptTagRegex.test(html)) {
    console.log('Replacing <script type="module" src="./app.js"></script> with inline bundle...');
    html = html.replace(scriptTagRegex, `<script type="module">\n${combinedCode}\n</script>`);
  } else {
    const inlineScriptRegex = /<script\s+type=["']module["']>[\s\S]*?<\/script>/;
    if (inlineScriptRegex.test(html)) {
      console.log('Replacing existing inline module script with updated bundle...');
      html = html.replace(inlineScriptRegex, `<script type="module">\n${combinedCode}\n</script>`);
    } else {
      console.error('Could not find script placeholder or script tag in index.html!');
      process.exit(1);
    }
  }
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('Successfully bundled into index.html! File size:', html.length, 'bytes');
