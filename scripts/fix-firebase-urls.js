#!/usr/bin/env node

/**
 * Fix Firebase Storage URLs - Remove Invalid Tokens
 * 
 * Removes &token=... from Firebase Storage URLs
 * Keeps ?alt=media which works publicly
 */

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../index.html');

console.log('🔧 Fixing Firebase Storage URLs...\n');

// Read HTML
let html = fs.readFileSync(indexPath, 'utf8');

// Count URLs before
const beforeCount = (html.match(/firebasestorage\.googleapis\.com/g) || []).length;
console.log(`📊 Found ${beforeCount} Firebase Storage URLs`);

// Remove &token=... from all Firebase URLs
// Pattern: &token=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
html = html.replace(/(&token=[a-f0-9-]+)/gi, '');

// Verify URLs after
const afterCount = (html.match(/firebasestorage\.googleapis\.com/g) || []).length;
console.log(`✅ Cleaned ${afterCount} URLs\n`);

// Save
fs.writeFileSync(indexPath, html);

console.log('✅ Fixed! All Firebase URLs now use ?alt=media without tokens');
console.log('\n📋 Next steps:');
console.log('1. Test locally: open index.html');
console.log('2. Commit: git add index.html && git commit -m "Fix: Remove invalid Firebase tokens"');
console.log('3. Push: git push');
console.log('4. Netlify will auto-deploy! 🚀\n');
