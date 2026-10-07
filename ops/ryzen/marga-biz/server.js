'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

function loadJsonEnvironment(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return;
    const values = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const [key, value] of Object.entries(values)) {
        if (process.env[key] == null && value != null) {
            process.env[key] = String(value);
        }
    }
}

loadJsonEnvironment(process.env.NETLIFY_ENV_JSON);

const PORT = Number(process.env.PORT || 9400);
const SITE_ROOT = path.resolve(process.env.SITE_ROOT || '/site/dist');
const FUNCTIONS_ROOT = path.resolve(process.env.FUNCTIONS_ROOT || '/site/netlify/functions');
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const MIME_TYPES = {
    '.avif': 'image/avif',
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml; charset=utf-8'
};

function applyCommonHeaders(res) {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

function sendJson(res, statusCode, payload) {
    applyCommonHeaders(res);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(Object.assign(new Error('Request body is too large'), { statusCode: 413 }));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function eventHeaders(req) {
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
        headers[key] = Array.isArray(value) ? value.join(', ') : (value || '');
    }
    return headers;
}

async function serveFunction(req, res, requestUrl) {
    const prefix = '/.netlify/functions/';
    const functionName = requestUrl.pathname.slice(prefix.length).split('/')[0];
    if (!/^[A-Za-z0-9_-]+$/.test(functionName)) {
        sendJson(res, 404, { error: 'Function not found' });
        return;
    }

    const modulePath = path.join(FUNCTIONS_ROOT, `${functionName}.js`);
    if (!fs.existsSync(modulePath)) {
        sendJson(res, 404, { error: 'Function not found' });
        return;
    }

    const body = ['GET', 'HEAD'].includes(req.method) ? null : await readBody(req);
    const queryStringParameters = {};
    for (const [key, value] of requestUrl.searchParams.entries()) {
        queryStringParameters[key] = value;
    }

    const handlerModule = require(modulePath);
    if (typeof handlerModule.handler !== 'function') {
        throw new Error(`Function ${functionName} does not export handler`);
    }

    const response = await handlerModule.handler({
        httpMethod: req.method,
        headers: eventHeaders(req),
        path: requestUrl.pathname,
        rawUrl: requestUrl.toString(),
        rawQuery: requestUrl.search.slice(1),
        queryStringParameters,
        body,
        isBase64Encoded: false
    }, { functionName });

    applyCommonHeaders(res);
    res.statusCode = Number(response?.statusCode || 200);
    for (const [key, value] of Object.entries(response?.headers || {})) {
        if (value != null) res.setHeader(key, value);
    }
    for (const [key, values] of Object.entries(response?.multiValueHeaders || {})) {
        if (values != null) res.setHeader(key, values);
    }

    const responseBody = response?.body == null ? '' : String(response.body);
    const output = response?.isBase64Encoded
        ? Buffer.from(responseBody, 'base64')
        : Buffer.from(responseBody);
    res.setHeader('Content-Length', output.length);
    res.end(req.method === 'HEAD' ? undefined : output);
}

function safeStaticPath(pathname) {
    const decoded = decodeURIComponent(pathname);
    const resolved = path.resolve(SITE_ROOT, `.${decoded}`);
    if (resolved !== SITE_ROOT && !resolved.startsWith(`${SITE_ROOT}${path.sep}`)) {
        return null;
    }
    return resolved;
}

function findStaticFile(pathname) {
    const candidate = safeStaticPath(pathname);
    if (!candidate) return null;

    const candidates = [candidate];
    if (pathname.endsWith('/')) {
        candidates.unshift(path.join(candidate, 'index.html'));
    } else if (!path.extname(candidate)) {
        candidates.push(path.join(candidate, 'index.html'), `${candidate}.html`);
    }

    for (const filePath of candidates) {
        try {
            if (fs.statSync(filePath).isFile()) return filePath;
        } catch (_) {
            // Try the next pretty-URL candidate.
        }
    }
    return null;
}

function serveStatic(req, res, pathname) {
    if (pathname.startsWith('/wp-admin/') || pathname.startsWith('/feed/')) {
        res.statusCode = 301;
        res.setHeader('Location', '/');
        res.end();
        return;
    }

    const filePath = findStaticFile(pathname);
    if (!filePath) {
        const notFound = path.join(SITE_ROOT, '404.html');
        applyCommonHeaders(res);
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        if (fs.existsSync(notFound)) {
            fs.createReadStream(notFound).pipe(res);
        } else {
            res.end('Not found');
        }
        return;
    }

    const stat = fs.statSync(filePath);
    const extension = path.extname(filePath).toLowerCase();
    applyCommonHeaders(res);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES[extension] || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());

    if (pathname.startsWith('/css/') || pathname.startsWith('/js/') || extension === '.ico') {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (pathname.startsWith('/services/')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    if (req.method === 'HEAD') {
        res.end();
        return;
    }
    fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
    try {
        const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        if (requestUrl.pathname === '/__health') {
            sendJson(res, 200, { ok: true, service: 'marga-biz' });
            return;
        }
        if (requestUrl.pathname.startsWith('/.netlify/functions/')) {
            await serveFunction(req, res, requestUrl);
            return;
        }
        if (!['GET', 'HEAD'].includes(req.method)) {
            sendJson(res, 405, { error: 'Method not allowed' });
            return;
        }
        serveStatic(req, res, requestUrl.pathname);
    } catch (error) {
        console.error(error);
        if (!res.headersSent) {
            sendJson(res, error.statusCode || 500, { error: 'Internal server error' });
        } else {
            res.end();
        }
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Marga.biz listening on ${PORT}`);
});

function shutdown() {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
