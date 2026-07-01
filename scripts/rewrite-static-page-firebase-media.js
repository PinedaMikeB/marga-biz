#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const TARGET_DIRS = [
    path.join(ROOT_DIR, 'static-pages'),
];

const FIREBASE_MEDIA_REGEX =
    /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/sah-spiritual-journal\.firebasestorage\.app\/o\/public%2Fwebsite%2F([^"'?\s<>)]+)\?alt=media/gi;
const STORAGE_MEDIA_REGEX =
    /https:\/\/storage\.googleapis\.com\/sah-spiritual-journal\.firebasestorage\.app\/public\/website\/([^"'?\s<>)]+)/gi;

function toLocalMediaUrl(filename) {
    return filename === 'marga-logo.png'
        ? '/marga-logo.png'
        : `/website-media/${encodeURIComponent(filename)}`;
}

function rewriteHtml(html) {
    let next = html.replace(
        /^\s*<link rel="preconnect" href="https:\/\/firebasestorage\.googleapis\.com">\s*$/gm,
        ''
    );
    next = next.replace(
        /^\s*<link rel="dns-prefetch" href="https:\/\/firebasestorage\.googleapis\.com">\s*$/gm,
        ''
    );
    next = next.replace(FIREBASE_MEDIA_REGEX, (_, filename) => toLocalMediaUrl(decodeURIComponent(filename)));
    next = next.replace(STORAGE_MEDIA_REGEX, (_, filename) => toLocalMediaUrl(decodeURIComponent(filename)));
    return next;
}

function rewriteFile(filePath) {
    const before = fs.readFileSync(filePath, 'utf8');
    const after = rewriteHtml(before);
    if (before === after) return false;
    fs.writeFileSync(filePath, after);
    return true;
}

function walk(dirPath, changedFiles) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath, changedFiles);
            continue;
        }
        if (!entry.name.endsWith('.html')) continue;
        if (rewriteFile(fullPath)) {
            changedFiles.push(path.relative(ROOT_DIR, fullPath));
        }
    }
}

function main() {
    const changedFiles = [];
    for (const dirPath of TARGET_DIRS) {
        if (fs.existsSync(dirPath)) {
            walk(dirPath, changedFiles);
        }
    }

    console.log(`Rewrote Firebase media URLs in ${changedFiles.length} static page files.`);
    if (changedFiles.length > 0) {
        console.log(changedFiles.slice(0, 50).join('\n'));
        if (changedFiles.length > 50) {
            console.log(`...and ${changedFiles.length - 50} more`);
        }
    }
}

main();
