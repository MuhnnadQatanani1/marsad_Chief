/* ============================================================
   dashboard.js — لوحة تحكم رئيس الهيئة
   ============================================================ */

let selectedYear = 'all';
let charts = {};

// ─────────────────────────────────────────────
// أدوات تنسيق
// ─────────────────────────────────────────────
function formatNumber(n) {
    if (n === undefined || n === null || n === '-') return '—';
    if (typeof n === 'string') return n;
    if (n >= 1000000) return (n / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1000)    return n.toLocaleString('en-US');
    if (n % 1 !== 0)  return parseFloat(n.toFixed(2)).toString();
    return n.toString();
}

function getYearsForIndicator(indicator) {
    return Object.keys(indicator.yearly).map(Number).sort((a, b) => a - b);
}

// ─────────────────────────────────────────────
// قيم المؤشر حسب الفلتر
// ─────────────────────────────────────────────
function getLatestValue(indicator) {
    if (selectedYear !== 'all' && indicator.yearly[selectedYear]) {
        return indicator.yearly[selectedYear].value;
    }
    const years = getYearsForIndicator(indicator);
    return indicator.yearly[years[years.length - 1]]?.value;
}

function getPrevValue(indicator) {
    const years = getYearsForIndicator(indicator);
    if (selectedYear !== 'all') {
        const idx = years.indexOf(Number(selectedYear));
        if (idx > 0) return indicator.yearly[years[idx - 1]]?.value;
        return null;
    }
    // كل السنوات: نقارن آخر سنتين متوفرتين
    if (years.length >= 2) return indicator.yearly[years[years.length - 2]]?.value;
    return null;
}

function getChange(indicator) {
    const current = getLatestValue(indicator);
    const prev = getPrevValue(indicator);
    if (current === undefined || current === null) return null;
    if (prev === undefined || prev === null || prev === 0) return null;
    if (typeof current !== 'number' || typeof prev !== 'number') return null;
    return ((current - prev) / Math.abs(prev)) * 100;
}

function getIndicatorValueForYear(indicator, year) {
    if (year === 'all') {
        const years = getYearsForIndicator(indicator);
        return indicator.yearly[years[years.length - 1]]?.value;
    }
    return indicator.yearly[year]?.value;
}

// ─────────────────────────────────────────────
// تسجيل الخروج والتاريخ
// ─────────────────────────────────────────────
function logout() {
    localStorage.removeItem('authenticated');
    localStorage.removeItem('loginTime');
    window.location.href = 'index.html';
}

function initDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    document.getElementById('lastUpdate').textContent = `${y}/${m}/${d}`;
}

// ─────────────────────────────────────────────
// KPI
// ─────────────────────────────────────────────
function updateKPIs() {
    const activeIndicators = INDICATORS.filter(i => !i.inactive);
    const total = activeIndicators.length;
    const available = activeIndicators.filter(i => {
        const v = getIndicatorValueForYear(i, selectedYear);
        return v !== undefined && v !== null;
    }).length;
    const cats = new Set(activeIndicators.map(i => i.category)).size;

    animateCounter('kpiTotalValue', total);
    animateCounter('kpiAvailableValue', available);
    animateCounter('kpiCategoriesValue', cats);
    document.getElementById('kpiConflictsValue').textContent = '0';

    const confCard = document.getElementById('kpiConflicts');
    confCard.className = 'kpi-card kpi-warning';
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    const current = parseInt(el.textContent) || 0;
    const diff = target - current;
    const steps = 20;
    let step = 0;
    const timer = setInterval(() => {
        step++;
        el.textContent = Math.round(current + (diff * step / steps));
        if (step >= steps) { el.textContent = target; clearInterval(timer); }
    }, 20);
}

// ─────────────────────────────────────────────
// الفئات والمؤشرات
// ─────────────────────────────────────────────
function getFilteredIndicators(categoryId) {
    return INDICATORS.filter(i => i.category === categoryId && !i.inactive).filter(i => {
        if (selectedYear === 'all') return true;
        return i.yearly[selectedYear] !== undefined;
    });
}

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = '';

    CATEGORIES.forEach(cat => {
        const indicators = getFilteredIndicators(cat.id);
        if (indicators.length === 0) return;

        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="category-header" onclick="toggleCategory(this)">
                <div class="category-header-left">
                    <div class="category-icon" style="background: ${cat.bgColor}">
                        <i class="bi ${cat.icon}"></i>
                    </div>
                    <div>
                        <div class="category-name">${cat.name}</div>
                        <div class="category-count">${indicators.length} مؤشر</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:10px;">
                    <span class="category-badge">${indicators.length}</span>
                    <i class="bi bi-chevron-down chev-icon" style="color:var(--text-secondary);transition:transform 0.3s;"></i>
                </div>
            </div>
            <div class="category-body">
                <table class="indicators-table">
                    <thead>
                        <tr>
                            <th style="width:80px">#</th>
                            <th>المؤشر</th>
                            <th style="width:70px">المصدر</th>
                            <th style="width:130px">القيمة</th>
                            <th style="width:90px">التغير</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${indicators.map(ind => renderIndicatorRow(ind)).join('')}
                    </tbody>
                </table>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderIndicatorRow(ind) {
    const value  = getIndicatorValueForYear(ind, selectedYear);
    const change = getChange(ind);

    const codeClass   = ind.isNew  ? 'indicator-code new-code' : 'indicator-code';
    const sourceClass = ind.source === 'auto' ? 'source-badge source-auto' : 'source-badge source-manual';
    const sourceText  = ind.source === 'auto' ? 'آلي' : 'يدوي';

    // سهم التغير
    let changeHtml = '<span class="change-none">—</span>';
    if (change !== null) {
        if (change > 0) {
            changeHtml = `<span class="indicator-change change-up"><i class="bi bi-arrow-up-circle-fill"></i> ${Math.abs(change).toFixed(1)}%</span>`;
        } else if (change < 0) {
            changeHtml = `<span class="indicator-change change-down"><i class="bi bi-arrow-down-circle-fill"></i> ${Math.abs(change).toFixed(1)}%</span>`;
        } else {
            changeHtml = `<span class="indicator-change change-none"><i class="bi bi-dash-circle"></i> 0%</span>`;
        }
    }

    const formattedValue = (value !== undefined && value !== null)
        ? `<strong>${formatNumber(value)}</strong> <small style="font-weight:400;color:var(--text-secondary)">${ind.unit}</small>`
        : '<span style="color:var(--text-secondary);font-size:0.8rem">غير متوفر</span>';

    const inactiveTag = ind.inactive
        ? ' <span style="color:var(--warning);font-size:0.68rem;font-weight:600">(غير نشط)</span>' : '';

    return `
        <tr>
            <td><span class="${codeClass}">${ind.id}</span></td>
            <td>
                <span class="indicator-name" onclick="openIndicatorDetail('${ind.id}')">${ind.name}${inactiveTag}</span>
            </td>
            <td><span class="${sourceClass}" title="التغذية: ${sourceText}">${sourceText}</span></td>
            <td class="indicator-value">${formattedValue}</td>
            <td>${changeHtml}</td>
        </tr>
    `;
}

// ─────────────────────────────────────────────
// فتح / إغلاق فئة
// ─────────────────────────────────────────────
function toggleCategory(headerEl) {
    const body = headerEl.nextElementSibling;
    const icon = headerEl.querySelector('.chev-icon');
    const isOpen = body.classList.contains('open');

    document.querySelectorAll('.category-body.open').forEach(b => b.classList.remove('open'));
    document.querySelectorAll('.chev-icon').forEach(i => {
        i.style.transform = '';
    });

    if (!isOpen) {
        body.classList.add('open');
        if (icon) icon.style.transform = 'rotate(180deg)';
    }
}

// ─────────────────────────────────────────────
// نافذة تفاصيل المؤشر
// ─────────────────────────────────────────────
function openIndicatorDetail(indicatorId) {
    const ind = INDICATORS.find(i => i.id === indicatorId);
    if (!ind) return;

    const modal = document.getElementById('detailModal');
    const title = document.getElementById('modalTitle');
    const body  = document.getElementById('modalBody');

    const cat = CATEGORIES.find(c => c.id === ind.category);
    title.innerHTML = `<i class="bi ${cat?.icon || 'bi-info-circle'}"></i> ${ind.id} — ${ind.name}`;

    // ====== بيانات الرسم: أول وآخر سنة فقط ======
    const years = getYearsForIndicator(ind);
    const firstYear  = years[0];
    const lastYear   = years[years.length - 1];
    const firstValue = ind.yearly[firstYear]?.value  ?? 0;
    const lastValue  = ind.yearly[lastYear]?.value   ?? 0;

    let totalChange = null;
    if (firstValue !== 0 && typeof firstValue === 'number' && typeof lastValue === 'number') {
        totalChange = ((lastValue - firstValue) / Math.abs(firstValue)) * 100;
    }

    const trendUp      = totalChange !== null && totalChange >= 0;
    const trendColor   = totalChange === null ? '#607d8b' : trendUp ? '#2e7d32' : '#c62828';
    const trendBg      = totalChange === null ? 'rgba(96,125,139,0.08)' : trendUp ? 'rgba(46,125,50,0.08)' : 'rgba(198,40,40,0.08)';
    const trendBorder  = totalChange === null ? 'rgba(96,125,139,0.25)' : trendUp ? 'rgba(46,125,50,0.25)' : 'rgba(198,40,40,0.25)';
    const trendIcon    = totalChange === null ? 'bi-dash-circle-fill' : trendUp ? 'bi-arrow-up-circle-fill' : 'bi-arrow-down-circle-fill';
    const trendLabel   = totalChange === null ? '—' : (trendUp ? '+' : '') + totalChange.toFixed(1) + '%';

    // ====== القيمة الحالية والسابقة ======
    const currentValue = getLatestValue(ind);
    const prevValue    = getPrevValue(ind);
    const yearChange   = getChange(ind);

    let html = '';

    // ── بطاقات المعلومات ──
    html += `<div class="modal-info-grid">`;
    html += infoCard('القيمة الحالية', currentValue !== undefined && currentValue !== null ? `${formatNumber(currentValue)} ${ind.unit}` : '—', trendColor);
    html += infoCard('القيمة السابقة', prevValue !== undefined && prevValue !== null ? `${formatNumber(prevValue)} ${ind.unit}` : '—', '#607d8b');
    if (yearChange !== null) {
        const yc = yearChange;
        html += infoCard('التغير السنوي', `${yc > 0 ? '+' : ''}${yc.toFixed(1)}%`, yc >= 0 ? '#2e7d32' : '#c62828');
    } else {
        html += infoCard('التغير السنوي', '—', '#607d8b');
    }
    html += infoCard('نوع التغذية', ind.source === 'auto' ? 'آلي (محسوب)' : 'يدوي (إدخال)', '#0277bd');
    html += `</div>`;

    // ── رسم الاتجاه (أول ↔ آخر سنة) ──
    html += `
    <div class="chart-section">
        <div class="chart-section-title">
            <i class="bi bi-graph-up" style="color:${trendColor}"></i>
            اتجاه المؤشر — من ${firstYear} إلى ${lastYear}
        </div>
        <div class="modal-chart-container">
            <canvas id="modalChart"></canvas>
        </div>
        <div class="trend-summary" style="background:${trendBg};border-color:${trendBorder}">
            <span style="font-size:0.85rem;color:var(--text-secondary)">
                ${formatNumber(firstValue)} ${ind.unit}
                <i class="bi bi-arrow-left" style="margin:0 6px"></i>
                ${formatNumber(lastValue)} ${ind.unit}
            </span>
            <span style="display:flex;align-items:center;gap:6px;font-weight:800;font-size:1rem;color:${trendColor}">
                <i class="bi ${trendIcon}" style="font-size:1.3rem"></i>
                ${trendLabel}
            </span>
        </div>
    </div>`;

    // ── جدول البيانات السنوية الكاملة ──
    html += `
    <div class="yearly-section">
        <div class="chart-section-title">
            <i class="bi bi-calendar3" style="color:var(--primary)"></i>
            القيم السنوية
        </div>
        <table class="yearly-table">
            <thead><tr>${years.map(y => `<th>${y}</th>`).join('')}</tr></thead>
            <tbody><tr>
                ${years.map(y => {
                    const v = ind.yearly[y]?.value;
                    return `<td>${v !== undefined && v !== null ? formatNumber(v) + ' <small>' + ind.unit + '</small>' : '—'}</td>`;
                }).join('')}
            </tr></tbody>
        </table>
    </div>`;

    // ── جدول التفاصيل (إن وُجد) ──
    if (ind.detail) {
        html += `
        <div class="detail-section">
            <div class="chart-section-title">
                <i class="bi bi-table" style="color:var(--primary)"></i>
                التفاصيل
            </div>
            <div class="table-scroll">
            <table class="modal-detail-table">
                <thead><tr>${ind.detail.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
                <tbody>
                    ${Object.entries(ind.detail.rows).map(([label, values]) => `
                        <tr>
                            <td style="font-weight:700;text-align:right;white-space:nowrap">${label}</td>
                            ${values.map(v => `<td>${formatNumber(v)}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        </div>`;
    }

    body.innerHTML = html;
    modal.classList.add('open');

    // رسم الرسم البياني بعد ظهور المودال
    setTimeout(() => renderModalChart(ind, firstYear, lastYear, firstValue, lastValue, trendColor), 120);
}

function infoCard(label, value, color) {
    return `
    <div class="modal-info-card">
        <span class="info-label">${label}</span>
        <span class="info-value" style="color:${color}">${value}</span>
    </div>`;
}

function renderModalChart(ind, firstYear, lastYear, firstValue, lastValue, color) {
    const ctx = document.getElementById('modalChart');
    if (!ctx || typeof Chart === 'undefined') return;

    try {
        if (charts.modal) { charts.modal.destroy(); charts.modal = null; }

        // بيانات كل السنوات (لرسم خط ناعم)
        const allYears  = getYearsForIndicator(ind);
        const allValues = allYears.map(y => {
            const v = ind.yearly[y]?.value;
            return (typeof v === 'number') ? v : null;
        });

        charts.modal = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allYears,
                datasets: [{
                    label: ind.name,
                    data: allValues,
                    backgroundColor: color + '22',
                    borderColor: color,
                    borderWidth: 3,
                    tension: 0.35,
                    pointBackgroundColor: allYears.map((y, i) =>
                        (y === firstYear || y === lastYear) ? color : color + '88'
                    ),
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: allYears.map((y, i) =>
                        (y === firstYear || y === lastYear) ? 9 : 5
                    ),
                    pointHoverRadius: 11,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(10,22,40,0.9)',
                        titleFont: { family: 'Cairo', size: 13, weight: 'bold' },
                        bodyFont: { family: 'Cairo', size: 12 },
                        padding: 14,
                        cornerRadius: 10,
                        callbacks: {
                            title: (items) => `سنة ${items[0].label}`,
                            label: (ctx) => {
                                const v = ctx.parsed.y;
                                return v !== null ? `  ${formatNumber(v)} ${ind.unit}` : '  غير متوفر';
                            }
                        }
                    },
                    annotation: undefined
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                            font: { family: 'Cairo', size: 11 },
                            callback: (v) => formatNumber(v)
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Cairo', size: 13, weight: '700' } }
                    }
                }
            }
});
    } catch (e) {
        console.error('خطأ في الرسم البياني:', e);
    }
}

function closeModal() {
    document.getElementById('detailModal').classList.remove('open');
    if (charts.modal) { charts.modal.destroy(); charts.modal = null; }
}

document.addEventListener('click', e => { if (e.target.id === 'detailModal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ─────────────────────────────────────────────
// فلتر السنوات
// ─────────────────────────────────────────────
function initYearFilter() {
    const buttons = document.querySelectorAll('.year-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function () {
            buttons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedYear = this.dataset.year === 'all' ? 'all' : parseInt(this.dataset.year);
            refreshDashboard();
        });
    });
}

// ─────────────────────────────────────────────
// تحديث اللوحة
// ─────────────────────────────────────────────
function refreshDashboard() {
    updateKPIs();
    renderCategories();
    updateFilterStats();
}

function updateFilterStats() {
    const stats = document.getElementById('filterStats');
    const active = INDICATORS.filter(i => !i.inactive);
    if (selectedYear === 'all') {
        stats.textContent = `عرض جميع البيانات — ${active.length} مؤشر نشط`;
    } else {
        const filtered = active.filter(i => i.yearly[selectedYear]);
        stats.textContent = `بيانات سنة ${selectedYear} — ${filtered.length} مؤشر متاح`;
    }
}

function scrollToCategories() {
    document.getElementById('categoriesGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─────────────────────────────────────────────
// التهيئة عند تحميل الصفحة
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('authenticated') !== 'true') {
        window.location.href = 'index.html';
        return;
    }
    initDate();
    initYearFilter();
    refreshDashboard();

    ['kpiTotal', 'kpiAvailable', 'kpiCategories', 'kpiConflicts'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', scrollToCategories);
    });
});
