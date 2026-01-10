/**
 * Add GA4 Events Script to All HTML Files
 * Run: node add-ga4-events.js
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = './dist';
const SCRIPT_TAG = '    <script src="/js/ga4-events.js" defer></script>';
const SEARCH_PATTERN = '</body>';

let filesUpdated = 0;
let filesSkipped = 0;
let errors = [];

function processFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Skip if already has ga4-events.js
        if (content.includes('ga4-events.js')) {
            filesSkipped++;
            return;
        }
        
        // Insert before </body>
        if (content.includes(SEARCH_PATTERN)) {
            content = content.replace(
                SEARCH_PATTERN, 
                `${SCRIPT_TAG}\n${SEARCH_PATTERN}`
            );
            fs.writeFileSync(filePath, content, 'utf8');
            filesUpdated++;
        }
    } catch (err) {
        errors.push({ file: filePath, error: err.message });
    }
}

function walkDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            walkDirectory(filePath);
        } else if (file.endsWith('.html')) {
            processFile(filePath);
        }
    });
}

console.log('Adding GA4 Events tracking to all HTML files...\n');
console.log(`Directory: ${DIST_DIR}`);
console.log('-------------------------------------------');

walkDirectory(DIST_DIR);

console.log('\n-------------------------------------------');
console.log(`✅ Files updated: ${filesUpdated}`);
console.log(`⏭️  Files skipped (already had script): ${filesSkipped}`);

if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length}`);
    errors.forEach(e => console.log(`   - ${e.file}: ${e.error}`));
}

console.log('\nDone! Now commit and push to deploy.');
