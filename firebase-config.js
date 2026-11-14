// firebase-config.js - Firebase Initialization & Data Sync Service for Hilmy Telecom POS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  enableNetwork,
  disableNetwork
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your exact web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDFOcL78EElDCtO21PGV3brHmWsLQXuab0",
  authDomain: "mnmn-daadf.firebaseapp.com",
  projectId: "mnmn-daadf",
  storageBucket: "mnmn-daadf.firebasestorage.app",
  messagingSenderId: "183889326185",
  appId: "1:183889326185:web:3d289c90e69e0975f7b2f8",
  measurementId: "G-MZGC8V6ZRG"
};

// Initialize Firebase App & Firestore
let app = null;
let db = null;
let isOnline = false;
let listeners = [];

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  isOnline = true;
  console.log("🔥 Firebase initialized successfully for project: mnmn-daadf");
} catch (e) {
  console.warn("⚠️ Firebase direct init warning, falling back to local mode:", e);
  isOnline = false;
}

// LocalStorage Persistence Keys
const STORAGE_KEYS = {
  PRODUCTS: 'hilmy_pos_products_v1',
  VODAFONE_LINES: 'hilmy_pos_voda_lines_v1',
  VODAFONE_TXS: 'hilmy_pos_voda_txs_v1',
  SALES: 'hilmy_pos_sales_v1',
  DRAWER: 'hilmy_pos_drawer_v1',
  SETTINGS: 'hilmy_pos_settings_v1'
};

// Helper: Local storage read/write
function getLocal(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (err) {
    console.error("Local storage read error:", err);
    return defaultVal;
  }
}

function setLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.error("Local storage write error:", err);
  }
}

// Data store in-memory mirror
export const Store = {
  products: getLocal(STORAGE_KEYS.PRODUCTS, []),
  vodafoneLines: getLocal(STORAGE_KEYS.VODAFONE_LINES, []),
  vodafoneTransactions: getLocal(STORAGE_KEYS.VODAFONE_TXS, []),
  salesInvoices: getLocal(STORAGE_KEYS.SALES, []),
  drawer: getLocal(STORAGE_KEYS.DRAWER, {
    shiftId: '#402',
    openingCash: 0,
    currentCash: 0,
    history: []
  }),
  isFirebaseConnected: false
};

// Event emitter for UI updates
const subscribers = new Set();
export function subscribeToStore(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
export function notifySubscribers(event, data) {
  subscribers.forEach(cb => {
    try { cb(event, data, Store); } catch(err) { console.error("Subscriber error:", err); }
  });
}

// Ensure 18 Vodafone Lines exist (Empty default: 0 balance, 0 dummy data)
export function ensureVodafoneLines() {
  if (!Store.vodafoneLines || Store.vodafoneLines.length === 0) {
    const lines = [];
    for (let i = 1; i <= 18; i++) {
      lines.push({
        id: `line_${i}`,
        lineNum: i,
        phone: '',
        monthlyLimit: 100000,
        balance: 0.00,
        totalTransferredMonth: 0.00,
        isActive: true,
        updatedAt: new Date().toISOString()
      });
    }
    Store.vodafoneLines = lines;
    setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);
  }
}
ensureVodafoneLines();

// ==========================================
// FIRESTORE REALTIME SYNC ENGINE
// ==========================================

export async function initRealtimeSync() {
  if (!db) {
    updateConnectionUI(false, "غير متصل (يعمل محلياً)");
    return;
  }

  try {
    // 1. Sync Products
    const productsCol = collection(db, "products");
    onSnapshot(productsCol, (snapshot) => {
      Store.isFirebaseConnected = true;
      updateConnectionUI(true, "متصل بالسيرفر (Firebase Live)");
      
      const prods = [];
      snapshot.forEach(docSnap => {
        prods.push({ id: docSnap.id, ...docSnap.data() });
      });
      Store.products = prods;
      setLocal(STORAGE_KEYS.PRODUCTS, prods);
      notifySubscribers("products_updated", prods);
    }, (error) => {
      console.warn("Products sync error:", error);
      Store.isFirebaseConnected = false;
      updateConnectionUI(false, "وضع عدم الاتصال (Offline)");
    });

    // 2. Sync Vodafone Lines
    const vodaLinesCol = collection(db, "vodafone_lines");
    onSnapshot(vodaLinesCol, (snapshot) => {
      if (!snapshot.empty) {
        const linesMap = {};
        snapshot.forEach(docSnap => {
          const d = docSnap.data();
          linesMap[d.lineNum] = { id: docSnap.id, ...d };
        });

        // Merge into 18 lines
        const lines = [];
        for (let i = 1; i <= 18; i++) {
          if (linesMap[i]) {
            lines.push(linesMap[i]);
          } else {
            lines.push(Store.vodafoneLines.find(l => l.lineNum === i) || {
              id: `line_${i}`,
              lineNum: i,
              phone: '',
              monthlyLimit: 100000,
              balance: 0,
              totalTransferredMonth: 0
            });
          }
        }
        Store.vodafoneLines = lines;
        setLocal(STORAGE_KEYS.VODAFONE_LINES, lines);
        notifySubscribers("vodafone_lines_updated", lines);
      }
    }, (error) => {
      console.warn("Vodafone lines sync error:", error);
    });

    // 3. Sync Vodafone Transactions
    const txCol = collection(db, "vodafone_transactions");
    onSnapshot(txCol, (snapshot) => {
      const txs = [];
      snapshot.forEach(docSnap => {
        txs.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort newest first
      txs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      Store.vodafoneTransactions = txs;
      setLocal(STORAGE_KEYS.VODAFONE_TXS, txs);
      notifySubscribers("vodafone_txs_updated", txs);
    }, (error) => {
      console.warn("Vodafone tx sync error:", error);
    });

    // 4. Sync Sales Invoices
    const salesCol = collection(db, "sales_invoices");
    onSnapshot(salesCol, (snapshot) => {
      const invoices = [];
      snapshot.forEach(docSnap => {
        invoices.push({ id: docSnap.id, ...docSnap.data() });
      });
      invoices.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      Store.salesInvoices = invoices;
      setLocal(STORAGE_KEYS.SALES, invoices);
      notifySubscribers("sales_updated", invoices);
    }, (error) => {
      console.warn("Sales sync error:", error);
    });

    // 5. Sync Cash Drawer
    const drawerDoc = doc(db, "cash_drawer", "current_shift");
    onSnapshot(drawerDoc, (docSnap) => {
      if (docSnap.exists()) {
        Store.drawer = docSnap.data();
        setLocal(STORAGE_KEYS.DRAWER, Store.drawer);
        notifySubscribers("drawer_updated", Store.drawer);
      }
    }, (error) => {
      console.warn("Drawer sync error:", error);
    });

  } catch (err) {
    console.error("Firebase sync initialization failed:", err);
    updateConnectionUI(false, "وضع العمل المحلي");
  }
}

// UI connection badge helper
function updateConnectionUI(online, message) {
  const badge = document.getElementById("firebase-status-badge");
  const text = document.getElementById("firebase-status-text");
  const dot = document.getElementById("firebase-status-dot");
  if (badge && text) {
    text.innerText = message;
    if (online) {
      badge.classList.remove("bg-amber-500/10", "text-amber-600", "border-amber-200");
      badge.classList.add("bg-emerald-500/10", "text-emerald-700", "border-emerald-300");
      if (dot) {
        dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse";
      }
    } else {
      badge.classList.remove("bg-emerald-500/10", "text-emerald-700", "border-emerald-300");
      badge.classList.add("bg-amber-500/10", "text-amber-600", "border-amber-200");
      if (dot) {
        dot.className = "w-2.5 h-2.5 rounded-full bg-amber-500";
      }
    }
  }
}

// ==========================================
// CRUD OPERATIONS (FIREBASE + LOCAL CACHE)
// ==========================================

// --- PRODUCTS CRUD ---
export async function addProduct(productData) {
  const newProduct = {
    barcode: (productData.barcode || '').trim(),
    name: (productData.name || '').trim(),
    category: productData.category, // 'chargers' | 'phones' | 'headphones' | 'speakers'
    subcategory: productData.subcategory || '',
    buyPrice: parseFloat(productData.buyPrice) || 0,
    sellPrice: parseFloat(productData.sellPrice) || 0,
    quantity: parseInt(productData.quantity, 10) || 0,
    brand: productData.brand || '',
    model: productData.model || '',
    imei: productData.imei || '',
    storage: productData.storage || '',
    color: productData.color || '',
    status: productData.status || 'available',
    customerName: productData.customerName || '',
    customerPhone: productData.customerPhone || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Local optimistic update
  const localId = 'prod_' + Date.now();
  newProduct.id = localId;
  Store.products.unshift(newProduct);
  setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
  notifySubscribers("products_updated", Store.products);

  // Firestore sync
  if (db) {
    try {
      const docRef = await addDoc(collection(db, "products"), newProduct);
      newProduct.id = docRef.id;
      // replace temporary id in local array
      const idx = Store.products.findIndex(p => p.id === localId);
      if (idx !== -1) Store.products[idx] = newProduct;
      setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
    } catch (err) {
      console.warn("Failed to write product to Firestore, saved locally:", err);
    }
  }

  return newProduct;
}

export async function updateProduct(id, updateData) {
  updateData.updatedAt = new Date().toISOString();

  // Local update
  const idx = Store.products.findIndex(p => p.id === id);
  if (idx !== -1) {
    Store.products[idx] = { ...Store.products[idx], ...updateData };
    setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
    notifySubscribers("products_updated", Store.products);
  }

  // Firestore update
  if (db && !id.startsWith('prod_')) {
    try {
      const ref = doc(db, "products", id);
      await updateDoc(ref, updateData);
    } catch (err) {
      console.warn("Failed to update product in Firestore:", err);
    }
  }
}

export async function deleteProduct(id) {
  // Local delete
  Store.products = Store.products.filter(p => p.id !== id);
  setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
  notifySubscribers("products_updated", Store.products);

  // Firestore delete
  if (db && !id.startsWith('prod_')) {
    try {
      await deleteDoc(doc(db, "products", id));
    } catch (err) {
      console.warn("Failed to delete product in Firestore:", err);
    }
  }
}

// Adjust stock quantity
export async function adjustProductStock(id, changeQty) {
  const prod = Store.products.find(p => p.id === id);
  if (prod) {
    const newQty = Math.max(0, (prod.quantity || 0) + changeQty);
    await updateProduct(id, { quantity: newQty });
  }
}

// --- VODAFONE CASH OPERATIONS ---

export async function updateVodafoneLineSettings(lineNum, data) {
  const lineIdx = Store.vodafoneLines.findIndex(l => l.lineNum === lineNum);
  if (lineIdx !== -1) {
    Store.vodafoneLines[lineIdx] = {
      ...Store.vodafoneLines[lineIdx],
      phone: data.phone !== undefined ? data.phone : Store.vodafoneLines[lineIdx].phone,
      monthlyLimit: data.monthlyLimit !== undefined ? parseFloat(data.monthlyLimit) : Store.vodafoneLines[lineIdx].monthlyLimit,
      updatedAt: new Date().toISOString()
    };
    setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);
    notifySubscribers("vodafone_lines_updated", Store.vodafoneLines);

    if (db) {
      try {
        const lineDoc = doc(db, "vodafone_lines", `line_${lineNum}`);
        await setDoc(lineDoc, Store.vodafoneLines[lineIdx], { merge: true });
      } catch (err) {
        console.warn("Error updating line settings in Firestore:", err);
      }
    }
  }
}

export async function recordVodafoneTransaction({ lineNum, type, amount, commission, customerPhone, notes }) {
  const numAmount = parseFloat(amount) || 0;
  const numCommission = parseFloat(commission) || 0;
  const lineIdx = Store.vodafoneLines.findIndex(l => l.lineNum === lineNum);
  if (lineIdx === -1) throw new Error("Line not found");

  const line = Store.vodafoneLines[lineIdx];
  let currentBalance = parseFloat(line.balance) || 0;
  let newBalance = currentBalance;

  if (type === 'deposit') {
    // إيداع كاش في المحفظة: المحفظة يزيد رصيدها
    newBalance += numAmount;
  } else if (type === 'withdraw') {
    // سحب / تحويل من المحفظة: المحفظة ينقص رصيدها
    if (currentBalance < numAmount) {
      console.warn("تحذير: رصيد المحفظة أقل من المبلغ المطلوب");
    }
    newBalance -= numAmount;
  }

  // Update line balance
  line.balance = newBalance;
  line.totalTransferredMonth = (line.totalTransferredMonth || 0) + numAmount;
  line.updatedAt = new Date().toISOString();
  setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);

  const txData = {
    lineNum,
    type, // 'deposit' or 'withdraw'
    amount: numAmount,
    commission: numCommission,
    customerPhone: customerPhone || '',
    notes: notes || '',
    balanceAfter: newBalance,
    timestamp: new Date().toISOString()
  };

  const localTxId = 'vtx_' + Date.now();
  txData.id = localTxId;
  Store.vodafoneTransactions.unshift(txData);
  setLocal(STORAGE_KEYS.VODAFONE_TXS, Store.vodafoneTransactions);

  // Update cash drawer with commission and cash flow
  // Deposit: Customer pays cash + commission -> Cash drawer increases by (amount + commission)
  // Withdraw: Customer takes cash, pays commission -> Cash drawer decreases by amount, adds commission -> Net change = (-amount + commission)
  const cashDelta = (type === 'deposit') ? (numAmount + numCommission) : (-numAmount + numCommission);
  await recordCashDrawerEntry({
    type: (cashDelta >= 0) ? 'in' : 'out',
    amount: Math.abs(cashDelta),
    reason: `معاملة فودافون كاش (${type === 'deposit' ? 'إيداع' : 'سحب'}) - خط ${lineNum} - عمولة: ${numCommission} ج.م`
  });

  notifySubscribers("vodafone_lines_updated", Store.vodafoneLines);
  notifySubscribers("vodafone_txs_updated", Store.vodafoneTransactions);

  // Firestore sync
  if (db) {
    try {
      await setDoc(doc(db, "vodafone_lines", `line_${lineNum}`), line, { merge: true });
      const docRef = await addDoc(collection(db, "vodafone_transactions"), txData);
      txData.id = docRef.id;
      const idx = Store.vodafoneTransactions.findIndex(t => t.id === localTxId);
      if (idx !== -1) Store.vodafoneTransactions[idx] = txData;
      setLocal(STORAGE_KEYS.VODAFONE_TXS, Store.vodafoneTransactions);
    } catch (err) {
      console.warn("Error saving vodafone tx to Firestore:", err);
    }
  }

  return txData;
}

export async function updateVodafoneTransaction(txId, { amount, commission, customerPhone, notes }) {
  const txIdx = Store.vodafoneTransactions.findIndex(t => t.id === txId);
  if (txIdx === -1) return;

  const oldTx = Store.vodafoneTransactions[txIdx];
  const newAmount = parseFloat(amount) || 0;
  const newCommission = parseFloat(commission) || 0;
  const amountDelta = newAmount - oldTx.amount;
  const commDelta = newCommission - (oldTx.commission || 0);

  // Adjust line balance
  const lineIdx = Store.vodafoneLines.findIndex(l => l.lineNum === oldTx.lineNum);
  if (lineIdx !== -1) {
    const line = Store.vodafoneLines[lineIdx];
    if (oldTx.type === 'deposit') {
      line.balance += amountDelta;
    } else {
      line.balance -= amountDelta;
    }
    line.totalTransferredMonth = Math.max(0, (line.totalTransferredMonth || 0) + amountDelta);
    setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);
    if (db) {
      setDoc(doc(db, "vodafone_lines", `line_${oldTx.lineNum}`), line, { merge: true }).catch(console.warn);
    }
  }

  // Update transaction record
  const updatedTx = {
    ...oldTx,
    amount: newAmount,
    commission: newCommission,
    customerPhone: customerPhone || '',
    notes: notes || '',
    updatedAt: new Date().toISOString()
  };

  Store.vodafoneTransactions[txIdx] = updatedTx;
  setLocal(STORAGE_KEYS.VODAFONE_TXS, Store.vodafoneTransactions);

  // Adjust drawer for commission delta
  if (commDelta !== 0) {
    await recordCashDrawerEntry({
      type: commDelta > 0 ? 'in' : 'out',
      amount: Math.abs(commDelta),
      reason: `تعديل عمولة حركة فودافون كاش - خط ${oldTx.lineNum}`
    });
  }

  notifySubscribers("vodafone_lines_updated", Store.vodafoneLines);
  notifySubscribers("vodafone_txs_updated", Store.vodafoneTransactions);

  if (db && !txId.startsWith('vtx_')) {
    try {
      await updateDoc(doc(db, "vodafone_transactions", txId), {
        amount: newAmount,
        commission: newCommission,
        customerPhone: customerPhone || '',
        notes: notes || '',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Error updating tx in Firestore:", err);
    }
  }
}

export async function deleteVodafoneTransaction(txId) {
  const tx = Store.vodafoneTransactions.find(t => t.id === txId);
  if (!tx) return;

  // Reverse line balance
  const lineIdx = Store.vodafoneLines.findIndex(l => l.lineNum === tx.lineNum);
  if (lineIdx !== -1) {
    const line = Store.vodafoneLines[lineIdx];
    if (tx.type === 'deposit') {
      line.balance -= tx.amount;
    } else {
      line.balance += tx.amount;
    }
    line.totalTransferredMonth = Math.max(0, (line.totalTransferredMonth || 0) - tx.amount);
    setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);
    if (db) {
      setDoc(doc(db, "vodafone_lines", `line_${tx.lineNum}`), line, { merge: true }).catch(console.warn);
    }
  }

  Store.vodafoneTransactions = Store.vodafoneTransactions.filter(t => t.id !== txId);
  setLocal(STORAGE_KEYS.VODAFONE_TXS, Store.vodafoneTransactions);
  notifySubscribers("vodafone_lines_updated", Store.vodafoneLines);
  notifySubscribers("vodafone_txs_updated", Store.vodafoneTransactions);

  if (db && !txId.startsWith('vtx_')) {
    try {
      await deleteDoc(doc(db, "vodafone_transactions", txId));
    } catch (err) {
      console.warn("Error deleting tx in Firestore:", err);
    }
  }
}

export async function resetVodafoneLine(lineNum) {
  const lineIdx = Store.vodafoneLines.findIndex(l => l.lineNum === lineNum);
  if (lineIdx !== -1) {
    Store.vodafoneLines[lineIdx].balance = 0.00;
    Store.vodafoneLines[lineIdx].totalTransferredMonth = 0.00;
    Store.vodafoneLines[lineIdx].updatedAt = new Date().toISOString();
    setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);

    // Also delete or mark transactions for this line
    const remainingTxs = Store.vodafoneTransactions.filter(t => t.lineNum !== lineNum);
    Store.vodafoneTransactions = remainingTxs;
    setLocal(STORAGE_KEYS.VODAFONE_TXS, Store.vodafoneTransactions);

    notifySubscribers("vodafone_lines_updated", Store.vodafoneLines);
    notifySubscribers("vodafone_txs_updated", Store.vodafoneTransactions);

    if (db) {
      setDoc(doc(db, "vodafone_lines", `line_${lineNum}`), Store.vodafoneLines[lineIdx], { merge: true }).catch(console.warn);
    }
  }
}

// --- SALES INVOICE / QUICK POS CHECKOUT ---

export async function checkoutSale({ items, subtotal, discount, totalAmount, cashPaid, change, customerName, customerPhone, cashier }) {
  const invoiceNumber = 'INV-' + (1000 + Store.salesInvoices.length + 1);
  const invoiceData = {
    invoiceNumber,
    items: items.map(item => ({
      productId: item.id,
      barcode: item.barcode || '',
      name: item.name,
      category: item.category || '',
      price: item.price,
      quantity: item.quantity,
      total: item.price * item.quantity
    })),
    subtotal: parseFloat(subtotal) || 0,
    discount: parseFloat(discount) || 0,
    totalAmount: parseFloat(totalAmount) || 0,
    cashPaid: parseFloat(cashPaid) || 0,
    change: parseFloat(change) || 0,
    customerName: customerName || 'عميل نقدي',
    customerPhone: customerPhone || '',
    cashier: cashier || 'أحمد الكاشير',
    timestamp: new Date().toISOString()
  };

  // Deduct stock for each item
  for (const item of items) {
    if (item.id) {
      await adjustProductStock(item.id, -item.quantity);
      // If it's a mobile phone, mark status as sold
      const prod = Store.products.find(p => p.id === item.id);
      if (prod && prod.category === 'phones') {
        await updateProduct(item.id, {
          status: 'sold',
          customerName: customerName || 'عميل نقدي',
          customerPhone: customerPhone || '',
          soldAt: new Date().toISOString()
        });
      }
    }
  }

  // Add to sales invoices
  const localId = 'inv_' + Date.now();
  invoiceData.id = localId;
  Store.salesInvoices.unshift(invoiceData);
  setLocal(STORAGE_KEYS.SALES, Store.salesInvoices);

  // Add cash to drawer
  await recordCashDrawerEntry({
    type: 'in',
    amount: invoiceData.totalAmount,
    reason: `فاتورة بيع ${invoiceNumber}`
  });

  notifySubscribers("sales_updated", Store.salesInvoices);

  // Firestore sync
  if (db) {
    try {
      const docRef = await addDoc(collection(db, "sales_invoices"), invoiceData);
      invoiceData.id = docRef.id;
      const idx = Store.salesInvoices.findIndex(s => s.id === localId);
      if (idx !== -1) Store.salesInvoices[idx] = invoiceData;
      setLocal(STORAGE_KEYS.SALES, Store.salesInvoices);
    } catch (err) {
      console.warn("Failed to save invoice to Firestore:", err);
    }
  }

  return invoiceData;
}

// --- CASH DRAWER ENTRY ---

export async function recordCashDrawerEntry({ type, amount, reason }) {
  const numAmount = parseFloat(amount) || 0;
  if (!Store.drawer) {
    Store.drawer = {
      shiftId: '#402',
      openingCash: 0,
      currentCash: 0,
      history: []
    };
  }

  let current = parseFloat(Store.drawer.currentCash) || 0;
  if (type === 'in') {
    current += numAmount;
  } else if (type === 'out') {
    current -= numAmount;
  } else if (type === 'set_opening') {
    Store.drawer.openingCash = numAmount;
    current = numAmount;
  }

  Store.drawer.currentCash = current;
  if (!Store.drawer.history) Store.drawer.history = [];
  Store.drawer.history.unshift({
    type,
    amount: numAmount,
    reason,
    balanceAfter: current,
    timestamp: new Date().toISOString()
  });

  setLocal(STORAGE_KEYS.DRAWER, Store.drawer);
  notifySubscribers("drawer_updated", Store.drawer);

  if (db) {
    try {
      await setDoc(doc(db, "cash_drawer", "current_shift"), Store.drawer);
    } catch (err) {
      console.warn("Error updating cash drawer in Firestore:", err);
    }
  }
}
