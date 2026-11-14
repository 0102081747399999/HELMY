// app.js - Main Application Logic for Hilmy Telecom POS Hub (Optimized for Laptop / Desktop POS)
import { 
  Store, 
  subscribeToStore, 
  initRealtimeSync,
  addProduct,
  updateProduct,
  deleteProduct,
  adjustProductStock,
  updateVodafoneLineSettings,
  recordVodafoneTransaction,
  updateVodafoneTransaction,
  deleteVodafoneTransaction,
  resetVodafoneLine,
  checkoutSale,
  recordCashDrawerEntry
} from './firebase-config.js';

// Application State
const AppState = {
  currentView: 'dashboard-overview',
  activeVodafoneLine: 1,
  activeChargerTab: 'all',
  activeHeadphoneTab: 'all',
  activeSpeakerTab: 'all',
  activePhoneBrand: 'all',
  activePhoneStatus: 'all',
  posCatalogCategory: 'all',
  posCatalogSearch: '',
  sidebarCollapsed: false,
  cart: [],
  cartDiscount: 0,
  deleteTarget: null, // { type: 'product'|'vodafone_tx'|'vodafone_reset', id: string, extra: any }
  editingProductId: null,
  editingVodafoneTxId: null
};

// ==========================================
// THEME & COLOR CUSTOMIZER SYSTEM
// ==========================================
const THEME_OPTIONS = {
  'dark-onyx': {
    id: 'dark-onyx',
    name: 'الأسود الداكن الفاخر (Dark Slate / Onyx)',
    desc: 'تصميم داكن فخم عالي التباين بلمسات تيتانيوم وسماوي مثلج (مريح جداً للعين)',
    badge: 'داكن فاخر',
    previewHex: ['#090d16', '#162032', '#38bdf8']
  },
  'red-magic': {
    id: 'red-magic',
    name: 'ريد ماجيك القرمزي (Red Magic Crimson)',
    desc: 'طابع رياضي فخم باللون القرمزي والأسود الملكي',
    badge: 'الخيار الافتراضي (هوية الموقع) ★',
    previewHex: ['#0d090d', '#20131d', '#f43f5e']
  },
  'emerald': {
    id: 'emerald',
    name: 'الزمردي المالي (Emerald Green POS)',
    desc: 'تصميم أنيق باللون الأخضر الزمردي المريح للعينيات المالية',
    badge: 'مالي راقي',
    previewHex: ['#061a14', '#0e3126', '#34d399']
  },
  'royal-purple': {
    id: 'royal-purple',
    name: 'البنفسجي الملكي الحديث (Royal Violet)',
    desc: 'لمسة عصرية راقية وجذابة بدرجات البنفسجي الفخم',
    badge: 'مودرن',
    previewHex: ['#0d0818', '#1e1136', '#a78bfa']
  },
  'classic-navy': {
    id: 'classic-navy',
    name: 'الكحلي والسماوي الأصلي (Classic Navy & Sky Blue)',
    desc: 'المظهر الكحلي المكتبي الكلاسيكي والأزرق الملكي',
    badge: 'كلاسيك',
    previewHex: ['#0a192f', '#112240', '#3b82f6']
  },
  'vanilla': {
    id: 'vanilla',
    name: 'الفانيلا والبيج الفاخر (Vanilla Cream & Gold)',
    desc: 'ثيم فاتح هادئ وراقي لمحبي الواجهات الفاتحة والواضحة',
    badge: 'فاتح أنيق',
    previewHex: ['#f8fafc', '#ffffff', '#2563eb']
  }
};

export function initTheme() {
  const savedTheme = localStorage.getItem('pos_color_theme') || 'red-magic';
  const savedAccent = localStorage.getItem('pos_accent_color');
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (savedAccent) {
    document.documentElement.style.setProperty('--accent-color', savedAccent);
    document.documentElement.style.setProperty('--accent-hover', adjustColorBrightness(savedAccent, -20));
  }
}

window.openThemeModal = () => {
  renderThemeModalOptions();
  const modal = document.getElementById('modal-theme-customizer');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeThemeModal = () => {
  const modal = document.getElementById('modal-theme-customizer');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.selectTheme = (themeId) => {
  if (!THEME_OPTIONS[themeId]) return;
  document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem('pos_color_theme', themeId);
  // Remove custom accent to revert to theme default
  localStorage.removeItem('pos_accent_color');
  document.documentElement.style.removeProperty('--accent-color');
  document.documentElement.style.removeProperty('--accent-hover');
  renderThemeModalOptions();
  showToast(`تم تفعيل ثيم: ${THEME_OPTIONS[themeId].name}`, 'palette');
};

window.setCustomAccentColor = (hex) => {
  if (!hex) return;
  document.documentElement.style.setProperty('--accent-color', hex);
  document.documentElement.style.setProperty('--accent-hover', adjustColorBrightness(hex, -20));
  localStorage.setItem('pos_accent_color', hex);
  showToast(`تم تعيين اللون المخصص: ${hex}`, 'format_color_fill');
};

window.resetAccentColor = () => {
  localStorage.removeItem('pos_accent_color');
  document.documentElement.style.removeProperty('--accent-color');
  document.documentElement.style.removeProperty('--accent-hover');
  showToast("تمت استعادة اللون الافتراضي للثيم النشط", 'refresh');
};

function adjustColorBrightness(hex, percent) {
  let num = parseInt(hex.replace('#',''), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      B = (num >> 8 & 0x00FF) + amt,
      G = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1);
}

function renderThemeModalOptions() {
  const container = document.getElementById('theme-options-container');
  if (!container) return;
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark-onyx';

  container.innerHTML = Object.keys(THEME_OPTIONS).map(key => {
    const t = THEME_OPTIONS[key];
    const isSelected = t.id === currentTheme;
    const dots = t.previewHex.map(hex => `<span class="w-4 h-4 rounded-full border border-white/20 shadow-sm" style="background-color: ${hex}"></span>`).join('');
    return `
      <div 
        onclick="window.selectTheme('${t.id}')"
        class="flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
          isSelected 
            ? 'border-secondary bg-secondary/10 shadow-md ring-2 ring-secondary/30' 
            : 'border-outline-variant/30 hover:border-secondary/50 hover:bg-surface-container-low'
        }">
        <div class="flex items-center gap-3.5">
          <div class="flex items-center -space-x-1.5 space-x-reverse p-1.5 bg-black/20 rounded-lg shrink-0">
            ${dots}
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <span class="font-headline-sm font-bold text-on-surface text-base">${t.name}</span>
              ${t.badge ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-secondary text-white' : 'bg-surface-container text-on-surface-variant'}">${t.badge}</span>` : ''}
            </div>
            <p class="font-body-sm text-on-surface-variant text-xs mt-0.5">${t.desc}</p>
          </div>
        </div>
        <div class="shrink-0 mr-2">
          <span class="w-6 h-6 rounded-full flex items-center justify-center border ${
            isSelected ? 'bg-secondary text-white border-secondary' : 'border-outline-variant/50 text-transparent'
          }">
            <span class="material-symbols-outlined text-sm font-bold">${isSelected ? 'check' : ''}</span>
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// Live Clock & Date for Laptop Header
function startLiveClock() {
  const clockEl = document.getElementById('header-live-clock');
  const dateEl = document.getElementById('header-live-date');

  const update = () => {
    const now = new Date();
    if (clockEl) {
      clockEl.innerText = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    }
    if (dateEl) {
      dateEl.innerText = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  };
  update();
  setInterval(update, 1000);
}

// Fullscreen Toggle for Laptop Cashier
window.toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
};

// Sidebar Collapse / Expand Toggle for Laptops
window.toggleSidebar = () => {
  AppState.sidebarCollapsed = !AppState.sidebarCollapsed;
  const sidebar = document.getElementById('app-sidebar');
  const mainWrapper = document.getElementById('main-content-wrapper');
  const header = document.getElementById('app-header');

  if (AppState.sidebarCollapsed) {
    sidebar?.classList.add('sidebar-collapsed');
    mainWrapper?.classList.remove('pr-72');
    mainWrapper?.classList.add('pr-20');
    header?.classList.remove('right-72');
    header?.classList.add('right-20');
  } else {
    sidebar?.classList.remove('sidebar-collapsed');
    mainWrapper?.classList.remove('pr-20');
    mainWrapper?.classList.add('pr-72');
    header?.classList.remove('right-20');
    header?.classList.add('right-72');
  }
};

// ==========================================
// INITIALIZATION
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
  // Initialize Theme Engine
  initTheme();

  // Initialize Realtime Firebase Synchronization
  initRealtimeSync();

  // Start Header Live Clock
  startLiveClock();

  // Subscribe UI to data store updates
  subscribeToStore((event, data, store) => {
    console.log(`Store event: ${event}`);
    renderCurrentView();
    updateGlobalHeaderBadges();
    if (!document.getElementById('modal-quick-pos')?.classList.contains('hidden')) {
      renderPOSCatalog(AppState.posCatalogCategory, AppState.posCatalogSearch);
    }
  });

  // Setup navigation handlers
  setupNavigation();

  // Setup Keyboard Shortcuts (F1, F2, F4, F7, ESC)
  setupKeyboardShortcuts();

  // Setup Global Hardware Barcode Scanner Listener
  setupBarcodeScannerListener();

  // Setup Quick POS Cart event handlers
  setupQuickPOS();

  // Setup Product CRUD Modals
  setupProductModal();

  // Setup Vodafone Controls
  setupVodafoneEvents();

  // Setup Cash Drawer Modals
  setupDrawerEvents();

  // Initial Render
  renderCurrentView();
  updateGlobalHeaderBadges();
});

// ==========================================
// ROUTING & VIEW NAVIGATION
// ==========================================

function setupNavigation() {
  const navLinks = document.querySelectorAll('nav a[data-path]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const path = link.getAttribute('data-path');
      navigateTo(path);
    });
  });

  // Catch in-page link navigation
  document.addEventListener('click', (e) => {
    const targetLink = e.target.closest('a[data-path]');
    if (targetLink) {
      e.preventDefault();
      const path = targetLink.getAttribute('data-path');
      navigateTo(path);
    }
  });
}

export function navigateTo(path) {
  AppState.currentView = path;

  // Update sidebar active classes
  const navLinks = document.querySelectorAll('nav a[data-path]');
  navLinks.forEach(link => {
    const isCurrent = link.getAttribute('data-path') === path;
    if (isCurrent) {
      link.setAttribute('aria-current', 'page');
      link.className = "flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-title-md shadow-md ring-1 ring-sky-accent/40";
    } else {
      link.removeAttribute('aria-current');
      link.className = "flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-300 hover:bg-navy-card hover:text-sky-accent transition-colors";
    }
  });

  // Show/Hide View Sections
  const views = ['dashboard-overview', 'vodafone-cash-wallets', 'chargers-cables', 'phones-sales-inventory', 'headphones-audio', 'speakers-sound'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === path) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  renderCurrentView();
}

function renderCurrentView() {
  switch (AppState.currentView) {
    case 'dashboard-overview':
      renderDashboard();
      break;
    case 'vodafone-cash-wallets':
      renderVodafoneHub();
      break;
    case 'chargers-cables':
      renderChargersPage();
      break;
    case 'phones-sales-inventory':
      renderPhonesPage();
      break;
    case 'headphones-audio':
      renderHeadphonesPage();
      break;
    case 'speakers-sound':
      renderSpeakersPage();
      break;
  }
}

// ==========================================
// GLOBAL HEADER & KPI BADGES
// ==========================================

function updateGlobalHeaderBadges() {
  const drawerBal = Store.drawer ? (Store.drawer.currentCash || 0) : 0;
  const headerCash = document.getElementById('header-cash-balance');
  const sidebarDrawerVal = document.getElementById('sidebar-drawer-val');
  if (headerCash) headerCash.innerText = `${formatMoney(drawerBal)} ج.م`;
  if (sidebarDrawerVal) sidebarDrawerVal.innerText = formatMoney(drawerBal);

  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = Store.salesInvoices.filter(inv => (inv.timestamp || '').startsWith(todayStr));
  const totalSalesVal = todaySales.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);

  const totalVodaBalance = Store.vodafoneLines.reduce((acc, l) => acc + (parseFloat(l.balance) || 0), 0);
  const lowStockCount = Store.products.filter(p => (p.category !== 'phones' && (p.quantity || 0) <= 2) || (p.category === 'phones' && p.status === 'available')).length;

  setElemText('stat-dash-drawer', formatMoney(drawerBal));
  setElemText('stat-dash-voda', formatMoney(totalVodaBalance));
  setElemText('stat-dash-sales', formatMoney(totalSalesVal));
  setElemText('stat-dash-sales-count', `${todaySales.length} عمليات بيع مكتملة`);
  setElemText('stat-dash-low-stock', lowStockCount);
}

// ==========================================
// VIEW 1: DASHBOARD OVERVIEW
// ==========================================

function renderDashboard() {
  updateGlobalHeaderBadges();

  const invoicesTbody = document.getElementById('dash-recent-invoices');
  if (invoicesTbody) {
    const recent = Store.salesInvoices.slice(0, 7);
    if (recent.length === 0) {
      invoicesTbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-on-surface-variant">
            <div class="flex flex-col items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[36px] opacity-40">receipt_long</span>
              <p class="font-headline-sm text-headline-sm">لا توجد مبيعات مسجلة حتى الآن</p>
              <button onclick="window.triggerQuickPOS()" class="text-secondary hover:underline font-label-md text-label-md font-bold">+ بدء بيع سريع (F2)</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      invoicesTbody.innerHTML = recent.map(inv => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors">
          <td class="py-3 px-4 font-numeric-table text-secondary font-bold">${inv.invoiceNumber}</td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant">${formatTime(inv.timestamp)}</td>
          <td class="py-3 px-4 font-label-md font-bold">${inv.items ? inv.items.map(i => `${i.name} (×${i.quantity})`).join(', ') : '-'}</td>
          <td class="py-3 px-4 font-numeric-table font-bold text-on-surface">${formatMoney(inv.totalAmount)} ج.م</td>
          <td class="py-3 px-4 text-on-surface-variant font-label-sm">${inv.customerName || 'عميل نقدي'}</td>
          <td class="py-3 px-4 text-center">
            <button onclick="window.printInvoiceReceipt('${inv.id}')" class="p-1.5 rounded-lg text-secondary hover:bg-secondary/10 transition-colors" title="طباعة الإيصال">
              <span class="material-symbols-outlined text-[18px]">print</span>
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  const vodaTbody = document.getElementById('dash-recent-voda');
  if (vodaTbody) {
    const recentVoda = Store.vodafoneTransactions.slice(0, 7);
    if (recentVoda.length === 0) {
      vodaTbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-on-surface-variant">
            <div class="flex flex-col items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[36px] opacity-40">account_balance_wallet</span>
              <p class="font-headline-sm text-headline-sm">لا توجد معاملات كاش مسجلة اليوم</p>
              <button onclick="window.navigateTo('vodafone-cash-wallets')" class="text-secondary hover:underline font-label-md text-label-md font-bold">+ فتح محافظ فودافون كاش</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      vodaTbody.innerHTML = recentVoda.map(tx => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors">
          <td class="py-3 px-4 font-label-md font-bold text-on-surface">خط ${tx.lineNum}</td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1 ${tx.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}">
              <span class="material-symbols-outlined text-[13px]">${tx.type === 'deposit' ? 'add_circle' : 'remove_circle'}</span>
              ${tx.type === 'deposit' ? 'إيداع (+)' : 'سحب (-)'}
            </span>
          </td>
          <td class="py-3 px-4 font-numeric-table font-bold text-on-surface">${formatMoney(tx.amount)} ج.م</td>
          <td class="py-3 px-4 font-numeric-table text-emerald-400 font-bold">+${formatMoney(tx.commission || 0)} ج.م</td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant">${tx.customerPhone || '-'}</td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant text-xs">${formatTime(tx.timestamp)}</td>
        </tr>
      `).join('');
    }
  }
}

// ==========================================
// VIEW 2: VODAFONE CASH 18 LINES MANAGEMENT
// ==========================================

function renderVodafoneHub() {
  const lineNum = AppState.activeVodafoneLine;
  const line = Store.vodafoneLines.find(l => l.lineNum === lineNum) || {
    lineNum,
    phone: '',
    monthlyLimit: 100000,
    balance: 0,
    totalTransferredMonth: 0
  };

  const gridContainer = document.getElementById('wallets-grid');
  if (gridContainer) {
    gridContainer.innerHTML = Store.vodafoneLines.map(l => {
      const isSelected = l.lineNum === lineNum;
      const hasPhone = Boolean(l.phone && l.phone.trim());
      const hasBalance = (l.balance || 0) > 0;
      return `
        <button 
          onclick="window.selectVodafoneLine(${l.lineNum})"
          class="wallet-btn flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-150 cursor-pointer ${
            isSelected 
              ? 'bg-primary text-white ring-2 ring-rose-500/50 shadow-lg shadow-rose-950/60 scale-105' 
              : 'bg-navy-card hover:bg-surface-container text-on-surface border border-slate-800 hover:border-rose-900/40'
          }"
          type="button">
          <div class="flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px] ${isSelected ? 'text-white' : (hasBalance ? 'text-emerald-400' : 'text-on-surface-variant')}">
              ${hasBalance ? 'account_balance_wallet' : 'sim_card'}
            </span>
            <span class="font-headline-sm text-headline-sm font-numeric-table font-bold">${l.lineNum}</span>
          </div>
          <span class="font-numeric-table text-xs mt-0.5 ${isSelected ? 'text-white/90' : 'text-on-surface-variant'} truncate max-w-[65px] font-bold">
            ${formatCompactMoney(l.balance || 0)}
          </span>
          <span class="w-1.5 h-1.5 rounded-full mt-1 ${hasPhone ? 'bg-emerald-400' : 'bg-outline-variant'}"></span>
        </button>
      `;
    }).join('');
  }

  const totalBalance = Store.vodafoneLines.reduce((acc, l) => acc + (parseFloat(l.balance) || 0), 0);
  const totalLimits = Store.vodafoneLines.reduce((acc, l) => acc + (parseFloat(l.monthlyLimit) || 100000), 0);
  const totalTransferred = Store.vodafoneLines.reduce((acc, l) => acc + (parseFloat(l.totalTransferredMonth) || 0), 0);
  const remainingTotalLimit = Math.max(0, totalLimits - totalTransferred);
  const limitPercent = totalLimits > 0 ? Math.min(100, Math.round((totalTransferred / totalLimits) * 100)) : 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCommissions = Store.vodafoneTransactions
    .filter(t => (t.timestamp || '').startsWith(todayStr))
    .reduce((acc, t) => acc + (parseFloat(t.commission) || 0), 0);
  const todayTxsCount = Store.vodafoneTransactions.filter(t => (t.timestamp || '').startsWith(todayStr)).length;

  setElemText('voda-kpi-total-balance', formatMoney(totalBalance));
  setElemText('voda-kpi-remaining-limit', formatMoney(remainingTotalLimit));
  setElemText('voda-kpi-limit-percent', `الاستهلاك الكلي: ${limitPercent}%`);
  setElemText('voda-kpi-today-commissions', formatMoney(todayCommissions));
  setElemText('voda-kpi-today-tx-count', `${todayTxsCount} عمليات اليوم`);

  const progressBar = document.getElementById('voda-kpi-limit-bar');
  if (progressBar) progressBar.style.width = `${limitPercent}%`;

  setElemText('active-line-badge', `خط ${line.lineNum} - نشط`);
  setElemText('active-line-phone-display', line.phone ? `رقم المحفظة: ${line.phone}` : 'لم يتم تحديد رقم هاتف للخط');
  setElemText('active-line-balance-display', `${formatMoney(line.balance || 0)} ج.م`);
  
  const lineLimit = parseFloat(line.monthlyLimit) || 100000;
  const lineUsed = parseFloat(line.totalTransferredMonth) || 0;
  const lineRemaining = Math.max(0, lineLimit - lineUsed);
  const lineLimitPercent = lineLimit > 0 ? Math.min(100, Math.round((lineUsed / lineLimit) * 100)) : 0;

  setElemText('active-line-limit-display', `${formatMoney(lineRemaining)} ج.م`);
  setElemText('active-line-limit-sub', `السقف الشهري: ${formatMoney(lineLimit)} ج.م (المستخدم ${lineLimitPercent}%)`);
  
  const activeLineBar = document.getElementById('active-line-limit-bar');
  if (activeLineBar) activeLineBar.style.width = `${lineLimitPercent}%`;

  const lineTxs = Store.vodafoneTransactions.filter(t => t.lineNum === lineNum);
  setElemText('active-line-txs-count', `${lineTxs.length} حركات`);

  const tbody = document.getElementById('transactions-body');
  if (tbody) {
    if (lineTxs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="py-16 text-center" colspan="8">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
              <span class="material-symbols-outlined text-[40px] opacity-30">hourglass_empty</span>
              <span class="font-headline-sm text-headline-sm font-bold text-on-surface">لم يتم تسجيل أي معاملات على الخط (${lineNum})</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">قم بتسجيل عملية إيداع أو سحب لتحديث كشف الحساب والرصيد فورياً.</span>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = lineTxs.map((tx, idx) => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors">
          <td class="py-3 px-3 font-numeric-table text-secondary font-bold">#${lineTxs.length - idx}</td>
          <td class="py-3 px-3 font-numeric-table text-on-surface-variant text-xs">${formatTime(tx.timestamp)}</td>
          <td class="py-3 px-3">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
              tx.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }">
              <span class="material-symbols-outlined text-[13px]">${tx.type === 'deposit' ? 'add_circle' : 'remove_circle'}</span>
              ${tx.type === 'deposit' ? 'إيداع / استلام' : 'تحويل / سحب'}
            </span>
          </td>
          <td class="py-3 px-3 font-numeric-table font-bold text-on-surface text-base">${formatMoney(tx.amount)} ج.م</td>
          <td class="py-3 px-3 font-numeric-table text-on-surface">${tx.customerPhone || '-'}</td>
          <td class="py-3 px-3 font-numeric-table text-emerald-400 font-bold">+${formatMoney(tx.commission || 0)} ج.م</td>
          <td class="py-3 px-3 font-numeric-table text-on-surface-variant font-bold">${formatMoney(tx.balanceAfter)} ج.م</td>
          <td class="py-3 px-3 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="window.openEditVodafoneTxModal('${tx.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" title="تعديل">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button onclick="window.confirmDeleteVodafoneTx('${tx.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 transition-colors" title="حذف">
                <span class="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }
}

function setupVodafoneEvents() {
  window.selectVodafoneLine = (lineNum) => {
    AppState.activeVodafoneLine = lineNum;
    renderVodafoneHub();
  };

  const btnDeposit = document.getElementById('btn-voda-deposit');
  const btnWithdraw = document.getElementById('btn-voda-withdraw');
  const amountInput = document.getElementById('voda-tx-amount');
  const phoneInput = document.getElementById('voda-tx-phone');
  const commInput = document.getElementById('voda-tx-commission');
  const notesInput = document.getElementById('voda-tx-notes');

  const handleTx = async (type) => {
    const amount = parseFloat(amountInput?.value) || 0;
    if (amount <= 0) {
      showToast("يرجى إدخال مبلغ صحيح للعملية", "warning");
      amountInput?.focus();
      return;
    }

    const commission = parseFloat(commInput?.value) || 0;
    const customerPhone = phoneInput?.value || '';
    const notes = notesInput?.value || '';

    try {
      await recordVodafoneTransaction({
        lineNum: AppState.activeVodafoneLine,
        type,
        amount,
        commission,
        customerPhone,
        notes
      });

      if (amountInput) amountInput.value = '';
      if (phoneInput) phoneInput.value = '';
      if (commInput) commInput.value = '5.00';
      if (notesInput) notesInput.value = '';

      showToast(`تم تسجيل حركة ${type === 'deposit' ? 'إيداع' : 'سحب'} بنجاح على خط ${AppState.activeVodafoneLine}`, 'verified');
    } catch (err) {
      showToast(`حدث خطأ: ${err.message}`, 'error');
    }
  };

  if (btnDeposit) btnDeposit.addEventListener('click', () => handleTx('deposit'));
  if (btnWithdraw) btnWithdraw.addEventListener('click', () => handleTx('withdraw'));

  window.confirmResetVodafoneLine = () => {
    const lineNum = AppState.activeVodafoneLine;
    AppState.deleteTarget = {
      type: 'vodafone_reset',
      id: lineNum,
      title: `إعادة تعيين خط فودافون كاش (${lineNum})`,
      message: `هل أنت متأكد من تصفير رصيد الخط (${lineNum}) وحذف سجل عملياته؟ لا يمكن التراجع عن هذا الإجراء.`
    };
    openDeleteConfirmModal();
  };

  window.confirmDeleteVodafoneTx = (txId) => {
    AppState.deleteTarget = {
      type: 'vodafone_tx',
      id: txId,
      title: 'حذف معاملة فودافون كاش',
      message: 'هل أنت متأكد من حذف هذه المعاملة؟ سيتم التراجع عن أثرها المالي على رصيد المحفظة والدرج.'
    };
    openDeleteConfirmModal();
  };

  window.openLineSettingsModal = () => {
    const line = Store.vodafoneLines.find(l => l.lineNum === AppState.activeVodafoneLine);
    if (!line) return;

    setElemValue('settings-line-num', line.lineNum);
    setElemValue('settings-line-phone', line.phone || '');
    setElemValue('settings-line-limit', line.monthlyLimit || 100000);

    const modal = document.getElementById('modal-line-settings');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeLineSettingsModal = () => {
    const modal = document.getElementById('modal-line-settings');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  window.saveLineSettings = async () => {
    const lineNum = AppState.activeVodafoneLine;
    const phone = document.getElementById('settings-line-phone')?.value || '';
    const monthlyLimit = parseFloat(document.getElementById('settings-line-limit')?.value) || 100000;

    await updateVodafoneLineSettings(lineNum, { phone, monthlyLimit });
    closeLineSettingsModal();
    showToast(`تم تحديث إعدادات الخط ${lineNum} بنجاح`, 'check_circle');
  };

  window.openEditVodafoneTxModal = (txId) => {
    const tx = Store.vodafoneTransactions.find(t => t.id === txId);
    if (!tx) return;

    AppState.editingVodafoneTxId = txId;
    setElemValue('edit-voda-tx-id', tx.id);
    setElemText('edit-voda-line-title', `خط فودافون كاش: رقم ${tx.lineNum}`);
    
    const typeBadge = document.getElementById('edit-voda-type-badge');
    if (typeBadge) {
      typeBadge.innerText = tx.type === 'deposit' ? 'إيداع / استلام (+)' : 'تحويل / سحب (-)';
      typeBadge.className = `px-2.5 py-0.5 rounded-full font-numeric-table text-xs font-bold ${
        tx.type === 'deposit' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
      }`;
    }

    setElemValue('edit-voda-amount', tx.amount);
    setElemValue('edit-voda-commission', tx.commission || 0);
    setElemValue('edit-voda-phone', tx.customerPhone || '');
    setElemValue('edit-voda-notes', tx.notes || '');

    const modal = document.getElementById('modal-edit-voda-tx');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeEditVodafoneTxModal = () => {
    const modal = document.getElementById('modal-edit-voda-tx');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    AppState.editingVodafoneTxId = null;
  };

  window.saveEditedVodafoneTx = async () => {
    const txId = AppState.editingVodafoneTxId;
    if (!txId) return;

    const amount = parseFloat(document.getElementById('edit-voda-amount')?.value) || 0;
    const commission = parseFloat(document.getElementById('edit-voda-commission')?.value) || 0;
    const customerPhone = document.getElementById('edit-voda-phone')?.value || '';
    const notes = document.getElementById('edit-voda-notes')?.value || '';

    if (amount <= 0) {
      showToast("يرجى إدخال مبلغ صحيح", "warning");
      return;
    }

    await updateVodafoneTransaction(txId, {
      amount,
      commission,
      customerPhone,
      notes
    });

    closeEditVodafoneTxModal();
    showToast("تم تحديث المعاملة وتعديل الرصيد تلقائياً", "verified");
  };
}

// ==========================================
// VIEW 3: CHARGERS & CABLES PAGE
// ==========================================

function renderChargersPage() {
  const allChargers = Store.products.filter(p => p.category === 'chargers');
  
  const totalQty = allChargers.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const costVal = allChargers.reduce((acc, p) => acc + ((p.buyPrice || 0) * (p.quantity || 0)), 0);
  const retailVal = allChargers.reduce((acc, p) => acc + ((p.sellPrice || 0) * (p.quantity || 0)), 0);
  const lowStock = allChargers.filter(p => (p.quantity || 0) <= 2).length;

  setElemText('chargers-stat-qty', totalQty);
  setElemText('chargers-stat-cost', formatMoney(costVal));
  setElemText('chargers-stat-retail', formatMoney(retailVal));
  setElemText('chargers-stat-profit', `أرباح تقديرية: ${formatMoney(retailVal - costVal)} ج.م`);
  setElemText('chargers-stat-low', lowStock);

  const subcounts = {
    complete: allChargers.filter(p => p.subcategory === 'complete').length,
    adapter: allChargers.filter(p => p.subcategory === 'adapter').length,
    typec: allChargers.filter(p => p.subcategory === 'typec').length,
    microusb: allChargers.filter(p => p.subcategory === 'microusb').length,
    pin: allChargers.filter(p => p.subcategory === 'pin').length
  };
  setElemText('badge-chargers-complete', subcounts.complete);
  setElemText('badge-chargers-adapter', subcounts.adapter);
  setElemText('badge-chargers-typec', subcounts.typec);
  setElemText('badge-chargers-microusb', subcounts.microusb);
  setElemText('badge-chargers-pin', subcounts.pin);
  setElemText('badge-chargers-all', allChargers.length);

  const activeTab = AppState.activeChargerTab;
  const searchInput = (document.getElementById('chargers-search-input')?.value || '').trim().toLowerCase();
  
  let filtered = allChargers;
  if (activeTab !== 'all') {
    filtered = filtered.filter(p => p.subcategory === activeTab);
  }
  if (searchInput) {
    filtered = filtered.filter(p => 
      (p.name || '').toLowerCase().includes(searchInput) || 
      (p.barcode || '').toLowerCase().includes(searchInput)
    );
  }

  const tbody = document.getElementById('chargers-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-16 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
              <span class="material-symbols-outlined text-[40px] opacity-30">cable</span>
              <span class="font-headline-sm text-headline-sm font-bold text-on-surface">لا توجد شواحن أو وصلات مسجلة</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">امسح الباركود أو اضغط F1 لإدخال شاحن أو وصلة جديدة.</span>
              <button onclick="window.openAddProductModal('chargers', '${activeTab !== 'all' ? activeTab : 'complete'}')" class="mt-2 bg-secondary text-white px-5 py-2 rounded-xl font-headline-sm text-headline-sm shadow-md hover:bg-secondary/90 transition-all cursor-pointer">
                + إضافة صنف جديد
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors">
          <td class="py-3.5 px-4 font-numeric-table font-bold text-secondary text-base">
            <span class="cursor-pointer hover:underline" onclick="window.addItemToCartFromBarcode('${item.barcode}')">${item.barcode || 'بدون باركود'}</span>
          </td>
          <td class="py-3.5 px-4 font-headline-sm font-bold text-on-surface text-base">${item.name}</td>
          <td class="py-3.5 px-4">
            <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-surface-container text-on-surface-variant border border-outline-variant/30">
              ${getChargerSubcategoryLabel(item.subcategory)}
            </span>
          </td>
          <td class="py-3.5 px-4 font-numeric-table text-on-surface text-base">${formatMoney(item.buyPrice)} ج.م</td>
          <td class="py-3.5 px-4 font-numeric-table font-bold text-emerald-400 text-lg">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-2">
              <span class="font-numeric-table font-bold text-lg ${item.quantity <= 2 ? 'text-rose-400' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-on-surface border border-outline-variant/30" title="زيادة +1">+</button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-on-surface border border-outline-variant/30" title="إنقاص -1">-</button>
            </div>
          </td>
          <td class="py-3.5 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" title="تعديل">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 transition-colors" title="حذف">
                <span class="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }
}

function getChargerSubcategoryLabel(sub) {
  switch (sub) {
    case 'complete': return 'شاحن كامل';
    case 'adapter': return 'رأس شاحن';
    case 'typec': return 'وصلة شحن عريضة (Type-C)';
    case 'microusb': return 'وصلة شحن عادية (Micro)';
    case 'pin': return 'وصلة شحن رفيعة (Pin/iPhone)';
    default: return 'شاحن / كابل';
  }
}

// ==========================================
// VIEW 4: MOBILE PHONES (IMEI) PAGE
// ==========================================

function renderPhonesPage() {
  const allPhones = Store.products.filter(p => p.category === 'phones');
  const availablePhones = allPhones.filter(p => p.status === 'available');
  const soldPhones = allPhones.filter(p => p.status === 'sold');

  const todayStr = new Date().toISOString().split('T')[0];
  const soldToday = soldPhones.filter(p => (p.soldAt || p.updatedAt || '').startsWith(todayStr));
  const todayProfit = soldToday.reduce((acc, p) => acc + ((p.sellPrice || 0) - (p.buyPrice || 0)), 0);
  const stockVal = availablePhones.reduce((acc, p) => acc + (p.buyPrice || 0), 0);

  setElemText('metric-stock-count', availablePhones.length);
  setElemText('metric-stock-value', formatMoney(stockVal));
  setElemText('metric-sold-today', soldToday.length);
  setElemText('metric-profit', formatMoney(todayProfit));

  const activeBrand = AppState.activePhoneBrand;
  const activeStatus = AppState.activePhoneStatus;
  const search = (document.getElementById('phones-search-input')?.value || '').trim().toLowerCase();

  let filtered = allPhones;
  if (activeBrand !== 'all') {
    filtered = filtered.filter(p => (p.brand || '').toLowerCase() === activeBrand.toLowerCase());
  }
  if (activeStatus !== 'all') {
    filtered = filtered.filter(p => p.status === activeStatus);
  }
  if (search) {
    filtered = filtered.filter(p => 
      (p.imei || '').toLowerCase().includes(search) ||
      (p.barcode || '').toLowerCase().includes(search) ||
      (p.name || '').toLowerCase().includes(search) ||
      (p.model || '').toLowerCase().includes(search) ||
      (p.brand || '').toLowerCase().includes(search)
    );
  }

  const tbody = document.getElementById('phones-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-16 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
              <span class="material-symbols-outlined text-[40px] opacity-30">smartphone</span>
              <span class="font-headline-sm text-headline-sm font-bold text-on-surface">لا توجد هواتف مسجلة بالمخزن</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">أضف هواتف جديدة مسجلة برقم السيريال أو الـ IMEI وسعر التكلفة والبيع.</span>
              <button onclick="window.openAddProductModal('phones')" class="mt-2 bg-secondary text-white px-5 py-2 rounded-xl font-headline-sm text-headline-sm shadow-md hover:bg-secondary/90 transition-all cursor-pointer">
                + إضافة هاتف جديد (IMEI)
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(phone => {
        const isAvail = phone.status === 'available';
        return `
          <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors">
            <td class="py-3.5 px-4 font-numeric-table font-bold text-secondary text-base">
              <span class="cursor-pointer hover:underline" onclick="window.addItemToCartFromBarcode('${phone.imei || phone.barcode}')">${phone.imei || phone.barcode || '-'}</span>
            </td>
            <td class="py-3.5 px-4 font-headline-sm font-bold text-on-surface text-base">
              ${phone.brand || ''} ${phone.model || phone.name}
            </td>
            <td class="py-3.5 px-4 font-label-md text-on-surface-variant">
              ${phone.storage || '-'} / ${phone.color || '-'}
            </td>
            <td class="py-3.5 px-4 font-numeric-table text-on-surface text-base">${formatMoney(phone.buyPrice)} ج.م</td>
            <td class="py-3.5 px-4 font-numeric-table font-bold text-emerald-400 text-lg">${formatMoney(phone.sellPrice)} ج.م</td>
            <td class="py-3.5 px-4">
              <span class="px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                isAvail ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-surface-container text-on-surface-variant border border-outline-variant/30'
              }">
                <span class="w-2 h-2 rounded-full ${isAvail ? 'bg-emerald-400 animate-pulse' : 'bg-outline'}"></span>
                ${isAvail ? 'متوفر بالمحل' : 'تم البيع'}
              </span>
            </td>
            <td class="py-3.5 px-4 font-label-sm text-on-surface-variant">
              ${!isAvail && phone.customerName ? `${phone.customerName} (${phone.customerPhone || ''})` : '-'}
            </td>
            <td class="py-3.5 px-4 text-center">
              <div class="flex items-center justify-center gap-1.5">
                ${isAvail ? `
                  <button onclick="window.addItemToCartFromBarcode('${phone.imei || phone.barcode}')" class="p-1.5 rounded-lg bg-secondary/15 hover:bg-secondary text-secondary hover:text-white transition-colors" title="إضافة للفاتورة (بيع)">
                    <span class="material-symbols-outlined text-[18px]">shopping_cart</span>
                  </button>
                ` : ''}
                <button onclick="window.openEditProductModal('${phone.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" title="تعديل">
                  <span class="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button onclick="window.confirmDeleteProduct('${phone.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 transition-colors" title="حذف">
                  <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

// ==========================================
// VIEW 5: HEADPHONES & AUDIO PAGE
// ==========================================

function renderHeadphonesPage() {
  const allHeadphones = Store.products.filter(p => p.category === 'headphones');
  const totalCount = allHeadphones.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const totalCost = allHeadphones.reduce((acc, p) => acc + ((p.buyPrice || 0) * (p.quantity || 0)), 0);
  
  setElemText('headphones-total-count', totalCount);
  setElemText('headphones-total-cost', formatMoney(totalCost));

  const subcounts = {
    silicone: allHeadphones.filter(p => p.subcategory === 'silicone').length,
    classic: allHeadphones.filter(p => p.subcategory === 'classic').length,
    bluetooth: allHeadphones.filter(p => p.subcategory === 'bluetooth').length
  };
  setElemText('badge-headphones-silicone', subcounts.silicone);
  setElemText('badge-headphones-classic', subcounts.classic);
  setElemText('badge-headphones-bluetooth', subcounts.bluetooth);
  setElemText('badge-headphones-all', allHeadphones.length);

  const activeTab = AppState.activeHeadphoneTab;
  const search = (document.getElementById('headphones-search-input')?.value || '').trim().toLowerCase();

  let filtered = allHeadphones;
  if (activeTab !== 'all') {
    filtered = filtered.filter(p => p.subcategory === activeTab);
  }
  if (search) {
    filtered = filtered.filter(p => 
      (p.name || '').toLowerCase().includes(search) || 
      (p.barcode || '').toLowerCase().includes(search)
    );
  }

  const tbody = document.getElementById('headphones-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-16 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
              <span class="material-symbols-outlined text-[40px] opacity-30">headphones</span>
              <span class="font-headline-sm text-headline-sm font-bold text-on-surface">لا توجد سماعات مسجلة في هذا القسم</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">قم بمسح الباركود أو الضغط على زر الإضافة لتسجيل سماعات جديدة.</span>
              <button onclick="window.openAddProductModal('headphones', '${activeTab !== 'all' ? activeTab : 'silicone'}')" class="mt-2 bg-secondary text-white px-5 py-2 rounded-xl font-headline-sm text-headline-sm shadow-md hover:bg-secondary/90 transition-all cursor-pointer">
                + إضافة سماعة جديدة
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors">
          <td class="py-3.5 px-4 font-numeric-table font-bold text-secondary text-base">
            <span class="cursor-pointer hover:underline" onclick="window.addItemToCartFromBarcode('${item.barcode}')">${item.barcode || 'بدون باركود'}</span>
          </td>
          <td class="py-3.5 px-4 font-headline-sm font-bold text-on-surface text-base">${item.name}</td>
          <td class="py-3.5 px-4">
            <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-surface-container text-on-surface-variant border border-outline-variant/30">
              ${getHeadphoneSubcategoryLabel(item.subcategory)}
            </span>
          </td>
          <td class="py-3.5 px-4 font-numeric-table text-on-surface text-base">${formatMoney(item.buyPrice)} ج.م</td>
          <td class="py-3.5 px-4 font-numeric-table font-bold text-emerald-400 text-lg">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-2">
              <span class="font-numeric-table font-bold text-lg ${item.quantity <= 2 ? 'text-rose-400' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-on-surface border border-outline-variant/30" title="زيادة +1">+</button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-on-surface border border-outline-variant/30" title="إنقاص -1">-</button>
            </div>
          </td>
          <td class="py-3.5 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" title="تعديل">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 transition-colors" title="حذف">
                <span class="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }
}

function getHeadphoneSubcategoryLabel(sub) {
  switch (sub) {
    case 'silicone': return 'سماعة جلدة (In-Ear)';
    case 'classic': return 'سماعة عضم (Classic)';
    case 'bluetooth': return 'سماعة بلوتوث (Wireless)';
    default: return 'سماعة';
  }
}

// ==========================================
// VIEW 6: SPEAKERS & SOUND PAGE
// ==========================================

function renderSpeakersPage() {
  const allSpeakers = Store.products.filter(p => p.category === 'speakers');
  const totalCount = allSpeakers.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const totalCost = allSpeakers.reduce((acc, p) => acc + ((p.buyPrice || 0) * (p.quantity || 0)), 0);

  setElemText('kpiTotalCount', totalCount);
  setElemText('kpiTotalCost', formatMoney(totalCost));

  const subcounts = {
    small: allSpeakers.filter(p => p.subcategory === 'small').length,
    medium: allSpeakers.filter(p => p.subcategory === 'medium').length,
    large: allSpeakers.filter(p => p.subcategory === 'large').length
  };
  setElemText('badgeSmallCount', subcounts.small);
  setElemText('badgeMediumCount', subcounts.medium);
  setElemText('badgeLargeCount', subcounts.large);
  setElemText('badgeAllSpeakersCount', allSpeakers.length);

  const activeTab = AppState.activeSpeakerTab;
  const search = (document.getElementById('barcodeScannerInput')?.value || '').trim().toLowerCase();

  let filtered = allSpeakers;
  if (activeTab !== 'all') {
    filtered = filtered.filter(p => p.subcategory === activeTab);
  }
  if (search) {
    filtered = filtered.filter(p => 
      (p.name || '').toLowerCase().includes(search) || 
      (p.barcode || '').toLowerCase().includes(search)
    );
  }

  const tbody = document.getElementById('speakersTableBody');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-16 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
              <span class="material-symbols-outlined text-[40px] opacity-30">speaker</span>
              <span class="font-headline-sm text-headline-sm font-bold text-on-surface">لا توجد صبات مسجلة في هذا الحجم</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">امسح باركود الصب أو اضغط F1 لإضافة صب جديد للمخزن.</span>
              <button onclick="window.openAddProductModal('speakers', '${activeTab !== 'all' ? activeTab : 'small'}')" class="mt-2 bg-secondary text-white px-5 py-2 rounded-xl font-headline-sm text-headline-sm shadow-md hover:bg-secondary/90 transition-all cursor-pointer">
                + إضافة صب جديد
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors">
          <td class="py-3.5 px-4 font-numeric-table font-bold text-secondary text-base">
            <span class="cursor-pointer hover:underline" onclick="window.addItemToCartFromBarcode('${item.barcode}')">${item.barcode || 'بدون باركود'}</span>
          </td>
          <td class="py-3.5 px-4 font-headline-sm font-bold text-on-surface text-base">${item.name}</td>
          <td class="py-3.5 px-4">
            <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-surface-container text-on-surface-variant border border-outline-variant/30">
              ${getSpeakerSubcategoryLabel(item.subcategory)}
            </span>
          </td>
          <td class="py-3.5 px-4 font-numeric-table text-on-surface text-base">${formatMoney(item.buyPrice)} ج.م</td>
          <td class="py-3.5 px-4 font-numeric-table font-bold text-emerald-400 text-lg">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-2">
              <span class="font-numeric-table font-bold text-lg ${item.quantity <= 2 ? 'text-rose-400' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-on-surface border border-outline-variant/30" title="زيادة +1">+</button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center font-bold text-on-surface border border-outline-variant/30" title="إنقاص -1">-</button>
            </div>
          </td>
          <td class="py-3.5 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" title="تعديل">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 transition-colors" title="حذف">
                <span class="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }
}

function getSpeakerSubcategoryLabel(sub) {
  switch (sub) {
    case 'small': return 'صب صغير';
    case 'medium': return 'صب وسط';
    case 'large': return 'صب كبير';
    default: return 'صب';
  }
}

window.setChargerTab = (tab) => {
  AppState.activeChargerTab = tab;
  document.querySelectorAll('.charger-tab-btn').forEach(b => {
    b.classList.remove('bg-secondary', 'text-white');
    b.classList.add('bg-surface-container-low', 'text-on-surface');
  });
  const activeBtn = document.querySelector(`.charger-tab-btn[data-charger-cat="${tab}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-surface-container-low', 'text-on-surface');
    activeBtn.classList.add('bg-secondary', 'text-white');
  }
  renderChargersPage();
};

window.setHeadphoneTab = (tab) => {
  AppState.activeHeadphoneTab = tab;
  document.querySelectorAll('.headphone-tab-btn').forEach(b => {
    b.classList.remove('bg-secondary', 'text-white');
    b.classList.add('bg-surface-container-low', 'text-on-surface');
  });
  const activeBtn = document.querySelector(`.headphone-tab-btn[data-headphone-cat="${tab}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-surface-container-low', 'text-on-surface');
    activeBtn.classList.add('bg-secondary', 'text-white');
  }
  renderHeadphonesPage();
};

window.setSpeakerTab = (tab) => {
  AppState.activeSpeakerTab = tab;
  document.querySelectorAll('.speaker-tab-btn').forEach(b => {
    b.classList.remove('bg-secondary', 'text-white');
    b.classList.add('bg-surface-container-low', 'text-on-surface');
  });
  const activeBtn = document.querySelector(`.speaker-tab-btn[data-speaker-cat="${tab}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-surface-container-low', 'text-on-surface');
    activeBtn.classList.add('bg-secondary', 'text-white');
  }
  renderSpeakersPage();
};

window.setPhoneBrandFilter = (brand) => {
  AppState.activePhoneBrand = brand;
  renderPhonesPage();
};

window.setPhoneStatusFilter = (status) => {
  AppState.activePhoneStatus = status;
  renderPhonesPage();
};

window.quickAdjustStock = async (id, delta) => {
  await adjustProductStock(id, delta);
  showToast(`تم تحديث رصيد الصنف (${delta > 0 ? '+1' : '-1'})`, 'inventory_2');
};

// ==========================================
// BARCODE SCANNER GLOBAL ENGINE
// ==========================================


// =========================================================================
// HARDWARE GUN & CAMERA BARCODE SCANNER SERVICE
// =========================================================================

let html5QrScannerInstance = null;
let currentTargetField = null;
let isTorchEnabled = false;
let scannerSoundEnabled = true;
let currentQuickIntakeProduct = null;

function playScanBeep(isSuccess = true) {
  if (!scannerSoundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (isSuccess) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.setValueAtTime(1900, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.16);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {}
}

window.toggleScannerSound = function() {
  scannerSoundEnabled = !scannerSoundEnabled;
  const btn = document.getElementById('btn-camera-sound');
  if (btn) {
    if (scannerSoundEnabled) {
      btn.className = "p-2 rounded-lg bg-surface-container text-emerald-400 hover:text-emerald-300 border border-outline-variant/30 text-xs flex items-center gap-1";
    } else {
      btn.className = "p-2 rounded-lg bg-surface-container text-slate-500 hover:text-slate-400 border border-outline-variant/30 text-xs flex items-center gap-1";
    }
  }
  showToast(scannerSoundEnabled ? 'تم تفعيل صوت المسح 🔔' : 'تم كتم صوت المسح 🔕', 'volume_up');
};

function setupBarcodeScannerListener() {
  let buffer = '';
  let lastKeyTime = Date.now();
  const SCANNER_INTERVAL_MS = 65; // max time between characters from a hardware gun

  window.addEventListener('keydown', (e) => {
    // F3 shortcut opens Camera Barcode Scanner
    if (e.key === 'F3') {
      e.preventDefault();
      window.openCameraScanner();
      return;
    }

    if (['F1', 'F2', 'F4', 'F7', 'F11', 'Escape'].includes(e.key)) {
      buffer = '';
      return;
    }

    const activeElem = document.activeElement;
    const isSpecificBarcodeInput = activeElem && (
      activeElem.id === 'barcodeScannerInput' || 
      activeElem.id === 'pos-barcode-search' || 
      activeElem.id === 'prod-barcode' || 
      activeElem.id === 'prod-phone-imei' ||
      activeElem.id === 'camera-manual-barcode-input'
    );

    const currentTime = Date.now();
    const timeDiff = currentTime - lastKeyTime;
    lastKeyTime = currentTime;

    if (e.key === 'Enter') {
      const trimmed = buffer.trim();
      if (trimmed.length >= 3) {
        buffer = '';
        e.preventDefault();
        handleScannedBarcode(trimmed);
        return;
      }
      buffer = '';
      return;
    }

    if (e.key.length === 1) {
      // If typing slowly (human) outside a barcode input, reset buffer
      if (!isSpecificBarcodeInput && timeDiff > SCANNER_INTERVAL_MS && buffer.length > 0) {
        buffer = e.key;
      } else {
        buffer += e.key;
      }
    }
  }, true);

  const bindEnterToBarcode = (inputId) => {
    const el = document.getElementById(inputId);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = el.value.trim();
          if (val) {
            e.preventDefault();
            handleScannedBarcode(val);
            el.value = '';
          }
        }
      });
    }
  };

  bindEnterToBarcode('barcodeScannerInput');
  bindEnterToBarcode('pos-barcode-search');
  bindEnterToBarcode('chargers-search-input');
  bindEnterToBarcode('headphones-search-input');
  bindEnterToBarcode('phones-search-input');
  bindEnterToBarcode('speakers-search-input');
}

export function handleScannedBarcode(barcode, targetField = null) {
  if (!barcode) return;
  const cleanCode = barcode.trim();
  if (cleanCode.length < 2) return;

  console.log(`🔍 Barcode received: ${cleanCode}`);
  playScanBeep(true);

  // 1. If Add Product modal is currently open or targeted
  const prodFormModal = document.getElementById('modal-product-form');
  const isProdFormOpen = prodFormModal && !prodFormModal.classList.contains('hidden');
  if (targetField === 'prod-barcode' || isProdFormOpen) {
    const barInput = document.getElementById('prod-barcode');
    if (barInput) {
      barInput.value = cleanCode;
      barInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const cat = document.getElementById('prod-category')?.value;
    if (cat === 'phones') {
      const imeiInput = document.getElementById('prod-phone-imei');
      if (imeiInput && !imeiInput.value) {
        imeiInput.value = cleanCode;
      }
    }
    showToast(`تم مسح الباركود بنجاح: ${cleanCode}`, 'barcode_scanner');
    document.getElementById('prod-name')?.focus();
    return;
  }

  // 2. If Quick POS (F2) is currently open
  const posModal = document.getElementById('modal-quick-pos');
  const isPOSOpen = posModal && !posModal.classList.contains('hidden');
  if (isPOSOpen || targetField === 'pos') {
    const product = Store.products.find(p => 
      (p.barcode && p.barcode.trim().toLowerCase() === cleanCode.toLowerCase()) ||
      (p.imei && p.imei.trim().toLowerCase() === cleanCode.toLowerCase())
    );

    if (product) {
      if (product.category === 'phones' && product.status === 'sold') {
        playScanBeep(false);
        showToast(`الهاتف مباع مسبقاً (IMEI: ${cleanCode})`, 'error');
        return;
      }
      addItemToCart(product);
      showToast(`تمت إضافة [${product.name}] إلى الفاتورة بنجاح`, 'shopping_cart');
    } else {
      playScanBeep(false);
      showToast(`الباركود [${cleanCode}] غير مسجل بالمخزن. جاري فتح نموذج الإضافة...`, 'warning');
      window.openAddProductModal(getDefaultCategoryForCurrentView(), null, cleanCode);
    }
    return;
  }

  // 3. General Screen Scan: Look up product in Store
  const foundProd = Store.products.find(p => 
    (p.barcode && p.barcode.trim().toLowerCase() === cleanCode.toLowerCase()) ||
    (p.imei && p.imei.trim().toLowerCase() === cleanCode.toLowerCase())
  );

  if (foundProd) {
    // Existing product -> Open Quick Intake & Action Modal
    window.openQuickIntakeModal(foundProd);
  } else {
    // New product -> Open Add Product form with pre-filled barcode
    showToast(`باركود جديد [${cleanCode}]! جاري فتح نافذة الإضافة وتعبئة الباركود تلقائياً`, 'add_circle');
    window.openAddProductModal(getDefaultCategoryForCurrentView(), null, cleanCode);
  }
}

function getDefaultCategoryForCurrentView() {
  switch (AppState.currentView) {
    case 'chargers-cables': return 'chargers';
    case 'phones-sales-inventory': return 'phones';
    case 'headphones-audio': return 'headphones';
    case 'speakers-sound': return 'speakers';
    default: return 'chargers';
  }
}

// =========================================================================
// CAMERA BARCODE SCANNER (Html5Qrcode)
// =========================================================================

window.openCameraScanner = async function(targetField = null) {
  currentTargetField = targetField;
  const modal = document.getElementById('modal-camera-barcode');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  if (typeof Html5Qrcode === 'undefined') {
    showToast('جاري تحميل مكتبة الكاميرا...', 'info');
    return;
  }

  const viewportEl = document.getElementById('camera-scanner-viewport');
  if (!viewportEl) return;

  try {
    if (html5QrScannerInstance) {
      try {
        await html5QrScannerInstance.stop();
      } catch (e) {}
      html5QrScannerInstance = null;
    }

    html5QrScannerInstance = new Html5Qrcode("camera-scanner-viewport");

    // Enumerate cameras
    try {
      const devices = await Html5Qrcode.getCameras();
      const dropdown = document.getElementById('camera-select-dropdown');
      if (dropdown && devices && devices.length > 0) {
        dropdown.innerHTML = devices.map((d, idx) => `
          <option value="${d.id}">${d.label || `كاميرا ${idx + 1}`}</option>
        `).join('');
      }
    } catch (e) {}

    const config = {
      fps: 15,
      qrbox: { width: 260, height: 160 },
      aspectRatio: 1.333333
    };

    // Start with environment (rear camera) or default camera
    const cameraConfig = { facingMode: "environment" };

    await html5QrScannerInstance.start(
      cameraConfig,
      config,
      (decodedText) => {
        console.log(`📷 [Camera Scan Hit]: ${decodedText}`);
        playScanBeep(true);
        if (navigator.vibrate) navigator.vibrate(100);
        window.closeCameraScanner();
        handleScannedBarcode(decodedText, currentTargetField);
      },
      () => {}
    );

  } catch (err) {
    console.error('Camera init error:', err);
    // If environment camera failed, try with any available camera
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        await html5QrScannerInstance.start(
          devices[0].id,
          { fps: 15, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            playScanBeep(true);
            window.closeCameraScanner();
            handleScannedBarcode(decodedText, currentTargetField);
          },
          () => {}
        );
        return;
      }
    } catch (e) {}
    showToast(`تعذر فتح الكاميرا: ${err.message || 'يرجى السماح بصلاحية الكاميرا في المتصفح'}`, 'error');
  }
};

window.closeCameraScanner = async function() {
  if (html5QrScannerInstance) {
    try {
      await html5QrScannerInstance.stop();
    } catch (e) {}
    html5QrScannerInstance = null;
  }
  const modal = document.getElementById('modal-camera-barcode');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.switchCamera = async function(cameraId) {
  if (!cameraId || !html5QrScannerInstance) return;
  try {
    await html5QrScannerInstance.stop();
    const config = { fps: 15, qrbox: { width: 260, height: 160 } };
    await html5QrScannerInstance.start(
      cameraId,
      config,
      (decodedText) => {
        playScanBeep(true);
        window.closeCameraScanner();
        handleScannedBarcode(decodedText, currentTargetField);
      },
      () => {}
    );
  } catch (e) {
    console.error('Switch camera error:', e);
  }
};

window.toggleCameraTorch = async function() {
  if (!html5QrScannerInstance) return;
  try {
    isTorchEnabled = !isTorchEnabled;
    await html5QrScannerInstance.applyVideoConstraints({
      advanced: [{ torch: isTorchEnabled }]
    });
    showToast(isTorchEnabled ? 'تم تشغيل الفلاش 💡' : 'تم إيقاف الفلاش', 'flash_on');
  } catch (e) {
    showToast('جهاز الكاميرا لا يدعم الفلاش', 'warning');
  }
};

window.submitManualCameraBarcode = function() {
  const input = document.getElementById('camera-manual-barcode-input');
  if (input && input.value.trim()) {
    const code = input.value.trim();
    input.value = '';
    window.closeCameraScanner();
    handleScannedBarcode(code, currentTargetField);
  }
};

// =========================================================================
// PRODUCT QUICK INTAKE & ACTION MODAL
// =========================================================================

window.openQuickIntakeModal = function(product) {
  currentQuickIntakeProduct = product;
  const modal = document.getElementById('modal-quick-intake');
  if (!modal) return;

  setElemText('quick-intake-badge', getCategoryArabicName(product.category));
  setElemText('quick-intake-barcode', product.barcode || product.imei || '-');
  setElemText('quick-intake-name', product.name || 'بدون اسم');
  setElemText('quick-intake-buy-price', `${formatMoney(product.buyPrice || 0)} ج.م`);
  setElemText('quick-intake-sell-price', `${formatMoney(product.sellPrice || 0)} ج.م`);
  setElemText('quick-intake-stock', `${product.quantity || 0} قطع بالمخزن`);
  setElemValue('quick-intake-prod-id', product.id);

  modal.classList.remove('hidden');
  modal.classList.add('flex');
};

window.closeQuickIntakeModal = function() {
  currentQuickIntakeProduct = null;
  const modal = document.getElementById('modal-quick-intake');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.quickAdjustStock = async function(delta) {
  if (!currentQuickIntakeProduct) return;
  const prodId = currentQuickIntakeProduct.id;
  const currentQty = parseInt(currentQuickIntakeProduct.quantity) || 0;
  const newQty = currentQty + delta;

  try {
    await adjustProductStock(prodId, delta);
    showToast(`تم توريد +${delta} حبات إلى المخزن! الرصيد الجديد: ${newQty}`, 'check_circle');
    window.closeQuickIntakeModal();
  } catch (e) {
    showToast('حدث خطأ أثناء تعديل المخزون', 'error');
  }
};

window.quickIntakeSellInPOS = function() {
  if (!currentQuickIntakeProduct) return;
  const prod = currentQuickIntakeProduct;
  window.closeQuickIntakeModal();
  window.triggerQuickPOS();
  addItemToCart(prod);
};

window.quickIntakeEditProduct = function() {
  if (!currentQuickIntakeProduct) return;
  const prod = currentQuickIntakeProduct;
  window.closeQuickIntakeModal();
  window.openEditProductModal(prod.id);
};

// ==========================================
// LAPTOP QUICK POS MODAL & SPLIT REGISTER (F2)
// ==========================================

function setupQuickPOS() {
  window.triggerQuickPOS = () => {
    const modal = document.getElementById('modal-quick-pos');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      setTimeout(() => {
        document.getElementById('pos-barcode-search')?.focus();
      }, 100);
      renderPOSCart();
      renderPOSCatalog(AppState.posCatalogCategory, AppState.posCatalogSearch);
    }
  };

  window.closeQuickPOS = () => {
    const modal = document.getElementById('modal-quick-pos');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  window.addItemToCartFromBarcode = (barcode) => {
    if (!barcode) return;
    const prod = Store.products.find(p => p.barcode === barcode || p.imei === barcode);
    if (prod) {
      window.triggerQuickPOS();
      addItemToCart(prod);
    }
  };

  const posSearch = document.getElementById('pos-barcode-search');
  if (posSearch) {
    posSearch.addEventListener('input', (e) => {
      AppState.posCatalogSearch = e.target.value.trim().toLowerCase();
      renderPOSCatalog(AppState.posCatalogCategory, AppState.posCatalogSearch);
    });
  }

  const discountInput = document.getElementById('pos-discount-input');
  if (discountInput) {
    discountInput.addEventListener('input', (e) => {
      AppState.cartDiscount = parseFloat(e.target.value) || 0;
      renderPOSCart();
    });
  }

  const cashPaidInput = document.getElementById('pos-cash-paid');
  if (cashPaidInput) {
    cashPaidInput.addEventListener('input', () => {
      calculatePOSChange();
    });
  }

  const btnCheckout = document.getElementById('pos-btn-checkout');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', () => {
      executePOSCheckout();
    });
  }

  window.setPOSCatalogCategory = (cat) => {
    AppState.posCatalogCategory = cat;
    document.querySelectorAll('.pos-cat-pill').forEach(b => {
      b.classList.remove('bg-secondary', 'text-white');
      b.classList.add('bg-surface-container', 'text-on-surface');
    });
    const active = document.querySelector(`.pos-cat-pill[data-cat="${cat}"]`);
    if (active) {
      active.classList.remove('bg-surface-container', 'text-on-surface');
      active.classList.add('bg-secondary', 'text-white');
    }
    renderPOSCatalog(cat, AppState.posCatalogSearch);
  };
}

// Render Widescreen Catalog on Laptop POS Right Panel
function renderPOSCatalog(category = 'all', searchQuery = '') {
  const container = document.getElementById('pos-catalog-grid');
  if (!container) return;

  let items = Store.products;
  if (category !== 'all') {
    items = items.filter(p => p.category === category);
  }
  if (searchQuery) {
    items = items.filter(p => 
      (p.name || '').toLowerCase().includes(searchQuery) ||
      (p.barcode || '').toLowerCase().includes(searchQuery) ||
      (p.imei || '').toLowerCase().includes(searchQuery) ||
      (p.model || '').toLowerCase().includes(searchQuery)
    );
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-on-surface-variant flex flex-col items-center justify-center gap-2">
        <span class="material-symbols-outlined text-[40px] opacity-30">inventory_2</span>
        <span class="font-headline-sm text-headline-sm font-bold">لا توجد منتجات مطابقة في المخزن</span>
        <span class="font-body-sm text-body-sm">اضغط F1 لإضافة صنف جديد فوراً</span>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(p => {
    const isAvail = p.category !== 'phones' ? (p.quantity > 0) : (p.status === 'available');
    return `
      <div 
        onclick="window.posSelectProduct('${p.id}')"
        class="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low hover:bg-surface-container-high hover:border-secondary cursor-pointer transition-all flex flex-col justify-between group active:scale-98 shadow-sm">
        <div>
          <div class="flex items-center justify-between text-xs text-on-surface-variant mb-1 font-numeric-table">
            <span class="bg-surface-container px-1.5 py-0.5 rounded text-[11px] font-bold">${getCategoryArabicName(p.category)}</span>
            <span class="${isAvail ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}">
              ${p.category === 'phones' ? (isAvail ? 'متوفر' : 'مباع') : `متاح: ${p.quantity}`}
            </span>
          </div>
          <h4 class="font-headline-sm font-bold text-on-surface text-sm line-clamp-2">${p.name}</h4>
        </div>
        <div class="mt-2.5 pt-2 border-t border-outline-variant/20 flex items-center justify-between">
          <span class="font-numeric-table text-emerald-400 font-bold text-base">${formatMoney(p.sellPrice)} ج.م</span>
          <span class="material-symbols-outlined text-secondary opacity-0 group-hover:opacity-100 text-lg transition-opacity">add_shopping_cart</span>
        </div>
      </div>
    `;
  }).join('');
}

function getCategoryArabicName(cat) {
  switch (cat) {
    case 'chargers': return 'شواحن';
    case 'phones': return 'هواتف';
    case 'headphones': return 'سماعات';
    case 'speakers': return 'صبات';
    default: return 'صنف';
  }
}

function addItemToCart(product) {
  if (product.category === 'phones' && product.status !== 'available') {
    showToast("عفواً هذا الهاتف تم بيعه بالفعل!", "warning");
    return;
  }

  const existingIdx = AppState.cart.findIndex(i => i.id === product.id);
  if (existingIdx !== -1) {
    if (product.category === 'phones') {
      showToast("هذا الهاتف مسجل برقم IMEI فريد وموجود بالفعل بالسلة", "warning");
      return;
    }
    if (AppState.cart[existingIdx].quantity >= product.quantity) {
      showToast(`الكمية المطلوبة تتجاوز المخزون المتوفر (${product.quantity})`, "warning");
      return;
    }
    AppState.cart[existingIdx].quantity += 1;
  } else {
    if (product.quantity <= 0 && product.category !== 'phones') {
      showToast("تنبيه: هذا الصنف نفذ من المخزون ولكن تم إضافته بالسلة", "warning");
    }
    AppState.cart.push({
      id: product.id,
      name: product.name,
      barcode: product.barcode || product.imei || '',
      category: product.category,
      price: product.sellPrice || 0,
      quantity: 1,
      maxQty: product.quantity || 999
    });
  }

  renderPOSCart();
  const posSearch = document.getElementById('pos-barcode-search');
  if (posSearch && posSearch.value) {
    posSearch.value = '';
    AppState.posCatalogSearch = '';
    renderPOSCatalog(AppState.posCatalogCategory, '');
  }
}

window.adjustCartQty = (id, delta) => {
  const item = AppState.cart.find(i => i.id === id);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    window.removeCartItem(id);
    return;
  }
  if (item.category === 'phones' && newQty > 1) {
    showToast("الهاتف يحتوي على IMEI فردي واحد فقط", "warning");
    return;
  }
  item.quantity = newQty;
  renderPOSCart();
};

window.removeCartItem = (id) => {
  AppState.cart = AppState.cart.filter(i => i.id !== id);
  renderPOSCart();
};

function renderPOSCart() {
  const container = document.getElementById('pos-cart-items');
  const countBadge = document.getElementById('pos-cart-count');
  if (countBadge) countBadge.innerText = `${AppState.cart.length} أصناف في الفاتورة`;

  if (!container) return;

  if (AppState.cart.length === 0) {
    container.innerHTML = `
      <div class="h-64 flex flex-col items-center justify-center text-on-surface-variant gap-2 text-center">
        <span class="material-symbols-outlined text-[48px] opacity-30">shopping_cart</span>
        <span class="font-headline-sm text-headline-sm font-bold">فاتورة العميل فارغة</span>
        <span class="font-body-sm text-body-sm">امسح باركود الصنف أو اختر من القائمة على اليمين</span>
      </div>
    `;
    setElemText('pos-subtotal', '0.00 ج.م');
    setElemText('pos-total', '0.00 ج.م');
    setElemValue('pos-cash-paid', '');
    setElemText('pos-change', '0.00 ج.م');
    return;
  }

  let subtotal = 0;
  container.innerHTML = AppState.cart.map(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    return `
      <div class="flex items-center justify-between p-3 bg-surface-container-low rounded-xl border border-outline-variant/30">
        <div class="flex flex-col flex-1">
          <span class="font-headline-sm font-bold text-on-surface text-base">${item.name}</span>
          <div class="flex items-center gap-2 mt-0.5 text-on-surface-variant font-numeric-table text-xs">
            <span>${formatMoney(item.price)} ج.م</span>
            <span>×</span>
            <span>${item.quantity}</span>
            <span>=</span>
            <span class="text-secondary font-bold text-sm">${formatMoney(itemTotal)} ج.م</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center bg-surface-container rounded-lg border border-outline-variant/40">
            <button onclick="window.adjustCartQty('${item.id}', -1)" class="w-7 h-7 flex items-center justify-center font-bold text-on-surface hover:bg-surface-container-high rounded-r-lg">-</button>
            <span class="w-8 text-center font-numeric-table font-bold text-sm">${item.quantity}</span>
            <button onclick="window.adjustCartQty('${item.id}', 1)" class="w-7 h-7 flex items-center justify-center font-bold text-on-surface hover:bg-surface-container-high rounded-l-lg">+</button>
          </div>
          <button onclick="window.removeCartItem('${item.id}')" class="text-rose-400 hover:bg-rose-500/20 p-1.5 rounded-lg transition-colors" title="حذف من الفاتورة">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  const discount = AppState.cartDiscount || 0;
  const total = Math.max(0, subtotal - discount);

  setElemText('pos-subtotal', `${formatMoney(subtotal)} ج.م`);
  setElemText('pos-total', `${formatMoney(total)} ج.م`);

  const cashInput = document.getElementById('pos-cash-paid');
  if (cashInput && (!cashInput.value || parseFloat(cashInput.value) === 0)) {
    cashInput.value = total > 0 ? total : '';
  }
  calculatePOSChange();
}

function calculatePOSChange() {
  const totalStr = document.getElementById('pos-total')?.innerText.replace(' ج.م', '').replace(/,/g, '') || '0';
  const total = parseFloat(totalStr) || 0;
  const paid = parseFloat(document.getElementById('pos-cash-paid')?.value) || 0;
  const change = Math.max(0, paid - total);
  setElemText('pos-change', `${formatMoney(change)} ج.م`);
}

window.posSelectProduct = (id) => {
  const p = Store.products.find(item => item.id === id);
  if (p) {
    addItemToCart(p);
  }
};

async function executePOSCheckout() {
  if (AppState.cart.length === 0) {
    showToast("سلة المبيعات فارغة!", "warning");
    return;
  }

  const subtotal = AppState.cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const discount = AppState.cartDiscount || 0;
  const totalAmount = Math.max(0, subtotal - discount);
  const cashPaid = parseFloat(document.getElementById('pos-cash-paid')?.value) || totalAmount;
  const change = Math.max(0, cashPaid - totalAmount);
  const customerName = document.getElementById('pos-cust-name')?.value || 'عميل نقدي';
  const customerPhone = document.getElementById('pos-cust-phone')?.value || '';

  try {
    const invoice = await checkoutSale({
      items: AppState.cart,
      subtotal,
      discount,
      totalAmount,
      cashPaid,
      change,
      customerName,
      customerPhone,
      cashier: 'أحمد الكاشير'
    });

    AppState.cart = [];
    AppState.cartDiscount = 0;
    if (document.getElementById('pos-discount-input')) document.getElementById('pos-discount-input').value = '0';
    if (document.getElementById('pos-cust-name')) document.getElementById('pos-cust-name').value = '';
    if (document.getElementById('pos-cust-phone')) document.getElementById('pos-cust-phone').value = '';

    window.closeQuickPOS();
    showToast(`تم حفظ الفاتورة بنجاح رقم ${invoice.invoiceNumber} وخصم المخزون`, 'verified');

    window.printInvoiceReceipt(invoice.id);

  } catch (err) {
    showToast(`فشل إتمام البيع: ${err.message}`, 'error');
  }
}

// ==========================================
// PROFESSIONAL POS INVOICE & RECEIPT PRINTING
// ==========================================

AppState.activePrintingInvoiceId = null;
AppState.activePrintFormat = '80mm';

function generateReceiptHTML(invoice, format = '80mm') {
  const isA4 = format === 'a4';
  const widthStyle = isA4 ? 'max-w-3xl mx-auto p-8' : 'w-[80mm] mx-auto p-4';
  const fontSize = isA4 ? 'text-sm' : 'text-xs';

  const itemsRows = (invoice.items || []).map((item, idx) => `
    <tr class="border-b border-gray-200">
      <td class="py-1.5 text-right font-medium">
        <div>${item.name || 'صنف'}</div>
        ${item.barcode ? `<div class="text-[10px] text-gray-500 font-mono">${item.barcode}</div>` : ''}
      </td>
      <td class="py-1.5 text-center font-mono font-bold">${item.quantity || 1}</td>
      <td class="py-1.5 text-center font-mono">${formatMoney(item.price || 0)}</td>
      <td class="py-1.5 text-left font-mono font-bold">${formatMoney(item.total || (item.price * item.quantity))}</td>
    </tr>
  `).join('');

  return `
    <div id="thermal-receipt-printable" class="${widthStyle} bg-white text-black font-sans leading-relaxed select-text" style="direction: rtl;">
      
      <!-- Store Header -->
      <div class="text-center pb-3 border-b-2 border-dashed border-gray-400">
        <div class="inline-block p-1 bg-black text-white rounded-lg mb-1 font-bold text-xs">HELMY POS</div>
        <h2 class="${isA4 ? 'text-2xl' : 'text-lg'} font-black tracking-tight">حلمي سنترال وموبايل</h2>
        <p class="text-[11px] text-gray-700 font-medium mt-0.5">للهواتف الذكية والإكسسوارات والشواحن وخدمات فودافون كاش</p>
        <p class="text-[10px] text-gray-600 mt-0.5">الفرع الرئيسي • هاتف المبيعات: 01000000000</p>
      </div>

      <!-- Invoice Meta Details -->
      <div class="py-2.5 border-b border-dashed border-gray-300 text-[11px] space-y-1">
        <div class="flex justify-between items-center">
          <span class="text-gray-600">رقم الفاتورة:</span>
          <span class="font-mono font-bold text-black">${invoice.invoiceNumber || 'INV-001'}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-600">التاريخ والوقت:</span>
          <span class="font-mono">${formatDate(invoice.timestamp)} - ${formatTime(invoice.timestamp)}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-600">اسم الكاشير:</span>
          <span class="font-medium">${invoice.cashier || 'أدمن الوردية • حلمي'}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-gray-600">العميل:</span>
          <span class="font-medium">${invoice.customerName || 'عميل نقدي'} ${invoice.customerPhone ? `(${invoice.customerPhone})` : ''}</span>
        </div>
      </div>

      <!-- Items Table -->
      <div class="py-2 border-b-2 border-dashed border-gray-400">
        <table class="w-full ${fontSize}">
          <thead>
            <tr class="border-b-2 border-black text-gray-800 text-[11px]">
              <th class="text-right py-1.5">الصنف</th>
              <th class="text-center py-1.5">الكمية</th>
              <th class="text-center py-1.5">السعر</th>
              <th class="text-left py-1.5">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
      </div>

      <!-- Financial Calculation Summary -->
      <div class="py-2.5 border-b-2 border-dashed border-gray-400 text-xs space-y-1">
        <div class="flex justify-between items-center text-gray-700">
          <span>المجموع الفرعي:</span>
          <span class="font-mono font-bold">${formatMoney(invoice.subtotal || invoice.totalAmount)} ج.م</span>
        </div>
        ${(invoice.discount || 0) > 0 ? `
          <div class="flex justify-between items-center text-red-600 font-bold">
            <span>الخصم المباشر:</span>
            <span class="font-mono">-${formatMoney(invoice.discount)} ج.م</span>
          </div>
        ` : ''}
        <div class="flex justify-between items-center py-1.5 border-t border-b border-black my-1 text-black font-black ${isA4 ? 'text-lg' : 'text-base'}">
          <span>صافي المطلوب:</span>
          <span class="font-mono">${formatMoney(invoice.totalAmount)} ج.م</span>
        </div>
        <div class="flex justify-between items-center text-gray-800 pt-0.5">
          <span>المبلغ المدفوع:</span>
          <span class="font-mono font-bold">${formatMoney(invoice.cashPaid || invoice.totalAmount)} ج.م</span>
        </div>
        <div class="flex justify-between items-center text-gray-800">
          <span>المتبقي للعميل (الباقي):</span>
          <span class="font-mono font-bold text-emerald-700">${formatMoney(invoice.change || 0)} ج.م</span>
        </div>
      </div>

      <!-- Barcode Visual Representation -->
      <div class="py-3 text-center border-b border-dashed border-gray-300">
        <div class="inline-block tracking-widest font-mono font-bold text-sm bg-gray-100 px-3 py-1 rounded border border-gray-300 mb-1">
          *${invoice.invoiceNumber || 'INV-001'}*
        </div>
        <div class="text-[9px] text-gray-500">امسح الكود بمسدس الباركود للاسترجاع السريع</div>
      </div>

      <!-- Policies & Thank you note -->
      <div class="pt-3 text-center text-[10px] text-gray-600 space-y-1">
        <p class="font-bold text-black">البضاعة المباعة ترد وتستبدل خلال 14 يوماً مع أصل الفاتورة</p>
        <p>القطع الإلكترونية والشواحن بضمان التجربة الفورية والاستبدال</p>
        <p class="pt-1 text-black font-medium">سعداء بخدمتكم دائماً في حلمي سنترال وموبايل 📱⚡</p>
        <div class="text-[8px] text-gray-400 pt-1">نظام حلمي كاشير سحابي • مدعوم بمزامنة لحظية</div>
      </div>

    </div>
  `;
}

window.printInvoiceReceipt = (invoiceId, format = '80mm') => {
  const invoice = Store.salesInvoices.find(inv => inv.id === invoiceId) || Store.salesInvoices[0];
  if (!invoice) {
    showToast('لم يتم العثور على الفاتورة', 'warning');
    return;
  }

  AppState.activePrintingInvoiceId = invoice.id;
  AppState.activePrintFormat = format;

  const modal = document.getElementById('modal-thermal-receipt');
  const container = document.getElementById('thermal-receipt-content');

  if (modal && container) {
    container.innerHTML = generateReceiptHTML(invoice, format);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.setReceiptFormat = (format) => {
  AppState.activePrintFormat = format;
  if (AppState.activePrintingInvoiceId) {
    window.printInvoiceReceipt(AppState.activePrintingInvoiceId, format);
  }
};

window.closeThermalReceiptModal = () => {
  const modal = document.getElementById('modal-thermal-receipt');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.executePrintReceipt = (format = null) => {
  const useFormat = format || AppState.activePrintFormat || '80mm';
  const invoice = Store.salesInvoices.find(inv => inv.id === AppState.activePrintingInvoiceId) || Store.salesInvoices[0];
  if (!invoice) return;

  const receiptHtml = generateReceiptHTML(invoice, useFormat);

  // Hidden isolated iframe for flawless direct POS printing
  let iframe = document.getElementById('pos-receipt-print-frame');
  if (iframe) iframe.remove();

  iframe = document.createElement('iframe');
  iframe.id = 'pos-receipt-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>فاتورة ${invoice.invoiceNumber || ''}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Readex+Pro:wght@400;600;700&display=swap" rel="stylesheet">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @page {
          size: ${useFormat === 'a4' ? 'A4 portrait' : '80mm auto'};
          margin: ${useFormat === 'a4' ? '12mm' : '2mm'};
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          margin: 0;
          padding: 0;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: 'Cairo', 'Readex Pro', sans-serif;
        }
      </style>
    </head>
    <body onload="window.focus(); window.print();">
      ${receiptHtml}
    </body>
    </html>
  `);
  doc.close();

  showToast('جاري إرسال الفاتورة إلى الطابعة...', 'print');
};


// ==========================================
// UNIVERSAL PRODUCT CRUD MODALS
// ==========================================

function setupProductModal() {
  const categorySelect = document.getElementById('prod-category');
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      updateProductModalFields(e.target.value);
    });
  }

  window.generateRandomBarcode = () => {
    const randomCode = '622' + Math.floor(100000000 + Math.random() * 900000000);
    setElemValue('prod-barcode', randomCode);
  };

  window.openAddProductModal = (category = 'chargers', subcategory = null, barcode = '') => {
    AppState.editingProductId = null;
    setElemText('modal-prod-title', '+ إضافة صنف جديد للمخزن');
    
    setElemValue('prod-id', '');
    setElemValue('prod-name', '');
    setElemValue('prod-barcode', barcode || '');
    setElemValue('prod-buy-price', '');
    setElemValue('prod-sell-price', '');
    setElemValue('prod-qty', '1');
    setElemValue('prod-category', category);
    
    updateProductModalFields(category);
    if (subcategory) {
      setElemValue('prod-subcategory', subcategory);
    }

    const modal = document.getElementById('modal-product-form');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      setTimeout(() => {
        if (!barcode) document.getElementById('prod-barcode')?.focus();
        else document.getElementById('prod-name')?.focus();
      }, 100);
    }
  };

  window.openEditProductModal = (id) => {
    const prod = Store.products.find(p => p.id === id);
    if (!prod) return;

    AppState.editingProductId = id;
    setElemText('modal-prod-title', 'تعديل بيانات الصنف');

    setElemValue('prod-id', prod.id);
    setElemValue('prod-name', prod.name || '');
    setElemValue('prod-barcode', prod.barcode || prod.imei || '');
    setElemValue('prod-buy-price', prod.buyPrice || 0);
    setElemValue('prod-sell-price', prod.sellPrice || 0);
    setElemValue('prod-qty', prod.quantity || 0);
    setElemValue('prod-category', prod.category || 'chargers');

    updateProductModalFields(prod.category || 'chargers');
    setElemValue('prod-subcategory', prod.subcategory || '');

    setElemValue('prod-phone-brand', prod.brand || '');
    setElemValue('prod-phone-model', prod.model || '');
    setElemValue('prod-phone-imei', prod.imei || '');
    setElemValue('prod-phone-storage', prod.storage || '');
    setElemValue('prod-phone-color', prod.color || '');

    const modal = document.getElementById('modal-product-form');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeProductModal = () => {
    const modal = document.getElementById('modal-product-form');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  window.saveProductForm = async () => {
    const category = document.getElementById('prod-category')?.value || 'chargers';
    const name = document.getElementById('prod-name')?.value || '';
    const barcode = document.getElementById('prod-barcode')?.value || '';
    const buyPrice = parseFloat(document.getElementById('prod-buy-price')?.value) || 0;
    const sellPrice = parseFloat(document.getElementById('prod-sell-price')?.value) || 0;
    const quantity = parseInt(document.getElementById('prod-qty')?.value, 10) || 0;
    const subcategory = document.getElementById('prod-subcategory')?.value || '';

    if (!name.trim()) {
      showToast("يرجى إدخال اسم الصنف", "warning");
      document.getElementById('prod-name')?.focus();
      return;
    }

    const productData = {
      name,
      barcode,
      category,
      subcategory,
      buyPrice,
      sellPrice,
      quantity
    };

    if (category === 'phones') {
      productData.brand = document.getElementById('prod-phone-brand')?.value || '';
      productData.model = document.getElementById('prod-phone-model')?.value || name;
      productData.imei = document.getElementById('prod-phone-imei')?.value || barcode;
      productData.storage = document.getElementById('prod-phone-storage')?.value || '';
      productData.color = document.getElementById('prod-phone-color')?.value || '';
      productData.status = 'available';
    }

    try {
      if (AppState.editingProductId) {
        await updateProduct(AppState.editingProductId, productData);
        showToast("تم تحديث بيانات الصنف بنجاح ومزامنتها", "verified");
      } else {
        await addProduct(productData);
        showToast("تمت إضافة الصنف الجديد بنجاح إلى الفيربيز والمخزن", "verified");
      }
      closeProductModal();
    } catch (err) {
      showToast(`خطأ في الحفظ: ${err.message}`, "error");
    }
  };

  window.confirmDeleteProduct = (id) => {
    const prod = Store.products.find(p => p.id === id);
    if (!prod) return;

    AppState.deleteTarget = {
      type: 'product',
      id: prod.id,
      title: 'تأكيد حذف الصنف من المخزن',
      message: `هل أنت متأكد من حذف الصنف [${prod.name}] نهائياً؟`
    };
    openDeleteConfirmModal();
  };
}

function updateProductModalFields(category) {
  const subcatSelect = document.getElementById('prod-subcategory');
  const phoneFields = document.getElementById('prod-phone-specific-fields');
  const subcatContainer = document.getElementById('prod-subcategory-container');

  if (category === 'phones') {
    if (phoneFields) phoneFields.classList.remove('hidden');
    if (subcatContainer) subcatContainer.classList.add('hidden');
  } else {
    if (phoneFields) phoneFields.classList.add('hidden');
    if (subcatContainer) subcatContainer.classList.remove('hidden');

    if (subcatSelect) {
      if (category === 'chargers') {
        subcatSelect.innerHTML = `
          <option value="complete">شاحن كامل (Complete Charger)</option>
          <option value="adapter">رأس شاحن (Adapter/Head)</option>
          <option value="typec">وصلة شحن عريضة (Type-C)</option>
          <option value="microusb">وصلة شحن عادية (Micro-USB)</option>
          <option value="pin">وصلة شحن رفيعة (Pin/iPhone)</option>
        `;
      } else if (category === 'headphones') {
        subcatSelect.innerHTML = `
          <option value="silicone">سماعة جلدة (In-Ear)</option>
          <option value="classic">سماعة عضم (Classic)</option>
          <option value="bluetooth">سماعة بلوتوث (Bluetooth Wireless)</option>
        `;
      } else if (category === 'speakers') {
        subcatSelect.innerHTML = `
          <option value="small">صب صغير (Small Speaker)</option>
          <option value="medium">صب وسط (Medium Speaker)</option>
          <option value="large">صب كبير (Large Speaker)</option>
        `;
      }
    }
  }
}

// ==========================================
// UNIVERSAL DELETE CONFIRMATION MODAL
// ==========================================

function openDeleteConfirmModal() {
  const modal = document.getElementById('modal-delete-confirm');
  if (!modal || !AppState.deleteTarget) return;

  setElemText('delete-confirm-title', AppState.deleteTarget.title || 'تأكيد الحذف');
  setElemText('delete-confirm-message', AppState.deleteTarget.message || 'هل أنت متأكد؟');

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

window.closeDeleteConfirmModal = () => {
  const modal = document.getElementById('modal-delete-confirm');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  AppState.deleteTarget = null;
};

window.executeDeleteAction = async () => {
  if (!AppState.deleteTarget) return;
  const target = AppState.deleteTarget;
  closeDeleteConfirmModal();

  try {
    if (target.type === 'product') {
      await deleteProduct(target.id);
      showToast("تم حذف الصنف من المخزن بنجاح", "delete");
    } else if (target.type === 'vodafone_tx') {
      await deleteVodafoneTransaction(target.id);
      showToast("تم حذف المعاملة والتراجع عن أثرها المالي", "delete");
    } else if (target.type === 'vodafone_reset') {
      await resetVodafoneLine(target.id);
      showToast(`تمت إعادة تعيين بيانات خط فودافون كاش (${target.id}) بنجاح`, "refresh");
    }
  } catch (err) {
    showToast(`فشل الحذف: ${err.message}`, "error");
  }
};

// ==========================================
// CASH DRAWER & SHIFT MODALS
// ==========================================

function setupDrawerEvents() {
  window.openOpeningCashModal = () => {
    const modal = document.getElementById('modal-opening-cash');
    if (modal) {
      setElemValue('opening-cash-amount', Store.drawer ? (Store.drawer.openingCash || '') : '');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeOpeningCashModal = () => {
    const modal = document.getElementById('modal-opening-cash');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  window.saveOpeningCash = async () => {
    const amount = parseFloat(document.getElementById('opening-cash-amount')?.value) || 0;
    await recordCashDrawerEntry({
      type: 'set_opening',
      amount,
      reason: 'تحديد رصيد افتتاح الدرج'
    });
    closeOpeningCashModal();
    showToast(`تم اعتماد رصيد الافتتاح: ${formatMoney(amount)} ج.م`, 'check_circle');
  };

  window.openDrawerAdjustModal = (type = 'in') => {
    const modal = document.getElementById('modal-drawer-adjust');
    if (modal) {
      setElemValue('drawer-adjust-type', type);
      setElemText('drawer-adjust-title', type === 'in' ? 'إيداع نقدية في درج الكاشير (+)' : 'سحب نقدية من درج الكاشير (-)');
      setElemValue('drawer-adjust-amount', '');
      setElemValue('drawer-adjust-reason', '');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeDrawerAdjustModal = () => {
    const modal = document.getElementById('modal-drawer-adjust');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  window.saveDrawerAdjustment = async () => {
    const type = document.getElementById('drawer-adjust-type')?.value || 'in';
    const amount = parseFloat(document.getElementById('drawer-adjust-amount')?.value) || 0;
    const reason = document.getElementById('drawer-adjust-reason')?.value || (type === 'in' ? 'إيداع نقدي' : 'سحب نقدي');

    if (amount <= 0) {
      showToast("يرجى إدخال مبلغ صحيح", "warning");
      return;
    }

    await recordCashDrawerEntry({ type, amount, reason });
    closeDrawerAdjustModal();
    showToast(`تم تسجيل ${type === 'in' ? 'إيداع' : 'سحب'} ${formatMoney(amount)} ج.م بنجاح`, 'payments');
  };
}

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      window.openAddProductModal(getDefaultCategoryForCurrentView());
    } else if (e.key === 'F2') {
      e.preventDefault();
      window.triggerQuickPOS();
    } else if (e.key === 'F4') {
      e.preventDefault();
      navigateTo('vodafone-cash-wallets');
    } else if (e.key === 'F7') {
      e.preventDefault();
      window.openThemeModal();
    } else if (e.key === 'Escape') {
      window.closeQuickPOS();
      window.closeProductModal();
      window.closeDeleteConfirmModal();
      window.closeLineSettingsModal();
      window.closeEditVodafoneTxModal();
      window.closeThemeModal();
      window.closeThermalReceiptModal();
      window.closeOpeningCashModal();
      window.closeDrawerAdjustModal();
    }
  });
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

export function showToast(msg, icon = 'check_circle') {
  const toast = document.getElementById('action-toast');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');
  if (toast && toastMsg && toastIcon) {
    toastMsg.innerText = msg;
    toastIcon.innerText = icon;
    toast.classList.remove('hidden');
    toast.classList.add('flex');
    setTimeout(() => {
      toast.classList.add('hidden');
      toast.classList.remove('flex');
    }, 4000);
  }
}
window.showToast = showToast;

// ==========================================
// FORMATTING HELPERS
// ==========================================

function formatMoney(num) {
  return (parseFloat(num) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatCompactMoney(num) {
  const n = parseFloat(num) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toFixed(0);
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function setElemText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

function setElemValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

window.navigateTo = navigateTo;
window.formatMoney = formatMoney;

window.onCategoryChange = function() {
  const cat = document.getElementById('prod-category')?.value;
  if (cat && typeof updateProductModalFields === 'function') {
    updateProductModalFields(cat);
  }
};
