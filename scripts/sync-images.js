/**
 * Download Missing Images from WordPress and Upload to Firebase
 * 
 * This script:
 * 1. Scans wordpress-data.json for all image URLs
 * 2. Checks which ones are missing from Firebase
 * 3. Downloads missing images from live WordPress site
 * 4. Uploads them to Firebase Storage
 * 
 * Usage: node scripts/sync-images.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Firebase Admin SDK
const admin = require('firebase-admin');

// Configuration
const CONFIG = {
    dataDir: path.join(__dirname, '../data'),
    tempDir: path.join(__dirname, '../temp-images'),
    serviceAccountPath: path.join(__dirname, '../service-account-key.json'),
    storageBucket: 'sah-spiritual-journal.firebasestorage.app',
    firebasePath: 'public/website/'
};

// Stats
const stats = {
    totalNeeded: 0,
    alreadyExists: 0,
    downloaded: 0,
    uploaded: 0,
    failed: [],
    startTime: Date.now()
};

console.log('🖼️  Image Sync Tool - WordPress to Firebase\n');
console.log('='.repeat(50));

// Initialize Firebase
function initFirebase() {
    console.log('\n🔥 Initializing Firebase...');
    
    if (!fs.existsSync(CONFIG.serviceAccountPath)) {
        console.error('❌ Service account key not found!');
        console.log('   Please ensure service-account-key.json exists');
        process.exit(1);
    }
    
    const serviceAccount = require(CONFIG.serviceAccountPath);
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: CONFIG.storageBucket
    });
    
    console.log('   ✅ Firebase initialized');
    return admin.storage().bucket();
}

// Extract all image URLs from WordPress data
function extractImageUrls() {
    console.log('\n📁 Extracting image URLs from WordPress data...');
    
    const wpDataPath = path.join(CONFIG.dataDir, 'wordpress-data.json');
    const wpData = JSON.parse(fs.readFileSync(wpDataPath, 'utf8'));
    
    const allContent = [];
    
    // Collect all content
    for (const page of (wpData.pages || [])) {
        if (page.content) allContent.push(page.content);
    }
    for (const post of (wpData.posts || [])) {
        if (post.content) allContent.push(post.content);
    }
    
    const fullContent = allContent.join('\n');
    
    // Find all WordPress image URLs
    const pattern = /https?:\/\/marga\.biz\/wp-content\/uploads\/(\d{4})\/(\d{2})\/([^"'\s>]+)/gi;
    const matches = [...fullContent.matchAll(pattern)];
    
    // Build unique image list with full URLs
    const images = new Map();
    
    for (const match of matches) {
        const [fullUrl, year, month, filename] = match;
        
        // Clean filename (remove query strings)
        let cleanFilename = filename.split('?')[0];
        
        // Remove WordPress size suffixes like -300x300
        const baseFilename = cleanFilename.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
        
        // Store with base filename as key (avoid duplicates)
        if (!images.has(baseFilename)) {
            // Construct clean URL (use https and base filename)
            const cleanUrl = `https://marga.biz/wp-content/uploads/${year}/${month}/${baseFilename}`;
            images.set(baseFilename, {
                filename: baseFilename,
                url: cleanUrl,
                year,
                month
            });
        }
    }
    
    console.log(`   ✅ Found ${images.size} unique images`);
    return Array.from(images.values());
}

// Check which images exist in Firebase
async function checkExistingImages(bucket, images) {
    console.log('\n🔍 Checking existing images in Firebase...');
    
    const missing = [];
    let checked = 0;
    
    for (const img of images) {
        const firebasePath = CONFIG.firebasePath + img.filename;
        const file = bucket.file(firebasePath);
        
        try {
            const [exists] = await file.exists();
            if (exists) {
                stats.alreadyExists++;
            } else {
                missing.push(img);
            }
        } catch (error) {
            missing.push(img);
        }
        
        checked++;
        if (checked % 100 === 0) {
            console.log(`   Checked ${checked}/${images.length}...`);
        }
    }
    
    console.log(`   ✅ ${stats.alreadyExists} already exist, ${missing.length} missing`);
    return missing;
}

// Download image from URL
function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        const request = protocol.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                downloadImage(redirectUrl, destPath).then(resolve).catch(reject);
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            
            const fileStream = fs.createWriteStream(destPath);
            response.pipe(fileStream);
            
            fileStream.on('finish', () => {
                fileStream.close();
                resolve(destPath);
            });
            
            fileStream.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });
        
        request.on('error', reject);
        request.setTimeout(30000, () => {
            request.destroy();
            reject(new Error('Timeout'));
        });
    });
}

// Upload image to Firebase
async function uploadToFirebase(bucket, localPath, firebasePath) {
    await bucket.upload(localPath, {
        destination: firebasePath,
        metadata: {
            cacheControl: 'public, max-age=31536000',
        }
    });
}

// Process missing images
async function processMissingImages(bucket, missingImages) {
    console.log('\n📥 Downloading and uploading missing images...');
    
    // Create temp directory
    if (!fs.existsSync(CONFIG.tempDir)) {
        fs.mkdirSync(CONFIG.tempDir, { recursive: true });
    }
    
    let processed = 0;
    const total = missingImages.length;
    
    // Process in batches of 5 for rate limiting
    const batchSize = 5;
    
    for (let i = 0; i < missingImages.length; i += batchSize) {
        const batch = missingImages.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (img) => {
            const localPath = path.join(CONFIG.tempDir, img.filename);
            const firebasePath = CONFIG.firebasePath + img.filename;
            
            try {
                // Download from WordPress
                await downloadImage(img.url, localPath);
                stats.downloaded++;
                
                // Upload to Firebase
                await uploadToFirebase(bucket, localPath, firebasePath);
                stats.uploaded++;
                
                // Clean up temp file
                fs.unlinkSync(localPath);
                
            } catch (error) {
                stats.failed.push({
                    filename: img.filename,
                    url: img.url,
                    error: error.message
                });
            }
            
            processed++;
        }));
        
        // Progress update
        if (processed % 50 === 0 || processed === total) {
            console.log(`   📤 Processed ${processed}/${total} (${stats.uploaded} uploaded, ${stats.failed.length} failed)`);
        }
        
        // Small delay between batches to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
    }
}

// Main execution
async function main() {
    try {
        // Initialize Firebase
        const bucket = initFirebase();
        
        // Extract image URLs from WordPress data
        const images = extractImageUrls();
        stats.totalNeeded = images.length;
        
        // Check which images already exist
        const missingImages = await checkExistingImages(bucket, images);
        
        if (missingImages.length === 0) {
            console.log('\n✅ All images already exist in Firebase!');
            return;
        }
        
        console.log(`\n📊 Need to download ${missingImages.length} images`);
        
        // Process missing images
        await processMissingImages(bucket, missingImages);
        
        // Summary
        const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);
        
        console.log('\n' + '='.repeat(50));
        console.log('🎉 IMAGE SYNC COMPLETE!');
        console.log('='.repeat(50));
        console.log(`\n📊 Summary:`);
        console.log(`   Total images needed: ${stats.totalNeeded}`);
        console.log(`   Already in Firebase: ${stats.alreadyExists}`);
        console.log(`   Downloaded: ${stats.downloaded}`);
        console.log(`   Uploaded: ${stats.uploaded}`);
        console.log(`   Failed: ${stats.failed.length}`);
        console.log(`   Duration: ${duration}s`);
        
        if (stats.failed.length > 0) {
            console.log('\n⚠️  Failed images:');
            const failedLog = path.join(__dirname, '../failed-images.json');
            fs.writeFileSync(failedLog, JSON.stringify(stats.failed, null, 2));
            console.log(`   Saved to: failed-images.json`);
            
            // Show first 10
            stats.failed.slice(0, 10).forEach(f => {
                console.log(`   - ${f.filename}: ${f.error}`);
            });
            if (stats.failed.length > 10) {
                console.log(`   ... and ${stats.failed.length - 10} more`);
            }
        }
        
        // Clean up temp directory
        if (fs.existsSync(CONFIG.tempDir)) {
            fs.rmSync(CONFIG.tempDir, { recursive: true });
        }
        
        console.log('\n📋 Next steps:');
        console.log('   1. Run: npm run generate');
        console.log('   2. Test locally: npm run serve');
        console.log('   3. Deploy: git push\n');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();
