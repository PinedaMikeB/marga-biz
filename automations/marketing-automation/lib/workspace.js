const fs = require('fs');
const path = require('path');

function getWorkspaceRoot(fromDir) {
    const baseName = path.basename(fromDir);
    if (baseName === 'workers' || baseName === 'lib') {
        return path.join(fromDir, '..');
    }

    return fromDir;
}

function getRepoRoot(workspaceRoot) {
    return path.join(workspaceRoot, '..', '..');
}

function parseArgs(argv) {
    const options = {};

    for (const arg of argv.slice(2)) {
        if (!arg.startsWith('--')) continue;
        const separatorIndex = arg.indexOf('=');
        if (separatorIndex === -1) {
            options[arg.slice(2)] = true;
            continue;
        }

        options[arg.slice(2, separatorIndex)] = arg.slice(separatorIndex + 1);
    }

    return options;
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function resolvePath(inputPath, fallbackAbsolutePath, baseDir) {
    if (!inputPath) {
        return fallbackAbsolutePath;
    }

    if (path.isAbsolute(inputPath)) {
        return inputPath;
    }

    return path.join(baseDir, inputPath);
}

function readJson(filePath, fallback = null) {
    if (!filePath || !fs.existsSync(filePath)) {
        return fallback;
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        return {
            __readError: error.message,
            __filePath: filePath
        };
    }
}

function readText(filePath, fallback = '') {
    if (!filePath || !fs.existsSync(filePath)) {
        return fallback;
    }

    return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, payload) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function writeText(filePath, text) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, text);
}

function compact(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function slugToTitle(value) {
    return String(value || '')
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function titleToSlug(value) {
    return compact(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function average(values) {
    const valid = values.filter((value) => Number.isFinite(value));
    if (!valid.length) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function percent(numerator, denominator) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
        return null;
    }

    return (numerator / denominator) * 100;
}

function formatNumber(value, digits = 1) {
    if (!Number.isFinite(value)) {
        return 'n/a';
    }

    return Number(value).toFixed(digits);
}

function formatRank(value) {
    return Number.isFinite(value) ? `#${value}` : 'not ranking';
}

function listFilesRecursively(dirPath, matcher = () => true) {
    if (!fs.existsSync(dirPath)) {
        return [];
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFilesRecursively(entryPath, matcher));
            continue;
        }

        if (entry.isFile() && matcher(entryPath)) {
            files.push(entryPath);
        }
    }

    return files;
}

function makeRunId(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, '-');
}

function writeWorkerArtifacts({
    report,
    markdown,
    outputDir,
    latestDir,
    extraFiles = []
}) {
    if (outputDir) {
        writeJson(path.join(outputDir, 'latest.json'), report);
        writeText(path.join(outputDir, 'latest.md'), markdown);
        for (const extraFile of extraFiles) {
            writeText(path.join(outputDir, extraFile.name), extraFile.content);
        }
    }

    if (latestDir) {
        writeJson(path.join(latestDir, 'latest.json'), report);
        writeText(path.join(latestDir, 'latest.md'), markdown);
        for (const extraFile of extraFiles) {
            writeText(path.join(latestDir, extraFile.name), extraFile.content);
        }
    }
}

module.exports = {
    average,
    compact,
    ensureDir,
    formatNumber,
    formatRank,
    getRepoRoot,
    getWorkspaceRoot,
    listFilesRecursively,
    makeRunId,
    parseArgs,
    percent,
    readJson,
    readText,
    resolvePath,
    slugToTitle,
    titleToSlug,
    writeJson,
    writeText,
    writeWorkerArtifacts
};
