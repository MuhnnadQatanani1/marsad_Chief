/* ============================================================
   chairman.js — لوحة رئيس الهيئة (مقياس إنفاذ القانون 2022–2025)
   يعتمد على common.js (APP = { data, recs }).
   يعرض: تبويبا المقياسين، مرشح السنة، بطاقات الإتاحة الأربع،
   4 بطاقات KPI، 10 محاور (اسم المؤشر + سهم الاتجاه فقط)،
   لوحة «التوصيات» الجانبية بأسلوب الأخبار، ونافذة تفاصيل
   تعرض معنى المؤشر + رسم بياني خطي ثابت مع إمكانية الجدول الكامل.
   ============================================================ */
'use strict';

(function () {
    const TABS_EL = document.getElementById('scaleTabs');
    const TOP_EL = document.getElementById('scaleContentTop');
    const CONTENT_EL = document.getElementById('scaleContent');
    const MODAL_EL = document.getElementById('detailModal');
    const MODAL_TITLE = document.getElementById('modalTitle');
    const MODAL_BODY = document.getElementById('modalBody');
    const CLOSE_BTN = document.getElementById('modalCloseBtn');

    const state = {
        year: '2025',
        scale: 'law_enforcement',
        statusFilter: null,          // null | 'available' | 'partial' | 'unavailable'
        detailId: null,
        compareYear: '2024',
        tableViews: {},              // tableId -> 'table' | 'bars'
        modalView: 'chart',          // 'chart' | 'table'
        showEmptyRows: false,
        returnFocus: null
    };

    /* ---------- أدوات صغيرة ---------- */
    function prevYearOf(y) {
        const i = YEARS.indexOf(y);
        return i > 0 ? YEARS[i - 1] : null;
    }

    function num1(n) {
        return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    }

    function mutedNA() {
        return '<span class="text-muted">غير متوفر</span>';
    }

    function cellHtml(v, asPct) {
        if (v === null || v === undefined) return mutedNA();
        return '<bdi dir="ltr">' + Number(v).toLocaleString('en-US') + (asPct ? '%' : '') + '</bdi>';
    }

    function esc(s) {
        return escapeHtml(s);
    }

    /* ---------- التجزئة (#year=2025&scale=…) ---------- */
    function parseHash() {
        const params = new URLSearchParams(location.hash.replace(/^#/, ''));
        const y = params.get('year');
        if (y && YEARS.includes(y)) state.year = y;
        const s = params.get('scale');
        if (s === 'law_enforcement' || s === 'anti_corruption_efforts') state.scale = s;
    }

    function writeHash() {
        const params = new URLSearchParams();
        params.set('year', state.year);
        params.set('scale', state.scale);
        history.replaceState(null, '', '#' + params.toString());
    }

    /* ---------- تسلسل المؤشرات للتنقل في النافذة ---------- */
    function allIndicatorIds() {
        const ids = [];
        APP.data.axes.forEach(a => ids.push.apply(ids, a.indicators));
        return ids;
    }

    function navList() {
        const ids = allIndicatorIds();
        if (!state.statusFilter) return ids;
        return ids.filter(id => ind(id).status === state.statusFilter);
    }

    /* ---------- البناء ---------- */
    function renderTabs() {
        let html = '';
        APP.data.scales.forEach(sc => {
            const active = sc.id === state.scale;
            const icon = sc.status === 'ready' ? 'bi-clipboard2-data' : 'bi-hourglass-split';
            const tag = sc.status === 'ready'
                ? '<span class="badge badge-success">جاهز</span>'
                : '<span class="badge badge-warning">قيد الإعداد</span>';
            html += '<li class="nav-item" role="presentation">' +
                '<button type="button" role="tab" aria-selected="' + active + '" ' +
                'class="nav-link category-tab' + (active ? ' active' : '') + '" data-scale="' + sc.id + '">' +
                '<i class="bi ' + icon + '"></i>' + esc(sc.name) + ' ' + tag + '</button></li>';
        });
        TABS_EL.innerHTML = html;
    }

    function renderContent() {
        const scale = APP.data.scales.find(s => s.id === state.scale) || APP.data.scales[0];

        if (scale.status === 'pending') {
            if (TOP_EL) TOP_EL.innerHTML = '';
            CONTENT_EL.innerHTML =
                '<div class="empty-state animate-in">' +
                '<i class="bi bi-hourglass-split"></i>' +
                '<h3>قيد الإعداد</h3>' +
                '<p>' + esc(scale.emptyMessage || 'بيانات مقياس جهود مكافحة الفساد لم تُضَف بعد.') + '</p>' +
                '</div>';
            return;
        }

        let top = '';

        // ترويسة الصفحة مع أزرار السنوات (بلا أي سطر توضيحي تحت العنوان)
        const actions =
            '<div class="d-flex align-center gap-2 flex-wrap">' +
            '<span class="text-small" style="opacity:.8">السنة:</span>' +
            yearGroupHtml(state.year) +
            '</div>';

        top += pageHeaderHtml('bi-clipboard2-data',
            'لوحة رئيس الهيئة — مقياس إنفاذ القانون 2022–2025', '', actions);

        // السطر الأول: بطاقات الإتاحة بالكحلي (لا تتغير مع السنة) — قابلة للضغط لفلترة صفوف المحاور
        const avail = APP.data.kpis.availability;
        const cards = [
            { key: 'all', label: 'إجمالي المؤشرات', value: avail.total, cls: 'bg-gradient-primary', icon: 'bi-grid-3x3-gap-fill' },
            { key: 'available', label: 'متوفر', value: avail.available, sub: 'نحو 65% من الإجمالي', cls: 'bg-gradient-info', icon: 'bi-check-circle-fill' },
            { key: 'partial', label: 'متوفر جزئياً', value: avail.partial, cls: 'bg-gradient-ink', icon: 'bi-exclamation-circle-fill' },
            { key: 'unavailable', label: 'غير متوفر', value: avail.unavailable, cls: 'bg-gradient-navy-soft', icon: 'bi-x-circle-fill' }
        ];

        top += '<div class="stat-cards">';
        cards.forEach(c => {
            const active = (c.key === 'all' && !state.statusFilter) || c.key === state.statusFilter;
            top += '<div class="stat-card ' + c.cls + (active ? ' active' : '') + '" role="button" tabindex="0" ' +
                'data-status="' + c.key + '" aria-pressed="' + active + '">' +
                '<div class="stat-icon"><i class="bi ' + c.icon + '"></i></div>' +
                '<span class="stat-value"><bdi dir="ltr">' + c.value + '</bdi></span>' +
                '<span class="stat-label">' + c.label + '</span>' +
                (c.sub ? '<span class="stat-label">' + c.sub + '</span>' : '') +
                '</div>';
        });
        top += '</div>';

        // السطر الثاني: أربعة مؤشرات رئيسية بالذهبي (تتغير مع السنة)
        top += kpiRowHtml();

        if (TOP_EL) TOP_EL.innerHTML = top;

        let html = '';

        // مفتاح ألوان الأسهم (أخضر للصعود / أحمر للهبوط)
        html += '<div class="trend-legend">' +
            '<i class="bi bi-info-circle"></i> لون السهم حسب الاتجاه:' +
            '<span><span class="trend-arrow trend-good"><span class="arrow-icon">▲</span></span> صعود</span>' +
            '<span><span class="trend-arrow trend-bad"><span class="arrow-icon">▼</span></span> هبوط</span>' +
            '<span><span class="trend-arrow trend-neutral"><span class="arrow-icon">—</span></span> محايد / بلا سلسلة</span>' +
            '</div>';

        // بطاقات المحاور العشرة (بجانبها لوحة التوصيات)
        html += axisCardsHtml();

        CONTENT_EL.innerHTML = html;
    }

    function kpiRowHtml() {
        const items = APP.data.kpis.headline.map(id => ind(id));
        const gradients = ['bg-gradient-gold-1', 'bg-gradient-gold-2', 'bg-gradient-accent', 'bg-gradient-success'];
        const icons = ['bi-chat-left-dots', 'bi-send', 'bi-gavel', 'bi-file-earmark-text'];

        let html = '<div class="kpi-4">';
        items.forEach((item, i) => {
            const v = item.headline ? item.headline[state.year] : null;
            const valHtml = (v === null || v === undefined)
                ? '<span class="kpi-4-value">' + mutedNA() + '</span>'
                : '<span class="kpi-4-value"><bdi dir="ltr">' + Number(v).toLocaleString('en-US') + '</bdi></span>';
            html += '<div class="kpi-4-card ' + gradients[i] + ' animate-in delay-' + (i + 1) + '">' +
                '<span class="kpi-4-label"><i class="bi ' + icons[i] + '"></i> ' + esc(item.shortName) +
                ' <span class="indicator-code-pill" style="background:rgba(255,255,255,.2);color:#fff">' + item.id + '</span></span>' +
                valHtml +
                '<span class="kpi-4-trend">' + trendBadgeHtml(item, state.year) + '</span>' +
                '</div>';
        });
        html += '</div>';
        return html;
    }

    function axisCardsHtml() {
        let html = '';
        APP.data.axes.forEach((axis, idx) => {
            const rows = axis.indicators.map(id => ind(id));

            let tableHtml = '<table class="table"><thead><tr>' +
                '<th>المؤشر</th><th>الاسم</th><th>الاتجاه</th>' +
                '</tr></thead><tbody>';

            rows.forEach(r => {
                const hidden = state.statusFilter && r.status !== state.statusFilter;
                tableHtml += '<tr class="indicator-row' + (hidden ? ' axis-row-hidden' : '') + '" role="button" tabindex="0" data-id="' + r.id + '" ' +
                    'data-status="' + r.status + '">' +
                    '<td><span class="indicator-code-pill">' + r.id + '</span></td>' +
                    '<td><div class="indicator-name-cell">' + esc(r.shortName || r.name) + '</div></td>' +
                    '<td>' + rowTrendHtml(r) + '</td>' +
                    '</tr>';
            });
            tableHtml += '</tbody></table>';

            html += '<div class="axis-card animate-in" data-axis="' + axis.no + '">' +
                '<div class="axis-card-header">' +
                '<div class="axis-card-title">' +
                '<div class="axis-num">' + axisNumText(axis.no) + '</div>' +
                '<div><h3>' + axis.no + '. ' + esc(axis.name) + '</h3>' +
                '<div class="axis-card-item">' + esc(axis.item) + '</div></div>' +
                '</div>' +
                '</div>' +
                '<div class="table-scroll">' + tableHtml + '</div>' +
                '</div>';
        });
        return html;
    }

    /* سهم الصفوف: ▲ / ▼ / — فقط، من دون أرقام (المفتاح أعلاه يشرح اللون) */
    function rowTrendHtml(item) {
        if (String(state.year) === String(APP.data.meta.baseYear)) {
            return '<span class="trend-arrow trend-base"><i class="bi bi-star-fill"></i> سنة الأساس</span>';
        }
        if (item.single) {
            return '<span class="trend-arrow trend-neutral" title="رقم واحد بلا سلسلة"><span class="arrow-icon">—</span></span>';
        }
        if (!item.headline || item.headline[state.year] === undefined || item.headline[state.year] === null) {
            return '<span class="trend-arrow trend-neutral"><span class="arrow-icon">—</span></span>';
        }
        const t = computeTrend(item, state.year);
        if (t.kind === 'new') return '<span class="trend-arrow trend-neutral" title="جديد"><span class="arrow-icon">▲</span></span>';
        if (t.kind === 'zero') return '<span class="trend-arrow trend-neutral" title="ثابت عند 0"><span class="arrow-icon">▬</span></span>';
        if (t.kind !== 'arrow') return '<span class="trend-arrow trend-neutral" title="لا توجد مقارنة"><span class="arrow-icon">—</span></span>';
        return '<span class="trend-arrow ' + t.colorClass + '" title="' + esc(t.text) + '">' +
            '<span class="arrow-icon">' + (t.diff >= 0 ? '▲' : '▼') + '</span></span>';
    }

    /* ============================================================
       نافذة التفاصيل: معنى المؤشر + رسم خطي ثابت + الجدول الكامل
       ============================================================ */
    function compareOptions(item) {
        if (!item.headline) return [];
        return YEARS.filter(y => item.headline[y] !== undefined && item.headline[y] !== null);
    }

    function defaultCompare(item) {
        const opts = compareOptions(item);
        if (!opts.length) return state.year;
        const current = state.year;
        const before = opts.filter(y => y < current);
        if (before.length) return String(before[before.length - 1]);
        const notCurrent = opts.filter(y => y !== current);
        if (notCurrent.length) return String(notCurrent[notCurrent.length - 1]);
        return String(current);
    }

    function openDetail(id, focusEl) {
        state.detailId = id;
        state.returnFocus = focusEl || null;
        state.modalView = 'chart';
        if (!compareOptions(ind(id)).includes(String(state.compareYear))) {
            state.compareYear = defaultCompare(ind(id));
        }
        renderModal();
        MODAL_EL.hidden = false;
        document.body.style.overflow = 'hidden';
        MODAL_EL.focus();
    }

    function closeModal() {
        MODAL_EL.hidden = true;
        document.body.style.overflow = '';
        if (state.returnFocus && state.returnFocus.focus) {
            try { state.returnFocus.focus(); } catch (e) { /* تجاهل */ }
        }
    }

    function renderModal() {
        const item = ind(state.detailId);
        if (!item) { closeModal(); return; }
        const nav = navList();
        const idx = nav.indexOf(item.id);
        const total = nav.length;

        MODAL_TITLE.innerHTML =
            '<span class="indicator-code-pill" style="background:rgba(255,255,255,.2);color:#fff">' + item.id + '</span> ' +
            esc(item.shortName || item.name);

        /* 1) معنى المؤشر / ماذا يقيس — فقط */
        let main = '<div class="meaning-box">' +
            '<div class="meaning-label"><i class="bi bi-bullseye"></i> ماذا يقيس هذا المؤشر؟</div>' +
            '<p>' + esc(item.name) + '</p>' +
            '<div class="d-flex flex-wrap gap-2" style="margin-top:10px">' +
            '<span class="source-chip"><i class="bi bi-rulers"></i> الوحدة: ' + esc(item.unit || '—') + '</span>' +
            (item.headlineLabel ? '<span class="source-chip"><i class="bi bi-tag"></i> ' + esc(item.headlineLabel) + '</span>' : '') +
            '</div></div>';

        /* 2) شريط التبديل: رسم بياني / جدول كامل + إظهار البنود الفارغة */
        const viewBar =
            '<div class="view-toggle-bar">' +
            '<div class="view-toggle-group">' +
            '<button type="button" class="view-toggle' + (state.modalView === 'chart' ? ' active' : '') + '" data-view="chart">' +
            '<i class="bi bi-graph-up"></i> الرسم البياني</button>' +
            '<button type="button" class="view-toggle' + (state.modalView === 'table' ? ' active' : '') + '" data-view="table">' +
            '<i class="bi bi-table"></i> الجدول الكامل</button>' +
            '</div>' +
            '<button type="button" class="table-toggle' + (state.showEmptyRows ? ' active' : '') + '" data-act="reveal">' +
            '<i class="bi bi-eye"></i> إظهار البنود الفارغة</button>' +
            '</div>';

        main += viewBar;

        if (state.modalView === 'chart') {
            main += chartBlockHtml(item);
        } else {
            main += '<div class="modal-tables-wrap">';
            if (item.tables && item.tables.length) {
                item.tables.forEach(tid => {
                    const table = APP.data.tables[tid];
                    if (table) main += tableBlockHtml(table);
                });
            }
            if (item.extra && item.extra.length) {
                main += extraSeriesHtml(item);
            }
            if (item.details && item.details.length) {
                main += detailsHtml(item);
            }
            main += '</div>';
        }

        // الحالة الخاصة: رقم وحيد بلا سلسلة (29.2) — تُعرض في الرسم والجدول معاً
        if (item.single) {
            main += '<div class="reason-card" style="border-style:dashed"><div class="reason-label"><i class="bi bi-pin-angle"></i> رقم واحد بلا سلسلة زمنية</div>' +
                '<p>' + esc(item.single.label) + ' = <bdi dir="ltr"><b>' + num1(item.single.pct) + '%</b></bdi> (سنة الأساس ' +
                esc(APP.data.meta.baseYear) + '). لا مقارنة سنوية، ولا يظهر سهم.</p>' +
                '<p class="text-muted text-small"><i class="bi bi-info-circle"></i> ' + esc(item.single.note) + '</p></div>';
        }

        const navBar =
            '<div class="detail-nav-bar">' +
            '<button type="button" class="detail-nav-btn" data-act="prev" ' + (idx <= 0 ? 'disabled' : '') + '>' +
            '<i class="bi bi-chevron-right"></i> السابق</button>' +
            '<span class="text-small text-muted">المؤشر <bdi dir="ltr"><strong>' + (idx + 1) + '</strong></bdi> من <bdi dir="ltr"><strong>' + total + '</strong></bdi></span>' +
            '<button type="button" class="detail-nav-btn" data-act="next" ' + (idx >= total - 1 ? 'disabled' : '') + '>' +
            'التالي <i class="bi bi-chevron-left"></i></button>' +
            '</div>';

        MODAL_BODY.innerHTML = navBar + main;
    }

    /* ---------- الرسم البياني الخطي (SVG يدوي، بلا مكتبات) ---------- */
    function chartBlockHtml(item) {
        const pts = (item.headline ? YEARS : [])
            .filter(y => item.headline[y] !== undefined && item.headline[y] !== null)
            .map(y => ({ y: String(y), v: Number(item.headline[y]) }))
            .sort((a, b) => a.y.localeCompare(b.y));

        if (!pts.length) {
            return '<div class="chart-empty"><i class="bi bi-bar-chart-line"></i>لا توجد سلسلة زمنية للرسم لهذا المؤشر.</div>';
        }
        if (pts.length === 1) {
            return '<div class="chart-empty"><i class="bi bi-circle"></i>سنة واحدة فقط متاحة: <bdi dir="ltr"><b>' +
                fmtPlain(pts[0].v) + '</b></bdi> (' + pts[0].y + ')</div>';
        }

        const W = 640, H = 250;
        const PAD = { l: 52, r: 24, t: 26, b: 36 };
        const vmin = Math.min.apply(null, pts.map(p => p.v));
        const vmax = Math.max.apply(null, pts.map(p => p.v));
        let lo = vmin, hi = vmax;
        if (hi === lo) { lo -= 1; hi += 1; }
        const padV = (hi - lo) * 0.12;
        const top = hi + padV;
        const bottom = Math.max(0, lo - padV);

        const x = i => PAD.l + (i * (W - PAD.l - PAD.r)) / (pts.length - 1);
        const y = v => PAD.t + ((top - v) / (top - bottom)) * (H - PAD.t - PAD.b);

        const linePoints = pts.map((p, i) => x(i).toFixed(1) + ',' + y(p.v).toFixed(1)).join(' ');

        let grid = '';
        const steps = 4;
        for (let s = 0; s <= steps; s++) {
            const val = bottom + ((top - bottom) * s) / steps;
            const yy = y(val);
            grid += '<line x1="' + PAD.l + '" y1="' + yy.toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + yy.toFixed(1) + '" class="chart-grid"/>' +
                '<text x="' + (PAD.l - 10) + '" y="' + (yy + 4).toFixed(1) + '" class="chart-tick" text-anchor="end">' +
                fmtPlain(Math.round(val)) + '</text>';
        }

        const dots = pts.map((p, i) =>
            '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="5" class="chart-dot"/>' +
            '<text x="' + x(i).toFixed(1) + '" y="' + (y(p.v) - 10).toFixed(1) + '" class="chart-val" text-anchor="middle">' +
            fmtPlain(p.v) + '</text>'
        ).join('');

        const yearLabels = pts.map((p, i) =>
            '<text x="' + x(i).toFixed(1) + '" y="' + (H - 10) + '" class="chart-year" text-anchor="middle">' + p.y + '</text>'
        ).join('');

        const trend = trendBadgeHtml(item, state.year);

        return '<div class="line-chart-card">' +
            '<div class="chart-head">' +
            '<span class="chart-title"><i class="bi bi-bar-chart-line"></i> ' + esc(item.headlineLabel || item.shortName) + '</span>' +
            (trend ? '<span class="chart-trend">' + trend + '</span>' : '') +
            '</div>' +
            '<div dir="ltr"><svg class="line-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="التغير عبر السنوات">' +
            grid +
            '<polyline class="chart-line" points="' + linePoints + '" fill="none"/>' +
            '<polygon class="chart-area" points="' + PAD.l + ',' + (H - PAD.b) + ' ' + linePoints + ' ' + (W - PAD.r) + ',' + (H - PAD.b) + '"/>' +
            dots + yearLabels +
            '</svg></div>' +
            '<div class="chart-foot"><span><span class="dot current"></span> الوحدة: ' + esc(item.unit || '—') + '</span>' +
            '<span class="text-small text-muted">القيم حسب سنوات السلاسل المتاحة</span></div>' +
            '</div>';
    }

    function extraSeriesHtml(item) {
        let html = '';
        item.extra.forEach(ex => {
            html += '<div class="d-flex align-center gap-2" style="margin-top:14px">' +
                '<div class="side-title" style="margin-bottom:0"><i class="bi bi-layers"></i> ' + esc(ex.label) + '</div>' +
                '<span class="source-chip' + (ex.source === 'التقرير' ? ' report' : '') + '"><i class="bi bi-bookmark"></i> المصدر: ' + esc(ex.source) + '</span>' +
                '</div>' +
                '<div class="table-scroll"><table class="table"><thead><tr><th>السنة</th>' +
                YEARS.map(y => '<th>' + y + '</th>').join('') +
                '</tr></thead><tbody>' +
                '<tr>' + YEARS.map(y => '<td>' + cellHtml(ex.values[y] === undefined ? null : ex.values[y]) + '</td>').join('') + '</tr>' +
                '</tbody></table></div>';
        });
        return html;
    }

    function detailsHtml(item) {
        return '<div class="card" style="margin-top:16px">' +
            '<div class="card-header"><h3><i class="bi bi-list-ul"></i> تفصيل الأحكام حسب السنة</h3></div>' +
            '<ul style="padding-inline-start:20px;line-height:2;font-size:.88rem">' +
            item.details.map(d =>
                '<li><bdi dir="ltr"><strong>' + d.year + ':</strong></bdi> ' + esc(d.text) + '</li>'
            ).join('') +
            '</ul></div>';
    }

    function isZeroRow(row) {
        let any = false;
        YEARS.forEach(y => { if (row.values[y] !== undefined && row.values[y] !== null && row.values[y] !== 0) any = true; });
        return !any;
    }

    function tableBlockHtml(table) {
        const view = state.tableViews[table.id] || 'table';
        const isPct = table.id === 'survey_detail';
        const hasEmptyRows = table.rows.some(r => isZeroRow(r));

        let html = '<div class="d-flex align-center justify-between flex-wrap gap-2" style="margin-top:16px">' +
            '<div class="d-flex align-center gap-2 flex-wrap">' +
            '<div class="side-title" style="margin-bottom:0"><i class="bi bi-table"></i> ' + esc(table.title) + '</div>' +
            '<span class="source-chip"><i class="bi bi-rulers"></i> الوحدة: ' + esc(table.unit || '—') + '</span>' +
            '</div>' +
            '<div class="d-flex align-center gap-2">' +
            '<button type="button" class="table-toggle' + (view === 'table' ? ' active' : '') + '" data-tview="table" data-table="' + table.id + '">' +
            '<i class="bi bi-table"></i> جدول</button>' +
            '<button type="button" class="table-toggle' + (view === 'bars' ? ' active' : '') + '" data-tview="bars" data-table="' + table.id + '">' +
            '<i class="bi bi-bar-chart"></i> أشرطة</button>' +
            '</div></div>';

        if (view === 'bars') {
            html += renderBarsTable(table, isPct);
        } else {
            html += renderPlainTable(table, isPct);
        }

        if (table.warning) {
            html += '<div class="alert-warning" style="margin-top:10px">' +
                '<i class="bi bi-exclamation-triangle-fill"></i>' +
                '<div><strong>ملاحظة على البيانات</strong><br>' + esc(table.warning) + '</div></div>';
        }

        if (hasEmptyRows && !state.showEmptyRows) {
            html += '<div class="text-muted text-small" style="margin-top:6px">' +
                '<i class="bi bi-eye-slash"></i> توجد بنود فارغة مخفية — فعّل «إظهار البنود الفارغة».</div>';
        }
        return html;
    }

    function renderPlainTable(table, isPct) {
        let rowsHtml = '';
        table.rows.forEach(row => {
            const hidden = isZeroRow(row) && !state.showEmptyRows;
            rowsHtml += '<tr' + (hidden ? ' class="row-group-hidden"' : '') + '>' +
                '<td class="bar-label">' + esc(row.label) + '</td>' +
                YEARS.map(y => '<td class="num">' + cellHtml(row.values[y] === undefined ? null : row.values[y], isPct) + '</td>').join('') +
                '</tr>';
        });

        let totalHtml = '';
        if (table.total) {
            totalHtml = '<tr class="striped-row fw-bold">' +
                '<td>' + esc(table.total.label || 'المجموع') + '</td>' +
                YEARS.map(y => '<td class="num"><bdi dir="ltr"><b>' +
                    (table.total.values[y] === undefined || table.total.values[y] === null ? '—' : Number(table.total.values[y]).toLocaleString('en-US')) +
                    '</b></bdi></td>').join('') +
                '</tr>';
        }

        return '<div class="table-scroll"><table class="table">' +
            '<thead><tr><th>البند</th>' +
            YEARS.map(y => '<th class="num"><bdi dir="ltr">' + y + '</bdi></th>').join('') +
            '</tr></thead><tbody>' + rowsHtml + totalHtml + '</tbody></table></div>';
    }

    function barTrackHtml(pct, textHtml, fillClass) {
        const inBlend = pct >= 42 ? ' in-blend' : '';
        return '<div class="bar-track">' +
            '<div class="bar-fill ' + fillClass + '" style="width:' + pct + '%"></div>' +
            '<div class="bar-num-over' + inBlend + '">' + textHtml + '</div>' +
            '</div>';
    }

    function renderBarsTable(table, isPct) {
        const cur = state.year;
        const cmp = state.compareYear;
        let rowsHtml = '';
        table.rows.forEach(row => {
            if (isZeroRow(row) && !state.showEmptyRows) return;
            const a = row.values[cur] === undefined ? null : row.values[cur];
            const b = row.values[cmp] === undefined ? null : row.values[cmp];
            const max = Math.max(a || 0, b || 0);
            const aPct = max > 0 ? Math.round(((a || 0) / max) * 100) : 0;
            const bPct = max > 0 ? Math.round(((b || 0) / max) * 100) : 0;
            rowsHtml += '<div class="bar-row compact">' +
                '<div class="bar-label" title="' + esc(row.label) + '">' + esc(row.label) + '</div>' +
                barTrackHtml(aPct, a === null ? mutedNA() : cellHtml(a, isPct), 'current') +
                barTrackHtml(bPct, b === null ? mutedNA() : cellHtml(b, isPct), 'compare') +
                '</div>';
        });

        return '<div class="bar-compare-wrap">' +
            '<div class="bar-legend">' +
            '<span><span class="dot current"></span><bdi dir="ltr">' + cur + '</bdi></span>' +
            '<span><span class="dot compare"></span><bdi dir="ltr">' + cmp + '</bdi></span>' +
            '</div>' +
            rowsHtml +
            '</div>';
    }

    /* ============================================================
       لوحة «التوصيات» الجانبية — أسلوب الأخبار (مستقلة عن السنة)
       ============================================================ */
    function renderRecsPanel() {
        const el = document.getElementById('recsPanel');
        if (!el) return;
        const all = getAllRecommendations();
        const order = ['short', 'medium', 'strategic'];

        let html = '<div class="recs-header">' +
            '<div class="recs-header-title"><i class="bi bi-newspaper"></i> التوصيات</div>' +
            '<span class="recs-count"><bdi dir="ltr">' + all.length + '</bdi> توصية</span>' +
            '</div>';
        html += '<div class="recs-body">';

        order.forEach(h => {
            const group = all.filter(r => r.horizon === h);
            if (!group.length) return;
            html += '<div class="recs-group">' +
                '<div class="recs-group-title"><span class="recs-group-dot"></span>' + esc(HORIZON_GROUP[h]) +
                ' <span class="recs-group-count"><bdi dir="ltr">' + group.length + '</bdi></span></div>';
            group.forEach(r => {
                html += '<div class="rec-item">' +
                    '<div class="rec-item-top">' +
                    (r.axisNo ? '<span class="axis-tag"><i class="bi bi-hash"></i> المحور ' + axisNumText(r.axisNo) + '</span>' : '') +
                    '<span class="horizon-badge horizon-' + r.horizon + '">' + HORIZON_LABELS[r.horizon] + '</span>' +
                    '</div>' +
                    '<p>' + esc(r.text) + '</p>' +
                    '</div>';
            });
            html += '</div>';
        });

        html += '</div>';
        el.innerHTML = html;
    }

    /* ---------- تفويض الأحداث ---------- */
    TABS_EL.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-scale]');
        if (!btn) return;
        const s = btn.getAttribute('data-scale');
        if (s === state.scale) return;
        state.scale = s;
        state.statusFilter = null;
        state.detailId = null;
        writeHash();
        renderTabs();
        renderContent();
    });

    function onTopClick(e) {
        const yearBtn = e.target.closest('.year-btn');
        if (yearBtn) {
            const y = yearBtn.getAttribute('data-year');
            if (y === state.year) return;
            state.year = y;
            state.compareYear = prevYearOf(y) || y;
            writeHash();
            renderContent();
            return;
        }
        const stat = e.target.closest('.stat-card');
        if (stat) {
            const k = stat.getAttribute('data-status');
            state.statusFilter = (state.statusFilter === k || k === 'all') ? null : k;
            renderContent();
        }
    }

    if (TOP_EL) TOP_EL.addEventListener('click', onTopClick);

    CONTENT_EL.addEventListener('click', function (e) {
        onTopClick(e);
        const row = e.target.closest('.indicator-row');
        if (row) {
            openDetail(row.getAttribute('data-id'), row);
        }
    });

    CONTENT_EL.addEventListener('keydown', function (e) {
        const row = e.target.closest('.indicator-row');
        if (!row) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetail(row.getAttribute('data-id'), row);
        }
    });

    MODAL_EL.addEventListener('click', function (e) {
        if (e.target === MODAL_EL) { closeModal(); return; }
        const act = e.target.closest('[data-act]');
        if (act) {
            const a = act.getAttribute('data-act');
            if (a === 'close') { closeModal(); return; }
            if (a === 'reveal') { state.showEmptyRows = !state.showEmptyRows; renderModal(); return; }
            if (a === 'prev' || a === 'next') {
                const nav = navList();
                const idx = nav.indexOf(state.detailId);
                const target = a === 'prev' ? nav[idx - 1] : nav[idx + 1];
                if (target) {
                    state.detailId = target;
                    if (!compareOptions(ind(target)).includes(String(state.compareYear))) {
                        state.compareYear = defaultCompare(ind(target));
                    }
                    renderModal();
                }
                return;
            }
        }
        const viewBtn = e.target.closest('[data-view]');
        if (viewBtn) {
            state.modalView = viewBtn.getAttribute('data-view');
            renderModal();
            return;
        }
        const tview = e.target.closest('[data-tview]');
        if (tview) {
            const tid = tview.getAttribute('data-table');
            state.tableViews[tid] = tview.getAttribute('data-tview');
            renderModal();
        }
    });

    MODAL_EL.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeModal();
    });

    if (CLOSE_BTN) {
        CLOSE_BTN.addEventListener('click', function () { closeModal(); });
    }

    window.addEventListener('hashchange', function () {
        parseHash();
        renderTabs();
        renderContent();
    });

    /* ---------- إقلاع ---------- */
    async function init() {
        const session = requireRole();
        if (!session) return;
        document.getElementById('navBar').innerHTML = navbarHtml(session, 'لوحة رئيس الهيئة — مقياس إنفاذ القانون 2022–2025');

        parseHash();
        if (TOP_EL) TOP_EL.innerHTML = '';
        CONTENT_EL.innerHTML =
            '<div class="loading-block"><i class="bi bi-arrow-repeat"></i>جارٍ تحميل بيانات المقياس…</div>';

        try {
            await loadAppData();
            state.compareYear = prevYearOf(state.year) || state.year;
            renderTabs();
            renderContent();
            renderRecsPanel();
        } catch (err) {
            if (TOP_EL) TOP_EL.innerHTML = '';
            showLoadError(CONTENT_EL);
            TABS_EL.innerHTML = '';
        }
    }

    init();
})();