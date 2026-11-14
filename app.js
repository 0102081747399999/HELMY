// app.js - Main Application Logic for Hilmy Telecom POS Hub
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
  cart: [],
  cartDiscount: 0,
  deleteTarget: null, // { type: 'product'|'vodafone_tx'|'vodafone_reset', id: string, extra: any }
  editingProductId: null,
  editingVodafoneTxId: null
};

// ==========================================
// INITIALIZATION
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
  // Initialize Realtime Firebase Synchronization
  initRealtimeSync();

  // Subscribe UI to data store updates
  subscribeToStore((event, data, store) => {
    console.log(`Store event: ${event}`);
    renderCurrentView();
    updateGlobalHeaderBadges();
  });

  // Setup navigation handlers
  setupNavigation();

  // Setup Keyboard Shortcuts (F1, F2, F3, F4, ESC)
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

  // Also catch in-page link navigation
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
      link.className = "flex items-center gap-space-sm px-space-md py-space-sm rounded-lg transition-all bg-secondary text-on-secondary font-bold shadow-[0_4px_6px_-1px_rgba(10,25,47,0.07)]";
    } else {
      link.removeAttribute('aria-current');
      link.className = "flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all";
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
  // Cash Drawer Balance
  const drawerBal = Store.drawer ? (Store.drawer.currentCash || 0) : 0;
  const headerCash = document.getElementById('header-cash-balance');
  const sidebarDrawerVal = document.getElementById('sidebar-drawer-val');
  if (headerCash) headerCash.innerText = `${formatMoney(drawerBal)} ج.م`;
  if (sidebarDrawerVal) sidebarDrawerVal.innerText = formatMoney(drawerBal);

  // Today's total sales
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = Store.salesInvoices.filter(inv => (inv.timestamp || '').startsWith(todayStr));
  const totalSalesVal = todaySales.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);

  // Total Vodafone Balance across all 18 lines
  const totalVodaBalance = Store.vodafoneLines.reduce((acc, l) => acc + (parseFloat(l.balance) || 0), 0);

  // Critical Low Stock Count (qty <= 2)
  const lowStockCount = Store.products.filter(p => (p.category !== 'phones' && (p.quantity || 0) <= 2) || (p.category === 'phones' && p.status === 'available')).length;

  // Update elements if present
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

  // Render Recent Invoices
  const invoicesTbody = document.getElementById('dash-recent-invoices');
  if (invoicesTbody) {
    const recent = Store.salesInvoices.slice(0, 5);
    if (recent.length === 0) {
      invoicesTbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-on-surface-variant">
            <div class="flex flex-col items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[36px] text-outline-variant">receipt_long</span>
              <p class="font-headline-sm text-headline-sm">لا توجد مبيعات مسجلة حتى الآن</p>
              <button onclick="window.triggerQuickPOS()" class="text-secondary hover:underline font-label-md text-label-md">+ بدء بيع سريع (F2)</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      invoicesTbody.innerHTML = recent.map(inv => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-lowest/50 transition-colors">
          <td class="py-3 px-4 font-code-mono text-secondary font-bold">${inv.invoiceNumber}</td>
          <td class="py-3 px-4 font-code-mono text-on-surface-variant">${formatTime(inv.timestamp)}</td>
          <td class="py-3 px-4 font-label-md">${inv.items ? inv.items.map(i => `${i.name} (x${i.quantity})`).join(', ') : '-'}</td>
          <td class="py-3 px-4 font-code-mono font-bold text-on-surface">${formatMoney(inv.totalAmount)} ج.م</td>
          <td class="py-3 px-4 text-on-surface-variant font-label-sm">${inv.customerName || 'عميل نقدي'}</td>
          <td class="py-3 px-4 text-center">
            <button onclick="window.printInvoiceReceipt('${inv.id}')" class="p-1 rounded-md text-secondary hover:bg-secondary/10 transition-colors" title="طباعة الإيصال">
              <span class="material-symbols-outlined text-[18px]">print</span>
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  // Render Recent Vodafone Cash transactions
  const vodaTbody = document.getElementById('dash-recent-voda');
  if (vodaTbody) {
    const recentVoda = Store.vodafoneTransactions.slice(0, 5);
    if (recentVoda.length === 0) {
      vodaTbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-on-surface-variant">
            <div class="flex flex-col items-center justify-center gap-2">
              <span class="material-symbols-outlined text-[36px] text-outline-variant">account_balance_wallet</span>
              <p class="font-headline-sm text-headline-sm">لا توجد معاملات كاش مسجلة اليوم</p>
              <button onclick="window.navigateTo('vodafone-cash-wallets')" class="text-secondary hover:underline font-label-md text-label-md">+ فتح محافظ فودافون كاش</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      vodaTbody.innerHTML = recentVoda.map(tx => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-lowest/50 transition-colors">
          <td class="py-3 px-4 font-label-md font-bold text-on-surface">خط ${tx.lineNum}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded-full text-label-sm font-bold ${tx.type === 'deposit' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
              ${tx.type === 'deposit' ? 'إيداع (+)' : 'سحب (-)'}
            </span>
          </td>
          <td class="py-3 px-4 font-code-mono font-bold text-on-surface">${formatMoney(tx.amount)} ج.م</td>
          <td class="py-3 px-4 font-code-mono text-on-tertiary-container">+${formatMoney(tx.commission || 0)} ج.م</td>
          <td class="py-3 px-4 font-code-mono text-on-surface-variant">${tx.customerPhone || '-'}</td>
          <td class="py-3 px-4 font-code-mono text-on-surface-variant text-label-sm">${formatTime(tx.timestamp)}</td>
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

  // 1. Render the 18 Buttons Grid
  const gridContainer = document.getElementById('wallets-grid');
  if (gridContainer) {
    gridContainer.innerHTML = Store.vodafoneLines.map(l => {
      const isSelected = l.lineNum === lineNum;
      const hasPhone = Boolean(l.phone && l.phone.trim());
      const hasBalance = (l.balance || 0) > 0;
      return `
        <button 
          onclick="window.selectVodafoneLine(${l.lineNum})"
          class="wallet-btn flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 cursor-pointer ${
            isSelected 
              ? 'bg-primary-container text-on-primary ring-2 ring-secondary shadow-md scale-105' 
              : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
          }"
          type="button">
          <div class="flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px] ${isSelected ? 'text-secondary-fixed' : (hasBalance ? 'text-on-tertiary-container' : 'text-on-surface-variant')}">
              ${hasBalance ? 'account_balance_wallet' : 'sim_card'}
            </span>
            <span class="font-headline-sm text-headline-sm font-code-mono">${l.lineNum}</span>
          </div>
          <span class="font-code-mono text-label-sm mt-0.5 ${isSelected ? 'text-on-primary-fixed' : 'text-on-surface-variant'} truncate max-w-[65px]">
            ${formatCompactMoney(l.balance || 0)}
          </span>
          <span class="w-1.5 h-1.5 rounded-full mt-1 ${hasPhone ? 'bg-on-tertiary-container' : 'bg-outline-variant'}"></span>
        </button>
      `;
    }).join('');
  }

  // 2. Render Global Vodafone KPIs
  const totalBalance = Store.vodafoneLines.reduce((acc, l) => acc + (parseFloat(l.balance) || 0), 0);
  const totalLimits = Store.vodafoneLines.reduce((acc, l) => acc + (parseFloat(l.monthlyLimit) || 100000), 0);
  const totalTransferred = Store.vodafoneLines.reduce((acc, l) => acc + (parseFloat(l.totalTransferredMonth) || 0), 0);
  const remainingTotalLimit = Math.max(0, totalLimits - totalTransferred);
  const limitPercent = totalLimits > 0 ? Math.min(100, Math.round((totalTransferred / totalLimits) * 100)) : 0;

  // Today's commissions
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCommissions = Store.vodafoneTransactions
    .filter(t => (t.timestamp || '').startsWith(todayStr))
    .reduce((acc, t) => acc + (parseFloat(t.commission) || 0), 0);
  const todayTxsCount = Store.vodafoneTransactions.filter(t => (t.timestamp || '').startsWith(todayStr)).length;

  setElemText('voda-kpi-total-balance', formatMoney(totalBalance));
  setElemText('voda-kpi-remaining-limit', formatMoney(remainingTotalLimit));
  setElemText('voda-kpi-limit-percent', `الاستهلاك الكلي: ${limitPercent}%`);
  setElemText('voda-kpi-today-commissions', formatMoney(todayCommissions));
  setElemText('voda-kpi-today-tx-count', `${todayTxsCount} عمليات`);

  const progressBar = document.getElementById('voda-kpi-limit-bar');
  if (progressBar) progressBar.style.width = `${limitPercent}%`;

  // 3. Render Active Line Card & Details
  setElemText('active-line-badge', `خط ${line.lineNum} - نشط`);
  setElemText('active-line-phone-display', line.phone ? `رقم المحفظة: ${line.phone}` : 'لم يتم تحديد رقم الهاتف');
  setElemText('active-line-balance-display', formatMoney(line.balance || 0));
  
  const lineLimit = parseFloat(line.monthlyLimit) || 100000;
  const lineUsed = parseFloat(line.totalTransferredMonth) || 0;
  const lineRemaining = Math.max(0, lineLimit - lineUsed);
  const lineLimitPercent = lineLimit > 0 ? Math.min(100, Math.round((lineUsed / lineLimit) * 100)) : 0;

  setElemText('active-line-limit-display', `${formatMoney(lineRemaining)} ج.م`);
  setElemText('active-line-limit-sub', `السقف الشهري: ${formatMoney(lineLimit)} ج.م (المستخدم ${lineLimitPercent}%)`);
  
  const activeLineBar = document.getElementById('active-line-limit-bar');
  if (activeLineBar) activeLineBar.style.width = `${lineLimitPercent}%`;

  // 4. Render Active Line Transactions Table
  const lineTxs = Store.vodafoneTransactions.filter(t => t.lineNum === lineNum);
  setElemText('active-line-txs-count', `${lineTxs.length} حركات`);

  const tbody = document.getElementById('transactions-body');
  if (tbody) {
    if (lineTxs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td class="py-16 text-center" colspan="8">
            <div class="flex flex-col items-center justify-center gap-space-sm max-w-sm mx-auto">
              <div class="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[32px]">hourglass_empty</span>
              </div>
              <div class="flex flex-col gap-1 text-center">
                <span class="font-headline-sm text-headline-sm text-on-surface">لم يتم تسجيل أي معاملات على الخط (${lineNum}) حتى الآن</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">قم ببدء عملية الإيداع أو السحب لتحديث كشف الحساب ورصيد المحفظة تلقائياً.</span>
              </div>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = lineTxs.map((tx, idx) => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-lowest/70 transition-colors">
          <td class="py-3 px-3 font-code-mono text-secondary font-bold">#${lineTxs.length - idx}</td>
          <td class="py-3 px-3 font-code-mono text-on-surface-variant text-label-sm">${formatTime(tx.timestamp)}</td>
          <td class="py-3 px-3">
            <span class="px-2.5 py-0.5 rounded-full text-label-sm font-bold inline-flex items-center gap-1 ${
              tx.type === 'deposit' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }">
              <span class="material-symbols-outlined text-[14px]">${tx.type === 'deposit' ? 'add_circle' : 'remove_circle'}</span>
              ${tx.type === 'deposit' ? 'إيداع / استلام' : 'تحويل / سحب'}
            </span>
          </td>
          <td class="py-3 px-3 font-code-mono font-bold text-on-surface">${formatMoney(tx.amount)} ج.م</td>
          <td class="py-3 px-3 font-code-mono text-on-surface">${tx.customerPhone || '-'}</td>
          <td class="py-3 px-3 font-code-mono text-on-tertiary-container font-bold">+${formatMoney(tx.commission || 0)} ج.م</td>
          <td class="py-3 px-3 font-code-mono text-on-surface-variant">${formatMoney(tx.balanceAfter)} ج.م</td>
          <td class="py-3 px-3 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="window.openEditVodafoneTxModal('${tx.id}')" class="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" title="تعديل">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button onclick="window.confirmDeleteVodafoneTx('${tx.id}')" class="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors" title="حذف">
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
  // Select line helper
  window.selectVodafoneLine = (lineNum) => {
    AppState.activeVodafoneLine = lineNum;
    renderVodafoneHub();
  };

  // Submit Vodafone Transaction Form
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

      // Clear inputs
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

  // Reset Line
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

  // Delete Transaction
  window.confirmDeleteVodafoneTx = (txId) => {
    AppState.deleteTarget = {
      type: 'vodafone_tx',
      id: txId,
      title: 'حذف معاملة فودافون كاش',
      message: 'هل أنت متأكد من حذف هذه المعاملة؟ سيتم التراجع عن أثرها المالي على رصيد المحفظة والدرج.'
    };
    openDeleteConfirmModal();
  };

  // Line Settings Modal
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

  // Edit Vodafone Transaction
  window.openEditVodafoneTxModal = (txId) => {
    const tx = Store.vodafoneTransactions.find(t => t.id === txId);
    if (!tx) return;

    AppState.editingVodafoneTxId = txId;
    setElemValue('edit-voda-tx-id', tx.id);
    setElemText('edit-voda-line-title', `خط فودافون كاش: رقم ${tx.lineNum}`);
    
    const typeBadge = document.getElementById('edit-voda-type-badge');
    if (typeBadge) {
      typeBadge.innerText = tx.type === 'deposit' ? 'إيداع / استلام (+)' : 'تحويل / سحب (-)';
      typeBadge.className = `px-2 py-0.5 rounded-full font-code-mono text-label-sm font-bold ${
        tx.type === 'deposit' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
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
  
  // Calculate category KPI metrics
  const totalQty = allChargers.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const costVal = allChargers.reduce((acc, p) => acc + ((p.buyPrice || 0) * (p.quantity || 0)), 0);
  const retailVal = allChargers.reduce((acc, p) => acc + ((p.sellPrice || 0) * (p.quantity || 0)), 0);
  const lowStock = allChargers.filter(p => (p.quantity || 0) <= 2).length;

  setElemText('chargers-stat-qty', totalQty);
  setElemText('chargers-stat-cost', formatMoney(costVal));
  setElemText('chargers-stat-retail', formatMoney(retailVal));
  setElemText('chargers-stat-profit', `أرباح تقديرية: ${formatMoney(retailVal - costVal)} ج.م`);
  setElemText('chargers-stat-low', lowStock);

  // Subcategory filter counts
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

  // Filter items
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

  // Render Table
  const tbody = document.getElementById('chargers-table-body');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-16 text-center">
            <div class="flex flex-col items-center justify-center gap-space-sm max-w-sm mx-auto">
              <div class="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[32px]">cable</span>
              </div>
              <div class="flex flex-col gap-1 text-center">
                <span class="font-headline-sm text-headline-sm text-on-surface">لا توجد شواحن أو وصلات مسجلة</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">المخزن فارغ حالياً. يمكنك مسح الباركود أو الضغط على الزر أدناه لإضافة أول صنف.</span>
              </div>
              <button onclick="window.openAddProductModal('chargers', '${activeTab !== 'all' ? activeTab : 'complete'}')" class="mt-space-xs bg-secondary text-on-secondary px-space-md py-space-xs rounded-lg font-headline-sm text-headline-sm flex items-center gap-space-xs hover:bg-secondary-container transition-all shadow-sm active:scale-95">
                <span class="material-symbols-outlined text-[18px]">add_circle</span>
                <span>+ إضافة صنف جديد</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-lowest/70 transition-colors">
          <td class="py-3 px-4 font-code-mono font-bold text-secondary">
            <span class="cursor-pointer hover:underline" onclick="window.addItemToCartFromBarcode('${item.barcode}')">${item.barcode || 'بدون باركود'}</span>
          </td>
          <td class="py-3 px-4 font-label-lg font-bold text-on-surface">${item.name}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded-full text-label-sm bg-surface-container text-on-surface-variant">
              ${getChargerSubcategoryLabel(item.subcategory)}
            </span>
          </td>
          <td class="py-3 px-4 font-code-mono text-on-surface">${formatMoney(item.buyPrice)} ج.م</td>
          <td class="py-3 px-4 font-code-mono font-bold text-on-tertiary-container">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-2">
              <span class="font-code-mono font-bold text-headline-sm ${item.quantity <= 2 ? 'text-error' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface" title="زيادة المخزون +1">
                +
              </button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface" title="إنقاص المخزون -1">
                -
              </button>
            </div>
          </td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" title="تعديل">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors" title="حذف">
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

  // Today's sold phones
  const todayStr = new Date().toISOString().split('T')[0];
  const soldToday = soldPhones.filter(p => (p.soldAt || p.updatedAt || '').startsWith(todayStr));
  const todayProfit = soldToday.reduce((acc, p) => acc + ((p.sellPrice || 0) - (p.buyPrice || 0)), 0);

  // Valuation
  const stockVal = availablePhones.reduce((acc, p) => acc + (p.buyPrice || 0), 0);

  setElemText('metric-stock-count', availablePhones.length);
  setElemText('metric-stock-value', formatMoney(stockVal));
  setElemText('metric-sold-today', soldToday.length);
  setElemText('metric-profit', formatMoney(todayProfit));

  // Filter
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
            <div class="flex flex-col items-center justify-center gap-space-sm max-w-sm mx-auto">
              <div class="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[32px]">smartphone</span>
              </div>
              <div class="flex flex-col gap-1 text-center">
                <span class="font-headline-sm text-headline-sm text-on-surface">لا توجد هواتف مسجلة بالمخزن</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">أضف هواتف جديدة مسجلة برقم السيريال أو الـ IMEI وسعر التكلفة والبيع.</span>
              </div>
              <button onclick="window.openAddProductModal('phones')" class="mt-space-xs bg-secondary text-on-secondary px-space-md py-space-xs rounded-lg font-headline-sm text-headline-sm flex items-center gap-space-xs hover:bg-secondary-container transition-all shadow-sm active:scale-95">
                <span class="material-symbols-outlined text-[18px]">add_circle</span>
                <span>+ إضافة هاتف جديد</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(phone => {
        const isAvail = phone.status === 'available';
        return `
          <tr class="border-b border-surface-container-low hover:bg-surface-container-lowest/70 transition-colors">
            <td class="py-3 px-4 font-code-mono font-bold text-secondary">
              <span class="cursor-pointer hover:underline" onclick="window.addItemToCartFromBarcode('${phone.imei || phone.barcode}')">${phone.imei || phone.barcode || '-'}</span>
            </td>
            <td class="py-3 px-4 font-headline-sm font-bold text-on-surface">
              ${phone.brand || ''} ${phone.model || phone.name}
            </td>
            <td class="py-3 px-4 font-label-md text-on-surface-variant">
              ${phone.storage || '-'} / ${phone.color || '-'}
            </td>
            <td class="py-3 px-4 font-code-mono text-on-surface">${formatMoney(phone.buyPrice)} ج.م</td>
            <td class="py-3 px-4 font-code-mono font-bold text-on-tertiary-container">${formatMoney(phone.sellPrice)} ج.م</td>
            <td class="py-3 px-4">
              <span class="px-2.5 py-0.5 rounded-full text-label-sm font-bold inline-flex items-center gap-1 ${
                isAvail ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-container text-on-surface-variant'
              }">
                <span class="w-1.5 h-1.5 rounded-full ${isAvail ? 'bg-emerald-600' : 'bg-outline'}"></span>
                ${isAvail ? 'متوفر بالمحل' : 'تم البيع'}
              </span>
            </td>
            <td class="py-3 px-4 font-label-sm text-on-surface-variant">
              ${!isAvail && phone.customerName ? `${phone.customerName} (${phone.customerPhone || ''})` : '-'}
            </td>
            <td class="py-3 px-4 text-center">
              <div class="flex items-center justify-center gap-1">
                ${isAvail ? `
                  <button onclick="window.addItemToCartFromBarcode('${phone.imei || phone.barcode}')" class="p-1 rounded bg-secondary/10 hover:bg-secondary text-secondary hover:text-white transition-colors" title="إضافة للفاتورة (بيع)">
                    <span class="material-symbols-outlined text-[18px]">shopping_cart</span>
                  </button>
                ` : ''}
                <button onclick="window.openEditProductModal('${phone.id}')" class="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" title="تعديل">
                  <span class="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button onclick="window.confirmDeleteProduct('${phone.id}')" class="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors" title="حذف">
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

  // Category counts
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
            <div class="flex flex-col items-center justify-center gap-space-sm max-w-sm mx-auto">
              <div class="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[32px]">headphones</span>
              </div>
              <div class="flex flex-col gap-1 text-center">
                <span class="font-headline-sm text-headline-sm text-on-surface">لا توجد سماعات مسجلة في هذا القسم</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">قم بمسح الباركود أو الضغط على زر الإضافة لتسجيل سماعات جديدة.</span>
              </div>
              <button onclick="window.openAddProductModal('headphones', '${activeTab !== 'all' ? activeTab : 'silicone'}')" class="mt-space-xs bg-secondary text-on-secondary px-space-md py-space-xs rounded-lg font-headline-sm text-headline-sm flex items-center gap-space-xs hover:bg-secondary-container transition-all shadow-sm active:scale-95">
                <span class="material-symbols-outlined text-[18px]">add_circle</span>
                <span>+ إضافة سماعة جديدة</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-lowest/70 transition-colors">
          <td class="py-3 px-4 font-code-mono font-bold text-secondary">
            <span class="cursor-pointer hover:underline" onclick="window.addItemToCartFromBarcode('${item.barcode}')">${item.barcode || 'بدون باركود'}</span>
          </td>
          <td class="py-3 px-4 font-label-lg font-bold text-on-surface">${item.name}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded-full text-label-sm bg-surface-container text-on-surface-variant">
              ${getHeadphoneSubcategoryLabel(item.subcategory)}
            </span>
          </td>
          <td class="py-3 px-4 font-code-mono text-on-surface">${formatMoney(item.buyPrice)} ج.م</td>
          <td class="py-3 px-4 font-code-mono font-bold text-on-tertiary-container">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-2">
              <span class="font-code-mono font-bold text-headline-sm ${item.quantity <= 2 ? 'text-error' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface" title="زيادة +1">
                +
              </button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface" title="إنقاص -1">
                -
              </button>
            </div>
          </td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" title="تعديل">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors" title="حذف">
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

  // Category counts
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
            <div class="flex flex-col items-center justify-center gap-space-sm max-w-sm mx-auto">
              <div class="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[32px]">speaker</span>
              </div>
              <div class="flex flex-col gap-1 text-center">
                <span class="font-headline-sm text-headline-sm text-on-surface">لا توجد صبات مسجلة في هذا الحجم</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">امسح باركود الصب أو اضغط F1 لإضافة صب جديد للمخزن.</span>
              </div>
              <button onclick="window.openAddProductModal('speakers', '${activeTab !== 'all' ? activeTab : 'small'}')" class="mt-space-xs bg-secondary text-on-secondary px-space-md py-space-xs rounded-lg font-headline-sm text-headline-sm flex items-center gap-space-xs hover:bg-secondary-container transition-all shadow-sm active:scale-95">
                <span class="material-symbols-outlined text-[18px]">add_circle</span>
                <span>+ إضافة صب جديد</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filtered.map(item => `
        <tr class="border-b border-surface-container-low hover:bg-surface-container-lowest/70 transition-colors">
          <td class="py-3 px-4 font-code-mono font-bold text-secondary">
            <span class="cursor-pointer hover:underline" onclick="window.addItemToCartFromBarcode('${item.barcode}')">${item.barcode || 'بدون باركود'}</span>
          </td>
          <td class="py-3 px-4 font-label-lg font-bold text-on-surface">${item.name}</td>
          <td class="py-3 px-4">
            <span class="px-2 py-0.5 rounded-full text-label-sm bg-surface-container text-on-surface-variant">
              ${getSpeakerSubcategoryLabel(item.subcategory)}
            </span>
          </td>
          <td class="py-3 px-4 font-code-mono text-on-surface">${formatMoney(item.buyPrice)} ج.م</td>
          <td class="py-3 px-4 font-code-mono font-bold text-on-tertiary-container">${formatMoney(item.sellPrice)} ج.م</td>
          <td class="py-3 px-4">
            <div class="flex items-center gap-2">
              <span class="font-code-mono font-bold text-headline-sm ${item.quantity <= 2 ? 'text-error' : 'text-on-surface'}">${item.quantity}</span>
              <button onclick="window.quickAdjustStock('${item.id}', 1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface" title="زيادة +1">
                +
              </button>
              <button onclick="window.quickAdjustStock('${item.id}', -1)" class="w-6 h-6 rounded bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface" title="إنقاص -1">
                -
              </button>
            </div>
          </td>
          <td class="py-3 px-4 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="window.openEditProductModal('${item.id}')" class="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors" title="تعديل">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button onclick="window.confirmDeleteProduct('${item.id}')" class="p-1 rounded hover:bg-error-container text-on-surface-variant hover:text-error transition-colors" title="حذف">
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

// Tab switcher helpers for inventory pages
window.setChargerTab = (tab) => {
  AppState.activeChargerTab = tab;
  document.querySelectorAll('.charger-tab-btn').forEach(b => {
    b.classList.remove('bg-primary-container', 'text-on-primary');
    b.classList.add('bg-surface-container-low', 'text-on-surface');
  });
  const activeBtn = document.querySelector(`.charger-tab-btn[data-charger-cat="${tab}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-surface-container-low', 'text-on-surface');
    activeBtn.classList.add('bg-primary-container', 'text-on-primary');
  }
  renderChargersPage();
};

window.setHeadphoneTab = (tab) => {
  AppState.activeHeadphoneTab = tab;
  document.querySelectorAll('.headphone-tab-btn').forEach(b => {
    b.classList.remove('bg-primary-container', 'text-on-primary');
    b.classList.add('bg-surface-container-low', 'text-on-surface');
  });
  const activeBtn = document.querySelector(`.headphone-tab-btn[data-headphone-cat="${tab}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-surface-container-low', 'text-on-surface');
    activeBtn.classList.add('bg-primary-container', 'text-on-primary');
  }
  renderHeadphonesPage();
};

window.setSpeakerTab = (tab) => {
  AppState.activeSpeakerTab = tab;
  document.querySelectorAll('.speaker-tab-btn').forEach(b => {
    b.classList.remove('bg-primary-container', 'text-on-primary');
    b.classList.add('bg-surface-container-low', 'text-on-surface');
  });
  const activeBtn = document.querySelector(`.speaker-tab-btn[data-speaker-cat="${tab}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-surface-container-low', 'text-on-surface');
    activeBtn.classList.add('bg-primary-container', 'text-on-primary');
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

function setupBarcodeScannerListener() {
  let buffer = '';
  let lastKeyTime = Date.now();

  window.addEventListener('keydown', (e) => {
    // Ignore function keys or modifier keys
    if (['F1', 'F2', 'F3', 'F4', 'Escape'].includes(e.key)) return;

    // Check if user is typing manually into a standard form input or textarea
    const activeElem = document.activeElement;
    const isEditingInput = activeElem && (
      activeElem.tagName === 'INPUT' || 
      activeElem.tagName === 'TEXTAREA' || 
      activeElem.tagName === 'SELECT'
    );

    const currentTime = Date.now();
    const timeDiff = currentTime - lastKeyTime;
    lastKeyTime = currentTime;

    // Hardware barcode scanners type very rapidly (typically < 40ms per keystroke)
    if (e.key === 'Enter') {
      if (buffer.length >= 3) {
        // We have a scanned barcode from hardware or entered in quick input!
        const scannedCode = buffer.trim();
        buffer = '';
        e.preventDefault();
        handleScannedBarcode(scannedCode);
        return;
      }
      buffer = '';
      return;
    }

    if (e.key.length === 1) {
      if (timeDiff > 120 && !isEditingInput) {
        // Reset buffer if delay too long between keystrokes outside an input
        buffer = '';
      }
      buffer += e.key;
    }
  });

  // Handle direct barcode inputs in header or inventory search
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
  bindEnterToBarcode('dash-scan-input');
  bindEnterToBarcode('chargers-search-input');
  bindEnterToBarcode('headphones-search-input');
  bindEnterToBarcode('phones-search-input');
  bindEnterToBarcode('pos-barcode-search');
}

export function handleScannedBarcode(barcode) {
  console.log(`🔍 Barcode detected: ${barcode}`);
  
  // Play subtle audio beep
  playScanBeep();

  // Find product by barcode or IMEI
  const product = Store.products.find(p => 
    (p.barcode && p.barcode.trim() === barcode.trim()) ||
    (p.imei && p.imei.trim() === barcode.trim())
  );

  const isPOSOpen = !document.getElementById('modal-quick-pos')?.classList.contains('hidden');

  if (isPOSOpen) {
    // If POS cart is open, immediately add to cart
    if (product) {
      addItemToCart(product);
      showToast(`تمت إضافة [${product.name}] إلى سلة البيع`, 'shopping_cart');
    } else {
      showToast(`الباركود [${barcode}] غير مسجل بالمخزن. اضغط F1 لإضافته.`, 'warning');
    }
  } else {
    // Not in POS modal: check if item exists
    if (product) {
      // If we are in inventory, highlight or open POS cart directly
      showToast(`تم العثور على الصنف: ${product.name} (الكمية: ${product.quantity})`, 'check_circle');
      // Trigger Quick POS and add this item
      window.triggerQuickPOS();
      addItemToCart(product);
    } else {
      // Product doesn't exist -> Prompt to add it immediately!
      showToast(`باركود جديد [${barcode}]. جاري فتح نافذة الإضافة...`, 'add_circle');
      window.openAddProductModal(getDefaultCategoryForCurrentView(), null, barcode);
    }
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

function playScanBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {
    // AudioContext might be blocked until user gesture
  }
}

// ==========================================
// QUICK POS MODAL & CART (F2)
// ==========================================

function setupQuickPOS() {
  window.triggerQuickPOS = () => {
    const modal = document.getElementById('modal-quick-pos');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      // Auto focus barcode input
      setTimeout(() => {
        document.getElementById('pos-barcode-search')?.focus();
      }, 100);
      renderPOSCart();
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

  // Pos barcode search input handler
  const posSearch = document.getElementById('pos-barcode-search');
  if (posSearch) {
    posSearch.addEventListener('input', (e) => {
      renderPOSProductDropdown(e.target.value.trim());
    });
  }

  // Discount input
  const discountInput = document.getElementById('pos-discount-input');
  if (discountInput) {
    discountInput.addEventListener('input', (e) => {
      AppState.cartDiscount = parseFloat(e.target.value) || 0;
      renderPOSCart();
    });
  }

  // Cash Paid input
  const cashPaidInput = document.getElementById('pos-cash-paid');
  if (cashPaidInput) {
    cashPaidInput.addEventListener('input', () => {
      calculatePOSChange();
    });
  }

  // Checkout button
  const btnCheckout = document.getElementById('pos-btn-checkout');
  if (btnCheckout) {
    btnCheckout.addEventListener('click', () => {
      executePOSCheckout();
    });
  }
}

function addItemToCart(product) {
  // Check if phone and already sold
  if (product.category === 'phones' && product.status !== 'available') {
    showToast("عفواً هذا الهاتف تم بيعه بالفعل!", "warning");
    return;
  }

  const existingIdx = AppState.cart.findIndex(i => i.id === product.id);
  if (existingIdx !== -1) {
    // If not a phone, increase quantity
    if (product.category === 'phones') {
      showToast("هذا الهاتف مسجل برقم IMEI فريد وموجود بالفعل بالسلة", "warning");
      return;
    }
    // Check available stock
    if (AppState.cart[existingIdx].quantity >= product.quantity) {
      showToast(`الكمية المطلوبة تتجاوز المخزون المتوفر (${product.quantity})`, "warning");
      return;
    }
    AppState.cart[existingIdx].quantity += 1;
  } else {
    // Check stock
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
  // Clear search
  const posSearch = document.getElementById('pos-barcode-search');
  if (posSearch) posSearch.value = '';
  document.getElementById('pos-search-results')?.classList.add('hidden');
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
  if (countBadge) countBadge.innerText = `${AppState.cart.length} أصناف`;

  if (!container) return;

  if (AppState.cart.length === 0) {
    container.innerHTML = `
      <div class="h-64 flex flex-col items-center justify-center text-on-surface-variant gap-2 text-center">
        <span class="material-symbols-outlined text-[48px] text-outline-variant">shopping_cart</span>
        <span class="font-headline-sm text-headline-sm">سلة البيع فارغة</span>
        <span class="font-body-sm text-body-sm">امسح باركود الصنف أو ابحث بالاسم لإضافته فوراً</span>
      </div>
    `;
    setElemText('pos-subtotal', '0.00');
    setElemText('pos-total', '0.00');
    setElemValue('pos-cash-paid', '');
    setElemText('pos-change', '0.00');
    return;
  }

  let subtotal = 0;
  container.innerHTML = AppState.cart.map(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    return `
      <div class="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
        <div class="flex flex-col flex-1">
          <span class="font-headline-sm text-headline-sm text-on-surface">${item.name}</span>
          <div class="flex items-center gap-2 mt-0.5 text-on-surface-variant font-code-mono text-label-sm">
            <span>${formatMoney(item.price)} ج.م</span>
            <span>×</span>
            <span>${item.quantity}</span>
            <span>=</span>
            <span class="text-secondary font-bold">${formatMoney(itemTotal)} ج.م</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center bg-surface-container-lowest rounded-lg border border-outline-variant/30">
            <button onclick="window.adjustCartQty('${item.id}', -1)" class="w-7 h-7 flex items-center justify-center text-on-surface hover:bg-surface-container rounded-r-lg">-</button>
            <span class="w-8 text-center font-code-mono font-bold">${item.quantity}</span>
            <button onclick="window.adjustCartQty('${item.id}', 1)" class="w-7 h-7 flex items-center justify-center text-on-surface hover:bg-surface-container rounded-l-lg">+</button>
          </div>
          <button onclick="window.removeCartItem('${item.id}')" class="text-error hover:bg-error-container/20 p-1 rounded-lg">
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

  // Default cash paid to total
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

function renderPOSProductDropdown(query) {
  const resultsBox = document.getElementById('pos-search-results');
  if (!resultsBox) return;

  if (!query || query.length < 2) {
    resultsBox.classList.add('hidden');
    return;
  }

  const matches = Store.products.filter(p => 
    (p.name || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.barcode || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.imei || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.model || '').toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  if (matches.length === 0) {
    resultsBox.innerHTML = `
      <div class="p-3 text-center text-on-surface-variant font-label-md">
        لا توجد أصناف مطابقة لهذا البحث
      </div>
    `;
  } else {
    resultsBox.innerHTML = matches.map(p => `
      <div 
        onclick="window.posSelectProduct('${p.id}')"
        class="p-2.5 hover:bg-surface-container flex items-center justify-between cursor-pointer border-b border-surface-container-low transition-colors">
        <div class="flex flex-col">
          <span class="font-headline-sm text-headline-sm text-on-surface">${p.name}</span>
          <span class="font-code-mono text-label-sm text-on-surface-variant">${p.barcode || p.imei || '-'} (${p.category})</span>
        </div>
        <div class="flex flex-col items-end">
          <span class="font-code-mono font-bold text-secondary">${formatMoney(p.sellPrice)} ج.م</span>
          <span class="font-label-sm text-on-surface-variant text-[11px]">المتاح: ${p.quantity}</span>
        </div>
      </div>
    `).join('');
  }

  resultsBox.classList.remove('hidden');
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

    // Reset Cart
    AppState.cart = [];
    AppState.cartDiscount = 0;
    if (document.getElementById('pos-discount-input')) document.getElementById('pos-discount-input').value = '0';
    if (document.getElementById('pos-cust-name')) document.getElementById('pos-cust-name').value = '';
    if (document.getElementById('pos-cust-phone')) document.getElementById('pos-cust-phone').value = '';

    window.closeQuickPOS();
    showToast(`تم حفظ الفاتورة بنجاح رقم ${invoice.invoiceNumber} وخصم المخزون`, 'verified');

    // Open Thermal Receipt Print Dialog
    window.printInvoiceReceipt(invoice.id);

  } catch (err) {
    showToast(`فشل إتمام البيع: ${err.message}`, 'error');
  }
}

// ==========================================
// THERMAL RECEIPT PRINTING
// ==========================================

window.printInvoiceReceipt = (invoiceId) => {
  const invoice = Store.salesInvoices.find(inv => inv.id === invoiceId) || Store.salesInvoices[0];
  if (!invoice) return;

  const modal = document.getElementById('modal-thermal-receipt');
  const container = document.getElementById('thermal-receipt-content');

  if (modal && container) {
    container.innerHTML = `
      <div class="p-6 bg-white text-black font-mono text-sm leading-tight text-right select-text" style="width: 80mm; margin: 0 auto;">
        <div class="text-center pb-3 border-b-2 border-dashed border-gray-400">
          <h2 class="text-xl font-bold font-sans">حلمي سنترال وموبايل</h2>
          <p class="text-xs text-gray-600">خدمات الاتصالات والمحافظ الذكية والمبيعات</p>
          <p class="text-xs text-gray-600">هاتف: 01000000000 - العنوان: الفرع الرئيسي</p>
        </div>

        <div class="py-2 border-b border-dashed border-gray-300 text-xs">
          <div class="flex justify-between"><span>رقم الفاتورة:</span><span class="font-bold">${invoice.invoiceNumber}</span></div>
          <div class="flex justify-between"><span>التاريخ والوقت:</span><span>${formatDate(invoice.timestamp)} ${formatTime(invoice.timestamp)}</span></div>
          <div class="flex justify-between"><span>الكاشير:</span><span>${invoice.cashier || 'أحمد الكاشير'}</span></div>
          <div class="flex justify-between"><span>العميل:</span><span>${invoice.customerName || 'نقدي'}</span></div>
        </div>

        <div class="py-2 border-b-2 border-dashed border-gray-400">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-gray-300">
                <th class="text-right py-1">الصنف</th>
                <th class="text-center py-1">الكمية</th>
                <th class="text-center py-1">السعر</th>
                <th class="text-left py-1">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => `
                <tr>
                  <td class="py-1">${item.name}</td>
                  <td class="text-center py-1">${item.quantity}</td>
                  <td class="text-center py-1">${formatMoney(item.price)}</td>
                  <td class="text-left py-1 font-bold">${formatMoney(item.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="py-2 border-b-2 border-dashed border-gray-400 text-xs font-sans">
          <div class="flex justify-between py-0.5"><span>المجموع:</span><span>${formatMoney(invoice.subtotal)} ج.م</span></div>
          ${invoice.discount > 0 ? `<div class="flex justify-between py-0.5 text-red-600"><span>الخصم:</span><span>-${formatMoney(invoice.discount)} ج.م</span></div>` : ''}
          <div class="flex justify-between py-1 text-base font-bold border-t border-gray-200 mt-1">
            <span>الصافي المطلوب:</span>
            <span>${formatMoney(invoice.totalAmount)} ج.م</span>
          </div>
          <div class="flex justify-between py-0.5"><span>المدفوع نقداً:</span><span>${formatMoney(invoice.cashPaid)} ج.م</span></div>
          <div class="flex justify-between py-0.5"><span>المتبقي للعميل:</span><span>${formatMoney(invoice.change)} ج.م</span></div>
        </div>

        <div class="pt-4 text-center text-xs text-gray-600">
          <p>شكراً لزيارتكم ونتشرف بخدمتكم دائماً</p>
          <p class="font-bold mt-1">البضاعة المباعة ترد وتستبدل خلال 14 يوماً بالفاتورة</p>
          <div class="mt-2 text-center text-[10px] text-gray-400">نظام حلمي تليكوم POS - سحابي متزامن</div>
        </div>
      </div>
    `;

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

window.executePrintReceipt = () => {
  window.print();
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

  // Barcode generator helper
  window.generateRandomBarcode = () => {
    const randomCode = '622' + Math.floor(100000000 + Math.random() * 900000000);
    setElemValue('prod-barcode', randomCode);
  };

  // Add Product Modal trigger
  window.openAddProductModal = (category = 'chargers', subcategory = null, barcode = '') => {
    AppState.editingProductId = null;
    setElemText('modal-prod-title', '+ إضافة صنف جديد للمخزن');
    
    // Reset Form
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

  // Edit Product Modal trigger
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

    // For phones
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

  // Save product (Add or Update)
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

  // Delete Product
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
    } else if (e.key === 'Escape') {
      // Close any open modal
      window.closeQuickPOS();
      window.closeProductModal();
      window.closeDeleteConfirmModal();
      window.closeLineSettingsModal();
      window.closeEditVodafoneTxModal();
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

// Global Export
window.navigateTo = navigateTo;
window.formatMoney = formatMoney;
