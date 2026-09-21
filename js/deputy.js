/* ============================================================
   deputy.js — لوحة نائب رئيس الهيئة (المتابعة التشغيلية)
   يعتمد على common.js (APP = { data, recs }).
   الأقسام: القمع (مسار القضية)، نقاط تستدعي الانتباه، الجاهزية،
   التوصيات حسب المدى، وملاحظات جودة البيانات.
   ============================================================ */
'use strict';

(function () {
    const ROOT_EL = document.getElementById('deputyContent');

    const state = { year: '2025' };

    function prevYearOf(y) {
        const i = YEARS.indexOf(y);
        return i > 0 ? YEARS[i - 1] : null;
    }

    function parseHash() {
        const params = new URLSearchParams(location.hash.replace(/^#/, ''));
        const y = params.get('year');
        if (y && YEARS.includes(y)) state.year = y;
    }

    function writeHash() {
        const params = new URLSearchParams();
        params.set('year', state.year);
        history.replaceState(null, '', '#' + params.toString());
    }

    function esc(s) {
        return escapeHtml(s);
    }

    function fmt1(v) {
        if (v === null || v === undefined) return null;
        return Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 });
    }

    /* ============================================================
       القسم الأول: مسار القضية من الشكوى إلى الحكم (9 مراحل)
       ============================================================ */
    function funnelRowHtml(stage, yearMax) {
        const val = stage.values[state.year];
        const py = prevYearOf(state.year);
        const prevVal = py ? stage.values[py] : null;

        // العرض نسبة إلى أكبر مرحلة في السنة المختارة (يتدرج القمع نحو الأسفل)
        const pct = val > 0 && yearMax > 0 ? Math.round((val / yearMax) * 100) : 0;

        let compareHtml;
        if (!py) {
            compareHtml = '<span class="trend-arrow trend-base"><i class="bi bi-star-fill"></i> سنة الأساس</span>';
        } else if (prevVal === null || prevVal === undefined) {
            compareHtml = '<span class="trend-arrow trend-neutral"><span class="arrow-icon">—</span> لا توجد مقارنة</span>';
        } else {
            compareHtml = trendBadgeForPair(val, prevVal, 'neutral');
        }

        return '<div class="funnel-stage">' +
            '<div>' +
            '<div class="funnel-stage-name">' + esc(stage.stage) + '</div>' +
            '<div class="funnel-stage-unit">الوحدة: ' + esc(stage.unit) + '</div>' +
            '</div>' +
            '<div class="funnel-track" title="' + esc(stage.stage) + '">' +
            '<div class="funnel-fill current" style="width:' + pct + '%"></div>' +
            '</div>' +
            '<div class="funnel-value">' + (val === null || val === undefined ? '<span class="text-muted">غير متوفر</span>' : '<bdi dir="ltr">' + Number(val).toLocaleString('en-US') + '</bdi>') + '</div>' +
            '<div class="funnel-compare">' +
            '<strong><bdi dir="ltr">' + (py || '—') + '</bdi></strong>' +
            (prevVal === null || prevVal === undefined
                ? '<span class="text-muted">غير متوفر</span>'
                : '<bdi dir="ltr">' + Number(prevVal).toLocaleString('en-US') + '</bdi>') +
            '<span>' + compareHtml + '</span>' +
            '</div>' +
            '</div>';
    }

    function sectionHtml(icon, title, sub, body, extraHeader, secId) {
        return '<section class="card animate-in deputy-sec"' + (secId ? ' id="' + secId + '"' : '') + '>' +
            '<div class="card-header">' +
            '<h3><i class="bi ' + icon + '"></i> ' + title + '</h3>' +
            (sub ? '<span class="section-sub" style="font-size:.8rem;color:var(--text-secondary)">' + sub + '</span>' : '') +
            (extraHeader || '') +
            '</div>' +
            body +
            '</section>';
    }

    function attentionCount(year) {
        let n = 0;
        APP.data.deputy.attentionRules.forEach(rule => {
            if (evalAttentionRule(rule, year)) n++;
        });
        return n;
    }

    function subnavHtml(counts) {
        const items = [
            { id: 'sec-funnel', icon: 'bi-funnel', label: 'مسار القضية', n: counts.funnel },
            { id: 'sec-attention', icon: 'bi-bell', label: 'نقاط الانتباه', n: counts.attention },
            { id: 'sec-readiness', icon: 'bi-clipboard-check', label: 'الجاهزية', n: counts.readiness },
            { id: 'sec-recs', icon: 'bi-list-check', label: 'التوصيات', n: counts.recs },
            { id: 'sec-issues', icon: 'bi-patch-exclamation', label: 'جودة البيانات', n: counts.issues }
        ];
        return '<nav class="deputy-subnav" aria-label="أقسام اللوحة">' +
            items.map(it =>
                '<a class="deputy-subnav-link" href="#' + it.id + '"><i class="bi ' + it.icon + '"></i> ' + it.label +
                ' <span class="deputy-subnav-count"><bdi dir="ltr">' + it.n + '</bdi></span></a>'
            ).join('') +
            '</nav>';
    }

    /* ============================================================
       القسم الثاني: نقاط تستدعي الانتباه (9 قواعد آلية)
       ============================================================ */
    function fillPlaceholders(text, vals) {
        let t = text;
        Object.keys(vals).forEach(k => {
            t = t.split('{' + k + '}').join(vals[k]);
        });
        return t;
    }

    function evalAttentionRule(rule, year) {
        const derived = APP.data.deputy.derived;

        switch (rule.id) {
            case 1: case 2: case 3: case 4: {
                const m = derived[rule.metric];
                if (!m) return null;
                const v = m.values[year];
                if (v === null || v === undefined) return null;
                let hit = false;
                if (rule.condition === 'gte70') hit = v >= 70;
                else if (rule.condition === 'lt10') hit = v < 10;
                else if (rule.condition === 'gte50') hit = v >= 50;
                if (!hit) return null;
                return fillPlaceholders(rule.text, { value: fmt1(v) + '%' });
            }
            case 5: {
                const h = ind('15.2').headline;
                const cur = h[year];
                const py = prevYearOf(year);
                const prev = py ? h[py] : null;
                if (cur !== null && cur !== undefined && prev !== null && prev !== undefined && cur > prev) {
                    return fillPlaceholders(rule.text, { prev: fmt1(prev), current: fmt1(cur) });
                }
                return null;
            }
            case 6: {
                const h = ind('13.2').headline;
                if (h[year] === 0) return fillPlaceholders(rule.text, {});
                return null;
            }
            case 7: {
                const conv = derived.conviction_rate.values[year];
                const acq = derived.acquittal_rate.values[year];
                if (conv !== null && conv !== undefined && acq !== null && acq !== undefined && conv < acq) {
                    return fillPlaceholders(rule.text, {
                        conviction: fmt1(conv) + '%',
                        acquittal: fmt1(acq) + '%'
                    });
                }
                return null;
            }
            case 8: {
                if (year !== '2025') return null;
                const v = derived.files_per_prosecutor_member.values['2025'];
                if (v !== null && v !== undefined && v >= 10) {
                    return fillPlaceholders(rule.text, { value: fmt1(v) });
                }
                return null;
            }
            case 9: {
                const item = ind('22.2');
                const ex = (item.extra || []).find(x => x.label.indexOf('الجهات المكلفة المستهدفة') !== -1);
                if (!ex) return null;
                const cur = ex.values[year];
                const py = prevYearOf(year);
                const prev = py ? ex.values[py] : null;
                if (cur !== null && cur !== undefined && prev !== null && prev !== undefined && prev > 0) {
                    if ((prev - cur) / prev > 0.5) {
                        return fillPlaceholders(rule.text, { prev: fmt1(prev), current: fmt1(cur) });
                    }
                }
                return null;
            }
        }
        return null;
    }

    function attentionGridHtml() {
        let cards = '';
        let shown = 0;
        APP.data.deputy.attentionRules.forEach(rule => {
            const text = evalAttentionRule(rule, state.year);
            if (!text) return;
            shown++;
            cards += '<div class="attention-card animate-in">' +
                '<div class="attention-icon"><i class="bi bi-exclamation-triangle"></i></div>' +
                '<div class="attention-text">' + esc(text) + '</div>' +
                '<span class="attention-num">' + rule.id + '</span>' +
                '</div>';
        });

        if (!shown) {
            cards = '<div class="empty-state" style="padding:26px 16px">' +
                '<i class="bi bi-check-circle" style="font-size:2rem"></i>' +
                '<p>لا توجد نقاط تستدعي الانتباه لسنة <bdi dir="ltr"><b>' + state.year + '</b></bdi>.</p>' +
                '</div>';
        }
        return '<div class="attention-grid">' + cards + '</div>';
    }

    /* ============================================================
       القسم الثالث: الجاهزية واستكمال المؤشرات
       ============================================================ */
    function readinessHtml() {
        const rows = APP.data.deputy.roadmap;
        const counter = '<span class="readiness-counter"><i class="bi bi-clipboard-check"></i> ' +
            '<bdi dir="ltr">' + rows.length + '</bdi> مؤشراً يحتاج استكمالاً</span>';

        let rowsHtml = '';
        rows.forEach(r => {
            rowsHtml += '<tr>' +
                '<td><span class="indicator-code-pill">' + r.id + '</span></td>' +
                '<td class="indicator-name-cell">' + esc(r.name) + '</td>' +
                '<td>' + getIndicatorStatusBadge(r.status) + '</td>' +
                '<td style="font-size:.82rem;line-height:1.8">' + esc(r.need) + '</td>' +
                '<td style="font-size:.82rem">' + esc(r.owner) + '</td>' +
                '</tr>';
        });

        return sectionHtml('bi-clipboard-check',
            'الجاهزية واستكمال المؤشرات',
            'المؤشرات غير المكتملة وما المطلوب لاستكمالها والجهة المعنية',
            '<div class="table-scroll"><table class="table">' +
            '<thead><tr><th>#</th><th>المؤشر</th><th>الحالة</th><th>المطلوب للاستكمال</th><th>الجهة المعنية</th></tr></thead>' +
            '<tbody>' + rowsHtml + '</tbody></table></div>',
            counter, 'sec-readiness');
    }

    /* ============================================================
       القسم الرابع: التوصيات مجمّعة حسب المدى
       ============================================================ */
    function recommendationsHtml() {
        const all = getAllRecommendations();
        const order = ['short', 'medium', 'strategic'];
        let body = '';

        order.forEach(h => {
            const group = all.filter(r => r.horizon === h);
            if (!group.length) return;
            let listHtml = '';
            group.forEach(r => {
                const tag = r.axisNo ? '<span class="axis-tag"><i class="bi bi-hash"></i> المحور ' + axisNumText(r.axisNo) + '</span>' : '';
                listHtml += '<div class="finding-item" style="align-items:center">' +
                    '<i class="bi bi-arrow-left-circle" style="margin-top:0"></i>' +
                    '<span style="flex:1">' + esc(r.text) + '</span>' +
                    tag + '</div>';
            });

            body += '<div class="mb-3">' +
                '<div class="side-title"><i class="bi bi-flag"></i> ' + HORIZON_GROUP[h] +
                ' <span class="badge badge-primary"><bdi dir="ltr">' + group.length + '</bdi></span></div>' +
                '<div class="findings-list">' + listHtml + '</div>' +
                '</div>';
        });

        return sectionHtml('bi-list-check',
            'التوصيات',
            'مجمّعة حسب المدى، لكل توصية وسم برقم المحور',
            body, null, 'sec-recs');
    }

    /* ============================================================
       القسم الخامس: ملاحظات جودة البيانات (مرتبة حسب الأهمية)
       ============================================================ */
    function dataIssuesHtml() {
        const sevOrder = { high: 0, medium: 1, low: 2 };
        const sevLabels = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };
        const issues = APP.data.deputy.dataIssues.slice().sort((a, b) => {
            // ملاحظة: 0 قيمة صحيحة يجب ألا تُعامل كـ falsy
            const av = Object.prototype.hasOwnProperty.call(sevOrder, a.severity) ? sevOrder[a.severity] : 3;
            const bv = Object.prototype.hasOwnProperty.call(sevOrder, b.severity) ? sevOrder[b.severity] : 3;
            return av - bv;
        });

        let rowsHtml = '';
        issues.forEach(q => {
            rowsHtml += '<tr>' +
                '<td><span class="indicator-code-pill">' + q.id + '</span></td>' +
                '<td><span class="severity-chip severity-' + q.severity + '">' + sevLabels[q.severity] + '</span></td>' +
                '<td style="font-size:.82rem">' + esc(q.position) + '</td>' +
                '<td style="font-size:.82rem;line-height:1.8">' + esc(q.note) + '</td>' +
                '<td style="font-size:.82rem;line-height:1.8;color:var(--text-secondary)">' + esc(q.adopted) + '</td>' +
                '</tr>';
        });

        return sectionHtml('bi-patch-exclamation',
            'ملاحظات على البيانات تحتاج مراجعة',
            'مرتبة حسب الأهمية — تُعرض البيانات كما وردت دون تصحيح تلقائي',
            '<div class="table-scroll"><table class="table">' +
            '<thead><tr><th>#</th><th>الأهمية</th><th>الموضع</th><th>الملاحظة</th><th>المعتمد في اللوحة</th></tr></thead>' +
            '<tbody>' + rowsHtml + '</tbody></table></div>', null, 'sec-issues');
    }

    /* ============================================================
       البناء والإقلاع
       ============================================================ */
    function render() {
        const d = APP.data.deputy;
        const actions =
            '<div class="d-flex align-center gap-2 flex-wrap">' +
            '<span class="text-small" style="opacity:.8">السنة:</span>' +
            yearGroupHtml(state.year) +
            '</div>';

        let html = '';
        html += pageHeaderHtml('bi-eye',
            'لوحة المتابعة التشغيلية — ' + APP.data.meta.period,
            'أين الخلل وماذا نفعل؟ (مشتركة مع لوحة الرئيس في السنة وقاعدة الأسهم والبيانات)',
            actions);

        // تنقل سريع بين الأقسام مع عدّادات
        html += subnavHtml({
            funnel: d.funnel.length,
            attention: attentionCount(state.year),
            readiness: d.roadmap.length,
            recs: getAllRecommendations().length,
            issues: d.dataIssues.length
        });

        // القسم 1: القمع
        const funnelNote = d.funnelNote;
        let yearMax = 0;
        d.funnel.forEach(st => {
            const v = st.values[state.year];
            if (v && v > yearMax) yearMax = v;
        });

        let funnelBody = '<div class="funnel-wrap">' +
            d.funnel.map(stage => funnelRowHtml(stage, yearMax)).join('') +
            '</div>' +
            '<div class="funnel-note"><i class="bi bi-exclamation-triangle-fill"></i><span>' + esc(funnelNote) + '</span></div>';

        html += sectionHtml('bi-funnel',
            'مسار القضية من الشكوى إلى الحكم',
            'مقارنة مع السنة السابقة — تقدير عام للتدفق',
            funnelBody, null, 'sec-funnel');

        // القسم 2: نقاط تستدعي الانتباه
        html += sectionHtml('bi-bell',
            'نقاط تستدعي الانتباه',
            'قواعد آلية تُحسب لسنة <bdi dir="ltr"><b>' + state.year + '</b></bdi> — تظهر البطاقة عند تحقق شرطها',
            attentionGridHtml(), null, 'sec-attention');

        // القسم 3: الجاهزية
        html += readinessHtml();

        // القسم 4: التوصيات
        html += recommendationsHtml();

        // القسم 5: ملاحظات البيانات
        html += dataIssuesHtml();

        html += '<button type="button" class="back-top" id="backTop" aria-label="العودة إلى الأعلى"><i class="bi bi-arrow-up"></i></button>';

        ROOT_EL.innerHTML = html;
    }

    /* ---------- تفويض الأحداث ---------- */
    ROOT_EL.addEventListener('click', function (e) {
        if (e.target.closest('#backTop')) {
            try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { window.scrollTo(0, 0); }
            return;
        }
        const yearBtn = e.target.closest('.year-btn');
        if (!yearBtn) return;
        const y = yearBtn.getAttribute('data-year');
        if (y === state.year) return;
        state.year = y;
        writeHash();
        render();
    });

    window.addEventListener('scroll', function () {
        const btn = document.getElementById('backTop');
        if (!btn) return;
        const y = window.scrollY || window.pageYOffset || 0;
        btn.classList.toggle('show', y > 600);
    }, { passive: true });

    window.addEventListener('hashchange', function () {
        parseHash();
        render();
    });

    async function init() {
        const session = requireRole();
        if (!session) return;
        document.getElementById('navBar').innerHTML = navbarHtml(session, 'لوحة نائب الرئيس — متابعة تشغيلية 2022–2025');

        parseHash();
        ROOT_EL.innerHTML =
            '<div class="loading-block"><i class="bi bi-arrow-repeat"></i>جارٍ تحميل بيانات المقياس…</div>';

        try {
            await loadAppData();
            render();
        } catch (err) {
            showLoadError(ROOT_EL);
        }
    }

    init();
})();