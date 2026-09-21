/* ============================================================
   common.js — أدوات مشتركة بين صفحتي الرئيس والنائب
   ============================================================ */
'use strict';

let APP = null; // { data, recs }

const YEARS = ['2022', '2023', '2024', '2025'];

const STATUS_LABELS = {
    available: 'متوفر',
    partial: 'متوفر جزئياً',
    unavailable: 'غير متوفر'
};

const POLARITY_LABELS = {
    up_good: 'الارتفاع إيجابي',
    down_good: 'الانخفاض إيجابي',
    neutral: 'محايد'
};

const HORIZON_LABELS = {
    short: 'قصير',
    medium: 'متوسط',
    strategic: 'استراتيجي'
};

const HORIZON_GROUP = {
    short: 'قصيرة المدى (تنظيمية وتنفيذية)',
    medium: 'متوسطة المدى (مؤسسية)',
    strategic: 'استراتيجية (سياسات عامة)'
};

const AXIS_NUM = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠'];

/* ---------- تحميل البيانات ---------- */
async function loadAppData() {
    try {
        const [dataRes, recRes] = await Promise.all([
            fetch('data.json', { cache: 'no-store' }),
            fetch('recommendations.json', { cache: 'no-store' })
        ]);
        if (!dataRes.ok) throw new Error('data ' + dataRes.status);
        if (!recRes.ok) throw new Error('recommendations ' + recRes.status);
        const data = await dataRes.json();
        const recs = await recRes.json();
        APP = { data, recs };
        return APP;
    } catch (err) {
        console.error('تعذر تحميل بيانات المقياس', err);
        APP = null;
        throw err;
    }
}

function showLoadError(container) {
    if (!container) return;
    container.innerHTML =
        '<div class="load-error"><i class="bi bi-exclamation-triangle-fill"></i>' +
        'تعذّر تحميل بيانات المقياس. تأكد من وجود ملفيّ data.json و recommendations.json بجانب الصفحة، ثم أعد التحميل.</div>';
}

/* ---------- قواعد القراءة السريعة ---------- */
function ind(id) {
    return APP.data.indicators.find(i => i.id === id);
}

function getAxis(no) {
    return APP.data.axes.find(a => a.no === Number(no));
}

function getAxisIndicators(no) {
    return APP.data.axes
        .find(a => a.no === Number(no)).indicators
        .map(id => ind(id));
}

function getRecommendationsByAxis(no) {
    const n = Number(no);
    return APP.recs
        .filter(r => r.active !== false && r.axisNo === n)
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getAllRecommendations() {
    return APP.recs
        .filter(r => r.active !== false)
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getIndicatorStatusBadge(status) {
    const map = {
        available: '<span class="badge badge-success">' + STATUS_LABELS.available + '</span>',
        partial: '<span class="badge badge-warning">' + STATUS_LABELS.partial + '</span>',
        unavailable: '<span class="badge badge-danger">' + STATUS_LABELS.unavailable + '</span>'
    };
    return map[status] || '';
}

/* ---------- تنسيق الأرقام (غربية مع فاصل الآلاف) ---------- */
function fmtNum(n) {
    if (n === null || n === undefined || n === '') return '<span class="text-muted">غير متوفر</span>';
    return '<bdi dir="ltr">' + Number(n).toLocaleString('en-US') + '</bdi>';
}

function fmtPlain(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return null;
    return Number(n).toLocaleString('en-US');
}

function fmtPct(n) {
    if (n === null || n === undefined) return '<span class="text-muted">غير متوفر</span>';
    return '<bdi dir="ltr">' + (Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(1)) + '%</bdi>';
}

/* ---------- اتجاه المقارنة (قاعدة القسم 1) ---------- */
/**
 * تعيد كائن الاتجاه بين سنة معينة وسنة الأساس الافتراضية (السابقة الزمنياً).
 */
function computeTrend(item, year) {
    if (!item.headline) {
        if (item.single) {
            return { kind: 'single', text: 'رقم واحد بلا سلسلة زمنية — لا توجد مقارنة' };
        }
        return { kind: 'noData', text: 'لا توجد مقارنة' };
    }
    const years = YEARS.filter(y => item.headline[y] !== undefined && item.headline[y] !== null);
    if (years.length === 0) return { kind: 'noData', text: 'لا توجد مقارنة' };

    const current = item.headline[year];
    const idx = years.indexOf(year);
    if (current === undefined || current === null) return { kind: 'noData', text: 'لا توجد مقارنة' };
    if (idx <= 0) {
        // ليس لها سنة سابقة ضمن السلسلة
        return { kind: 'noData', text: 'لا توجد مقارنة' };
    }
    const prevRaw = years[idx - 1];
    const prev = item.headline[prevRaw];

    if (prev === 0 && current > 0) return { kind: 'new', text: 'جديد', prev: 0, current };
    if (prev === 0 && current === 0) return { kind: 'zero', text: 'ثابت عند 0', prev: 0, current: 0 };
    if (prev === null || prev === undefined) return { kind: 'noData', text: 'لا توجد مقارنة' };

    const pct = ((current - prev) / prev) * 100;
    const diff = current - prev;
    const arrow = diff > 0 ? '▲' : (diff < 0 ? '▼' : '▬');
    // لون السهم حسب الاتجاه فقط: أخضر للمرتفع، أحمر للمنخفض
    const colorClass = diff === 0 ? 'trend-neutral' : (diff > 0 ? 'trend-good' : 'trend-bad');

    return {
        kind: 'arrow',
        arrow,
        diff,
        pct: Math.abs(pct),
        sign: pct >= 0 ? '+' : '-',
        prev,
        current,
        colorClass,
        text: (sign2 => pct.toFixed(1) + '%' + '  (' + (diff >= 0 ? '+' : '') + fmtPlain(diff) + ')')(pct)
    };
}

/**
 * HTML لشارة السهم عند مقارنة قيمة سنة بسنة أقرب داخل السلسلة (تُستخدم في جداول المحاور).
 */
function trendBadgeHtml(item, year) {
    const t = computeTrend(item, year);

    const baseYear = APP.data.meta.baseYear;
    const hasThisYear = item.headline && item.headline[year] !== undefined && item.headline[year] !== null;

    if (String(year) === String(baseYear)) {
        if (!item.headline) return '';
        return '<span class="trend-arrow trend-base"><i class="bi bi-star-fill"></i> سنة الأساس</span>';
    }
    if (!item.headline) return '';

    if (t.kind === 'new') {
        return '<span class="trend-arrow trend-neutral"><span class="arrow-icon">🆕</span> جديد</span>';
    }
    if (t.kind === 'zero') {
        return '<span class="trend-arrow trend-neutral"><span class="arrow-icon">▮</span> ثابت عند 0</span>';
    }
    if (t.kind === 'noData') {
        return '<span class="trend-arrow trend-neutral"><span class="arrow-icon">—</span> لا توجد مقارنة</span>';
    }
    if (t.kind === 'arrow') {
        const label = t.arrow + ' ' + t.sign + t.pct.toFixed(1) + '%';
        return '<span class="trend-arrow ' + t.colorClass + '"><span class="arrow-icon">' + t.arrow + '</span> ' +
            t.sign + t.pct.toFixed(1) + '% <span class="trend-label-note">' +
            (t.diff >= 0 ? '+' : '') + fmtPlain(t.diff) + '</span></span>';
    }
    return '';
}

/* ---------- شريط علوي مشترك ---------- */
function navbarHtml(session, subtitle) {
    return '<header class="site-nav">' +
        '<div class="site-nav-inner">' +
        '<div class="site-nav-brand">' +
        '<div class="site-nav-shield site-nav-logo"><img src="assets/pacc-logo.jpg" alt="شعار هيئة مكافحة الفساد" onerror="this.remove()"></div>' +
        '<div class="site-nav-titles">' +
        '<h1>هيئة مكافحة الفساد</h1>' +
        '<p>' + (subtitle || 'المرصد الوطني لمؤشرات النزاهة ومكافحة الفساد') + '</p>' +
        '</div></div>' +
        '<div class="site-nav-actions">' +
        '<span class="site-nav-user"><i class="bi bi-person-circle"></i> ' + session.name + '</span>' +
        '<button class="site-nav-btn" onclick="logout()" title="تسجيل الخروج" aria-label="تسجيل الخروج"><i class="bi bi-box-arrow-right"></i></button>' +
        '</div></div></header>';
}

/* ---------- ترويسة الصفحة ---------- */
function pageHeaderHtml(icon, title, sub, actionsHtml) {
    return '<div class="page-header">' +
        '<div class="page-header-title">' +
        '<div class="page-header-icon"><i class="bi ' + icon + '"></i></div>' +
        '<div><h1>' + title + '</h1><p>' + (sub || '') + '</p></div>' +
        '</div>' +
        (actionsHtml ? '<div class="page-header-actions">' + actionsHtml + '</div>' : '') +
        '</div>';
}

/* ---------- أزرار السنوات ---------- */
function yearGroupHtml(activeYear, onChangeFn) {
    let html = '<div class="year-buttons d-flex gap-2 flex-wrap">';
    YEARS.forEach(y => {
        html += '<button type="button" class="year-btn' + (y === activeYear ? ' active' : '') + '" data-year="' + y + '">' +
            '<bdi dir="ltr">' + y + '</bdi></button>';
    });
    html += '</div>';
    return html;
}

/* ---------- أرقام المحاور بالأحرف ---------- */
function axisNumText(no) {
    return AXIS_NUM[no - 1] || String(no);
}

/* ---------- تهيئة بسيطة: منع FOUC ---------- */
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- سهم هذه السنة مقابل السنة السابقة مباشرة ---------- */
function compareTwo(a, b, polarity) {
    if (a === null || a === undefined || b === null || b === undefined) return { kind: 'noData', text: 'لا توجد مقارنة' };
    if (b === 0 && a > 0) return { kind: 'new', text: 'جديد' };
    if (b === 0 && a === 0) return { kind: 'zero', text: 'ثابت عند 0' };
    const pct = ((a - b) / b) * 100;
    const diff = a - b;
    const arrow = diff > 0 ? '▲' : (diff < 0 ? '▼' : '▬');
    // لون السهم حسب الاتجاه فقط: أخضر للمرتفع، أحمر للمنخفض
    const colorClass = diff === 0 ? 'trend-neutral' : (diff > 0 ? 'trend-good' : 'trend-bad');
    return { kind: 'arrow', arrow, diff, pct: Math.abs(pct), sign: pct >= 0 ? '+' : '-', colorClass };
}

function trendBadgeForPair(a, b, polarity) {
    const t = compareTwo(a, b, polarity);
    if (t.kind === 'new') return '<span class="trend-arrow trend-neutral"><span class="arrow-icon">🆕</span> جديد</span>';
    if (t.kind === 'zero') return '<span class="trend-arrow trend-neutral"><span class="arrow-icon">▮</span> ثابت عند 0</span>';
    if (t.kind === 'noData') return '<span class="trend-arrow trend-neutral"><span class="arrow-icon">—</span> لا توجد مقارنة</span>';
    return '<span class="trend-arrow ' + t.colorClass + '"><span class="arrow-icon">' + t.arrow + '</span> ' +
        t.sign + t.pct.toFixed(1) + '% <span class="trend-label-note">' +
        (t.diff >= 0 ? '+' : '') + fmtPlain(t.diff) + '</span></span>';
}