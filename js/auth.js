/* ============================================================
   auth.js — إدارة الجلسة والدخول (Web Crypto / SHA-256)
   يعتمد على users.js (المُحمَّل أولاً).
   ============================================================ */
'use strict';

const SESSION_KEY = 'pacc_session_v1';
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

/* ---------- تشفير SHA-256 بنص UTF-8 ---------- */
async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

/* ---------- دالة المقارنة الآمنة زمنياً (بسيطة) ---------- */
function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

/* ---------- المصادقة ---------- */
async function authenticate(username, password) {
    const user = USERS.find(u => u.username === (username || '').trim().toLowerCase());
    if (!user) return { ok: false };
    const hash = await sha256Hex(user.salt + password);
    if (!safeEqual(hash, user.hash)) return { ok: false };

    const session = {
        username: user.username,
        role: user.role,
        name: user.name,
        pages: user.pages.slice(),
        loginAt: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
}

/* ---------- القراءة/المسح ---------- */
function getSession() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s || !s.username || !s.role) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }
        return s;
    } catch (err) {
        return null;
    }
}

function clearSession() {
    try {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem('pacc_fail_count');
        sessionStorage.removeItem('pacc_lock_until');
    } catch (err) { /* تجاهل */ }
}

/* ---------- الحماية على الصفحات ---------- */
function requireRole() {
    const session = getSession();
    if (!session) {
        window.location.replace('login.html');
        return null;
    }
    const page = window.location.pathname.split('/').pop() || 'index.html';
    if (!session.pages.includes(page)) {
        // صلاحية خاطئة: توجيه إلى صفحة الدور نفسها
        const target = session.role === 'chairman' ? 'chairman.html' : 'deputy.html';
        if (page !== target) window.location.replace(target);
        return null;
    }
    return session;
}

/* ---------- إدارة محاولات الدخول الفاشلة ---------- */
function getFailureState() {
    return {
        count: parseInt(sessionStorage.getItem('pacc_fail_count') || '0', 10),
        lockUntil: parseInt(sessionStorage.getItem('pacc_lock_until') || '0', 10)
    };
}

function registerFailure() {
    const st = getFailureState();
    const now = Date.now();
    let count = st.count + 1;
    if (now < st.lockUntil) count = MAX_ATTEMPTS; // ما زال في فترة القفل
    sessionStorage.setItem('pacc_fail_count', String(count));
    if (count >= MAX_ATTEMPTS) {
        sessionStorage.setItem('pacc_lock_until', String(now + LOCKOUT_SECONDS * 1000));
        return { locked: true, seconds: LOCKOUT_SECONDS };
    }
    return { locked: false, count };
}

function resetFailures() {
    sessionStorage.removeItem('pacc_fail_count');
    sessionStorage.removeItem('pacc_lock_until');
}

function remainingLockSeconds() {
    const now = Date.now();
    const lockUntil = parseInt(sessionStorage.getItem('pacc_lock_until') || '0', 10);
    if (now >= lockUntil || !lockUntil) return 0;
    return Math.ceil((lockUntil - now) / 1000);
}

/* ---------- خروج ---------- */
function logout() {
    clearSession();
    window.location.replace('login.html');
}