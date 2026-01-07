/**
 * Marga Website - Image Uploader
 * 
 * Downloads images from WordPress site and uploads to Firebase Storage
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

console.log('🔥 Marga Image Uploader\n');

// Check for service account key
const serviceAccountPath = path.join(__dirname, '../service-account-key.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Error: service-account-key.json not found!');
    console.log('\n📋 Please follow FIREBASE-SETUP.md instructions first.\n');
    process.exit(1);
}

// Initialize Firebase Admin
console.log('🔧 Initializing Firebase...');
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: serviceAccount.project_id + '.firebasestorage.app'
});

const bucket = admin.storage().bucket();
console.log('✅ Firebase initialized\n');

// Load WordPress data
const wpDataPath = path.join(__dirname, '../data/wordpress-data.json');
if (!fs.existsSync(wpDataPath)) {
    console.error('❌ WordPress data not found!');
    process.exit(1);
}

console.log('📁 Loading WordPress data...');
const wpData = JSON.parse(fs.readFileSync(wpDataPath, 'utf8'));
console.log(`✅ Loaded data for ${wpData.pages.length} pages\n`);

// Extract all unique image URLs
console.log('🔍 Extracting image URLs...');
const imageUrls = new Set();

// Helper to extract URLs from content
function extractImageUrls(content) {
    if (!content) return;
    
    // Match img src and various WordPress upload paths
    const patterns = [
        /https?:\/\/marga\.biz\/wp-content\/uploads\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp|svg)/gi,
        /http:\/\/marga\.biz\/wp-content\/uploads\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp|svg)/gi,
        /src="(https?:\/\/marga\.biz\/[^"]+\.(jpg|jpeg|png|gif|webp|svg))"/gi
    ];
    
    patterns.forEach(pattern => {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
            imageUrls.add(match[0].replace(/^src="|"$/g, ''));
        }
    });
}

// Extract from homepage
const homepage = wpData.pages.find(p => 
    p.slug === 'copier-rental' || 
    p.slug === '' || 
    p.link.endsWith('.biz/')
);

if (homepage) {
    extractImageUrls(homepage.content);
    console.log('✅ Extracted images from homepage');
}

// Extract from all pages
wpData.pages.slice(0, 50).forEach(page => {
    extractImageUrls(page.content);
});

console.log(`✅ Found ${imageUrls.size} unique images\n`);

// Download and upload images
const urlMapping = {};
let uploaded = 0;
let failed = 0;

async function downloadAndUpload(url) {
    return new Promise((resolve, reject) => {
        try {
            // Clean URL
            url = url.trim().replace(/['"]/g, '');
            
            // Get filename
            const urlObj = new URL(url);
            const filename = path.basename(urlObj.pathname);
            const firebasePath = `public/website/${filename}`;
            
            console.log(`📥 Downloading: ${filename}`);
            
            // Download image
            const protocol = url.startsWith('https') ? https : http;
            protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    console.log(`⚠️  Failed to download ${filename}: ${response.statusCode}`);
                    failed++;
                    resolve();
                    return;
                }
                
                const chunks = [];
                response.on('data', chunk => chunks.push(chunk));
                response.on('end', async () => {
                    try {
                        const buffer = Buffer.concat(chunks);
                        
                        // Upload to Firebase
                        const file = bucket.file(firebasePath);
                        await file.save(buffer, {
                            metadata: {
                                contentType: response.headers['content-type'],
                                cacheControl: 'public, max-age=31536000'
                            }
                        });
                        
                        // Make public
                        await file.makePublic();
                        
                        // Get public URL
                        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${firebasePath}`;
                        urlMapping[url] = publicUrl;
                        
                        uploaded++;
                        console.log(`✅ Uploaded: ${filename} (${uploaded}/${imageUrls.size})`);
                        resolve();
                        
                    } catch (uploadError) {
                        console.error(`❌ Upload error for ${filename}:`, uploadError.message);
                        failed++;
                        resolve();
                    }
                });
            }).on('error', (err) => {
                console.error(`❌ Download error for ${filename}:`, err.message);
                failed++;
                resolve();
            });
            
        } catch (error) {
            console.error(`❌ Error processing ${url}:`, error.message);
            failed++;
            resolve();
        }
    });
}

async function uploadAllImages() {
    console.log('📤 Starting upload process...\n');
    
    const imageArray = Array.from(imageUrls);
    
    // Upload in batches to avoid overwhelming the connection
    const batchSize = 5;
    for (let i = 0; i < imageArray.length; i += batchSize) {
        const batch = imageArray.slice(i, i + batchSize);
        await Promise.all(batch.map(url => downloadAndUpload(url)));
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📊 Upload Summary:');
    console.log(`✅ Uploaded: ${uploaded}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📁 Total: ${imageUrls.size}\n`);
    
    // Save mapping file
    const mappingPath = path.join(__dirname, '../data/image-url-mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify(urlMapping, null, 2));
    console.log('✅ Saved URL mapping to: data/image-url-mapping.json\n');
    
    // Update HTML with new URLs
    await updateHTML();
}

async function updateHTML() {
    console.log('🔄 Updating HTML with Firebase URLs...');
    
    const indexPath = path.join(__dirname, '../index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Replace URLs
    let replacements = 0;
    Object.entries(urlMapping).forEach(([oldUrl, newUrl]) => {
        if (html.includes(oldUrl)) {
            html = html.replace(new RegExp(oldUrl, 'g'), newUrl);
            replacements++;
        }
    });
    
    fs.writeFileSync(indexPath, html);
    console.log(`✅ Updated ${replacements} image URLs in index.html\n`);
    
    console.log('🎉 All done! Your website now uses Firebase Storage for images.\n');
    console.log('📋 Next steps:');
    console.log('   1. Open index.html to verify images load');
    console.log('   2. Test in browser');
    console.log('   3. Deploy to Netlify\n');
}

// Run the upload
uploadAllImages()
    .then(() => {
        console.log('✅ Image upload complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
