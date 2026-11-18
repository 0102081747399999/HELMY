// app.js - Main Application Logic for سنترال حلمي (Central Hilmy POS & Telecom Hub)
// Fully disabled native print dialogs per user request
if (typeof window !== 'undefined') {
  window.print = function() {
    console.warn('[Print Blocked] تم إلغاء مربع حوار الطباعة نهائياً بناءً على طلبك.');
  };
}

import { 
  Store, 
  subscribeToStore, 
  initRealtimeSync,
  addProduct,
  updateProduct,
  deleteProduct,
  adjustProductStock,
  recordDirectCategorySale,
  recordDirectCategoryRestock,
  parseCashSMS,
  processIncomingSMS,
  updateVodafoneLineSettings,
  recordVodafoneTransaction,
  updateVodafoneTransaction,
  deleteVodafoneTransaction,
  resetVodafoneLine,
  resetAllVodafoneLines,
  deleteSMS,
  clearAllSMS,
  getDeletedSMSBlacklist,
  getDeletedVodaTxsBlacklist,
  checkoutSale,
  updateSaleInvoice,
  deleteSaleInvoice,
  recordCashDrawerEntry,
  signInWithGooglePopup,
  getFirebaseAuth
} from './firebase-config.js';

// Application State
const AppState = {
  currentView: 'dashboard-overview',
  activeVodafoneLine: 1,
  categoryViewTab: {
    headphones: 'inventory',
    chargers: 'inventory',
    cables: 'inventory',
    speakers: 'inventory',
    phones: 'inventory',
    covers: 'inventory',
    accessories: 'inventory',
    manual: 'inventory'
  },
  activeChargerTab: 'all',
  activeCablesTab: 'all',
  activeHeadphoneTab: 'all',
  activeSpeakerTab: 'all',
  activeCoversTab: 'all',
  activeAccessoriesTab: 'all',
  activePhoneBrand: 'all',
  activePhoneStatus: 'all',
  vodafoneMonitorFilterLine: 'all',
  vodafoneMonitorFilterType: 'all',
  vodafoneMonitorFilterDate: 'today',
  vodafoneMonitorSearch: '',
  allSalesCategoryFilter: 'all',
  allSalesDateFilter: 'all',
  activeAllSalesDateFilter: 'all',
  allSalesSearch: '',
  allSalesMasterTab: 'sales',
  masterCatalogCategory: 'all',
  masterCatalogSearch: '',
  manualInventorySearch: '',
  lowStockModalFilter: 'all',
  posCatalogCategory: 'all',
  posCatalogSearch: '',
  sidebarCollapsed: false,
  cart: [],
  cartDiscount: 0,
  deleteTarget: null,
  editingProductId: null,
  editingVodafoneTxId: null,
  currentSmartProduct: null
};

// ==========================================
// THEME & COLOR CUSTOMIZER SYSTEM
// ==========================================
const THEME_OPTIONS = {
  'dark-onyx': {
    id: 'dark-onyx',
    name: 'الأسود الداكن الفاخر (Dark Slate / Onyx)',
    desc: 'تصميم داكن فخم عالي التباين بلمسات تيتانيوم وسماوي مثلج',
    badge: 'داكن فاخر',
    previewHex: ['#090d16', '#162032', '#38bdf8']
  },
  'red-magic': {
    id: 'red-magic',
    name: 'سنترال حلمي الفاخر (Helmy Luxury Black & Crimson)',
    desc: 'طابع فاخر ملكي باللون القرمزي والأسود الداكن (سنترال حلمي)',
    badge: 'الخيار الافتراضي ★',
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
      G = (num >> 8 & 0x00FF) + amt,
      B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1);
}

function renderThemeModalOptions() {
  const container = document.getElementById('theme-options-container');
  if (!container) return;
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'red-magic';

  container.innerHTML = Object.values(THEME_OPTIONS).map(t => {
    const isSelected = t.id === currentTheme;
    return `
      <div 
        onclick="window.selectTheme('${t.id}')"
        class="p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
          isSelected 
            ? 'bg-primary/10 border-primary ring-2 ring-primary/40 shadow-lg' 
            : 'bg-surface-container-low border-outline-variant/30 hover:border-outline-variant hover:bg-surface-container'
        }"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-bold text-xs text-on-surface">${t.name}</span>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-container text-on-surface-variant border border-outline-variant/30">${t.badge}</span>
          </div>
          ${isSelected ? '<span class="material-symbols-outlined text-primary text-base">check_circle</span>' : ''}
        </div>
        <p class="text-[11px] text-on-surface-variant leading-relaxed">${t.desc}</p>
        <div class="flex items-center gap-1.5 pt-1">
          ${t.previewHex.map(c => `<span class="w-5 h-5 rounded-full border border-black/20 shadow-xs" style="background-color: ${c}"></span>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// Live Clock for Cashier
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

// Fullscreen Toggle
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

// Sidebar Toggle (Mobile Drawer & Laptop Collapse)
window.toggleSidebar = () => {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    sidebar.classList.toggle('sidebar-open');
    sidebar.classList.toggle('sidebar-closed');
  }
  if (backdrop) {
    backdrop.classList.toggle('hidden');
  }
};

// ==========================================
// FIXED STORE HERO BANNER (بانر سنترال حلمي الثابت الرسمي)
// ==========================================
function setupBannerSlider() {
  // Static banner - no autoplay per user request
}

// ==========================================
// INITIALIZATION
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initRealtimeSync();
  startLiveClock();
  setupBannerSlider();

  // Subscribe UI to store events
  subscribeToStore((event, data, store) => {
    renderCurrentView();
    updateGlobalHeaderBadges();
    if (!document.getElementById('modal-quick-pos')?.classList.contains('hidden')) {
      renderPOSCatalog(AppState.posCatalogCategory, AppState.posCatalogSearch);
    }
  });

  setupNavigation();
  setupKeyboardShortcuts();
  setupBarcodeScannerListener();
  setupQuickPOS();
  setupProductModal();
  setupVodafoneEvents();
  setupDrawerEvents();
  setupSmartCodeEvents();
  startSMSPoller();

  renderCurrentView();
  updateGlobalHeaderBadges();
});

// ==========================================
// ROUTING & VIEW NAVIGATION
// ==========================================

const ALL_VIEWS = [
  'dashboard-overview',
  'vodafone-monitor',
  'vodafone-cash-wallets',
  'all-sales-master',
  'manual-inventory',
  'chargers-inventory',
  'cables-inventory',
  'headphones-audio',
  'speakers-sound',
  'phones-sales-inventory',
  'covers-inventory',
  'accessories-inventory',
  'sms-sync-hub'
];

function setupNavigation() {
  document.addEventListener('click', (e) => {
    const targetLink = e.target.closest('[data-path]');
    if (targetLink) {
      e.preventDefault();
      const path = targetLink.getAttribute('data-path');
      navigateTo(path);
      // Close sidebar if on mobile
      if (window.innerWidth < 1024) {
        const sidebar = document.getElementById('app-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        sidebar?.classList.remove('sidebar-open');
        sidebar?.classList.add('sidebar-closed');
        backdrop?.classList.add('hidden');
      }
    }
  });
}

export function navigateTo(path) {
  // Alias redirects
  if (path === 'chargers-cables') path = 'chargers-inventory';

  AppState.currentView = path;

  // Update navigation styling
  const navLinks = document.querySelectorAll('[data-path]');
  navLinks.forEach(link => {
    const linkPath = link.getAttribute('data-path');
    const isCurrent = linkPath === path || (linkPath === 'chargers-cables' && path === 'chargers-inventory');
    if (isCurrent) {
      link.setAttribute('aria-current', 'page');
      link.classList.add('bg-primary', 'text-white', 'shadow-md', 'ring-1', 'ring-rose-500/40');
      link.classList.remove('text-slate-300', 'hover:bg-navy-card');
    } else {
      link.removeAttribute('aria-current');
      link.classList.remove('bg-primary', 'text-white', 'shadow-md', 'ring-1', 'ring-rose-500/40');
      link.classList.add('text-slate-300', 'hover:bg-navy-card');
    }
  });

  // Show/Hide View Sections
  ALL_VIEWS.forEach(v => {
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCurrentView() {
  switch (AppState.currentView) {
    case 'dashboard-overview':
      renderDashboard();
      break;
    case 'all-sales-master':
      renderAllSalesMasterPage();
      break;
    case 'manual-inventory':
      renderManualInventoryPage();
      break;
    case 'vodafone-monitor':
      renderVodafoneMonitor();
      break;
    case 'vodafone-cash-wallets':
      renderVodafoneHub();
      break;
    case 'chargers-inventory':
      renderChargersPage();
      break;
    case 'cables-inventory':
      renderCablesPage();
      break;
    case 'headphones-audio':
      renderHeadphonesPage();
      break;
    case 'speakers-sound':
      renderSpeakersPage();
      break;
    case 'phones-sales-inventory':
      renderPhonesPage();
      break;
    case 'covers-inventory':
      renderCoversPage();
      break;
    case 'accessories-inventory':
      renderAccessoriesPage();
      break;
    case 'sms-sync-hub':
      renderSmsSyncHub();
      break;
    default:
      renderDashboard();
  }
}

// Global Header & Sidebar Badges
function updateGlobalHeaderBadges() {
  const drawerCash = Store.drawer ? (parseFloat(Store.drawer.currentCash) || 0) : 0;
  setElemText('header-cash-balance', `${formatMoney(drawerCash)} ج.م`);
  setElemText('sidebar-drawer-val', `${formatMoney(drawerCash)} ج.م`);

  // Calculate totals
  const totalProds = Store.products.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const totalSalesVal = Store.salesInvoices.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
  const lowStockProducts = getLowStockProducts();
  const lowStockCount = lowStockProducts.length;

  setElemText('stat-dash-stock-total', totalProds);
  setElemText('stat-dash-sales', formatMoney(totalSalesVal));
  setElemText('stat-dash-sales-count', `${Store.salesInvoices.length} عمليات بيع`);
  setElemText('stat-dash-low-stock', lowStockCount);
  setElemText('header-low-stock-count', lowStockCount);

  const headerLowStockBtn = document.getElementById('btn-header-low-stock');
  if (headerLowStockBtn) {
    if (lowStockCount > 0) {
      headerLowStockBtn.classList.remove('opacity-50');
      headerLowStockBtn.classList.add('ring-2', 'ring-amber-500/60');
    } else {
      headerLowStockBtn.classList.add('opacity-50');
      headerLowStockBtn.classList.remove('ring-2', 'ring-amber-500/60');
    }
  }
}

// ==========================================
// CATEGORY DUAL-TAB SWITCHER (مخزون VS مبيعات)
// ==========================================

window.switchCategoryTab = function(category, tab) {
  AppState.categoryViewTab[category] = tab;

  // Toggle button styling
  document.querySelectorAll(`[data-cat-tab-for="${category}"]`).forEach(btn => {
    const btnTab = btn.getAttribute('data-cat-tab');
    if (btnTab === tab) {
      btn.className = "px-4 py-2 rounded-xl text-xs font-bold transition-all bg-primary text-white shadow-sm ring-1 ring-rose-500/40 flex items-center gap-1.5 cursor-pointer";
    } else {
      btn.className = "px-4 py-2 rounded-xl text-xs font-bold transition-all bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 flex items-center gap-1.5 cursor-pointer";
    }
  });

  // Toggle containers
  const invCont = document.getElementById(`${category}-inventory-container`);
  const salesCont = document.getElementById(`${category}-sales-container`);
  if (invCont) {
    if (!salesCont || tab === 'inventory') {
      invCont.classList.remove('hidden');
    } else {
      invCont.classList.add('hidden');
    }
  }
  if (salesCont) {
    if (tab === 'sales') {
      salesCont.classList.remove('hidden');
    } else {
      salesCont.classList.add('hidden');
    }
  }

  renderCurrentView();
};

// Helper: Extract sales for a given category (100% resilient category resolution)
function getCategorySales(cat) {
  const sales = [];
  (Store.salesInvoices || []).forEach(inv => {
    (inv.items || []).forEach((item, itemIdx) => {
      const cleanBar = item.barcode ? String(item.barcode).trim().toLowerCase() : '';
      const cleanProdId = item.productId ? String(item.productId).trim() : '';
      const cleanName = item.name ? String(item.name).trim().toLowerCase() : '';

      const itemProd = (Store.products || []).find(p => {
        if (cleanProdId && p.id && String(p.id).trim() === cleanProdId) return true;
        if (cleanBar && p.barcode && String(p.barcode).trim().toLowerCase() === cleanBar) return true;
        if (cleanBar && p.imei && String(p.imei).trim().toLowerCase() === cleanBar) return true;
        if (cleanName && p.name && String(p.name).trim().toLowerCase() === cleanName) return true;
        return false;
      });
      
      const rawCat = (item.category || (itemProd ? itemProd.category : '') || '').toLowerCase().trim();
      let matches = false;
      if (cat === 'all') {
        matches = true;
      } else if (rawCat === cat) {
        matches = true;
      } else if (cat === 'chargers' && (rawCat.includes('charger') || rawCat.includes('شاحن') || rawCat.includes('شواحن'))) {
        matches = true;
      } else if (cat === 'cables' && (rawCat.includes('cable') || rawCat.includes('وصل') || rawCat.includes('سلك'))) {
        matches = true;
      } else if (cat === 'headphones' && (rawCat.includes('headphone') || rawCat.includes('earphone') || rawCat.includes('سماع') || rawCat.includes('صوت'))) {
        matches = true;
      } else if (cat === 'speakers' && (rawCat.includes('speaker') || rawCat.includes('صب') || rawCat.includes('مكبر'))) {
        matches = true;
      } else if (cat === 'phones' && (rawCat.includes('phone') || rawCat.includes('هاتف') || rawCat.includes('تليفون') || rawCat.includes('موبايل'))) {
        matches = true;
      } else if (cat === 'covers' && (rawCat.includes('cover') || rawCat.includes('case') || rawCat.includes('جراب') || rawCat.includes('كفر') || rawCat.includes('اسكرين'))) {
        matches = true;
      } else if (cat === 'accessories' && (rawCat.includes('acc') || rawCat.includes('إكسسوار') || rawCat.includes('اكسسوار'))) {
        matches = true;
      } else if (cat === 'manual' && (rawCat.includes('manual') || rawCat.includes('يدوي') || rawCat === 'general' || !rawCat)) {
        matches = true;
      }

      if (matches) {
        const buyP = (item.buyPrice !== undefined && item.buyPrice !== null && !isNaN(parseFloat(item.buyPrice))) 
          ? parseFloat(item.buyPrice) 
          : (itemProd ? (itemProd.buyPrice || 0) : 0);
        const sellP = parseFloat(item.price) || 0;
        const q = parseInt(item.quantity, 10) || 1;
        const profit = (item.profit !== undefined && item.profit !== null && !isNaN(parseFloat(item.profit)))
          ? parseFloat(item.profit)
          : ((sellP - buyP) * q);

        sales.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          timestamp: inv.timestamp,
          customerName: inv.customerName || 'عميل نقدي',
          customerPhone: inv.customerPhone || '',
          itemIndex: itemIdx,
          ...item,
          category: rawCat || cat,
          buyPrice: buyP,
          price: sellP,
          quantity: q,
          profit
        });
      }
    });
  });
  sales.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  return sales;
}

// Helper: Render category sales table rows
function renderSalesTableHTML(salesList, categoryArabicName) {
  if (salesList.length === 0) {
    return `
      <tr>
        <td colspan="9" class="py-14 text-center">
          <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
            <span class="material-symbols-outlined text-[38px] opacity-30">receipt_long</span>
            <span class="font-headline-sm font-bold text-on-surface">لا توجد عمليات بيع مسجلة لهذا القسم حتى الآن</span>
            <span class="text-xs">اكتب كود أي صنف في شريط الكود الذكي بالأعلى واضغط "بيع" لتنزيله هنا تلقائياً مع التاريخ والربح.</span>
          </div>
        </td>
      </tr>
    `;
  }

  return salesList.map(sale => {
    const buyPrice = sale.buyPrice || 0;
    const sellPrice = sale.price || 0;
    const qty = sale.quantity || 1;
    const total = sellPrice * qty;
    const profit = (sellPrice - buyPrice) * qty;

    return `
      <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
        <td class="py-3 px-4 font-numeric-table font-bold text-on-surface">
          ${formatDateArabic(sale.timestamp)}
        </td>
        <td class="py-3 px-4 font-numeric-table font-bold text-secondary">
          ${sale.barcode || '-'}
        </td>
        <td class="py-3 px-4 font-bold text-on-surface">
          ${sale.name}
        </td>
        <td class="py-3 px-4 font-numeric-table font-bold text-on-surface">
          ${qty} حبة
        </td>
        <td class="py-3 px-4 font-numeric-table text-on-surface">
          ${formatMoney(sellPrice)} ج.م
        </td>
        <td class="py-3 px-4 font-numeric-table font-bold text-emerald-400">
          ${formatMoney(total)} ج.م
        </td>
        <td class="py-3 px-4 font-numeric-table font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          +${formatMoney(profit)} ج.م
        </td>
        <td class="py-3 px-4 text-on-surface-variant">
          ${sale.customerName || 'عميل نقدي'} (${sale.invoiceNumber})
        </td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="window.openEditSaleModal('${sale.invoiceId}', '${sale.productId || sale.barcode || ''}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-600 hover:text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer" title="تعديل عملية البيع">
              <span class="material-symbols-outlined text-[15px]">edit</span>
              <span>تعديل</span>
            </button>
            <button onclick="window.confirmDeleteSale('${sale.invoiceId}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer" title="حذف نهائي للعملية واسترجاع المخزون">
              <span class="material-symbols-outlined text-[15px]">delete_forever</span>
              <span>حذف</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
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
              <p class="font-headline-sm">لا توجد مبيعات مسجلة حتى الآن</p>
              <button onclick="window.triggerQuickPOS()" class="text-secondary hover:underline font-bold text-xs">+ بدء بيع سريع (F2)</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      invoicesTbody.innerHTML = recent.map(inv => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors">
          <td class="py-3 px-4 font-numeric-table text-secondary font-bold">${inv.invoiceNumber}</td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant">${formatTime(inv.timestamp)}</td>
          <td class="py-3 px-4 font-bold text-xs">${inv.items ? inv.items.map(i => `${i.name} (×${i.quantity})`).join(', ') : '-'}</td>
          <td class="py-3 px-4 font-numeric-table font-bold text-on-surface">${formatMoney(inv.totalAmount)} ج.م</td>
          <td class="py-3 px-4 text-on-surface-variant text-xs">${inv.customerName || 'عميل نقدي'}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="window.printInvoiceReceipt('${inv.id}')" class="p-1.5 rounded-lg text-secondary hover:bg-secondary/10 transition-colors cursor-pointer" title="عرض تفاصيل الفاتورة">
                <span class="material-symbols-outlined text-[18px]">receipt_long</span>
              </button>
              <button onclick="window.openEditSaleModal('${inv.id}')" class="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer" title="تعديل عملية البيع">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button onclick="window.confirmDeleteSale('${inv.id}')" class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer" title="حذف نهائي للعملية واسترجاع المخزون">
                <span class="material-symbols-outlined text-[18px]">delete_forever</span>
              </button>
            </div>
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
              <p class="font-headline-sm">لا توجد معاملات كاش مسجلة اليوم</p>
              <button onclick="window.navigateTo('vodafone-cash-wallets')" class="text-secondary hover:underline font-bold text-xs">+ فتح محافظ فودافون كاش</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      vodaTbody.innerHTML = recentVoda.map(tx => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors">
          <td class="py-3 px-4 font-bold text-on-surface">خط ${tx.lineNum}</td>
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
// VIEW: VODAFONE MONITOR HUB (متابعة فودافون كاش)
// ==========================================

function renderVodafoneMonitor() {
  const allLines = Store.vodafoneLines || [];
  const allTxs = Store.vodafoneTransactions || [];

  // Today's Date Calculation
  const todayTxs = allTxs.filter(t => isToday(t.timestamp));
  const todayDepositsList = todayTxs.filter(t => t.type === 'deposit');
  const todayWithdrawsList = todayTxs.filter(t => t.type === 'withdraw');

  const todayDepositsTotal = todayDepositsList.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
  const todayWithdrawsTotal = todayWithdrawsList.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
  const todayCommsTotal = todayTxs.reduce((acc, t) => acc + (parseFloat(t.commission) || 0), 0);
  const totalWalletsBalance = allLines.reduce((acc, l) => acc + (parseFloat(l.balance) || 0), 0);

  // Set Top KPI displays
  setElemText('vm-today-deposits-val', `${formatMoney(todayDepositsTotal)} ج.م`);
  setElemText('vm-today-deposits-count', `${todayDepositsList.length} حركات استلام`);

  setElemText('vm-today-withdraws-val', `${formatMoney(todayWithdrawsTotal)} ج.م`);
  setElemText('vm-today-withdraws-count', `${todayWithdrawsList.length} حركات تحويل`);

  setElemText('vm-today-profits-val', `+${formatMoney(todayCommsTotal)} ج.م`);
  setElemText('vm-today-profits-count', `${todayTxs.length} إجمالي حركات اليوم`);

  setElemText('vm-total-balance-val', `${formatMoney(totalWalletsBalance)} ج.م`);
  setElemText('vm-total-devices-count', `18 هاتف وخط متصل 🟢`);

  // Render 18 Lines & Connected Hardware Devices Cards
  const linesGrid = document.getElementById('vodafone-monitor-lines-grid');
  if (linesGrid) {
    linesGrid.innerHTML = allLines.map(line => {
      const lineTodayTxs = todayTxs.filter(t => t.lineNum === line.lineNum);
      const lineTodayIn = lineTodayTxs.filter(t => t.type === 'deposit').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      const lineTodayOut = lineTodayTxs.filter(t => t.type === 'withdraw').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      const hasPhone = Boolean(line.phone && line.phone.trim());
      const deviceName = line.deviceName || `هاتف خط ${line.lineNum}`;

      return `
        <div class="bg-surface-container-low p-3.5 rounded-2xl border border-outline-variant/30 hover:border-outline-variant transition-all flex flex-col justify-between gap-2.5 shadow-xs">
          <!-- Line Header -->
          <div class="flex items-center justify-between pb-2 border-b border-outline-variant/20">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold text-xs shrink-0">
                ${line.lineNum}
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-bold text-xs text-on-surface truncate">خط ${line.lineNum}</span>
                <span class="text-[11px] font-numeric-table font-bold ${hasPhone ? 'text-sky-400' : 'text-amber-400'} truncate">
                  ${hasPhone ? line.phone : 'بدون رقم هاتف'}
                </span>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>متصل</span>
            </span>
          </div>

          <!-- Connected Hardware Device -->
          <div class="bg-surface-container/60 p-2 rounded-xl border border-outline-variant/20 flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="material-symbols-outlined text-sm text-sky-400 shrink-0">smartphone</span>
              <span class="text-[11px] font-bold text-on-surface truncate" title="${deviceName}">${deviceName}</span>
            </div>
            <button onclick="window.openLineDeviceModal(${line.lineNum})" class="text-[10px] text-rose-400 hover:text-rose-300 font-bold px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-colors shrink-0 cursor-pointer">
              تعديل الجهاز
            </button>
          </div>

          <!-- Balance & Today Flow -->
          <div class="space-y-1.5 pt-0.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-on-surface-variant text-[11px]">الرصيد الحالي:</span>
              <span class="font-numeric-table font-black text-emerald-400 text-sm">${formatMoney(line.balance || 0)} ج.م</span>
            </div>
            <div class="grid grid-cols-2 gap-1.5 text-[10px] pt-1 border-t border-outline-variant/15">
              <div class="flex items-center justify-between bg-surface-container/40 px-2 py-1 rounded-lg">
                <span class="text-on-surface-variant">مستلم:</span>
                <span class="font-numeric-table font-bold text-emerald-400">+${formatMoney(lineTodayIn)}</span>
              </div>
              <div class="flex items-center justify-between bg-surface-container/40 px-2 py-1 rounded-lg">
                <span class="text-on-surface-variant">محول:</span>
                <span class="font-numeric-table font-bold text-rose-400">-${formatMoney(lineTodayOut)}</span>
              </div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="flex items-center gap-1.5 pt-1">
            <button onclick="window.quickOpenVodafoneTx(${line.lineNum})" class="flex-1 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all">
              <span class="material-symbols-outlined text-[15px]">add_circle</span>
              <span>حركة جديدة</span>
            </button>
            <button onclick="window.viewLineConsole(${line.lineNum})" class="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-all cursor-pointer" title="فتح كونسول الخط">
              <span class="material-symbols-outlined text-[16px]">visibility</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Filter & Render Transactions Ledger Table
  const filterLine = AppState.vodafoneMonitorFilterLine;
  const filterType = AppState.vodafoneMonitorFilterType;
  const filterDate = AppState.vodafoneMonitorFilterDate;
  const search = (AppState.vodafoneMonitorSearch || '').trim().toLowerCase();

  let filteredTxs = allTxs;

  if (filterLine !== 'all') {
    const num = parseInt(filterLine, 10);
    filteredTxs = filteredTxs.filter(t => t.lineNum === num);
  }

  if (filterType !== 'all') {
    filteredTxs = filteredTxs.filter(t => t.type === filterType);
  }

  if (filterDate === 'today') {
    filteredTxs = filteredTxs.filter(t => isToday(t.timestamp));
  } else if (filterDate === 'yesterday') {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toDateString();
    filteredTxs = filteredTxs.filter(t => new Date(t.timestamp).toDateString() === yestStr);
  } else if (filterDate === 'month') {
    const now = new Date();
    filteredTxs = filteredTxs.filter(t => {
      const d = new Date(t.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }

  if (search) {
    filteredTxs = filteredTxs.filter(t => 
      (t.transactionId || '').toLowerCase().includes(search) ||
      (t.customerPhone || '').toLowerCase().includes(search) ||
      (t.notes || '').toLowerCase().includes(search) ||
      String(t.amount || '').includes(search) ||
      String(t.lineNum || '').includes(search)
    );
  }

  const tbody = document.getElementById('vodafone-monitor-tx-tbody');
  const countBadge = document.getElementById('vodafone-monitor-tx-count-badge');
  if (countBadge) countBadge.innerText = `${filteredTxs.length} عمليات مسجلة`;

  if (tbody) {
    if (filteredTxs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-14 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
              <span class="material-symbols-outlined text-[42px] opacity-30">receipt_long</span>
              <span class="font-headline-sm font-bold text-on-surface">لا توجد عمليات مطابقة للمحددات</span>
              <span class="text-xs">لم يتم تسجيل أي عمليات بهذه الفلاتر، يمكنك تسجيل حركة كاش جديدة لأي خط الآن.</span>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filteredTxs.map(t => {
        const line = allLines.find(l => l.lineNum === t.lineNum) || { lineNum: t.lineNum };
        const isDep = t.type === 'deposit';
        const txRef = t.transactionId || ('#' + (t.id ? t.id.slice(-6) : '-'));

        return `
          <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
            <td class="py-3 px-3 font-numeric-table font-bold text-on-surface whitespace-nowrap">
              ${formatDateArabic(t.timestamp)}
            </td>
            <td class="py-3 px-3">
              <div class="flex flex-col">
                <span class="font-bold text-on-surface flex items-center gap-1">
                  <span class="material-symbols-outlined text-rose-500 text-sm">sim_card</span>
                  <span>خط ${t.lineNum}</span>
                  <span class="font-numeric-table text-sky-400 text-[11px]">${line.phone ? '(' + line.phone + ')' : ''}</span>
                </span>
                <span class="text-[10px] text-on-surface-variant truncate">${line.deviceName || 'هاتف الخط'}</span>
              </div>
            </td>
            <td class="py-3 px-3">
              <span class="px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${isDep ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}">
                <span class="material-symbols-outlined text-[13px]">${isDep ? 'south_west' : 'north_east'}</span>
                <span>${isDep ? 'إيداع / استلام (+)' : 'سحب / تحويل (-)'}</span>
              </span>
            </td>
            <td class="py-3 px-3 font-numeric-table font-black text-sm ${isDep ? 'text-emerald-400' : 'text-rose-400'}">
              ${isDep ? '+' : '-'}${formatMoney(t.amount)} ج.م
            </td>
            <td class="py-3 px-3 font-numeric-table font-bold text-secondary text-xs">
              ${txRef}
            </td>
            <td class="py-3 px-3 font-numeric-table font-bold text-emerald-400">
              +${formatMoney(t.commission || 0)} ج.م
            </td>
            <td class="py-3 px-3 font-numeric-table font-bold text-on-surface">
              ${formatMoney(t.balanceAfter || 0)} ج.م
            </td>
            <td class="py-3 px-3 text-on-surface-variant text-[11px] max-w-[140px] truncate" title="${t.customerPhone || ''} ${t.notes || ''}">
              ${t.customerPhone ? '<span class="font-numeric-table font-bold text-on-surface block">' + t.customerPhone + '</span>' : ''}
              <span>${t.notes || '-'}</span>
            </td>
            <td class="py-3 px-3 text-center whitespace-nowrap">
              <div class="flex items-center justify-center gap-1">
                <button onclick="window.openEditVodafoneTxModal('${t.id}')" class="px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-sky-400 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors" title="تعديل العملية">
                  <span class="material-symbols-outlined text-[15px]">edit</span>
                  <span>تعديل</span>
                </button>
                <button onclick="window.confirmDeleteVodafoneTx('${t.id}')" class="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors" title="حذف نهائي">
                  <span class="material-symbols-outlined text-[15px]">delete</span>
                  <span>حذف</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

window.quickOpenVodafoneTx = (lineNum) => {
  AppState.activeVodafoneLine = parseInt(lineNum, 10);
  navigateTo('vodafone-cash-wallets');
  setTimeout(() => {
    document.getElementById('voda-tx-amount')?.focus();
  }, 200);
};

window.viewLineConsole = (lineNum) => {
  AppState.activeVodafoneLine = parseInt(lineNum, 10);
  navigateTo('vodafone-cash-wallets');
};

window.setVodafoneMonitorFilterLine = (val) => {
  AppState.vodafoneMonitorFilterLine = val;
  renderVodafoneMonitor();
};

window.setVodafoneMonitorFilterType = (val) => {
  AppState.vodafoneMonitorFilterType = val;
  renderVodafoneMonitor();
};

window.setVodafoneMonitorFilterDate = (val) => {
  AppState.vodafoneMonitorFilterDate = val;
  renderVodafoneMonitor();
};

window.setVodafoneMonitorSearch = (val) => {
  AppState.vodafoneMonitorSearch = val;
  renderVodafoneMonitor();
};

window.openLineDeviceModal = (lineNum) => {
  const line = Store.vodafoneLines.find(l => l.lineNum === lineNum);
  if (!line) return;

  setElemValue('line-device-edit-linenum', line.lineNum);
  setElemText('line-device-edit-title', `تخصيص بيانات خط ${line.lineNum} والجهاز المربوط`);
  setElemValue('line-device-edit-phone', line.phone || '');
  setElemValue('line-device-edit-name', line.deviceName || `هاتف محمول خط ${line.lineNum}`);
  setElemValue('line-device-edit-limit', line.monthlyLimit || 100000);

  const modal = document.getElementById('modal-line-device-settings');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('line-device-edit-phone')?.focus(), 100);
  }
};

window.closeLineDeviceModal = () => {
  const modal = document.getElementById('modal-line-device-settings');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.saveLineDeviceSettings = async () => {
  const lineNum = parseInt(document.getElementById('line-device-edit-linenum')?.value, 10);
  const phone = (document.getElementById('line-device-edit-phone')?.value || '').trim();
  const deviceName = (document.getElementById('line-device-edit-name')?.value || '').trim();
  const monthlyLimit = parseFloat(document.getElementById('line-device-edit-limit')?.value) || 100000;

  if (isNaN(lineNum) || lineNum < 1 || lineNum > 18) return;

  await updateVodafoneLineSettings(lineNum, {
    phone,
    deviceName: deviceName || `هاتف محمول خط ${lineNum}`,
    monthlyLimit
  });

  closeLineDeviceModal();
  showToast(`تم حفظ بيانات خط ${lineNum} والجهاز بنجاح!`, 'check_circle');
  renderVodafoneMonitor();
  renderVodafoneHub();
};

window.openEditVodafoneTxModal = (txId) => {
  const tx = Store.vodafoneTransactions.find(t => t.id === txId);
  if (!tx) {
    showToast("لم يتم العثور على المعاملة", "error");
    return;
  }

  AppState.editingVodafoneTxId = txId;
  setElemValue('edit-voda-tx-id', tx.id);
  setElemText('edit-voda-tx-title', `تعديل حركة فودافون كاش (${tx.type === 'deposit' ? 'إيداع' : 'سحب'}) - خط ${tx.lineNum}`);
  setElemValue('edit-voda-amount', tx.amount || 0);
  setElemValue('edit-voda-commission', tx.commission || 0);
  setElemValue('edit-voda-customer-phone', tx.customerPhone || '');
  setElemValue('edit-voda-notes', tx.notes || '');
  setElemValue('edit-voda-ref-id', tx.transactionId || '');

  const modal = document.getElementById('modal-edit-vodafone-tx');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeEditVodafoneTxModal = () => {
  AppState.editingVodafoneTxId = null;
  const modal = document.getElementById('modal-edit-vodafone-tx');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.saveEditedVodafoneTx = async () => {
  const txId = document.getElementById('edit-voda-tx-id')?.value;
  const amount = parseFloat(document.getElementById('edit-voda-amount')?.value) || 0;
  const commission = parseFloat(document.getElementById('edit-voda-commission')?.value) || 0;
  const customerPhone = (document.getElementById('edit-voda-customer-phone')?.value || '').trim();
  const notes = (document.getElementById('edit-voda-notes')?.value || '').trim();
  const transactionId = (document.getElementById('edit-voda-ref-id')?.value || '').trim();

  if (amount <= 0) {
    showToast("يرجى إدخال مبلغ صحيح", "warning");
    return;
  }

  await updateVodafoneTransaction(txId, {
    amount,
    commission,
    customerPhone,
    notes,
    transactionId
  });

  closeEditVodafoneTxModal();
  showToast("تم تعديل حركة فودافون كاش وتحديث الرصيد والدرج تلقائياً بنجاح", "check_circle");
  renderVodafoneHub();
  renderVodafoneMonitor();
};

window.confirmDeleteVodafoneTx = async (txId) => {
  const tx = Store.vodafoneTransactions.find(t => t.id === txId);
  if (!tx) return;

  const typeArabic = tx.type === 'deposit' ? 'إيداع / استلام (+)' : 'سحب / تحويل (-)';
  const amountStr = formatMoney(tx.amount);
  const lineNum = tx.lineNum;

  const msg = `هل أنت متأكد تماماً من حذف حركة فودافون كاش هذه نهائياً؟\n\n` +
    `📌 نوع الحركة: ${typeArabic}\n` +
    `💰 المبلغ: ${amountStr} ج.م (خط ${lineNum})\n` +
    `العمولة: ${formatMoney(tx.commission || 0)} ج.م\n\n` +
    `⚠️ تنبيه هام:\n` +
    `1. سيتم حذف الحركة نهائياً وتاماً ولن تعود نهائياً عند التحديث.\n` +
    `2. سيتم استرجاع رصيد خط ${lineNum} تلقائياً.\n` +
    `3. سيتم ضبط درج النقدية تلقائياً.`;

  if (confirm(msg)) {
    await deleteVodafoneTransaction(txId);
    showToast(`تم حذف معاملة فودافون كاش نهائياً واسترجاع رصيد خط ${lineNum} بنجاح`, "delete");
    renderVodafoneHub();
    renderVodafoneMonitor();
  }
};

// ==========================================
// VIEW 2: VODAFONE CASH 18 LINES (Zero Balances + SMS)
// ==========================================

function renderVodafoneHub() {
  const lineNum = AppState.activeVodafoneLine;
  const line = Store.vodafoneLines.find(l => l.lineNum === lineNum) || {
    lineNum,
    phone: '',
    monthlyLimit: 100000,
    balance: 0.00,
    totalTransferredMonth: 0.00
  };

  const gridContainer = document.getElementById('wallets-grid');
  if (gridContainer) {
    gridContainer.innerHTML = Store.vodafoneLines.map(l => {
      const isSelected = l.lineNum === lineNum;
      const hasPhone = Boolean(l.phone && l.phone.trim());
      const hasBalance = (parseFloat(l.balance) || 0) > 0;
      return `
        <button 
          onclick="window.selectVodafoneLine(${l.lineNum})"
          class="p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 transition-all cursor-pointer relative text-right min-h-[72px] ${
            isSelected 
              ? 'bg-rose-600 text-white border-rose-500 shadow-md ring-2 ring-rose-500/50' 
              : 'bg-surface-container-low hover:bg-surface-container text-on-surface border-outline-variant/30'
          }"
          title="خط ${l.lineNum} - ${hasPhone ? l.phone : 'اضغط لإضافة الرقم'}"
        >
          <div class="flex items-center justify-between w-full">
            <span class="text-xs font-black flex items-center gap-1">
              <span class="material-symbols-outlined text-[15px] ${isSelected ? 'text-white' : 'text-rose-400'}">sim_card</span>
              <span>خط ${l.lineNum}</span>
            </span>
            <span class="w-2.5 h-2.5 rounded-full ${hasBalance ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-500'}"></span>
          </div>

          <div class="w-full text-center py-1 px-1.5 rounded-lg ${isSelected ? 'bg-black/25' : 'bg-surface-container border border-outline-variant/20'}">
            <span class="font-numeric-table font-bold text-xs block truncate ${hasPhone ? (isSelected ? 'text-white' : 'text-sky-300') : (isSelected ? 'text-rose-200' : 'text-amber-400/90')}">
              ${hasPhone ? l.phone : '+ أضف الرقم'}
            </span>
          </div>

          <div class="flex items-center justify-between w-full text-[11px] pt-0.5 border-t ${isSelected ? 'border-white/20' : 'border-outline-variant/20'}">
            <span class="text-[10px] ${isSelected ? 'text-rose-200' : 'text-on-surface-variant'}">الرصيد:</span>
            <span class="font-numeric-table font-black ${isSelected ? 'text-white' : 'text-emerald-400'}">
              ${formatMoney(l.balance || 0)} ج.م
            </span>
          </div>
        </button>
      `;
    }).join('');
  }

  // Active Line Details
  setElemText('active-line-badge', `خط ${line.lineNum} ${line.phone ? '- ' + line.phone : ''} (نشط)`);
  setElemText('active-line-phone-display', line.phone ? `رقم الشريحة: ${line.phone}` : 'لم يتم تسجيل رقم هاتف للخط');
  const quickPhoneInput = document.getElementById('active-line-quick-phone');
  if (quickPhoneInput) quickPhoneInput.value = line.phone || '';
  const quickPhoneLabel = document.getElementById('active-line-quick-label');
  if (quickPhoneLabel) quickPhoneLabel.innerText = `رقم هاتف خط ${line.lineNum} (فودافون كاش):`;
  setElemText('active-line-balance-big', `${formatMoney(line.balance || 0)} ج.م`);
  setElemText('active-line-month-transferred', `${formatMoney(line.totalTransferredMonth || 0)} ج.م`);
  
  const remaining = Math.max(0, (line.monthlyLimit || 100000) - (line.totalTransferredMonth || 0));
  setElemText('active-line-remaining-limit', `${formatMoney(remaining)} ج.م`);

  // Overall KPIs
  const totalBalance = Store.vodafoneLines.reduce((acc, l) => acc + (parseFloat(l.balance) || 0), 0);
  const totalLimit = Store.vodafoneLines.reduce((acc, l) => acc + (parseFloat(l.monthlyLimit) || 100000), 0);
  const totalUsed = Store.vodafoneLines.reduce((acc, l) => acc + (parseFloat(l.totalTransferredMonth) || 0), 0);
  const todayTxs = Store.vodafoneTransactions.filter(t => isToday(t.timestamp));
  const todayComms = todayTxs.reduce((acc, t) => acc + (parseFloat(t.commission) || 0), 0);

  setElemText('voda-kpi-total-balance', `${formatMoney(totalBalance)} ج.م`);
  setElemText('voda-kpi-remaining-limit', `${formatMoney(Math.max(0, totalLimit - totalUsed))} ج.م`);
  setElemText('voda-kpi-today-commissions', `+${formatMoney(todayComms)} ج.م`);
  setElemText('voda-kpi-today-tx-count', `${todayTxs.length} عمليات اليوم`);

  const percentUsed = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;
  setElemText('voda-kpi-limit-percent', `الاستهلاك الكلي: ${percentUsed}%`);
  const limitBar = document.getElementById('voda-kpi-limit-bar');
  if (limitBar) limitBar.style.width = `${percentUsed}%`;

  // Render transactions table for this line
  const lineTxs = Store.vodafoneTransactions.filter(t => t.lineNum === lineNum);
  const txTbody = document.getElementById('voda-transactions-tbody');
  if (txTbody) {
    if (lineTxs.length === 0) {
      txTbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-on-surface-variant">
            <span class="text-xs">لا توجد حركات مسجلة لهذا الخط حتى الآن. استخدم نموذج الإيداع / السحب لتسجيل أول حركة.</span>
          </td>
        </tr>
      `;
    } else {
      txTbody.innerHTML = lineTxs.map(t => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
          <td class="py-2.5 px-3 font-numeric-table font-bold text-on-surface">${formatDateArabic(t.timestamp)}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${t.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}">
              ${t.type === 'deposit' ? 'إيداع (+)' : 'سحب (-)'}
            </span>
          </td>
          <td class="py-2.5 px-3 font-numeric-table font-bold text-on-surface">${formatMoney(t.amount)} ج.م</td>
          <td class="py-2.5 px-3 font-numeric-table text-emerald-400 font-bold">+${formatMoney(t.commission || 0)} ج.م</td>
          <td class="py-2.5 px-3 font-numeric-table font-bold text-on-surface">${formatMoney(t.balanceAfter || 0)} ج.م</td>
          <td class="py-2.5 px-3 text-on-surface-variant">${t.customerPhone || t.notes || '-'}</td>
          <td class="py-2.5 px-3 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="window.openEditVodafoneTxModal('${t.id}')" class="p-1 rounded text-on-surface-variant hover:text-secondary" title="تعديل"><span class="material-symbols-outlined text-[16px]">edit</span></button>
              <button onclick="window.confirmDeleteVodafoneTx('${t.id}')" class="p-1 rounded text-on-surface-variant hover:text-rose-400" title="حذف"><span class="material-symbols-outlined text-[16px]">delete</span></button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }
}

window.selectVodafoneLine = (num) => {
  AppState.activeVodafoneLine = parseInt(num, 10);
  renderVodafoneHub();
};

window.confirmResetAllLines = () => {
  if (confirm("هل أنت متأكد تماماً من تصفير أرصدة جميع الخطوط الـ 18 إلى 0.00 ج.م؟ (سيتم تصفير الرصيد لجميع الخطوط)")) {
    resetAllVodafoneLines();
    renderVodafoneHub();
    showToast("تم تصفير جميع خطوط فودافون كاش بنجاح (الرصيد: 0.00 ج.م)", "refresh");
  }
};

// ==========================================
// VIEW 3: CHARGERS INVENTORY & SALES
// ==========================================

function renderChargersPage() {
  const allChargers = Store.products.filter(p => p.category === 'chargers');
  const sales = getCategorySales('chargers');

  // KPIs
  const totalQty = allChargers.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const costVal = allChargers.reduce((acc, p) => acc + ((p.buyPrice || 0) * (p.quantity || 0)), 0);
  const retailVal = allChargers.reduce((acc, p) => acc + ((p.sellPrice || 0) * (p.quantity || 0)), 0);
  const totalSalesVal = sales.reduce((acc, s) => acc + ((s.price || 0) * (s.quantity || 1)), 0);
  const totalProfitVal = sales.reduce((acc, s) => acc + (s.profit || 0), 0);

  setElemText('chargers-stat-qty', totalQty);
  setElemText('chargers-stat-cost', formatMoney(costVal));
  setElemText('chargers-stat-retail', formatMoney(retailVal));
  setElemText('chargers-stat-profit', `أرباح تقديرية: ${formatMoney(retailVal - costVal)} ج.م`);
  setElemText('chargers-count-badge', `${allChargers.length} أصناف`);

  // Warehouse only: No sales badges

  // Subcategory filter & search
  const activeTab = AppState.activeChargerTab;
  const search = (document.getElementById('chargers-search-input')?.value || '').trim().toLowerCase();

  let filtered = allChargers;
  if (activeTab !== 'all') filtered = filtered.filter(p => p.subcategory === activeTab);
  if (search) filtered = filtered.filter(p => String(p.name || '').toLowerCase().includes(search) || String(p.barcode || '').toLowerCase().includes(search));

  // Render Inventory Table
  const tbody = document.getElementById('chargers-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-14 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
              <span class="material-symbols-outlined text-[40px] opacity-30">power</span>
              <span class="font-headline-sm font-bold text-on-surface">لا توجد شواحن مسجلة</span>
              <button onclick="window.openAddProductModal('chargers')" class="mt-2 bg-secondary text-white px-5 py-2 rounded-xl text-xs font-bold">+ إضافة شاحن جديد</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
          <td class="py-3 px-4 font-numeric-table font-bold text-secondary text-sm">
            <span class="cursor-pointer hover:underline" onclick="window.openSmartCodeActionModal('${item.id}')">${item.barcode || 'بدون كود'}</span>
          </td>
          <td class="py-3 px-4 font-bold text-on-surface text-sm">${item.name}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-lg text-xs bg-surface-container text-on-surface-variant">${getChargerSubcategoryLabel(item.subcategory)}</span></td>
          <td class="py-3 px-4 font-numeric-table font-bold text-emerald-400">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-1.5 font-numeric-table font-bold text-sm">
              <span class="${item.quantity <= 2 ? 'text-rose-400' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">+</button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">-</button>
            </div>
          </td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant text-[11px]">${formatDateArabic(item.lastRestockedAt || item.createdAt)}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.openSmartCodeActionModal('${item.id}', 'restock')" class="px-3 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold transition-colors" title="توريد مخزون">+ توريد</button>
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"><span class="material-symbols-outlined text-[17px]">edit</span></button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400"><span class="material-symbols-outlined text-[17px]">delete</span></button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  // Render Sales Table
  const salesTbody = document.getElementById('chargers-sales-table-body');
  if (salesTbody) {
    salesTbody.innerHTML = renderSalesTableHTML(sales, 'الشواحن');
  }
}

function getChargerSubcategoryLabel(sub) {
  switch (sub) {
    case 'complete': return 'شاحن كامل';
    case 'adapter': return 'رأس شاحن';
    case 'fast': return 'شاحن سريع (Fast/PD)';
    case 'wireless': return 'شاحن لاسلكي';
    default: return 'شاحن';
  }
}

window.setChargerTab = (tab) => {
  AppState.activeChargerTab = tab;
  document.querySelectorAll('[data-charger-tab]').forEach(btn => {
    btn.className = btn.getAttribute('data-charger-tab') === tab 
      ? 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-primary text-white shadow-sm ring-1 ring-rose-500/40 cursor-pointer'
      : 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 cursor-pointer';
  });
  renderChargersPage();
};

// ==========================================
// VIEW 4: CABLES INVENTORY & SALES (الوصلات)
// ==========================================

function renderCablesPage() {
  const allCables = Store.products.filter(p => p.category === 'cables');
  const sales = getCategorySales('cables');

  const totalQty = allCables.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const costVal = allCables.reduce((acc, p) => acc + ((p.buyPrice || 0) * (p.quantity || 0)), 0);
  const retailVal = allCables.reduce((acc, p) => acc + ((p.sellPrice || 0) * (p.quantity || 0)), 0);
  const totalSalesVal = sales.reduce((acc, s) => acc + ((s.price || 0) * (s.quantity || 1)), 0);
  const totalProfitVal = sales.reduce((acc, s) => acc + (s.profit || 0), 0);

  setElemText('cables-stat-qty', totalQty);
  setElemText('cables-stat-cost', formatMoney(costVal));
  setElemText('cables-stat-retail', formatMoney(retailVal));
  setElemText('cables-count-badge', `${allCables.length} أصناف`);

  setElemText('cables-sales-total-val', `${formatMoney(totalSalesVal)} ج.م`);
  setElemText('cables-sales-profit-val', `+${formatMoney(totalProfitVal)} ج.م`);
  setElemText('cables-sales-count-badge', `${sales.length} مبيعات`);

  const activeTab = AppState.activeCablesTab;
  const search = (document.getElementById('cables-search-input')?.value || '').trim().toLowerCase();

  let filtered = allCables;
  if (activeTab !== 'all') filtered = filtered.filter(p => p.subcategory === activeTab);
  if (search) filtered = filtered.filter(p => String(p.name || '').toLowerCase().includes(search) || String(p.barcode || '').toLowerCase().includes(search));

  const tbody = document.getElementById('cables-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-14 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
              <span class="material-symbols-outlined text-[40px] opacity-30">cable</span>
              <span class="font-headline-sm font-bold text-on-surface">لا توجد وصلات مسجلة</span>
              <button onclick="window.openAddProductModal('cables')" class="mt-2 bg-secondary text-white px-5 py-2 rounded-xl text-xs font-bold">+ إضافة وصلة جديدة</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
          <td class="py-3 px-4 font-numeric-table font-bold text-secondary text-sm">
            <span class="cursor-pointer hover:underline" onclick="window.openSmartCodeActionModal('${item.id}')">${item.barcode || 'بدون كود'}</span>
          </td>
          <td class="py-3 px-4 font-bold text-on-surface text-sm">${item.name}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-lg text-xs bg-surface-container text-on-surface-variant">${getCableSubcategoryLabel(item.subcategory)}</span></td>
          <td class="py-3 px-4 font-numeric-table font-bold text-emerald-400">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-1.5 font-numeric-table font-bold text-sm">
              <span class="${item.quantity <= 2 ? 'text-rose-400' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">+</button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">-</button>
            </div>
          </td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant text-[11px]">${formatDateArabic(item.lastRestockedAt || item.createdAt)}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.openSmartCodeActionModal('${item.id}', 'restock')" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold transition-colors">+ توريد</button>
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"><span class="material-symbols-outlined text-[17px]">edit</span></button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400"><span class="material-symbols-outlined text-[17px]">delete</span></button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  const salesTbody = document.getElementById('cables-sales-table-body');
  if (salesTbody) {
    salesTbody.innerHTML = renderSalesTableHTML(sales, 'الوصلات');
  }
}

function getCableSubcategoryLabel(sub) {
  switch (sub) {
    case 'typec': return 'Type-C عريضة';
    case 'microusb': return 'Micro عادية';
    case 'pin': return 'Lightning / Pin آيفون';
    case 'aux': return 'وصلة صوت AUX';
    case 'otg': return 'وصلة OTG';
    default: return 'كابل / وصلة';
  }
}

window.setCablesTab = (tab) => {
  AppState.activeCablesTab = tab;
  document.querySelectorAll('[data-cables-tab]').forEach(btn => {
    btn.className = btn.getAttribute('data-cables-tab') === tab 
      ? 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-primary text-white shadow-sm ring-1 ring-rose-500/40 cursor-pointer'
      : 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 cursor-pointer';
  });
  renderCablesPage();
};

// ==========================================
// VIEW 5: HEADPHONES INVENTORY & SALES (السماعات)
// ==========================================

function renderHeadphonesPage() {
  const allHeadphones = Store.products.filter(p => p.category === 'headphones');
  const sales = getCategorySales('headphones');

  const totalCount = allHeadphones.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const totalCost = allHeadphones.reduce((acc, p) => acc + ((p.buyPrice || 0) * (p.quantity || 0)), 0);
  const totalRetail = allHeadphones.reduce((acc, p) => acc + ((p.sellPrice || 0) * (p.quantity || 0)), 0);
  const totalSalesVal = sales.reduce((acc, s) => acc + ((s.price || 0) * (s.quantity || 1)), 0);
  const totalProfitVal = sales.reduce((acc, s) => acc + (s.profit || 0), 0);

  setElemText('headphones-total-count', totalCount);
  setElemText('headphones-total-cost', formatMoney(totalCost));
  setElemText('headphones-count-badge', `${allHeadphones.length} أصناف`);

  setElemText('headphones-sales-total-val', `${formatMoney(totalSalesVal)} ج.م`);
  setElemText('headphones-sales-profit-val', `+${formatMoney(totalProfitVal)} ج.م`);
  setElemText('headphones-sales-count-badge', `${sales.length} مبيعات`);

  const activeTab = AppState.activeHeadphoneTab;
  const search = (document.getElementById('headphones-search-input')?.value || '').trim().toLowerCase();

  let filtered = allHeadphones;
  if (activeTab !== 'all') filtered = filtered.filter(p => p.subcategory === activeTab);
  if (search) filtered = filtered.filter(p => String(p.name || '').toLowerCase().includes(search) || String(p.barcode || '').toLowerCase().includes(search));

  const tbody = document.getElementById('headphones-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-14 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
              <span class="material-symbols-outlined text-[40px] opacity-30">headphones</span>
              <span class="font-headline-sm font-bold text-on-surface">لا توجد سماعات مسجلة</span>
              <button onclick="window.openAddProductModal('headphones')" class="mt-2 bg-secondary text-white px-5 py-2 rounded-xl text-xs font-bold">+ إضافة سماعة جديدة</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
          <td class="py-3 px-4 font-numeric-table font-bold text-secondary text-sm">
            <span class="cursor-pointer hover:underline" onclick="window.openSmartCodeActionModal('${item.id}')">${item.barcode || 'بدون كود'}</span>
          </td>
          <td class="py-3 px-4 font-bold text-on-surface text-sm">${item.name}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-lg text-xs bg-surface-container text-on-surface-variant">${getHeadphoneSubcategoryLabel(item.subcategory)}</span></td>
          <td class="py-3 px-4 font-numeric-table font-bold text-emerald-400">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-1.5 font-numeric-table font-bold text-sm">
              <span class="${item.quantity <= 2 ? 'text-rose-400' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">+</button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">-</button>
            </div>
          </td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant text-[11px]">${formatDateArabic(item.lastRestockedAt || item.createdAt)}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.openSmartCodeActionModal('${item.id}', 'restock')" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold transition-colors">+ توريد</button>
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"><span class="material-symbols-outlined text-[17px]">edit</span></button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400"><span class="material-symbols-outlined text-[17px]">delete</span></button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  const salesTbody = document.getElementById('headphones-sales-table-body');
  if (salesTbody) {
    salesTbody.innerHTML = renderSalesTableHTML(sales, 'السماعات');
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

window.setHeadphoneTab = (tab) => {
  AppState.activeHeadphoneTab = tab;
  document.querySelectorAll('[data-headphone-tab]').forEach(btn => {
    btn.className = btn.getAttribute('data-headphone-tab') === tab 
      ? 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-primary text-white shadow-sm ring-1 ring-rose-500/40 cursor-pointer'
      : 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 cursor-pointer';
  });
  renderHeadphonesPage();
};

// ==========================================
// VIEW 6: SPEAKERS INVENTORY & SALES (الصبات)
// ==========================================

function renderSpeakersPage() {
  const allSpeakers = Store.products.filter(p => p.category === 'speakers');
  const sales = getCategorySales('speakers');

  const totalCount = allSpeakers.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const totalCost = allSpeakers.reduce((acc, p) => acc + ((p.buyPrice || 0) * (p.quantity || 0)), 0);
  const totalSalesVal = sales.reduce((acc, s) => acc + ((s.price || 0) * (s.quantity || 1)), 0);
  const totalProfitVal = sales.reduce((acc, s) => acc + (s.profit || 0), 0);

  setElemText('kpiTotalCount', totalCount);
  setElemText('kpiTotalCost', formatMoney(totalCost));
  setElemText('speakers-count-badge', `${allSpeakers.length} صبات`);

  setElemText('speakers-sales-total-val', `${formatMoney(totalSalesVal)} ج.م`);
  setElemText('speakers-sales-profit-val', `+${formatMoney(totalProfitVal)} ج.م`);
  setElemText('speakers-sales-count-badge', `${sales.length} مبيعات`);

  const activeTab = AppState.activeSpeakerTab;
  const search = (document.getElementById('speakers-search-input')?.value || '').trim().toLowerCase();

  let filtered = allSpeakers;
  if (activeTab !== 'all') filtered = filtered.filter(p => p.subcategory === activeTab);
  if (search) filtered = filtered.filter(p => String(p.name || '').toLowerCase().includes(search) || String(p.barcode || '').toLowerCase().includes(search));

  const tbody = document.getElementById('speakersTableBody');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-14 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
              <span class="material-symbols-outlined text-[40px] opacity-30">speaker</span>
              <span class="font-headline-sm font-bold text-on-surface">لا توجد صبات مسجلة</span>
              <button onclick="window.openAddProductModal('speakers')" class="mt-2 bg-secondary text-white px-5 py-2 rounded-xl text-xs font-bold">+ إضافة صب جديد</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
          <td class="py-3 px-4 font-numeric-table font-bold text-secondary text-sm">
            <span class="cursor-pointer hover:underline" onclick="window.openSmartCodeActionModal('${item.id}')">${item.barcode || 'بدون كود'}</span>
          </td>
          <td class="py-3 px-4 font-bold text-on-surface text-sm">${item.name}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-lg text-xs bg-surface-container text-on-surface-variant">${item.subcategory || 'صب'}</span></td>
          <td class="py-3 px-4 font-numeric-table font-bold text-emerald-400">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-1.5 font-numeric-table font-bold text-sm">
              <span class="${item.quantity <= 2 ? 'text-rose-400' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">+</button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">-</button>
            </div>
          </td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant text-[11px]">${formatDateArabic(item.lastRestockedAt || item.createdAt)}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.openSmartCodeActionModal('${item.id}', 'restock')" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold transition-colors">+ توريد</button>
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"><span class="material-symbols-outlined text-[17px]">edit</span></button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400"><span class="material-symbols-outlined text-[17px]">delete</span></button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  const salesTbody = document.getElementById('speakers-sales-table-body');
  if (salesTbody) {
    salesTbody.innerHTML = renderSalesTableHTML(sales, 'الصبات');
  }
}

window.setSpeakerTab = (tab) => {
  AppState.activeSpeakerTab = tab;
  document.querySelectorAll('[data-speaker-tab]').forEach(btn => {
    btn.className = btn.getAttribute('data-speaker-tab') === tab 
      ? 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-primary text-white shadow-sm ring-1 ring-rose-500/40 cursor-pointer'
      : 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 cursor-pointer';
  });
  renderSpeakersPage();
};

// ==========================================
// VIEW 7: PHONES INVENTORY & SALES (الهواتف الذكية)
// ==========================================

function renderPhonesPage() {
  const allPhones = Store.products.filter(p => p.category === 'phones');
  const sales = getCategorySales('phones');

  const availablePhones = allPhones.filter(p => p.status === 'available');
  const soldPhones = allPhones.filter(p => p.status === 'sold');
  const totalCost = availablePhones.reduce((acc, p) => acc + (p.buyPrice || 0), 0);
  const totalRetail = availablePhones.reduce((acc, p) => acc + (p.sellPrice || 0), 0);
  const totalSalesVal = sales.reduce((acc, s) => acc + ((s.price || 0) * (s.quantity || 1)), 0);
  const totalProfitVal = sales.reduce((acc, s) => acc + (s.profit || 0), 0);

  setElemText('phones-count-badge', `${availablePhones.length} متاح بالمحل`);
  setElemText('phones-stat-cost', formatMoney(totalCost));
  setElemText('phones-stat-retail', formatMoney(totalRetail));

  setElemText('phones-sales-total-val', `${formatMoney(totalSalesVal)} ج.م`);
  setElemText('phones-sales-profit-val', `+${formatMoney(totalProfitVal)} ج.م`);
  setElemText('phones-sales-count-badge', `${sales.length} هواتف مباعة`);

  const activeBrand = AppState.activePhoneBrand;
  const activeStatus = AppState.activePhoneStatus;
  const search = (document.getElementById('phones-search-input')?.value || '').trim().toLowerCase();

  let filtered = allPhones;
  if (activeBrand !== 'all') filtered = filtered.filter(p => (p.brand || '').toLowerCase() === activeBrand.toLowerCase());
  if (activeStatus !== 'all') filtered = filtered.filter(p => p.status === activeStatus);
  if (search) {
    filtered = filtered.filter(p => 
      String(p.name || '').toLowerCase().includes(search) || 
      String(p.imei || '').toLowerCase().includes(search) ||
      String(p.barcode || '').toLowerCase().includes(search)
    );
  }

  const tbody = document.getElementById('phones-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-14 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
              <span class="material-symbols-outlined text-[40px] opacity-30">smartphone</span>
              <span class="font-headline-sm font-bold text-on-surface">لا توجد هواتف مسجلة</span>
              <button onclick="window.openAddProductModal('phones')" class="mt-2 bg-secondary text-white px-5 py-2 rounded-xl text-xs font-bold">+ إضافة هاتف جديد (IMEI)</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
          <td class="py-3 px-4 font-numeric-table font-bold text-secondary text-sm">
            <span class="cursor-pointer hover:underline" onclick="window.openSmartCodeActionModal('${item.id}')">${item.imei || item.barcode || 'بدون كود'}</span>
          </td>
          <td class="py-3 px-4 font-bold text-on-surface text-sm">${item.name} (${item.brand || ''})</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-lg text-xs bg-surface-container text-on-surface-variant">${item.storage || ''} ${item.color ? '- ' + item.color : ''}</span></td>
          <td class="py-3 px-4">
            ${item.linkedPhoneNumber || item.customerPhone ? `
              <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold font-numeric-table text-xs border border-emerald-500/20">
                <span class="material-symbols-outlined text-[15px]">call</span>
                <span>${item.linkedPhoneNumber || item.customerPhone}</span>
                <button onclick="window.openLinkPhoneModal('${item.id}')" title="تغيير الرقم المرتبط" class="text-on-surface-variant hover:text-secondary underline mr-1 text-[10px]">تعديل</button>
              </div>
            ` : `
              <button onclick="window.openLinkPhoneModal('${item.id}')" class="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary text-xs font-bold transition-colors inline-flex items-center gap-1 border border-outline-variant/30">
                <span class="material-symbols-outlined text-[14px]">add_call</span>
                + ربط برقم
              </button>
            `}
          </td>
          <td class="py-3 px-4 font-numeric-table font-bold text-emerald-400">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${item.status === 'available' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'}">
              ${item.status === 'available' ? 'متوفر بالمحل' : 'تم البيع'}
            </span>
          </td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant text-[11px]">${formatDateArabic(item.createdAt)}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              ${item.status === 'available' ? `
                <span class="px-2 py-0.5 rounded text-[11px] bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">متوفر</span>
              ` : ''}
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"><span class="material-symbols-outlined text-[17px]">edit</span></button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400"><span class="material-symbols-outlined text-[17px]">delete</span></button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  const salesTbody = document.getElementById('phones-sales-table-body');
  if (salesTbody) {
    salesTbody.innerHTML = renderSalesTableHTML(sales, 'الهواتف');
  }
}

window.setPhoneBrandFilter = (brand) => {
  AppState.activePhoneBrand = brand;
  document.querySelectorAll('[data-phone-brand]').forEach(btn => {
    btn.className = btn.getAttribute('data-phone-brand') === brand 
      ? 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-primary text-white shadow-sm ring-1 ring-rose-500/40 cursor-pointer'
      : 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 cursor-pointer';
  });
  renderPhonesPage();
};

window.setPhoneStatusFilter = (status) => {
  AppState.activePhoneStatus = status;
  renderPhonesPage();
};

// ==========================================
// VIEW 8: COVERS INVENTORY & SALES (صفحة الجرابات الجديدة)
// ==========================================

function renderCoversPage() {
  const allCovers = Store.products.filter(p => p.category === 'covers');
  const sales = getCategorySales('covers');

  const totalQty = allCovers.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const costVal = allCovers.reduce((acc, p) => acc + ((p.buyPrice || 0) * (p.quantity || 0)), 0);
  const retailVal = allCovers.reduce((acc, p) => acc + ((p.sellPrice || 0) * (p.quantity || 0)), 0);
  const totalSalesVal = sales.reduce((acc, s) => acc + ((s.price || 0) * (s.quantity || 1)), 0);
  const totalProfitVal = sales.reduce((acc, s) => acc + (s.profit || 0), 0);

  setElemText('covers-stat-qty', totalQty);
  setElemText('covers-stat-cost', formatMoney(costVal));
  setElemText('covers-stat-retail', formatMoney(retailVal));
  setElemText('covers-count-badge', `${allCovers.length} جرابات`);

  setElemText('covers-sales-total-val', `${formatMoney(totalSalesVal)} ج.م`);
  setElemText('covers-sales-profit-val', `+${formatMoney(totalProfitVal)} ج.م`);
  setElemText('covers-sales-count-badge', `${sales.length} مبيعات`);

  const activeTab = AppState.activeCoversTab;
  const search = (document.getElementById('covers-search-input')?.value || '').trim().toLowerCase();

  let filtered = allCovers;
  if (activeTab !== 'all') filtered = filtered.filter(p => p.subcategory === activeTab);
  if (search) filtered = filtered.filter(p => String(p.name || '').toLowerCase().includes(search) || String(p.barcode || '').toLowerCase().includes(search));

  const tbody = document.getElementById('covers-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-14 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
              <span class="material-symbols-outlined text-[40px] opacity-30">shield</span>
              <span class="font-headline-sm font-bold text-on-surface">لا توجد جرابات مسجلة بالمخزن</span>
              <p class="text-xs">امسح الباركود أو اكتب الكود يدوي لإدخال جراب جديد في هذا القسم.</p>
              <button onclick="window.openAddProductModal('covers')" class="mt-2 bg-secondary text-white px-5 py-2 rounded-xl text-xs font-bold">+ إضافة جراب جديد</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
          <td class="py-3 px-4 font-numeric-table font-bold text-secondary text-sm">
            <span class="cursor-pointer hover:underline" onclick="window.openSmartCodeActionModal('${item.id}')">${item.barcode || 'بدون كود'}</span>
          </td>
          <td class="py-3 px-4 font-bold text-on-surface text-sm">${item.name}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-lg text-xs bg-surface-container text-on-surface-variant">${getCoverSubcategoryLabel(item.subcategory)}</span></td>
          <td class="py-3 px-4 font-numeric-table font-bold text-emerald-400">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-1.5 font-numeric-table font-bold text-sm">
              <span class="${item.quantity <= 2 ? 'text-rose-400' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">+</button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">-</button>
            </div>
          </td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant text-[11px]">${formatDateArabic(item.lastRestockedAt || item.createdAt)}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.openSmartCodeActionModal('${item.id}', 'restock')" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold transition-colors">+ توريد</button>
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"><span class="material-symbols-outlined text-[17px]">edit</span></button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400"><span class="material-symbols-outlined text-[17px]">delete</span></button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  const salesTbody = document.getElementById('covers-sales-table-body');
  if (salesTbody) {
    salesTbody.innerHTML = renderSalesTableHTML(sales, 'الجرابات');
  }
}

function getCoverSubcategoryLabel(sub) {
  switch (sub) {
    case 'clear': return 'جراب شفاف';
    case 'silicone': return 'جراب سيليكون';
    case 'armor': return 'جراب حماية ضد الصدمات';
    case 'leather': return 'جراب جلد فاخر';
    case 'magsafe': return 'جراب ماج سيف (MagSafe)';
    case 'wallet': return 'جراب محفظة';
    default: return 'جراب هاتف';
  }
}

window.setCoversTab = (tab) => {
  AppState.activeCoversTab = tab;
  document.querySelectorAll('[data-covers-tab]').forEach(btn => {
    btn.className = btn.getAttribute('data-covers-tab') === tab 
      ? 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-primary text-white shadow-sm ring-1 ring-rose-500/40 cursor-pointer'
      : 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 cursor-pointer';
  });
  renderCoversPage();
};

// ==========================================
// VIEW 9: ACCESSORIES INVENTORY & SALES (الإكسسوارات)
// ==========================================

function renderAccessoriesPage() {
  const allAcc = Store.products.filter(p => p.category === 'accessories');
  const sales = getCategorySales('accessories');

  const totalQty = allAcc.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const costVal = allAcc.reduce((acc, p) => acc + ((p.buyPrice || 0) * (p.quantity || 0)), 0);
  const retailVal = allAcc.reduce((acc, p) => acc + ((p.sellPrice || 0) * (p.quantity || 0)), 0);
  const totalSalesVal = sales.reduce((acc, s) => acc + ((s.price || 0) * (s.quantity || 1)), 0);
  const totalProfitVal = sales.reduce((acc, s) => acc + (s.profit || 0), 0);

  setElemText('accessories-stat-qty', totalQty);
  setElemText('accessories-stat-cost', formatMoney(costVal));
  setElemText('accessories-stat-retail', formatMoney(retailVal));
  setElemText('accessories-count-badge', `${allAcc.length} إكسسوارات`);

  setElemText('accessories-sales-total-val', `${formatMoney(totalSalesVal)} ج.م`);
  setElemText('accessories-sales-profit-val', `+${formatMoney(totalProfitVal)} ج.م`);
  setElemText('accessories-sales-count-badge', `${sales.length} مبيعات`);

  const activeTab = AppState.activeAccessoriesTab;
  const search = (document.getElementById('accessories-search-input')?.value || '').trim().toLowerCase();

  let filtered = allAcc;
  if (activeTab !== 'all') filtered = filtered.filter(p => p.subcategory === activeTab);
  if (search) filtered = filtered.filter(p => String(p.name || '').toLowerCase().includes(search) || String(p.barcode || '').toLowerCase().includes(search));

  const tbody = document.getElementById('accessories-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-14 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
              <span class="material-symbols-outlined text-[40px] opacity-30">devices_other</span>
              <span class="font-headline-sm font-bold text-on-surface">لا توجد إكسسوارات مسجلة</span>
              <button onclick="window.openAddProductModal('accessories')" class="mt-2 bg-secondary text-white px-5 py-2 rounded-xl text-xs font-bold">+ إضافة إكسسوار جديد</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
          <td class="py-3 px-4 font-numeric-table font-bold text-secondary text-sm">
            <span class="cursor-pointer hover:underline" onclick="window.openSmartCodeActionModal('${item.id}')">${item.barcode || 'بدون كود'}</span>
          </td>
          <td class="py-3 px-4 font-bold text-on-surface text-sm">${item.name}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-lg text-xs bg-surface-container text-on-surface-variant">${item.subcategory || 'إكسسوار'}</span></td>
          <td class="py-3 px-4 font-numeric-table font-bold text-emerald-400">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-1.5 font-numeric-table font-bold text-sm">
              <span class="${item.quantity <= 2 ? 'text-rose-400' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">+</button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold">-</button>
            </div>
          </td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant text-[11px]">${formatDateArabic(item.lastRestockedAt || item.createdAt)}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.openSmartCodeActionModal('${item.id}', 'restock')" class="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold transition-colors">+ توريد</button>
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"><span class="material-symbols-outlined text-[17px]">edit</span></button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400"><span class="material-symbols-outlined text-[17px]">delete</span></button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }

  const salesTbody = document.getElementById('accessories-sales-table-body');
  if (salesTbody) {
    salesTbody.innerHTML = renderSalesTableHTML(sales, 'الإكسسوارات');
  }
}

window.setAccessoriesTab = (tab) => {
  AppState.activeAccessoriesTab = tab;
  document.querySelectorAll('[data-accessories-tab]').forEach(btn => {
    btn.className = btn.getAttribute('data-accessories-tab') === tab 
      ? 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-primary text-white shadow-sm ring-1 ring-rose-500/40 cursor-pointer'
      : 'px-4 py-2 rounded-xl text-xs font-bold transition-all bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 cursor-pointer';
  });
  renderAccessoriesPage();
};

// =========================================================================
// SMART QUICK CODE SYSTEM ("اكتب الكود يطلب مني بيع أو تسجيل")
// =========================================================================

// Arabic digit to Latin digit conversion (٠١٢٣٤٥٦٧٨٩ -> 0123456789)
window.normalizeArabicDigits = function(str) {
  if (!str) return '';
  const arabicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(str).replace(/[٠-٩]/g, d => arabicDigits.indexOf(d));
};

window.updateQuickCodeDisplay = function() {
  const codeInput = document.getElementById('quickCodeManualInput');
  const clearBtn = document.getElementById('quickCodeClearBtn');
  const executeBtnText = document.getElementById('quickCodeExecuteBtnText');
  const liveBadge = document.getElementById('quickCodeLiveBadge');
  const liveNum = document.getElementById('quickCodeLiveNum');
  const matchHint = document.getElementById('quickCodeMatchHint');

  if (!codeInput) return;

  // Convert Arabic numerals to Latin numerals on the fly
  const originalVal = codeInput.value || '';
  const normalized = window.normalizeArabicDigits(originalVal);
  if (normalized !== originalVal) {
    const selStart = codeInput.selectionStart;
    codeInput.value = normalized;
    try { codeInput.setSelectionRange(selStart, selStart); } catch(e){}
  }

  const val = codeInput.value.trim();

  // 1. Toggle Clear Button
  if (clearBtn) {
    if (val.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  // 2. Update Execute Button Text dynamically (e.g. "تنفيذ ( 2 ) ↵")
  if (executeBtnText) {
    if (val.length > 0) {
      executeBtnText.textContent = `تنفيذ ( ${val} ) ↵`;
    } else {
      executeBtnText.textContent = 'تنفيذ ↵';
    }
  }

  // 3. Update Live Code Badge
  if (liveBadge && liveNum) {
    if (val.length > 0) {
      liveNum.textContent = val;
      liveBadge.classList.remove('hidden');
    } else {
      liveBadge.classList.add('hidden');
    }
  }

  // 4. Inline Found Item Hint (without dropdown list)
  if (matchHint) {
    if (val.length > 0 && Array.isArray(Store.products) && Store.products.length > 0) {
      const q = val.toLowerCase();
      const qNum = parseInt(val, 10);
      const matched = Store.products.find(p => {
        const b = String(p.barcode != null ? p.barcode : '').trim().toLowerCase();
        const id = String(p.id != null ? p.id : '').trim().toLowerCase();
        if (b && b === q) return true;
        if (id && id === q) return true;
        if (!isNaN(qNum) && parseInt(b, 10) === qNum) return true;
        return false;
      });
      if (matched) {
        matchHint.textContent = `✓ ${matched.name}`;
        matchHint.classList.remove('hidden');
      } else {
        matchHint.classList.add('hidden');
      }
    } else {
      matchHint.classList.add('hidden');
    }
  }
};

function setupSmartCodeEvents() {
  const codeInput = document.getElementById('quickCodeManualInput');

  if (codeInput) {
    codeInput.addEventListener('input', () => {
      window.updateQuickCodeDisplay();
    });

    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.triggerManualCodeSearch();
      }
    });

    codeInput.addEventListener('focus', () => {
      window.updateQuickCodeDisplay();
    });
  }

  // Global listener: If user types numbers while not focused on another input or open modal,
  // automatically redirect digits to the code input so numbers are never lost!
  window.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
    if (isInput) return;

    // Check if any modal is currently visible
    const openModal = document.querySelector('[id^="modal-"]:not(.hidden), .modal-backdrop:not(.hidden)');
    if (openModal) return;

    // If typing digits 0-9 or Arabic digits
    if (/^[0-9٠-٩]$/.test(e.key)) {
      const quickInput = document.getElementById('quickCodeManualInput');
      if (quickInput) {
        quickInput.focus();
        quickInput.value += window.normalizeArabicDigits(e.key);
        window.updateQuickCodeDisplay();
        e.preventDefault();
      }
    }
  });

  // Auto-focus code input on initial page load
  setTimeout(() => {
    const input = document.getElementById('quickCodeManualInput');
    if (input && document.activeElement === document.body) {
      input.focus();
    }
  }, 400);
}

window.clearQuickCodeInput = function() {
  const codeInput = document.getElementById('quickCodeManualInput');
  if (codeInput) {
    codeInput.value = '';
    codeInput.focus();
  }
  window.updateQuickCodeDisplay();
};

window.triggerCloudSyncManual = async function() {
  showToast("⏳ جاري مزامنة ورفع كافة بيانات المحل إلى سحابة فيربيز (helmy-10237)...", "info", 3000);
  if (typeof window.pushAllLocalDataToFirestore === 'function') {
    const success = await window.pushAllLocalDataToFirestore();
    if (success) {
      showToast("🔥 تم بنجاح رفع وتأكيد كافة الأصناف والفواتير والخطوط في سحابة فيربيز!", "check_circle", 5000);
    } else {
      showToast("⚠️ تعذّر الاتصال السحابي حالياً - البيانات محفوظة بأمان محلياً على الهارد ديسك", "warning", 5000);
    }
  }
};

window.triggerManualCodeSearch = function() {
  const codeInput = document.getElementById('quickCodeManualInput');
  if (!codeInput) return;
  const val = codeInput.value.trim();
  if (!val) {
    showToast("يرجى كتابة رقم الكود أو الباركود أولاً", "warning");
    return;
  }
  handleScannedBarcode(val);
};

window.openSmartCodeActionModal = function(code, defaultAction = 'choose') {
  if (!code) return;
  const cleanCode = String(code).trim();
  if (!cleanCode) return;

  const q = cleanCode.toLowerCase();
  const qNum = parseInt(cleanCode, 10);

  // 1. Exact match on barcode, IMEI, or ID
  let prod = Store.products.find(p => {
    const bStr = String(p.barcode != null ? p.barcode : '').trim().toLowerCase();
    const imeiStr = String(p.imei != null ? p.imei : '').trim().toLowerCase();
    const idStr = String(p.id != null ? p.id : '').trim().toLowerCase();
    return (bStr && bStr === q) || (imeiStr && imeiStr === q) || (idStr && idStr === q);
  });

  // 2. Numeric match (e.g., "70" matches numeric 70 or 070)
  if (!prod && !isNaN(qNum)) {
    prod = Store.products.find(p => {
      const bStr = String(p.barcode != null ? p.barcode : '').trim();
      const bNum = parseInt(bStr, 10);
      return !isNaN(bNum) && bNum === qNum;
    });
  }

  // 3. Substring / Containment fallback
  if (!prod) {
    prod = Store.products.find(p => {
      const bStr = String(p.barcode != null ? p.barcode : '').trim().toLowerCase();
      const imeiStr = String(p.imei != null ? p.imei : '').trim().toLowerCase();
      return (bStr && (bStr.includes(q) || q.includes(bStr))) || (imeiStr && imeiStr.includes(q));
    });
  }

  // 4. Product Name fallback
  if (!prod) {
    prod = Store.products.find(p => {
      const nameStr = String(p.name != null ? p.name : '').trim().toLowerCase();
      return nameStr && nameStr.includes(q);
    });
  }

  if (!prod) {
    playScanBeep(false);
    showToast(`الكود [${cleanCode}] غير مسجل بعد! جاري فتح نموذج تسجيل صنف جديد...`, 'warning');
    window.openAddProductModal(getDefaultCategoryForCurrentView(), null, cleanCode);
    return;
  }

  AppState.currentSmartProduct = prod;

  // Populate Modal Fields
  setElemText('smart-modal-code-badge', `كود: ${prod.barcode || prod.imei || cleanCode}`);
  setElemText('smart-modal-category-badge', getCategoryArabicName(prod.category));
  setElemText('smart-modal-prod-name', prod.name);
  setElemText('smart-modal-stock', `${prod.quantity || 0} قطع بالمخزن`);
  setElemText('smart-modal-sell-price', `${formatMoney(prod.sellPrice)} ج.م`);
  setElemText('smart-modal-last-date', formatDateArabic(prod.lastRestockedAt || prod.createdAt));

  // Initialize sale inputs
  setElemValue('smart-sale-qty', '1');
  setElemValue('smart-sale-price', prod.sellPrice || 0);
  setElemValue('smart-sale-customer', 'عميل نقدي');
  setElemValue('smart-sale-phone', '');

  // Initialize restock inputs
  setElemValue('smart-restock-qty', '1');
  setElemValue('smart-restock-buy-price', prod.buyPrice || 0);
  setElemValue('smart-restock-sell-price', prod.sellPrice || 0);

  const modal = document.getElementById('modal-smart-code-action');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  // Switch to preferred action tab
  if (defaultAction === 'sale') {
    window.setSmartModalTab('sale');
  } else if (defaultAction === 'restock') {
    window.setSmartModalTab('restock');
  } else {
    window.setSmartModalTab('choose');
  }
};

window.closeSmartCodeActionModal = function() {
  AppState.currentSmartProduct = null;
  const modal = document.getElementById('modal-smart-code-action');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.setSmartModalTab = function(tab) {
  const chooseSec = document.getElementById('smart-action-choose-section');
  const saleSec = document.getElementById('smart-action-sale-section');
  const restockSec = document.getElementById('smart-action-restock-section');

  if (tab === 'choose') {
    chooseSec?.classList.remove('hidden');
    saleSec?.classList.add('hidden');
    restockSec?.classList.add('hidden');
  } else if (tab === 'sale') {
    chooseSec?.classList.add('hidden');
    saleSec?.classList.remove('hidden');
    restockSec?.classList.add('hidden');
    setTimeout(() => document.getElementById('smart-sale-qty')?.focus(), 100);
  } else if (tab === 'restock') {
    chooseSec?.classList.add('hidden');
    saleSec?.classList.add('hidden');
    restockSec?.classList.remove('hidden');
    setTimeout(() => document.getElementById('smart-restock-qty')?.focus(), 100);
  }
};

// Confirm Direct Sale from Smart Code Modal
window.confirmSmartCodeSale = async function() {
  const prod = AppState.currentSmartProduct;
  if (!prod) return;

  const qty = parseInt(document.getElementById('smart-sale-qty')?.value, 10) || 1;
  const sellPrice = parseFloat(document.getElementById('smart-sale-price')?.value) || prod.sellPrice || 0;
  const customerName = (document.getElementById('smart-sale-customer')?.value || '').trim() || 'عميل نقدي';
  const customerPhone = (document.getElementById('smart-sale-phone')?.value || '').trim();

  const prevQty = parseInt(prod.quantity, 10) || 0;
  if (prevQty < qty) {
    showToast(`⚠️ الكمية المتوفرة بالمخزن (${prevQty}) أقل من المطلوب (${qty}) - تم البيع وتحديث الرصيد`, 'warning', 3500);
  }

  try {
    const saleResult = await recordDirectCategorySale({
      productId: prod.id,
      barcode: prod.barcode || prod.imei,
      name: prod.name,
      category: prod.category,
      quantity: qty,
      sellPrice,
      buyPrice: prod.buyPrice || 0,
      customerName,
      customerPhone,
      saleDate: new Date().toISOString()
    });

    closeSmartCodeActionModal();
    playScanBeep(true);

    const remainingStock = saleResult._remainingStock !== undefined ? saleResult._remainingStock : Math.max(0, prevQty - qty);

    // 1. Toast for sale registration
    showToast(`⚡ تم تسجيل بيع [${prod.name}] فوراً في قسم المبيعات! (المتبقي: ${remainingStock} حبة)`, 'check_circle', 3000);

    // 2. Real-time shortage alert as demanded by user:
    // "لو عندي من الحاجة 30 بعت 29 يتفضل واحدة يقول لي دي فضل، ويقول لي دي من ضمن النواقص"
    if (remainingStock <= 2) {
      setTimeout(() => {
        if (remainingStock === 1) {
          showToast(`⚠️ تنبيه نواقص عاجل: تم بيع [${prod.name}]! فاضل قطعة واحدة فقط (1) وأصبح من ضمن النواقص! يرجى طلب توريد كمية جديدة فوراً.`, 'warning', 7000);
          playScanBeep(false);
        } else if (remainingStock <= 0) {
          showToast(`🚨 تنبيه نفاد كمية: تم بيع [${prod.name}]! فاضل 0 (نفذت الكمية تماماً) - تم إدراجه فوراً في كشف النواقص!`, 'error', 7000);
          playScanBeep(false);
        } else if (remainingStock === 2) {
          showToast(`⚠️ تنبيه نواقص: تم بيع [${prod.name}]! فاضل 2 قطع فقط وأصبح من ضمن النواقص.`, 'warning', 6000);
        }
      }, 450);
    }

    // 3. Immediately refresh current view & header badges
    updateGlobalHeaderBadges();

    // Switch to master sales page and re-render instantly
    navigateTo('all-sales-master');
    window.setAllSalesDateFilter('all');
    renderAllSalesMasterPage();
  } catch (e) {
    console.error(e);
    showToast('حدث خطأ أثناء تسجيل عملية البيع', 'error');
  }
};

// Confirm Restock from Smart Code Modal
window.confirmSmartCodeRestock = async function() {
  const prod = AppState.currentSmartProduct;
  if (!prod) return;

  const qty = parseInt(document.getElementById('smart-restock-qty')?.value, 10) || 1;
  const newBuyPrice = document.getElementById('smart-restock-buy-price')?.value;
  const newSellPrice = document.getElementById('smart-restock-sell-price')?.value;

  try {
    await recordDirectCategoryRestock({
      productId: prod.id,
      deltaQty: qty,
      newBuyPrice,
      newSellPrice,
      restockDate: new Date().toISOString()
    });

    closeSmartCodeActionModal();
    playScanBeep(true);
    showToast(`📦 تم توريد +${qty} حبات إلى مخزون ${getCategoryArabicName(prod.category)} وتحديث التاريخ بنجاح!`, 'inventory_2');

    // Switch to category inventory page
    navigateTo(getCategoryViewPath(prod.category));
    window.switchCategoryTab(prod.category, 'inventory');
  } catch (e) {
    console.error(e);
    showToast('حدث خطأ أثناء توريد المخزون', 'error');
  }
};

// Quick Stock Increment (+1, +5, +10)
window.quickAdjustStock = async function(prodId, delta) {
  const prod = Store.products.find(p => p.id === prodId);
  if (!prod) return;

  try {
    await adjustProductStock(prodId, delta);
    showToast(`تم تعديل مخزون [${prod.name}]: ${delta > 0 ? '+' + delta : delta} حبة`, 'check_circle');
  } catch (e) {
    showToast('خطأ أثناء تعديل المخزون', 'error');
  }
};

// ==========================================
// HARDWARE SCANNER & BARCODE DISPATCHER
// ==========================================

let barcodeBuffer = '';
let lastKeyTime = Date.now();

function setupBarcodeScannerListener() {
  window.addEventListener('keydown', (e) => {
    // If active element is an input or textarea (except general barcode inputs), don't intercept typing
    const active = document.activeElement;
    const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
    const isSpecialBarInput = active && (active.id === 'barcodeScannerInput' || active.id === 'pos-barcode-search' || active.id === 'quickCodeManualInput');

    const currentTime = Date.now();

    if (e.key === 'Enter') {
      if (barcodeBuffer.length >= 2) {
        e.preventDefault();
        const code = barcodeBuffer.trim();
        barcodeBuffer = '';
        handleScannedBarcode(code);
        return;
      }
      barcodeBuffer = '';
      return;
    }

    if (e.key.length === 1) {
      if (currentTime - lastKeyTime > 100) {
        barcodeBuffer = '';
      }
      barcodeBuffer += e.key;
      lastKeyTime = currentTime;

      // Hardware gun auto-capture when not inside a text field
      if (!isInput) {
        if (barcodeBuffer.length >= 3) {
          clearTimeout(window._barcodeScanTimeout);
          window._barcodeScanTimeout = setTimeout(() => {
            if (barcodeBuffer.length >= 3) {
              const code = barcodeBuffer.trim();
              barcodeBuffer = '';
              handleScannedBarcode(code);
            }
          }, 70);
        }
      }
    }
  });
}

export function handleScannedBarcode(barcode, targetField = null) {
  if (!barcode) return;
  const cleanCode = barcode.trim();
  if (cleanCode.length < 1) return;

  console.log(`🔍 Scanned / Entered Code: ${cleanCode}`);
  playScanBeep(true);

  // 1. If Product Form is currently open
  const prodFormModal = document.getElementById('modal-product-form');
  if (targetField === 'prod-barcode' || (prodFormModal && !prodFormModal.classList.contains('hidden'))) {
    const barInput = document.getElementById('prod-barcode');
    if (barInput) {
      barInput.value = cleanCode;
      barInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const cat = document.getElementById('prod-category')?.value;
    if (cat === 'phones') {
      const imeiInput = document.getElementById('prod-phone-imei');
      if (imeiInput && !imeiInput.value) imeiInput.value = cleanCode;
    }
    showToast(`تم مسح الباركود بنجاح: ${cleanCode}`, 'barcode_scanner');
    document.getElementById('prod-name')?.focus();
    return;
  }

  // 2. If Quick POS is currently open
  const posModal = document.getElementById('modal-quick-pos');
  if (targetField === 'pos' || (posModal && !posModal.classList.contains('hidden'))) {
    const q = cleanCode.toLowerCase();
    const qNum = parseInt(cleanCode, 10);
    const product = Store.products.find(p => {
      const bStr = String(p.barcode != null ? p.barcode : '').trim().toLowerCase();
      const imeiStr = String(p.imei != null ? p.imei : '').trim().toLowerCase();
      if (bStr === q || imeiStr === q) return true;
      if (!isNaN(qNum)) {
        const bNum = parseInt(bStr, 10);
        if (!isNaN(bNum) && bNum === qNum) return true;
      }
      return false;
    });

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
      showToast(`الباركود [${cleanCode}] غير مسجل. جاري فتح نموذج الإضافة...`, 'warning');
      window.openAddProductModal(getDefaultCategoryForCurrentView(), null, cleanCode);
    }
    return;
  }

  // 3. General Screen: Smart Code Action Modal (بيع أو تسجيل)
  window.openSmartCodeActionModal(cleanCode);
}

function getDefaultCategoryForCurrentView() {
  switch (AppState.currentView) {
    case 'manual-inventory': return 'manual';
    case 'chargers-inventory': return 'chargers';
    case 'cables-inventory': return 'cables';
    case 'headphones-audio': return 'headphones';
    case 'speakers-sound': return 'speakers';
    case 'phones-sales-inventory': return 'phones';
    case 'covers-inventory': return 'covers';
    case 'accessories-inventory': return 'accessories';
    default: return 'chargers';
  }
}

// ==========================================
// SMS FORWARDER & WEBHOOK AUTO-SYNC
// ==========================================

function startSMSPoller() {
  if (typeof window === 'undefined') return;
  setInterval(async () => {
    try {
      const res = await fetch('/api/recent-sms');
      if (res.ok) {
        const data = await res.json();
        if (data.sms && data.sms.length > 0) {
          handleIncomingServerSMSList(data.sms);
        }
      }
    } catch (e) {
      // In local file:/// mode or server offline, fail silently
    }
  }, 3000);
}

function handleIncomingServerSMSList(smsList) {
  if (!Array.isArray(smsList) || smsList.length === 0) return;

  const processedList = JSON.parse(localStorage.getItem('hilmy_processed_sms_ids_v2') || '[]');
  const processedSet = new Set(processedList);
  const deletedBlacklist = getDeletedSMSBlacklist ? getDeletedSMSBlacklist() : new Set();
  let hasNew = false;

  smsList.forEach(smsItem => {
    if (!smsItem || !smsItem.id) return;
    if (deletedBlacklist.has(smsItem.id)) return; // Skipped permanently!
    if (processedSet.has(smsItem.id)) return; // Already seen/processed!

    processedSet.add(smsItem.id);
    hasNew = true;

    processIncomingSMS({
      sender: smsItem.sender,
      body: smsItem.message,
      simPhone: smsItem.sim,
      slot: smsItem.sim,
      timestamp: smsItem.timestamp
    });
  });

  if (hasNew) {
    localStorage.setItem('hilmy_processed_sms_ids_v2', JSON.stringify(Array.from(processedSet).slice(-400)));
    playScanBeep(true);
    showToast('📩 تم استقبال رسالة كاش جديدة وتحديث المحفظة تلقائياً!', 'mark_email_read');
    renderVodafoneHub();
    renderVodafoneMonitor();
    renderSmsSyncHub();
  }
}

window.confirmDeleteSMS = (smsId) => {
  if (confirm("هل تريد حذف هذه الرسالة نهائياً؟")) {
    deleteSMS(smsId);
    showToast("تم حذف الرسالة نهائياً", "delete");
    renderSmsSyncHub();
  }
};

window.confirmClearAllSMS = () => {
  if (confirm("هل أنت متأكد من تفريغ ومسح سجل رسائل الكاش بالكامل؟")) {
    clearAllSMS();
    showToast("تم تفريغ سجل الرسائل بالكامل بنجاح", "delete");
    renderSmsSyncHub();
  }
};

function renderSmsSyncHub() {
  const tbody = document.getElementById('sms-sync-history-tbody');
  if (tbody) {
    const inbox = Store.smsInbox || [];
    if (inbox.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-on-surface-variant">
            <span class="text-xs">لم يتم استلام أي رسائل كاش من الهاتف حتى الآن. استخدم تطبيق SMS Forwarder على هاتفك أو الصق الرسالة يدوياً.</span>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = inbox.map(item => {
        const p = item.parsed || {};
        return `
          <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
            <td class="py-2.5 px-3 font-numeric-table font-bold">${formatDateArabic(item.timestamp)}</td>
            <td class="py-2.5 px-3 font-bold">${item.sender || 'فودافون كاش'}</td>
            <td class="py-2.5 px-3 max-w-xs truncate" title="${item.body}">${item.body}</td>
            <td class="py-2.5 px-3 font-numeric-table font-bold ${p.type === 'deposit' ? 'text-emerald-400' : 'text-rose-400'}">
              ${p.type === 'deposit' ? '+' : '-'}${formatMoney(p.amount || 0)} ج.م
            </td>
            <td class="py-2.5 px-3 font-bold text-on-surface">
              ${item.matchedLineNum ? 'خط ' + item.matchedLineNum : 'غير محدد'}
            </td>
            <td class="py-2.5 px-3 text-center">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${item.isProcessed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}">
                ${item.isProcessed ? 'تم التسجيل بنجاح' : 'معلق'}
              </span>
            </td>
            <td class="py-2.5 px-3 text-center">
              <button onclick="window.confirmDeleteSMS('${item.id}')" class="p-1 rounded text-on-surface-variant hover:text-rose-400 cursor-pointer" title="حذف الرسالة">
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Fetch LAN IP for display
  fetch('/api/network-info')
    .then(r => r.json())
    .then(data => {
      if (data.urls && data.urls[0]) {
        setElemText('sms-webhook-url-display', `${data.urls[0]}/api/sms-webhook`);
        setElemText('mobile-network-url-display', data.urls[0]);
      }
    })
    .catch(() => {
      setElemText('sms-webhook-url-display', 'http://192.168.1.X:3000/api/sms-webhook');
      setElemText('mobile-network-url-display', 'http://192.168.1.X:3000');
    });
}

// Manual SMS Parser Modal
window.openSMSParserModal = function() {
  const modal = document.getElementById('modal-sms-parser');
  if (modal) {
    setElemValue('manual-sms-input-text', '');
    const preview = document.getElementById('sms-parser-live-preview');
    if (preview) preview.classList.add('hidden');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('manual-sms-input-text')?.focus(), 100);
  }
};

window.closeSMSParserModal = function() {
  const modal = document.getElementById('modal-sms-parser');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.liveParsePastedSMS = function() {
  const text = document.getElementById('manual-sms-input-text')?.value || '';
  const parsed = parseCashSMS(text);
  const preview = document.getElementById('sms-parser-live-preview');

  if (!parsed || !parsed.isCashSMS) {
    if (preview) preview.classList.add('hidden');
    return;
  }

  if (preview) preview.classList.remove('hidden');

  setElemText('sms-preview-provider', parsed.provider.toUpperCase());
  setElemText('sms-preview-type', parsed.type === 'deposit' ? 'إيداع / استلام (+)' : 'تحويل / سحب (-)');
  setElemText('sms-preview-amount', `${formatMoney(parsed.amount)} ج.م`);
  setElemText('sms-preview-customer', parsed.customerPhone || 'غير مذكور');
  setElemText('sms-preview-balance-after', parsed.balanceAfter !== null ? `${formatMoney(parsed.balanceAfter)} ج.م` : 'غير مذكور');
  setElemText('sms-preview-txid', parsed.transactionId || 'تلقائي');

  // Match line
  let targetLine = 1;
  if (parsed.customerPhone) {
    const match = Store.vodafoneLines.find(l => l.phone && l.phone.includes(parsed.customerPhone));
    if (match) targetLine = match.lineNum;
  }
  setElemValue('sms-target-line-select', targetLine);
};

window.confirmApplyPastedSMS = async function() {
  const text = document.getElementById('manual-sms-input-text')?.value || '';
  const parsed = parseCashSMS(text);
  if (!parsed || !parsed.isCashSMS) {
    showToast("تعذر التعرف على بيانات الرسالة", "warning");
    return;
  }

  const lineNum = parseInt(document.getElementById('sms-target-line-select')?.value, 10) || 1;

  try {
    await recordVodafoneTransaction({
      lineNum,
      type: parsed.type,
      amount: parsed.amount,
      commission: parsed.commission || 0,
      customerPhone: parsed.customerPhone || '',
      notes: `رسالة نصية (${parsed.transactionId ? '#' + parsed.transactionId : 'يدوية'})`
    });

    if (parsed.balanceAfter !== null && !isNaN(parsed.balanceAfter)) {
      const idx = Store.vodafoneLines.findIndex(l => l.lineNum === lineNum);
      if (idx !== -1) {
        Store.vodafoneLines[idx].balance = parsed.balanceAfter;
        updateVodafoneLineSettings(lineNum, { balance: parsed.balanceAfter });
      }
    }

    closeSMSParserModal();
    playScanBeep(true);
    showToast(`✅ تم تسجيل حركة الكاش بنجاح في خط ${lineNum} وتحديث الرصيد!`, 'check_circle');
    renderVodafoneHub();
  } catch (e) {
    showToast('حدث خطأ أثناء تطبيق الرسالة', 'error');
  }
};

// ==========================================
// VODAFONE EVENTS & MODALS
// ==========================================

function setupVodafoneEvents() {
  const btnDep = document.getElementById('btn-voda-deposit');
  const btnWith = document.getElementById('btn-voda-withdraw');

  btnDep?.addEventListener('click', () => window.executeVodafoneTx('deposit'));
  btnWith?.addEventListener('click', () => window.executeVodafoneTx('withdraw'));
}

window.executeVodafoneTx = async function(type) {
  const lineNum = AppState.activeVodafoneLine;
  const amount = parseFloat(document.getElementById('voda-tx-amount')?.value) || 0;
  const commission = parseFloat(document.getElementById('voda-tx-commission')?.value) || 0;
  const customerPhone = (document.getElementById('voda-tx-customer-phone')?.value || '').trim();
  const notes = (document.getElementById('voda-tx-notes')?.value || '').trim();

  if (amount <= 0) {
    showToast("يرجى إدخال مبلغ صحيح للعملية", "warning");
    return;
  }

  try {
    await recordVodafoneTransaction({
      lineNum,
      type,
      amount,
      commission,
      customerPhone,
      notes
    });

    setElemValue('voda-tx-amount', '');
    setElemValue('voda-tx-commission', '');
    setElemValue('voda-tx-customer-phone', '');
    setElemValue('voda-tx-notes', '');

    playScanBeep(true);
    showToast(`تم تسجيل حركة ${type === 'deposit' ? 'إيداع' : 'سحب'} بنجاح على خط ${lineNum}`, 'check_circle');
    renderVodafoneHub();
  } catch (e) {
    showToast("حدث خطأ أثناء تسجيل المعاملة", "error");
  }
};

window.openLineSettingsModal = (lineNum) => {
  const line = Store.vodafoneLines.find(l => l.lineNum === lineNum);
  if (!line) return;
  setElemValue('line-settings-num', line.lineNum);
  setElemValue('line-settings-phone', line.phone || '');
  setElemValue('line-settings-limit', line.monthlyLimit || 100000);
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
  const num = parseInt(document.getElementById('line-settings-num')?.value, 10);
  const phone = (document.getElementById('line-settings-phone')?.value || '').trim();
  const monthlyLimit = parseFloat(document.getElementById('line-settings-limit')?.value) || 100000;

  await updateVodafoneLineSettings(num, { phone, monthlyLimit });
  closeLineSettingsModal();
  showToast(`تم تحديث إعدادات خط ${num} بنجاح`, 'check_circle');
  renderVodafoneHub();
};

window.openEditVodafoneTxModal = (txId) => {
  const tx = Store.vodafoneTransactions.find(t => t.id === txId);
  if (!tx) return;
  AppState.editingVodafoneTxId = txId;
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
  AppState.editingVodafoneTxId = null;
  const modal = document.getElementById('modal-edit-voda-tx');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.saveEditedVodafoneTx = async () => {
  const txId = AppState.editingVodafoneTxId;
  if (!txId) return;

  const amount = parseFloat(document.getElementById('edit-voda-amount')?.value) || 0;
  const commission = parseFloat(document.getElementById('edit-voda-commission')?.value) || 0;
  const customerPhone = (document.getElementById('edit-voda-phone')?.value || '').trim();
  const notes = (document.getElementById('edit-voda-notes')?.value || '').trim();

  await updateVodafoneTransaction(txId, { amount, commission, customerPhone, notes });
  closeEditVodafoneTxModal();
  showToast("تم تعديل حركة الكاش بنجاح", "check_circle");
  renderVodafoneHub();
};

window.confirmDeleteVodafoneTx = async (txId) => {
  if (confirm("هل أنت متأكد من حذف هذه الحركة؟ سيتم تعديل رصيد الخط تلقائياً.")) {
    await deleteVodafoneTransaction(txId);
    showToast("تم حذف الحركة واستعادة رصيد الخط بنجاح", "delete");
    renderVodafoneHub();
  }
};

// ==========================================
// PRODUCT FORM CRUD MODAL (Enhanced with Covers & Cables)
// ==========================================

function setupProductModal() {
  const form = document.getElementById('form-product');
  if (form) {
    form.setAttribute('novalidate', 'true');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await window.saveProductForm();
    });
  }

  const catSelect = document.getElementById('prod-category');
  if (catSelect) {
    catSelect.addEventListener('change', () => {
      updateProductModalFields(catSelect.value);
    });
  }

  const phoneSelect = document.getElementById('prod-phone-number-select');
  if (phoneSelect) {
    phoneSelect.addEventListener('change', () => {
      if (phoneSelect.value) {
        setElemValue('prod-phone-number', phoneSelect.value);
      }
    });
  }
}

window.openAddProductModal = (category = null, subcategory = null, barcode = null) => {
  AppState.editingProductId = null;
  setElemText('modal-prod-title', 'إضافة صنف جديد للمخزن');
  setElemValue('prod-id', '');
  setElemValue('prod-barcode', barcode || '');
  setElemValue('prod-name', '');
  setElemValue('prod-buy-price', '');
  setElemValue('prod-sell-price', '');
  setElemValue('prod-quantity', '1');
  setElemValue('prod-brand', '');
  setElemValue('prod-model', '');
  setElemValue('prod-phone-imei', barcode || '');
  setElemValue('prod-phone-storage', '128GB');
  setElemValue('prod-phone-color', 'أسود');
  setElemValue('prod-phone-number', '');
  populatePhoneSelectOptions('prod-phone-number-select', '');

  const cat = category || getDefaultCategoryForCurrentView();
  setElemValue('prod-category', cat);
  updateProductModalFields(cat);

  if (subcategory) {
    setElemValue('prod-subcategory', subcategory);
  }

  const modal = document.getElementById('modal-product-form');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
      if (barcode) {
        document.getElementById('prod-name')?.focus();
      } else {
        document.getElementById('prod-barcode')?.focus();
      }
    }, 100);
  }
};

window.openEditProductModal = (id) => {
  const prod = Store.products.find(p => p.id === id);
  if (!prod) return;

  AppState.editingProductId = id;
  setElemText('modal-prod-title', 'تعديل بيانات الصنف والمخزون');
  setElemValue('prod-id', prod.id);
  setElemValue('prod-barcode', prod.barcode || '');
  setElemValue('prod-name', prod.name || '');
  setElemValue('prod-category', prod.category || 'chargers');
  updateProductModalFields(prod.category || 'chargers');

  setElemValue('prod-subcategory', prod.subcategory || '');
  setElemValue('prod-buy-price', prod.buyPrice || 0);
  setElemValue('prod-sell-price', prod.sellPrice || 0);
  setElemValue('prod-quantity', prod.quantity || 0);
  setElemValue('prod-brand', prod.brand || '');
  setElemValue('prod-model', prod.model || '');
  setElemValue('prod-phone-imei', prod.imei || '');
  setElemValue('prod-phone-storage', prod.storage || '');
  setElemValue('prod-phone-color', prod.color || '');
  setElemValue('prod-phone-number', prod.linkedPhoneNumber || prod.customerPhone || '');
  populatePhoneSelectOptions('prod-phone-number-select', prod.linkedPhoneNumber || prod.customerPhone || '');

  const modal = document.getElementById('modal-product-form');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeProductModal = () => {
  AppState.editingProductId = null;
  const modal = document.getElementById('modal-product-form');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

function updateProductModalFields(category) {
  const subcatSelect = document.getElementById('prod-subcategory');
  const subcatGroup = document.getElementById('prod-subcategory-group');
  const phoneFields = document.getElementById('phone-specific-fields');

  if (category === 'phones') {
    phoneFields?.classList.remove('hidden');
    subcatGroup?.classList.add('hidden');
  } else {
    phoneFields?.classList.add('hidden');
    subcatGroup?.classList.remove('hidden');

    if (subcatSelect) {
      if (category === 'chargers') {
        subcatSelect.innerHTML = `
          <option value="complete">شاحن كامل</option>
          <option value="adapter">رأس شاحن</option>
          <option value="fast">شاحن سريع (Fast/PD)</option>
          <option value="wireless">شاحن لاسلكي</option>
        `;
      } else if (category === 'cables') {
        subcatSelect.innerHTML = `
          <option value="typec">وصلة Type-C عريضة</option>
          <option value="microusb">وصلة Micro عادية</option>
          <option value="pin">وصلة Pin / Lightning آيفون</option>
          <option value="aux">كابل صوت AUX</option>
          <option value="otg">وصلة OTG</option>
        `;
      } else if (category === 'headphones') {
        subcatSelect.innerHTML = `
          <option value="silicone">سماعة جلدة (In-Ear)</option>
          <option value="classic">سماعة عضم (Classic)</option>
          <option value="bluetooth">سماعة بلوتوث (Wireless)</option>
        `;
      } else if (category === 'speakers') {
        subcatSelect.innerHTML = `
          <option value="small">صب صغير (Mini)</option>
          <option value="medium">صب وسط (Medium)</option>
          <option value="large">صب كبير (Party/Big)</option>
        `;
      } else if (category === 'covers') {
        subcatSelect.innerHTML = `
          <option value="clear">جراب شفاف (Clear)</option>
          <option value="silicone">جراب سيليكون مطاطي</option>
          <option value="armor">جراب حماية مضاد للصدمات</option>
          <option value="leather">جراب جلد فاخر</option>
          <option value="magsafe">جراب مغناطيسي (MagSafe)</option>
          <option value="wallet">جراب محفظة</option>
        `;
      } else if (category === 'accessories') {
        subcatSelect.innerHTML = `
          <option value="screen_protector">اسكرينة حماية شاشة</option>
          <option value="holder">حامل هاتف / ستاند سيارة</option>
          <option value="memory">كارت ميموري / فلاشة</option>
          <option value="powerbank">باور بانك</option>
          <option value="general">إكسسوار عام</option>
        `;
      } else if (category === 'manual') {
        subcatSelect.innerHTML = `
          <option value="قطع غيار">قطع غيار</option>
          <option value="شاشات وبطاريات">شاشات وبطاريات</option>
          <option value="صيانة وخدمات">صيانة وخدمات</option>
          <option value="أخرى ويدوي">أخرى ويدوي</option>
        `;
      }
    }
  }
}

window.saveProductForm = async () => {
  const barcode = (document.getElementById('prod-barcode')?.value || '').trim();
  const name = (document.getElementById('prod-name')?.value || '').trim();
  const category = document.getElementById('prod-category')?.value || 'chargers';
  const subcategory = document.getElementById('prod-subcategory')?.value || '';
  const buyPriceInput = document.getElementById('prod-buy-price')?.value;
  const sellPriceInput = document.getElementById('prod-sell-price')?.value;
  const qtyInput = document.getElementById('prod-quantity')?.value;

  const buyPrice = (buyPriceInput !== undefined && buyPriceInput !== '' && !isNaN(parseFloat(buyPriceInput))) ? Math.max(0, parseFloat(buyPriceInput)) : 0;
  const sellPrice = (sellPriceInput !== undefined && sellPriceInput !== '' && !isNaN(parseFloat(sellPriceInput))) ? Math.max(0, parseFloat(sellPriceInput)) : 0;
  const quantity = (qtyInput !== undefined && qtyInput !== '' && !isNaN(parseInt(qtyInput, 10))) ? Math.max(0, parseInt(qtyInput, 10)) : 1;

  const brand = (document.getElementById('prod-brand')?.value || '').trim();
  const model = (document.getElementById('prod-model')?.value || '').trim();
  const imei = (document.getElementById('prod-phone-imei')?.value || '').trim();
  const storage = document.getElementById('prod-phone-storage')?.value || '';
  const color = document.getElementById('prod-phone-color')?.value || '';
  const linkedPhoneNumber = (document.getElementById('prod-phone-number')?.value || '').trim();

  let finalBarcode = barcode;
  if (!finalBarcode) {
    if (category === 'phones' && imei) {
      finalBarcode = imei;
    } else {
      finalBarcode = generateNextProductCode(category);
    }
  }

  let validName = name;
  if (!validName) {
    if (category === 'phones') {
      validName = `${brand || 'هاتف'} ${model || finalBarcode}`.trim();
    } else if (category === 'manual') {
      validName = subcategory || 'صنف يدوي';
    } else {
      validName = `${getCategoryArabicName(category)} (${finalBarcode})`;
    }
  }

  const productData = {
    barcode: finalBarcode,
    name: validName,
    category,
    subcategory,
    buyPrice,
    sellPrice,
    quantity,
    brand,
    model,
    imei: imei || (category === 'phones' ? finalBarcode : ''),
    storage,
    color,
    linkedPhoneNumber
  };

  try {
    if (AppState.editingProductId) {
      await updateProduct(AppState.editingProductId, productData);
      showToast(`✅ تم تعديل بيانات [${validName}] بنجاح`, 'check_circle');
    } else {
      await addProduct(productData);
      showToast(`✅ تم تسجيل [${validName}] بكود [${finalBarcode}] في مخزون ${getCategoryArabicName(category)} بنجاح!`, 'check_circle');
    }

    closeProductModal();
    renderCurrentView();
    updateGlobalHeaderBadges();
  } catch (e) {
    console.error("Save product error:", e);
    showToast("حدث خطأ أثناء حفظ الصنف", "error");
  }
};

window.confirmDeleteProduct = async (id) => {
  const prod = Store.products.find(p => p.id === id);
  if (!prod) return;
  if (confirm(`هل أنت متأكد تماماً من حذف الصنف [${prod.name}] نهائياً من المخزن؟\n\n⚠️ سيتم حذفه تماماً ولن يرجع نهائياً عند إدخال أي أكواد أخرى.`)) {
    const prodName = prod.name;
    await deleteProduct(id);
    showToast(`تم حذف الصنف [${prodName}] نهائياً من السيستم`, 'delete');
    renderCurrentView();
  }
};

// ==========================================
// QUICK POS MODAL & CASHIER (F2)
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
    const bStr = String(barcode).trim().toLowerCase();
    const prod = Store.products.find(p => 
      (p.barcode != null && String(p.barcode).trim().toLowerCase() === bStr) || 
      (p.imei != null && String(p.imei).trim().toLowerCase() === bStr)
    );
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
    document.querySelectorAll('[data-pos-cat]').forEach(btn => {
      btn.className = btn.getAttribute('data-pos-cat') === cat
        ? 'px-3 py-1.5 rounded-lg bg-primary text-white shrink-0 cursor-pointer font-bold'
        : 'px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface shrink-0 cursor-pointer font-bold';
    });
    renderPOSCatalog(cat, AppState.posCatalogSearch);
  };
}

function renderPOSCatalog(category = 'all', searchQuery = '') {
  const grid = document.getElementById('pos-catalog-grid');
  if (!grid) return;

  let items = Store.products.filter(p => (p.quantity || 0) > 0);
  if (category !== 'all') {
    items = items.filter(p => p.category === category);
  }
  if (searchQuery) {
    items = items.filter(p => 
      String(p.name || '').toLowerCase().includes(searchQuery) ||
      String(p.barcode || '').toLowerCase().includes(searchQuery) ||
      String(p.imei || '').toLowerCase().includes(searchQuery)
    );
  }

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-10 text-center text-on-surface-variant">
        <span class="text-xs">لا توجد منتجات مطابقة في الكتالوج</span>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(prod => `
    <div 
      onclick="window.addProdToCartById('${prod.id}')"
      class="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 flex flex-col justify-between gap-1.5 cursor-pointer transition-all hover:scale-[1.02] shadow-xs"
    >
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-rose-400 truncate">${getCategoryArabicName(prod.category)}</span>
        <span class="font-numeric-table font-bold text-[10px] text-on-surface-variant">${prod.quantity} حبة</span>
      </div>
      <h5 class="text-xs font-bold text-on-surface truncate" title="${prod.name}">${prod.name}</h5>
      <div class="flex items-center justify-between pt-1 border-t border-outline-variant/20">
        <span class="font-numeric-table font-bold text-emerald-400 text-xs">${formatMoney(prod.sellPrice)} ج.م</span>
        <span class="material-symbols-outlined text-rose-500 text-sm">add_shopping_cart</span>
      </div>
    </div>
  `).join('');
}

window.addProdToCartById = (id) => {
  const prod = Store.products.find(p => p.id === id);
  if (prod) addItemToCart(prod);
};

function addItemToCart(prod) {
  const existing = AppState.cart.find(i => i.id === prod.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    AppState.cart.push({
      id: prod.id,
      name: prod.name,
      barcode: prod.barcode || prod.imei || '',
      category: prod.category || 'chargers',
      price: prod.sellPrice || 0,
      buyPrice: prod.buyPrice || 0,
      quantity: 1
    });
  }
  playScanBeep(true);
  renderPOSCart();
}

function renderPOSCart() {
  const tbody = document.getElementById('pos-cart-tbody');
  const totalItemsCount = AppState.cart.reduce((acc, i) => acc + i.quantity, 0);
  const subtotal = AppState.cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const total = Math.max(0, subtotal - (AppState.cartDiscount || 0));

  setElemText('pos-cart-count-badge', `${totalItemsCount} عناصر`);
  setElemText('pos-subtotal', `${formatMoney(subtotal)} ج.م`);
  setElemText('pos-total-amount', `${formatMoney(total)} ج.م`);

  calculatePOSChange();

  if (!tbody) return;

  if (AppState.cart.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-12 text-center text-on-surface-variant">
          <span class="text-xs">السلة فارغة. امسح الباركود أو اختر من الكتالوج.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = AppState.cart.map((item, idx) => `
    <tr class="border-b border-surface-container-low text-xs">
      <td class="py-2.5 px-3 font-bold text-on-surface">${item.name}</td>
      <td class="py-2.5 px-3 font-numeric-table text-on-surface">${formatMoney(item.price)}</td>
      <td class="py-2.5 px-3">
        <div class="flex items-center gap-1 font-numeric-table font-bold">
          <button onclick="window.updateCartQty(${idx}, -1)" class="w-5 h-5 rounded bg-surface-container text-xs">-</button>
          <span>${item.quantity}</span>
          <button onclick="window.updateCartQty(${idx}, 1)" class="w-5 h-5 rounded bg-surface-container text-xs">+</button>
        </div>
      </td>
      <td class="py-2.5 px-3 font-numeric-table font-bold text-emerald-400">${formatMoney(item.price * item.quantity)}</td>
      <td class="py-2.5 px-3 text-center">
        <button onclick="window.removeCartItem(${idx})" class="text-rose-400 hover:text-rose-300"><span class="material-symbols-outlined text-[16px]">close</span></button>
      </td>
    </tr>
  `).join('');
}

window.updateCartQty = (idx, delta) => {
  if (!AppState.cart[idx]) return;
  AppState.cart[idx].quantity += delta;
  if (AppState.cart[idx].quantity <= 0) {
    AppState.cart.splice(idx, 1);
  }
  renderPOSCart();
};

window.removeCartItem = (idx) => {
  AppState.cart.splice(idx, 1);
  renderPOSCart();
};

function calculatePOSChange() {
  const subtotal = AppState.cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const total = Math.max(0, subtotal - (AppState.cartDiscount || 0));
  const paid = parseFloat(document.getElementById('pos-cash-paid')?.value) || 0;
  const change = Math.max(0, paid - total);
  setElemText('pos-change-due', `${formatMoney(change)} ج.م`);
}

async function executePOSCheckout() {
  if (AppState.cart.length === 0) {
    showToast("سلة المشتريات فارغة", "warning");
    return;
  }

  const subtotal = AppState.cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const total = Math.max(0, subtotal - (AppState.cartDiscount || 0));
  const paid = parseFloat(document.getElementById('pos-cash-paid')?.value) || total;
  const change = Math.max(0, paid - total);
  const custName = (document.getElementById('pos-customer-name')?.value || '').trim() || 'عميل نقدي';
  const custPhone = (document.getElementById('pos-customer-phone')?.value || '').trim();

  try {
    const soldItems = [...AppState.cart];

    const invoice = await checkoutSale({
      items: AppState.cart,
      subtotal,
      discount: AppState.cartDiscount,
      totalAmount: total,
      cashPaid: paid,
      change,
      customerName: custName,
      customerPhone: custPhone
    });

    AppState.cart = [];
    AppState.cartDiscount = 0;
    setElemValue('pos-cash-paid', '');
    setElemValue('pos-customer-name', '');
    setElemValue('pos-customer-phone', '');

    closeQuickPOS();
    playScanBeep(true);
    showToast(`⚡ تم تسجيل الفاتورة ${invoice.invoiceNumber} فوراً في قسم المبيعات!`, 'receipt_long', 3500);

    // Real-time shortage alerts for sold items as requested by user
    const criticalShortages = [];
    soldItems.forEach(cartItem => {
      const prod = Store.products.find(p => p.id === cartItem.id);
      if (prod) {
        const remaining = prod.quantity !== undefined ? prod.quantity : 0;
        if (remaining <= 2) {
          criticalShortages.push({ name: prod.name, remaining });
        }
      }
    });

    if (criticalShortages.length > 0) {
      setTimeout(() => {
        playScanBeep(false);
        criticalShortages.forEach((cs, idx) => {
          setTimeout(() => {
            if (cs.remaining === 1) {
              showToast(`⚠️ تنبيه نواقص فوري: [${cs.name}] فاضل قطعة واحدة فقط (1)! أصبح من ضمن النواقص (يرجى طلب توريد)`, 'warning', 7000);
            } else if (cs.remaining <= 0) {
              showToast(`🚨 تنبيه نفاد كمية: [${cs.name}] فاضل 0 (نفذت الكمية تماماً)! تم تسجيله في النواقص`, 'error', 7000);
            } else {
              showToast(`⚠️ تنبيه نواقص: [${cs.name}] فاضل ${cs.remaining} قطع فقط ومن ضمن النواقص!`, 'warning', 6000);
            }
          }, idx * 800);
        });
      }, 500);
    }

    updateGlobalHeaderBadges();
    renderCurrentView();

    window.printInvoiceReceipt(invoice.id);
  } catch (e) {
    showToast("حدث خطأ أثناء إتمام عملية البيع", "error");
  }
}

// Receipt Viewer
window.printInvoiceReceipt = (invoiceId) => {
  const inv = Store.salesInvoices.find(s => s.id === invoiceId);
  if (!inv) return;

  setElemText('thermal-store-name', 'سنترال حلمي');
  setElemText('receipt-inv-num', inv.invoiceNumber);
  setElemText('receipt-date', formatDateArabic(inv.timestamp));
  setElemText('receipt-customer', inv.customerName || 'عميل نقدي');
  setElemText('receipt-total', `${formatMoney(inv.totalAmount)} ج.م`);
  setElemText('receipt-cash', `${formatMoney(inv.cashPaid || inv.totalAmount)} ج.م`);
  setElemText('receipt-change', `${formatMoney(inv.change || 0)} ج.م`);

  const tbody = document.getElementById('receipt-items-tbody');
  if (tbody) {
    tbody.innerHTML = (inv.items || []).map(item => `
      <tr class="border-b border-dashed border-black/20 text-xs">
        <td class="py-1 text-right font-bold">${item.name}</td>
        <td class="py-1 text-center font-numeric-table font-bold">${item.quantity}</td>
        <td class="py-1 text-left font-numeric-table font-bold">${formatMoney(item.price * item.quantity)}</td>
      </tr>
    `).join('');
  }

  const modal = document.getElementById('modal-thermal-receipt');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeThermalReceiptModal = () => {
  const modal = document.getElementById('modal-thermal-receipt');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

// ==========================================
// DRAWER & KEYBOARD SHORTCUTS
// ==========================================

function setupDrawerEvents() {
  window.openOpeningCashModal = () => {
    const modal = document.getElementById('modal-opening-cash');
    if (modal) {
      setElemValue('opening-cash-amount', Store.drawer?.currentCash || 0);
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
    showToast(`تم اعتماد رصيد افتتاح الدرج: ${formatMoney(amount)} ج.م`, 'check_circle');
  };

  window.openDrawerAdjustModal = (type = 'in') => {
    const modal = document.getElementById('modal-drawer-adjust');
    if (modal) {
      setElemValue('drawer-adjust-type', type);
      setElemText('drawer-adjust-title', type === 'in' ? 'إيداع نقدية في درج الكاشير (+)' : 'سحب نقدية من درج الكاشير (-)');
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
    const reason = (document.getElementById('drawer-adjust-reason')?.value || '').trim() || (type === 'in' ? 'إيداع نقدية' : 'سحب نقدية');

    if (amount <= 0) {
      showToast("يرجى إدخال مبلغ صحيح", "warning");
      return;
    }

    await recordCashDrawerEntry({ type, amount, reason });
    closeDrawerAdjustModal();
    showToast(`تم تسجيل ${type === 'in' ? 'إيداع' : 'سحب'} ${formatMoney(amount)} ج.م بنجاح`, 'payments');
  };
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      window.openAddProductModal(getDefaultCategoryForCurrentView());
    } else if (e.key === 'F2') {
      e.preventDefault();
      window.triggerQuickPOS();
    } else if (e.key === 'F3') {
      e.preventDefault();
      window.openCameraScanner();
    } else if (e.key === 'F4') {
      e.preventDefault();
      document.getElementById('quickCodeManualInput')?.focus();
    } else if (e.key === 'F7') {
      e.preventDefault();
      window.openThemeModal();
    } else if (e.key === 'Escape') {
      window.closeQuickPOS();
      window.closeProductModal();
      window.closeSmartCodeActionModal();
      window.closeSMSParserModal();
      window.closeLineSettingsModal();
      window.closeEditVodafoneTxModal();
      window.closeThemeModal();
      window.closeThermalReceiptModal();
      window.closeOpeningCashModal();
      window.closeDrawerAdjustModal();
      window.closePhoneAccessModal();
      window.closeCameraScanner();
    }
  });
}

// ==========================================
// CAMERA SCANNER MODAL (F3)
// ==========================================

let html5QrCodeInstance = null;
let currentTargetField = null;

window.openCameraScanner = async function(target = null) {
  currentTargetField = target;
  const modal = document.getElementById('modal-camera-barcode');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  if (typeof Html5Qrcode === 'undefined') {
    showToast('جاري تحميل مكتبة الكاميرا...', 'info');
    return;
  }

  try {
    if (html5QrCodeInstance) {
      try { await html5QrCodeInstance.stop(); } catch(e){}
    }
    html5QrCodeInstance = new Html5Qrcode("camera-scanner-viewport");
    await html5QrCodeInstance.start(
      { facingMode: "environment" },
      { fps: 15, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        playScanBeep(true);
        window.closeCameraScanner();
        handleScannedBarcode(decodedText, currentTargetField);
      },
      () => {}
    );
  } catch (err) {
    console.error("Camera start error:", err);
    showToast("تعذر تشغيل الكاميرا: تأكد من السماح بصلاحيات الكاميرا", "error");
  }
};

window.closeCameraScanner = async function() {
  if (html5QrCodeInstance) {
    try { await html5QrCodeInstance.stop(); } catch(e){}
    html5QrCodeInstance = null;
  }
  const modal = document.getElementById('modal-camera-barcode');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
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

// Phone Access Modal
window.openPhoneAccessModal = function() {
  const modal = document.getElementById('modal-phone-access');
  if (modal) {
    fetch('/api/network-info')
      .then(r => r.json())
      .then(data => {
        if (data.urls && data.urls[0]) {
          setElemText('phone-access-url', data.urls[0]);
          const qrImg = document.getElementById('phone-access-qr-img');
          if (qrImg) {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data.urls[0])}`;
          }
        }
      })
      .catch(() => {
        setElemText('phone-access-url', 'http://' + window.location.host);
      });

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closePhoneAccessModal = function() {
  const modal = document.getElementById('modal-phone-access');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

// Mobile Categories Navigation Menu
window.openMobileCategoryMenu = function() {
  const modal = document.getElementById('modal-mobile-categories');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeMobileCategoryMenu = function() {
  const modal = document.getElementById('modal-mobile-categories');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

// Fast Code Prompt for Mobile
window.openQuickCodePrompt = function() {
  const code = prompt("⚡ اكتب كود الصنف (مثلاً: 70) أو امسح الباركود للبيع أو التوريد:");
  if (code && code.trim()) {
    handleScannedBarcode(code.trim());
  }
};

// Audio Beep
function playScanBeep(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? 'sine' : 'sawtooth';
    osc.frequency.value = success ? 880 : 320;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (success ? 0.12 : 0.25));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.12 : 0.25));
  } catch (e) {}
}

// Toasts
let toastTimer = null;
export function showToast(msg, icon = 'check_circle', durationMs = 4000) {
  const toast = document.getElementById('action-toast');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');
  if (toast && toastMsg && toastIcon) {
    if (toastTimer) clearTimeout(toastTimer);
    toastMsg.innerText = msg;
    toastIcon.innerText = icon;
    toast.classList.remove('hidden');
    toast.classList.add('flex');
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
      toast.classList.remove('flex');
    }, durationMs);
  }
}
window.showToast = showToast;

// Helpers
function formatMoney(num) {
  return (parseFloat(num) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDateArabic(isoStr) {
  if (!isoStr) return 'غير محدد';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return isoStr;
  }
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function isToday(isoStr) {
  if (!isoStr) return false;
  const d = new Date(isoStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isYesterday(isoStr) {
  if (!isoStr) return false;
  const d = new Date(isoStr);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.toDateString() === y.toDateString();
}

function isLast7Days(isoStr) {
  if (!isoStr) return false;
  const d = new Date(isoStr);
  const now = new Date();
  const diffTime = now.getTime() - d.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
}

function isThisMonth(isoStr) {
  if (!isoStr) return false;
  const d = new Date(isoStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function setElemText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

function setElemValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getCategoryArabicName(cat) {
  switch (cat) {
    case 'manual': return 'المخزن اليدوي';
    case 'chargers': return 'قسم الشواحن';
    case 'cables': return 'قسم الوصلات';
    case 'headphones': return 'قسم السماعات والصوتيات';
    case 'speakers': return 'قسم الصبات والمكبرات';
    case 'phones': return 'قسم التليفونات';
    case 'covers': return 'قسم الجرابات والحمايات';
    case 'accessories': return 'قسم الإكسسوارات العامة';
    default: return 'المخزن العام';
  }
}

function getCategoryViewPath(cat) {
  switch (cat) {
    case 'manual': return 'manual-inventory';
    case 'chargers': return 'chargers-inventory';
    case 'cables': return 'cables-inventory';
    case 'headphones': return 'headphones-audio';
    case 'speakers': return 'speakers-sound';
    case 'phones': return 'phones-sales-inventory';
    case 'covers': return 'covers-inventory';
    case 'accessories': return 'accessories-inventory';
    default: return 'chargers-inventory';
  }
}

window.navigateTo = navigateTo;
window.formatMoney = formatMoney;

// ==========================================
// VODAFONE QUICK PHONE NUMBER ACTIONS
// ==========================================

window.saveActiveLineQuickPhone = async () => {
  const lineNum = AppState.activeVodafoneLine;
  const input = document.getElementById('active-line-quick-phone');
  const phone = (input?.value || '').trim();

  await updateVodafoneLineSettings(lineNum, { phone });
  showToast(`تم حفظ رقم خط ${lineNum} بنجاح: ${phone || 'تم تفريغ الرقم'}`, 'check_circle');
  renderVodafoneHub();
};

window.openAllLinesModal = () => {
  const container = document.getElementById('all-lines-inputs-grid');
  if (container) {
    container.innerHTML = Store.vodafoneLines.map(l => `
      <div class="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-xs text-on-surface flex items-center gap-1.5">
            <span class="material-symbols-outlined text-rose-500 text-sm">sim_card</span>
            <span>خط ${l.lineNum}</span>
          </span>
          <span class="font-numeric-table font-bold text-[11px] text-emerald-400">${formatMoney(l.balance || 0)} ج.م</span>
        </div>
        <div>
          <label class="block text-[10px] text-on-surface-variant font-bold mb-1">رقم الشريحة (فودافون كاش):</label>
          <input type="tel" data-line-num="${l.lineNum}" value="${l.phone || ''}" placeholder="010xxxxxxxx" class="all-lines-phone-input w-full bg-surface-container text-on-surface font-numeric-table font-bold text-xs rounded-xl px-3 py-2 border border-outline-variant/40 focus:ring-2 focus:ring-rose-500 focus:outline-none" />
        </div>
      </div>
    `).join('');
  }

  const modal = document.getElementById('modal-all-lines-phones');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeAllLinesModal = () => {
  const modal = document.getElementById('modal-all-lines-phones');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.saveAllLinesPhones = async () => {
  const inputs = document.querySelectorAll('.all-lines-phone-input');
  let count = 0;
  for (const input of inputs) {
    const lineNum = parseInt(input.getAttribute('data-line-num'), 10);
    const phone = (input.value || '').trim();
    if (lineNum >= 1 && lineNum <= 18) {
      await updateVodafoneLineSettings(lineNum, { phone });
      count++;
    }
  }
  closeAllLinesModal();
  showToast(`تم حفظ وتحديث أرقام جميع الخطوط بنجاح (${count} خط)`, "check_circle");
  renderVodafoneHub();
};

// ==========================================
// SALES EDIT & PERMANENT DELETE HANDLERS
// ==========================================

window.openEditSaleModal = (invoiceId, productIdOrBarcode) => {
  const inv = Store.salesInvoices.find(s => s.id === invoiceId);
  if (!inv) {
    showToast("لم يتم العثور على الفاتورة المطلوبة", "error");
    return;
  }

  // Find target item
  let targetItem = null;
  if (productIdOrBarcode !== undefined && productIdOrBarcode !== null && inv.items) {
    if (typeof productIdOrBarcode === 'number' && inv.items[productIdOrBarcode]) {
      targetItem = inv.items[productIdOrBarcode];
    } else {
      targetItem = inv.items.find(i => i.productId === productIdOrBarcode || i.barcode === productIdOrBarcode);
    }
  }
  if (!targetItem && inv.items && inv.items.length > 0) {
    targetItem = inv.items[0];
  }

  if (!targetItem) {
    showToast("لا توجد أصناف قابلة للتعديل في هذه الفاتورة", "error");
    return;
  }

  setElemValue('edit-sale-invoice-id', inv.id);
  setElemValue('edit-sale-product-id', targetItem.productId || '');
  setElemValue('edit-sale-buy-price', targetItem.buyPrice || 0);
  setElemText('edit-sale-inv-num', `فاتورة رقم: ${inv.invoiceNumber}`);
  setElemText('edit-sale-prod-name', targetItem.name || 'منتج');
  setElemText('edit-sale-prod-barcode', `الكود: ${targetItem.barcode || '-'}`);
  setElemText('edit-sale-buy-price-display', `${formatMoney(targetItem.buyPrice || 0)} ج.م`);

  setElemValue('edit-sale-qty', targetItem.quantity || 1);
  setElemValue('edit-sale-price', targetItem.price || 0);
  setElemValue('edit-sale-customer-name', inv.customerName || '');
  setElemValue('edit-sale-customer-phone', inv.customerPhone || '');

  // Format timestamp for datetime-local: YYYY-MM-DDTHH:mm
  try {
    const d = inv.timestamp ? new Date(inv.timestamp) : new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
    setElemValue('edit-sale-timestamp', localISOTime);
  } catch (e) {
    setElemValue('edit-sale-timestamp', '');
  }

  window.calcEditSaleTotals();

  const modal = document.getElementById('modal-edit-sale');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeEditSaleModal = () => {
  const modal = document.getElementById('modal-edit-sale');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.calcEditSaleTotals = () => {
  const qty = parseInt(document.getElementById('edit-sale-qty')?.value, 10) || 1;
  const price = parseFloat(document.getElementById('edit-sale-price')?.value) || 0;
  const buyPrice = parseFloat(document.getElementById('edit-sale-buy-price')?.value) || 0;

  const total = price * qty;
  const profit = (price - buyPrice) * qty;

  setElemText('edit-sale-total-display', `${formatMoney(total)} ج.م`);
  const profitEl = document.getElementById('edit-sale-profit-display');
  if (profitEl) {
    profitEl.innerText = `${profit >= 0 ? '+' : ''}${formatMoney(profit)} ج.م`;
    profitEl.className = `font-numeric-table font-black text-lg ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
  }
};

window.saveEditedSale = async () => {
  const invoiceId = document.getElementById('edit-sale-invoice-id')?.value;
  const productId = document.getElementById('edit-sale-product-id')?.value;
  const qty = parseInt(document.getElementById('edit-sale-qty')?.value, 10) || 1;
  const price = parseFloat(document.getElementById('edit-sale-price')?.value) || 0;
  const customerName = (document.getElementById('edit-sale-customer-name')?.value || '').trim() || 'عميل نقدي';
  const customerPhone = (document.getElementById('edit-sale-customer-phone')?.value || '').trim();
  const timeVal = document.getElementById('edit-sale-timestamp')?.value;
  const timestamp = timeVal ? new Date(timeVal).toISOString() : new Date().toISOString();

  if (qty <= 0) {
    showToast("يجب أن تكون الكمية المباعة 1 على الأقل", "warning");
    return;
  }
  if (price < 0) {
    showToast("سعر البيع لا يمكن أن يكون سالباً", "warning");
    return;
  }

  const updated = await updateSaleInvoice(invoiceId, {
    productId,
    quantity: qty,
    price,
    customerName,
    customerPhone,
    timestamp
  });

  if (updated) {
    closeEditSaleModal();
    showToast("تم حفظ تعديلات عملية البيع وتحديث المخزون والدرج بنجاح", "check_circle");
    renderCurrentView();
    updateGlobalHeaderBadges();
  } else {
    showToast("تعذر حفظ التعديل، يرجى المحاولة مرة أخرى", "error");
  }
};

window.confirmDeleteSale = async (invoiceId) => {
  const inv = Store.salesInvoices.find(s => s.id === invoiceId);
  if (!inv) {
    showToast("لم يتم العثور على الفاتورة المطلوبة", "error");
    return;
  }

  const itemsDesc = inv.items ? inv.items.map(i => `${i.name} (${i.quantity} حبة)`).join(' + ') : 'الصنف المباع';
  const totalAmount = formatMoney(inv.totalAmount || 0);

  const confirmMsg = `هل أنت متأكد تماماً من حذف عملية البيع (فاتورة رقم ${inv.invoiceNumber}) نهائياً؟\n\n` +
    `📦 الصنف: ${itemsDesc}\n` +
    `💰 الإجمالي: ${totalAmount} ج.م\n\n` +
    `⚠️ تنبيه هام:\n` +
    `1. سيتم حذف الفاتورة نهائياً وتاماً من السيستم وقاعدة البيانات.\n` +
    `2. سيتم استرجاع الكمية المباعة إلى المخزون تلقائياً.\n` +
    `3. سيتم خصم مبلغ الفاتورة من الخزينة تلقائياً.`;

  if (confirm(confirmMsg)) {
    const success = await deleteSaleInvoice(invoiceId);
    if (success) {
      showToast(`تم حذف فاتورة البيع ${inv.invoiceNumber} نهائياً واسترجاع البضاعة للمخزن بنجاح`, "delete");
      renderCurrentView();
      updateGlobalHeaderBadges();
    } else {
      showToast("تعذر حذف الفاتورة، يرجى المحاولة مرة أخرى", "error");
    }
  }
};

// =========================================================================
// PHONE NUMBER LINKING SYSTEM (ربط كل تليفون برقمه مع إتاحة كافة الخطوط)
// =========================================================================

export function getAllAvailablePhoneNumbers() {
  const numbers = [];
  const lines = Store.vodafoneLines || [];
  lines.forEach(l => {
    const num = (l.phone || '').trim();
    if (num) {
      numbers.push({ number: num, label: `خط ${l.lineNum} - فودافون كاش (${num})` });
    } else {
      numbers.push({ number: `خط ${l.lineNum}`, label: `خط ${l.lineNum} - فودافون كاش (18 خط)` });
    }
  });

  // Also include any previously linked numbers from phones or customer records
  (Store.products || []).forEach(p => {
    if (p.category === 'phones' && (p.linkedPhoneNumber || p.customerPhone)) {
      const ph = (p.linkedPhoneNumber || p.customerPhone).trim();
      if (ph && !numbers.some(n => n.number === ph)) {
        numbers.push({ number: ph, label: `${ph} (${p.name || 'هاتف مسجل'})` });
      }
    }
  });
  return numbers;
}

export function populatePhoneSelectOptions(selectElemId, currentVal = '') {
  const sel = document.getElementById(selectElemId);
  if (!sel) return;
  const numbers = getAllAvailablePhoneNumbers();
  sel.innerHTML = `<option value="">-- اختر من خطوط فودافون كاش (18 خط) أو الأرقام المسجلة --</option>` +
    numbers.map(n => `<option value="${n.number}" ${n.number === currentVal ? 'selected' : ''}>${n.label}</option>`).join('');
}

window.openLinkPhoneModal = function(productId) {
  const prod = Store.products.find(p => p.id === productId);
  if (!prod) return;
  AppState.editingProductId = productId;
  setElemText('modal-link-phone-prod-name', prod.name || 'هاتف محمول');
  setElemText('modal-link-phone-imei', prod.imei || prod.barcode || 'بدون كود');

  const currentPhone = prod.linkedPhoneNumber || prod.customerPhone || '';
  populatePhoneSelectOptions('modal-link-phone-select', currentPhone);
  setElemValue('modal-link-phone-input', currentPhone);

  const sel = document.getElementById('modal-link-phone-select');
  if (sel) {
    sel.onchange = () => {
      if (sel.value && !sel.value.startsWith('خط ')) {
        setElemValue('modal-link-phone-input', sel.value);
      }
    };
  }

  const modal = document.getElementById('modal-link-phone');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeLinkPhoneModal = function() {
  AppState.editingProductId = null;
  const modal = document.getElementById('modal-link-phone');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.saveLinkedPhone = async function() {
  const prodId = AppState.editingProductId;
  if (!prodId) return;
  const sel = document.getElementById('modal-link-phone-select')?.value || '';
  const typed = (document.getElementById('modal-link-phone-input')?.value || '').trim();
  const phone = typed || sel;

  try {
    await updateProduct(prodId, { linkedPhoneNumber: phone });
    showToast(`✅ تم ربط الهاتف بالرقم [${phone || 'إلغاء الربط'}] بنجاح!`, 'check_circle');
    closeLinkPhoneModal();
    renderCurrentView();
  } catch (e) {
    console.error(e);
    showToast('حدث خطأ أثناء ربط الرقم بالهاتف', 'error');
  }
};

// =========================================================================
// LOW-STOCK SHORTAGE SYSTEM (تنبيه النواقص الفعلي ومعرفة الأصناف المنتهية)
// =========================================================================

export function getLowStockProducts() {
  return (Store.products || []).filter(p => {
    if (p.category === 'phones' && p.status === 'sold') return false;
    const limit = (p.minStockLimit !== undefined && p.minStockLimit !== null && p.minStockLimit !== '' && !isNaN(parseInt(p.minStockLimit, 10))) 
      ? parseInt(p.minStockLimit, 10) 
      : 2;
    return (p.quantity || 0) <= Math.max(2, limit);
  }).sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
}

window.openLowStockModal = function() {
  AppState.activeLowStockFilter = 'all';
  renderLowStockModalContent();
  const modal = document.getElementById('modal-low-stock-details');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeLowStockModal = function() {
  const modal = document.getElementById('modal-low-stock-details');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.filterLowStockModal = function(tab) {
  AppState.activeLowStockFilter = tab;
  renderLowStockModalContent();
};

function renderLowStockModalContent() {
  const allShortages = getLowStockProducts();
  const filter = AppState.activeLowStockFilter || 'all';

  const depletedCount = allShortages.filter(p => (p.quantity || 0) <= 0).length;
  const lowCount = allShortages.filter(p => (p.quantity || 0) > 0 && (p.quantity || 0) <= 2).length;

  setElemText('low-stock-count-all', allShortages.length);
  setElemText('low-stock-count-depleted', depletedCount);
  setElemText('low-stock-count-low', lowCount);
  setElemText('modal-low-stock-badge', `${allShortages.length} صنف بحاجة لتوريد`);
  setElemText('low-stock-modal-subtitle', `يوجد ${allShortages.length} صنف من ضمن النواقص بحاجة لتوريد فوري`);

  let filtered = allShortages;
  if (filter === 'depleted') {
    filtered = allShortages.filter(p => (p.quantity || 0) <= 0);
  } else if (filter === 'low') {
    filtered = allShortages.filter(p => (p.quantity || 0) > 0 && (p.quantity || 0) <= 2);
  }

  // Update button active styles
  const btnAll = document.getElementById('btn-low-stock-filter-all');
  const btnDep = document.getElementById('btn-low-stock-filter-depleted');
  const btnLow = document.getElementById('btn-low-stock-filter-low');

  if (btnAll) {
    btnAll.className = (filter === 'all')
      ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white cursor-pointer shadow-sm'
      : 'px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container text-on-surface-variant hover:bg-surface-container-high cursor-pointer';
  }
  if (btnDep) {
    btnDep.className = (filter === 'depleted')
      ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white cursor-pointer shadow-sm'
      : 'px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 cursor-pointer';
  }
  if (btnLow) {
    btnLow.className = (filter === 'low')
      ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white cursor-pointer shadow-sm'
      : 'px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 cursor-pointer';
  }

  const listContainer = document.getElementById('low-stock-items-container') || document.getElementById('low-stock-items-list');
  if (!listContainer) return;

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="py-12 text-center text-on-surface-variant">
        <span class="material-symbols-outlined text-4xl text-emerald-400 mb-2">check_circle</span>
        <p class="font-bold text-sm text-on-surface">لا توجد نواقص في هذا القسم حالياً!</p>
        <p class="text-xs text-on-surface-variant mt-1">جميع الأصناف متوفرة بالمخزن بشكل سليم.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filtered.map(item => {
    const qty = item.quantity || 0;
    const isZero = qty <= 0;
    const isSingle = qty === 1;
    const catName = getCategoryArabicName(item.category);

    let statusBadge = '';
    let qtyColorClass = '';
    if (isZero) {
      statusBadge = `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">🚨 نفذت الكمية تماماً (فاضل 0)</span>`;
      qtyColorClass = 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
    } else if (isSingle) {
      statusBadge = `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40 animate-pulse">⚠️ فاضل قطعة واحدة فقط (1) - من ضمن النواقص!</span>`;
      qtyColorClass = 'bg-amber-500/25 text-amber-300 border border-amber-500/40 ring-2 ring-amber-500/50';
    } else {
      statusBadge = `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">⚠️ فاضل ${qty} قطع (من ضمن النواقص)</span>`;
      qtyColorClass = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    }

    return `
      <div class="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container hover:border-outline-variant/50 transition-all flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl flex flex-col items-center justify-center font-bold text-base ${qtyColorClass}">
            <span>${qty}</span>
            <span class="text-[9px] -mt-1 font-normal">فاضل</span>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h5 class="font-bold text-on-surface text-sm">${item.name}</h5>
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-container text-on-surface-variant">${catName}</span>
              ${item.barcode ? `<span class="font-numeric-table text-[11px] text-secondary font-bold">#${item.barcode}</span>` : ''}
              ${statusBadge}
            </div>
            <div class="flex items-center gap-3 mt-1 text-xs text-on-surface-variant flex-wrap">
              <span>سعر البيع: <b class="text-emerald-400 font-numeric-table font-bold">${formatMoney(item.sellPrice)} ج.م</b></span>
              <span>•</span>
              <span>سعر الشراء: <b class="text-on-surface font-numeric-table font-bold">${formatMoney(item.buyPrice)} ج.م</b></span>
              <span>•</span>
              <span class="font-bold text-amber-400">
                ${isZero ? '🔴 غير متوفر للبيع' : `المتبقي للبيع: فاضل ${qty} قطعة فقط`}
              </span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="window.quickRestockFromShortageModal('${item.id}', 1)" title="توريد +1 قطعة فوراً" class="px-2 py-1.5 rounded-xl bg-primary/20 hover:bg-primary text-primary hover:text-white text-xs font-bold transition-all cursor-pointer">
            +1 توريد
          </button>
          <button onclick="window.quickRestockFromShortageModal('${item.id}', 5)" title="توريد +5 قطع فوراً" class="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-bold transition-all cursor-pointer">
            +5 توريد
          </button>
          <button onclick="window.quickRestockFromShortageModal('${item.id}', 10)" title="توريد +10 قطع فوراً" class="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-bold transition-all cursor-pointer">
            +10 توريد
          </button>
          <button onclick="window.openSmartCodeActionModal('${item.barcode || item.imei || item.id}', 'restock')" title="تفاصيل التوريد والأسعار" class="p-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant cursor-pointer">
            <span class="material-symbols-outlined text-[18px]">add_business</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.quickRestockFromShortageModal = async function(prodId, delta) {
  try {
    await quickAdjustStock(prodId, delta);
    const p = Store.products.find(x => x.id === prodId);
    showToast(`📦 تم توريد +${delta} حبات لصنف [${p?.name || ''}] بنجاح!`, 'inventory_2');
    renderLowStockModalContent();
    updateGlobalHeaderBadges();
    renderCurrentView();
  } catch (e) {
    showToast('حدث خطأ أثناء التوريد', 'error');
  }
};

// =========================================================================
// VIEW: MANUAL WAREHOUSE (المخزن اليدوي المفتوح للأصناف الحرة وقطع الغيار)
// =========================================================================

export function renderManualInventoryPage() {
  const allManual = (Store.products || []).filter(p => p.category === 'manual');

  const totalQty = allManual.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const totalRetail = allManual.reduce((acc, p) => acc + ((p.sellPrice || 0) * (p.quantity || 0)), 0);
  const depletedCount = allManual.filter(p => (p.quantity || 0) <= 0).length;

  setElemText('manual-stat-items', allManual.length);
  setElemText('manual-stat-total-items', allManual.length);
  setElemText('manual-stat-qty', totalQty);
  setElemText('manual-stat-total-qty', totalQty);
  setElemText('manual-stat-depleted', depletedCount);
  setElemText('manual-stat-total-retail', `${formatMoney(totalRetail)} ج.م`);
  setElemText('manual-count-badge', `${allManual.length} أصناف مسجلة`);

  // Render Manual Warehouse Sales (Tab 2)
  const sales = getCategorySales('manual');
  const totalSalesVal = sales.reduce((acc, s) => acc + ((s.price || 0) * (s.quantity || 1)), 0);
  const totalProfitVal = sales.reduce((acc, s) => acc + (s.profit || 0), 0);

  // Warehouse only: No sales badges

  const salesSearch = (document.getElementById('manual-sales-search-input')?.value || '').trim().toLowerCase();
  let filteredSales = sales;
  if (salesSearch) {
    filteredSales = filteredSales.filter(s => 
      String(s.name || '').toLowerCase().includes(salesSearch) ||
      String(s.barcode || '').toLowerCase().includes(salesSearch) ||
      String(s.customerName || '').toLowerCase().includes(salesSearch) ||
      String(s.invoiceNumber || '').toLowerCase().includes(salesSearch)
    );
  }

  const salesTbody = document.getElementById('manual-sales-table-body');
  if (salesTbody) {
    salesTbody.innerHTML = renderSalesTableHTML(filteredSales, 'المخزن اليدوي');
  }

  const activeSub = AppState.activeManualSubcatFilter || 'all';
  const search = (document.getElementById('manual-search-input')?.value || '').trim().toLowerCase();

  let filtered = allManual;
  if (activeSub !== 'all') {
    filtered = filtered.filter(p => (p.subcategory || '').includes(activeSub) || (p.notes || '').includes(activeSub));
  }
  if (search) {
    filtered = filtered.filter(p => 
      String(p.name || '').toLowerCase().includes(search) || 
      String(p.barcode || '').toLowerCase().includes(search) ||
      String(p.notes || '').toLowerCase().includes(search) ||
      String(p.subcategory || '').toLowerCase().includes(search)
    );
  }

  const tbody = document.getElementById('manual-inventory-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-14 text-center">
            <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
              <span class="material-symbols-outlined text-[42px] opacity-30">inventory_2</span>
              <span class="font-headline-sm font-bold text-on-surface">المخزن اليدوي فارغ حالياً</span>
              <p class="text-xs">اكتب أي صنف أو بيان في شريط الكتابة بالأعلى واضغط (تسجيل وحفظ فوراً) لإضافته مباشرة.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
          <td class="py-3 px-4 font-numeric-table font-bold text-secondary text-sm">
            <span class="cursor-pointer hover:underline" onclick="window.openSmartCodeActionModal('${item.barcode || item.id}')">${item.barcode || 'يدوي'}</span>
          </td>
          <td class="py-3 px-4 font-bold text-on-surface text-sm">
            ${item.name}
            ${item.notes ? `<div class="text-[11px] text-on-surface-variant font-normal mt-0.5">${item.notes}</div>` : ''}
          </td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-1 rounded-lg text-xs bg-surface-container text-on-surface-variant font-medium">${item.subcategory || 'أصناف متنوعة'}</span>
          </td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-1.5 font-numeric-table font-bold text-sm">
              <span class="${item.quantity <= 2 ? 'text-rose-400 font-extrabold' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold" title="زيادة 1">+</button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high text-xs font-bold" title="خصم 1">-</button>
            </div>
          </td>
          <td class="py-3 px-4 font-numeric-table font-bold text-emerald-400 text-sm">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3 px-4 font-numeric-table text-on-surface-variant text-[11px]">${formatDateArabic(item.lastRestockedAt || item.createdAt)}</td>
          <td class="py-3 px-4 text-on-surface-variant text-xs">${item.notes || item.linkedPhoneNumber || '-'}</td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1.5">
              <button onclick="window.openSmartCodeActionModal('${item.barcode || item.id}', 'restock')" class="px-3 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white font-bold transition-colors">+ توريد</button>
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant" title="تعديل"><span class="material-symbols-outlined text-[17px]">edit</span></button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400" title="حذف"><span class="material-symbols-outlined text-[17px]">delete</span></button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  }
}

window.setManualSubcategoryFilter = function(sub) {
  AppState.activeManualSubcatFilter = sub;
  document.querySelectorAll('[data-manual-sub]').forEach(btn => {
    const isActive = btn.getAttribute('data-manual-sub') === sub;
    btn.className = isActive 
      ? 'px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-white shadow-sm ring-1 ring-rose-500/40 cursor-pointer'
      : 'px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 cursor-pointer';
  });
  renderManualInventoryPage();
};

window.submitManualQuickAdd = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  
  // Read from both manual-entry-* and manual-quick-* ID variants
  const nameEl = document.getElementById('manual-entry-name') || document.getElementById('manual-quick-name');
  const codeEl = document.getElementById('manual-entry-barcode') || document.getElementById('manual-quick-code');
  const typeEl = document.getElementById('manual-entry-type') || document.getElementById('manual-quick-subcat');
  const qtyEl = document.getElementById('manual-entry-qty') || document.getElementById('manual-quick-qty');
  const sellPriceEl = document.getElementById('manual-entry-sell-price') || document.getElementById('manual-quick-sell-price');
  const buyPriceEl = document.getElementById('manual-entry-buy-price') || document.getElementById('manual-quick-buy-price');
  const notesEl = document.getElementById('manual-entry-notes') || document.getElementById('manual-quick-notes');

  let rawName = (nameEl?.value || '').trim();
  let barcode = (codeEl?.value || '').trim();
  let subcategory = (typeEl?.value || '').trim();
  let sellPrice = parseFloat(sellPriceEl?.value);
  let buyPrice = parseFloat(buyPriceEl?.value);
  let quantity = parseInt(qtyEl?.value, 10);
  let notes = (notesEl?.value || '').trim();

  // "أي كتابة أكتبها تدخل، مش لازم يطلب مني حاجة محددة"
  if (!rawName) {
    if (subcategory) {
      rawName = subcategory;
    } else if (notes) {
      rawName = notes.length > 25 ? notes.slice(0, 25) + '...' : notes;
    } else if (barcode) {
      rawName = `صنف يدوي (${barcode})`;
    } else {
      rawName = `صنف يدوي ${Date.now().toString().slice(-4)}`;
    }
  }

  if (!barcode) {
    barcode = `MAN-${Date.now().toString().slice(-6)}`;
  }
  if (!subcategory) {
    subcategory = 'أصناف متنوعة';
  }
  if (isNaN(sellPrice) || sellPrice < 0) {
    sellPrice = 0;
  }
  if (isNaN(buyPrice) || buyPrice < 0) {
    buyPrice = 0;
  }
  if (isNaN(quantity) || quantity < 0) {
    quantity = 1;
  }

  try {
    await addProduct({
      barcode,
      name: rawName,
      category: 'manual',
      subcategory,
      sellPrice,
      buyPrice,
      quantity,
      notes
    });

    // Reset inputs
    if (nameEl) nameEl.value = '';
    if (codeEl) codeEl.value = '';
    if (typeEl) typeEl.value = '';
    if (sellPriceEl) sellPriceEl.value = '';
    if (buyPriceEl) buyPriceEl.value = '';
    if (qtyEl) qtyEl.value = '1';
    if (notesEl) notesEl.value = '';

    // Re-focus name field for continuous effortless typing
    if (nameEl) nameEl.focus();

    showToast(`✅ تم تسجيل [${rawName}] في المخزن اليدوي بنجاح!`, 'check_circle');
    renderManualInventoryPage();
    updateGlobalHeaderBadges();
  } catch (err) {
    console.error(err);
    showToast('حدث خطأ أثناء حفظ الصنف اليدوي', 'error');
  }
};

// =========================================================================
// VIEW: ALL-SALES MASTER & COMPLETE SELLABLE CATALOG
// (شاشة المبيعات الشاملة والبيع الكلي)
// =========================================================================

export function getAllSalesUnified() {
  const allSales = [];
  (Store.salesInvoices || []).forEach(inv => {
    (inv.items || []).forEach((item, itemIdx) => {
      // Find matching product in Store.products to resolve category and buyPrice if missing
      const matchedProd = (Store.products || []).find(p => 
        (item.productId && p.id === item.productId) || 
        (item.barcode && p.barcode && String(p.barcode).trim() === String(item.barcode).trim()) ||
        (item.name && p.name && p.name.trim() === item.name.trim())
      );
      
      const category = item.category || (matchedProd ? matchedProd.category : 'manual');
      const buyPrice = (item.buyPrice !== undefined && item.buyPrice !== null && !isNaN(parseFloat(item.buyPrice))) 
        ? parseFloat(item.buyPrice) 
        : (matchedProd ? (parseFloat(matchedProd.buyPrice) || 0) : 0);
      const sellPrice = parseFloat(item.price || item.sellPrice || 0);
      const quantity = parseInt(item.quantity, 10) || 1;
      const totalRow = sellPrice * quantity;
      const profit = (item.profit !== undefined && item.profit !== null && !isNaN(parseFloat(item.profit))) 
        ? parseFloat(item.profit) 
        : (totalRow - (buyPrice * quantity));

      allSales.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        timestamp: inv.timestamp,
        customerName: inv.customerName || 'عميل نقدي',
        customerPhone: inv.customerPhone || '',
        itemIndex: itemIdx,
        ...item,
        category,
        buyPrice,
        price: sellPrice,
        quantity,
        total: totalRow,
        profit
      });
    });
  });
  return allSales.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
}

export function renderAllSalesMasterPage() {
  const allSales = getAllSalesUnified();
  const allProducts = Store.products || [];

  const totalSalesVal = allSales.reduce((acc, s) => acc + ((s.price || 0) * (s.quantity || 1)), 0);
  const totalProfitVal = allSales.reduce((acc, s) => acc + (s.profit || 0), 0);
  const totalItemsCount = allSales.reduce((acc, s) => acc + (s.quantity || 1), 0);
  const totalInvoicesCount = (Store.salesInvoices || []).length;

  // Update Main KPIs (Matching index.html)
  setElemText('all-sales-count-badge', `${totalInvoicesCount} فواتير مباعة`);
  setElemText('all-sales-stat-total', `${formatMoney(totalSalesVal)} ج.م`);
  setElemText('all-sales-stat-profit', `+${formatMoney(totalProfitVal)} ج.م`);
  setElemText('all-sales-stat-items-count', totalItemsCount);
  setElemText('all-sales-stat-invoices-count', totalInvoicesCount);

  // Fallback KPIs
  setElemText('all-sales-kpi-total-val', `${formatMoney(totalSalesVal)} ج.م`);
  setElemText('all-sales-kpi-count', `${allSales.length} عمليات بيع`);
  setElemText('all-sales-kpi-profit-val', `+${formatMoney(totalProfitVal)} ج.م`);
  setElemText('all-sales-kpi-unique-items', `${allProducts.length} صنف مسجل`);

  const activeTab = AppState.activeAllSalesTab || 'sales';
  if (activeTab === 'sales') {
    renderMasterSalesTable(allSales);
  } else {
    renderMasterCatalog();
  }
}

window.switchAllSalesMasterTab = function(tab) {
  AppState.activeAllSalesTab = tab;
  const isSales = (tab === 'sales');
  
  const tabBtnSales = document.getElementById('tab-btn-master-sales') || document.getElementById('all-sales-tab-sales');
  const tabBtnCatalog = document.getElementById('tab-btn-master-catalog') || document.getElementById('all-sales-tab-catalog');
  const salesContainer = document.getElementById('master-sales-tab-content') || document.getElementById('master-tab-sales-container');
  const catalogContainer = document.getElementById('master-catalog-tab-content') || document.getElementById('master-tab-catalog-container');

  if (tabBtnSales) {
    tabBtnSales.className = isSales 
      ? 'px-5 py-2.5 rounded-xl text-xs font-bold transition-all bg-primary text-white shadow-sm ring-1 ring-rose-500/40 flex items-center gap-2 cursor-pointer'
      : 'px-5 py-2.5 rounded-xl text-xs font-bold transition-all bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 flex items-center gap-2 cursor-pointer';
  }
  if (tabBtnCatalog) {
    tabBtnCatalog.className = !isSales 
      ? 'px-5 py-2.5 rounded-xl text-xs font-bold transition-all bg-primary text-white shadow-sm ring-1 ring-rose-500/40 flex items-center gap-2 cursor-pointer'
      : 'px-5 py-2.5 rounded-xl text-xs font-bold transition-all bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 flex items-center gap-2 cursor-pointer';
  }

  if (salesContainer) salesContainer.classList.toggle('hidden', !isSales);
  if (catalogContainer) catalogContainer.classList.toggle('hidden', isSales);

  renderAllSalesMasterPage();
};

window.setAllSalesCategoryFilter = function(cat) {
  AppState.activeAllSalesCategoryFilter = cat;
  const sel = document.getElementById('all-sales-filter-cat');
  if (sel) sel.value = cat;

  document.querySelectorAll('[data-sales-cat]').forEach(btn => {
    const isActive = btn.getAttribute('data-sales-cat') === cat;
    btn.className = isActive 
      ? 'px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-white shadow-sm ring-1 ring-rose-500/40 cursor-pointer'
      : 'px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30 cursor-pointer';
  });
  renderAllSalesMasterPage();
};

window.setAllSalesDateFilter = function(period) {
  AppState.activeAllSalesDateFilter = period;
  document.querySelectorAll('[data-all-sales-date], [data-sales-date]').forEach(btn => {
    const btnPeriod = btn.getAttribute('data-all-sales-date') || btn.getAttribute('data-sales-date');
    const isActive = btnPeriod === period;
    btn.className = isActive 
      ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white cursor-pointer shadow-sm ring-1 ring-rose-500/40'
      : 'px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container-low text-on-surface border border-outline-variant/30 hover:bg-surface-container cursor-pointer';
  });
  renderAllSalesMasterPage();
};

window.setAllSalesSearch = function(query) {
  AppState.allSalesSearch = (query || '').trim().toLowerCase();
  renderAllSalesMasterPage();
};

function renderMasterSalesTable(allSales) {
  const catFilter = AppState.activeAllSalesCategoryFilter || 'all';
  const dateFilter = AppState.activeAllSalesDateFilter || 'all';
  const searchInput = document.getElementById('all-sales-search-input');
  const search = (searchInput ? searchInput.value : (AppState.allSalesSearch || '')).trim().toLowerCase();

  let filtered = allSales;

  if (catFilter !== 'all') {
    filtered = filtered.filter(s => {
      if (catFilter === 'chargers' && (s.category === 'chargers' || s.category === 'chargers-cables')) return true;
      if (catFilter === 'cables' && (s.category === 'cables' || s.category === 'chargers-cables')) return true;
      return s.category === catFilter;
    });
  }

  if (dateFilter === 'today') {
    filtered = filtered.filter(s => isToday(s.timestamp));
  } else if (dateFilter === 'yesterday') {
    filtered = filtered.filter(s => isYesterday(s.timestamp));
  } else if (dateFilter === 'week') {
    filtered = filtered.filter(s => isLast7Days(s.timestamp));
  } else if (dateFilter === 'month') {
    filtered = filtered.filter(s => isThisMonth(s.timestamp));
  }

  if (search) {
    filtered = filtered.filter(s => 
      String(s.name || '').toLowerCase().includes(search) ||
      String(s.invoiceNumber || '').toLowerCase().includes(search) ||
      String(s.customerName || '').toLowerCase().includes(search) ||
      String(s.customerPhone || '').toLowerCase().includes(search) ||
      String(s.barcode || '').toLowerCase().includes(search)
    );
  }

  const tbody = document.getElementById('all-sales-table-body') || document.getElementById('all-sales-master-table-body');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-14 text-center">
          <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
            <span class="material-symbols-outlined text-[42px] opacity-30">receipt_long</span>
            <span class="font-headline-sm font-bold text-on-surface">لا توجد عمليات بيع تطابق الفلاتر المحددة</span>
            <p class="text-xs">جرب تغيير الفترة الزمنية أو اختيار "جميع الأقسام" أو مسح كلمة البحث.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const totalRow = (item.price || 0) * (item.quantity || 1);
    const profit = (item.profit !== undefined && item.profit !== null) 
      ? item.profit 
      : (totalRow - ((item.buyPrice || 0) * (item.quantity || 1)));
    const catName = getCategoryArabicName(item.category);
    return `
      <tr class="border-b border-surface-container-low hover:bg-surface-container-high transition-colors text-xs">
        <td class="py-3 px-4 font-numeric-table text-on-surface font-medium whitespace-nowrap">
          <div class="font-bold">${formatDateArabic(item.timestamp)}</div>
          <span class="text-[10px] text-on-surface-variant">${formatTime(item.timestamp)}</span>
        </td>
        <td class="py-3 px-4 font-numeric-table font-bold text-secondary text-sm whitespace-nowrap">
          <div>${item.invoiceNumber || 'INV-DIRECT'}</div>
          ${item.barcode ? `<span class="text-[11px] text-on-surface-variant font-mono">#${item.barcode}</span>` : ''}
        </td>
        <td class="py-3 px-4">
          <div class="font-bold text-on-surface text-sm">${item.name}</div>
          <span class="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-container text-on-surface-variant">${catName}</span>
        </td>
        <td class="py-3 px-4 font-numeric-table font-bold text-on-surface text-center whitespace-nowrap">
          ${item.quantity || 1} حبة
        </td>
        <td class="py-3 px-4 font-numeric-table font-bold text-slate-300 text-sm whitespace-nowrap">
          ${formatMoney(item.price)} ج.م
        </td>
        <td class="py-3 px-4 font-numeric-table font-extrabold text-emerald-400 text-sm whitespace-nowrap">
          ${formatMoney(totalRow)} ج.م
        </td>
        <td class="py-3 px-4 font-numeric-table font-bold ${profit >= 0 ? 'text-teal-400' : 'text-rose-400'} text-sm whitespace-nowrap">
          ${profit >= 0 ? '+' : ''}${formatMoney(profit)} ج.م
        </td>
        <td class="py-3 px-4">
          <div class="font-bold text-on-surface">${item.customerName || 'عميل نقدي'}</div>
          ${item.customerPhone ? `<div class="text-[11px] font-numeric-table text-on-surface-variant flex items-center gap-1 mt-0.5"><span class="material-symbols-outlined text-[13px]">call</span>${item.customerPhone}</div>` : ''}
        </td>
        <td class="py-3 px-4 text-center whitespace-nowrap">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="window.printInvoiceReceipt('${item.invoiceId}')" title="طباعة وعرض الفاتورة" class="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-secondary cursor-pointer">
              <span class="material-symbols-outlined text-[17px]">receipt_long</span>
            </button>
            <button onclick="window.openEditSaleModal('${item.invoiceId}', ${item.itemIndex})" title="تعديل عملية البيع" class="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-400 cursor-pointer">
              <span class="material-symbols-outlined text-[17px]">edit</span>
            </button>
            <button onclick="window.confirmDeleteSale('${item.invoiceId}')" title="حذف عملية البيع واسترجاع المخزون" class="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 cursor-pointer">
              <span class="material-symbols-outlined text-[17px]">delete_forever</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.renderMasterCatalog = function() {
  const cat = AppState.activeMasterCatalogCat || 'all';
  const searchInput = document.getElementById('master-catalog-search-input');
  const search = (searchInput ? searchInput.value : (AppState.masterCatalogSearch || '')).trim().toLowerCase();

  // Render Category Filter Pills if container exists
  const pillsContainer = document.getElementById('catalog-category-filter-pills');
  if (pillsContainer) {
    const cats = [
      { id: 'all', label: 'جميع الأقسام' },
      { id: 'phones', label: 'التليفونات' },
      { id: 'chargers', label: 'الشواحن' },
      { id: 'cables', label: 'الوصلات' },
      { id: 'headphones', label: 'السماعات' },
      { id: 'speakers', label: 'الصبات' },
      { id: 'covers', label: 'الجرابات' },
      { id: 'accessories', label: 'الإكسسوارات' },
      { id: 'manual', label: 'المخزن اليدوي' }
    ];
    pillsContainer.innerHTML = cats.map(c => {
      const isActive = cat === c.id;
      return `<button onclick="window.setMasterCatalogCategory('${c.id}')" data-catalog-cat="${c.id}" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${isActive ? 'bg-primary text-white shadow-sm ring-1 ring-rose-500/40' : 'bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/30'}">${c.label}</button>`;
    }).join('');
  }

  let products = Store.products || [];
  if (cat !== 'all') {
    products = products.filter(p => {
      if (cat === 'chargers' && (p.category === 'chargers' || p.category === 'chargers-cables')) return true;
      if (cat === 'cables' && (p.category === 'cables' || p.category === 'chargers-cables')) return true;
      return p.category === cat;
    });
  }
  if (search) {
    products = products.filter(p => 
      String(p.name || '').toLowerCase().includes(search) ||
      String(p.barcode || '').toLowerCase().includes(search) ||
      String(p.imei || '').toLowerCase().includes(search) ||
      String(p.brand || '').toLowerCase().includes(search)
    );
  }

  const grid = document.getElementById('master-catalog-cards-grid') || document.getElementById('master-catalog-grid');
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-on-surface-variant">
        <span class="material-symbols-outlined text-4xl mb-2 opacity-30">inventory</span>
        <p class="font-bold text-sm text-on-surface">لا توجد أصناف في الكتالوج تطابق البحث</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(prod => {
    const isOutOfStock = (prod.quantity || 0) <= 0;
    const isLow = (prod.quantity || 0) <= 2;
    const catName = getCategoryArabicName(prod.category);
    return `
      <div class="p-4 rounded-2xl bg-surface-container-low border border-surface-container hover:border-outline-variant/60 transition-all flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-surface-container text-on-surface-variant">${catName}</span>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold font-numeric-table ${isOutOfStock ? 'bg-rose-500/20 text-rose-400' : isLow ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}">
              ${isOutOfStock ? 'نفذت الكمية (0)' : `${prod.quantity} حبات بالمخزن`}
            </span>
          </div>
          <h4 class="font-bold text-on-surface text-sm line-clamp-2 mb-1">${prod.name}</h4>
          ${prod.linkedPhoneNumber ? `
            <div class="text-[11px] text-emerald-400 font-bold mb-1 flex items-center gap-1">
              <span class="material-symbols-outlined text-[13px]">call</span>
              ${prod.linkedPhoneNumber}
            </div>
          ` : ''}
          ${prod.barcode ? `<div class="text-[11px] font-numeric-table text-secondary mb-2">#${prod.barcode}</div>` : ''}
        </div>

        <div class="pt-3 border-t border-surface-container-high mt-2">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs text-on-surface-variant">سعر البيع:</span>
            <span class="font-bold text-base text-emerald-400 font-numeric-table">${formatMoney(prod.sellPrice)} ج.م</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="window.openSmartCodeActionModal('${prod.barcode || prod.imei || prod.id}', 'sale')" class="w-full py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer">
              <span>💰</span> بيع فوري
            </button>
            <button onclick="window.addProdToCartById('${prod.id}')" class="w-full py-2 rounded-xl bg-secondary/20 hover:bg-secondary text-secondary hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer">
              <span>🛒</span> للسلة
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

window.setMasterCatalogCategory = function(cat) {
  AppState.activeMasterCatalogCat = cat;
  renderMasterCatalog();
};

window.setMasterCatalogSearch = function(query) {
  AppState.masterCatalogSearch = (query || '').trim().toLowerCase();
  renderMasterCatalog();
};
