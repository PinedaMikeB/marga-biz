const fs = require('fs');
const path = require('path');

const GA4_CODE = `<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-L8XL675H9L"></script>
<script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-L8XL675H9L');
</script>
`;

const distDir = '/Volumes/Wotg Drive Mike/GitHub/marga-biz/dist';
let count = 0;
let skipped = 0;

function processDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (item === 'index.html') {
            let content = fs.readFileSync(fullPath, 'utf8');
            
            // Check if GA4 already exists
            if (content.includes('G-L8XL675H9L')) {
                skipped++;
                continue;
            }
            
            // Insert GA4 after <head>
            if (content.includes('<head>')) {
                content = content.replace('<head>', '<head>\n' + GA4_CODE);
                fs.writeFileSync(fullPath, content);
                count++;
                if (count % 100 === 0) {
                    console.log(`Processed ${count} files...`);
                }
            }
        }
    }
}

console.log('Starting GA4 injection...');
processDirectory(distDir);
console.log(`\nDone! Added GA4 to ${count} files. Skipped ${skipped} (already had GA4).`);
