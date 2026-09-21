#!/usr/bin/env node
/* ============================================================
   preview-server.mjs — خادم محلي صغير للتجربة فقط
   (بديل لـ npx serve، لا يُستخدم في الإنتاج)

   السبب: npx serve كان ينهار بـ EMFILE (كثرة الملفات المفتوحة)
   عند انفجار طلبات متطابقة. هذا الخادم:
     • يحدّ عدد الملفات المفتوحة معاً (قائمة انتظار)
     • يضغط الطلبات المتطابقة ويكتفي بأول عملية قراءة
     • لا ينهار تحت الضغط — يكتفي بـ 503 إن اشتغل كثيراً

   التشغيل:  node tools/preview-server.mjs [المنفذ]   (افتراضي 4174)
   ============================================================ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4174);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8'
};

/* حجم نافذة القراءة المتزامنة — يمنع EMFILE */
const MAX_CONCURRENT_READS = 24;
let activeReads = 0;
const readQueue = [];

function withReadLock(fn) {
    return new Promise((resolve, reject) => {
        const job = () => {
            activeReads++;
            fn().then(
                r => { activeReads--; next(); resolve(r); },
                e => { activeReads--; next(); reject(e); }
            );
        };
        const next = () => { while (activeReads < MAX_CONCURRENT_READS && readQueue.length) readQueue.shift()(); };
        if (activeReads < MAX_CONCURRENT_READS) job();
        else readQueue.push(job);
    });
}

/* جدول طلبات متطابقة قيد المعالجة لتجميعها */
const inflight = new Map();

function serveFile(req, res, filePath) {
    const key = req.method + ' ' + req.url;
    if (inflight.has(key)) {
        // طلب مطابق قيد القراءة — انتظر نفس النتيجة
        inflight.get(key).then(r => respond(res, r), () => respond(res, generic503()));
        return;
    }

    const p = withReadLock(() => fs.promises.readFile(filePath))
        .then(data => {
            const ext = path.extname(filePath).toLowerCase();
            return {
                status: 200,
                headers: {
                    'Content-Type': MIME[ext] || 'application/octet-stream',
                    'Cache-Control': 'no-store',
                    'X-Content-Type-Options': 'nosniff'
                },
                body: data
            };
        })
        .catch(err => {
            if (err.code === 'ENOENT') return null;
            console.error('ERROR', filePath, err.message);
            return { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: Buffer.from('500 Internal Error') };
        });

    inflight.set(key, p);
    p.finally(() => inflight.delete(key)).then(r => {
        if (!r) {
            respond(res, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: Buffer.from('404 Not Found') });
        } else {
            respond(res, r);
        }
    });
}

function respond(res, r) {
    if (res.writableEnded || res.destroyed) return;
    res.writeHead(r.status, r.headers);
    res.end(r.body);
}

function generic503() {
    return {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '1' },
        body: Buffer.from('503 Busy — حاول مجدداً')
    };
}

const server = http.createServer((req, res) => {
    let urlPath;
    try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { respond(res, { status: 400, headers: {}, body: Buffer.from('400 Bad Request') }); return; }

    if (urlPath === '/') urlPath = '/index.html';

    // منع تجاوز الدليل (../)
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
        respond(res, { status: 403, headers: {}, body: Buffer.from('403 Forbidden') });
        return;
    }

    // مسار بلا امتداد: جرّب إضافة .html (مثل /chairman -> chairman.html)
    let candidate = filePath;
    if (!path.extname(candidate)) {
        candidate = filePath + '.html';
    }

    fs.promises.stat(candidate).then(st => {
        if (st.isDirectory()) {
            const idx = path.join(candidate, 'index.html');
            return fs.promises.stat(idx).then(() => serveFile(req, res, idx)).catch(() => serveFile(req, res, candidate));
        }
        serveFile(req, res, candidate);
    }).catch(() => serveFile(req, res, candidate));
});

server.on('clientError', (err, socket) => {
    try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch { /* تجاهل */ }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log('pacc preview server: http://localhost:' + PORT + '  (root: ' + ROOT + ')');
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });