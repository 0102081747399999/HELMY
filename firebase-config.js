// firebase-config.js - Firebase Initialization & Data Sync Service for Hilmy Telecom POS (سنترال حلمي)
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
  where,
  orderBy, 
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as fbSignOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  isOnline = true;
  console.log("🔥 Firebase initialized successfully for project: mnmn-daadf (سنترال حلمي)");
} catch (e) {
  console.warn("⚠️ Firebase direct init warning, falling back to local mode:", e);
  isOnline = false;
}

// Initialize Firebase Auth
let auth = null;
let googleProvider = null;

try {
  if (app) {
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    console.log("🔐 Firebase Auth initialized successfully for Hilmy Telecom POS");
  }
} catch (e) {
  console.warn("⚠️ Firebase Auth direct init warning:", e);
}

export async function signInWithGooglePopup() {
  if (!auth || !googleProvider) {
    throw new Error('Firebase Auth is not available');
  }
  return await signInWithPopup(auth, googleProvider);
}

export function getFirebaseAuth() {
  return auth;
}

// LocalStorage Persistence Keys
const STORAGE_KEYS = {
  PRODUCTS: 'hilmy_pos_products_v1',
  VODAFONE_LINES: 'hilmy_pos_voda_lines_v1',
  VODAFONE_TXS: 'hilmy_pos_voda_txs_v1',
  SALES: 'hilmy_pos_sales_v1',
  DRAWER: 'hilmy_pos_drawer_v1',
  SETTINGS: 'hilmy_pos_settings_v1',
  SMS_INBOX: 'hilmy_pos_sms_inbox_v1',
  ZERO_CHECK: 'hilmy_lines_zeroed_v2',
  DELETED_PRODUCTS_BLACKLIST: 'hilmy_deleted_products_blacklist_v1',
  DELETED_SALES_BLACKLIST: 'hilmy_deleted_sales_blacklist_v1',
  DELETED_VODAFONE_TXS_BLACKLIST: 'hilmy_deleted_vtx_blacklist_v1',
  DELETED_SMS_BLACKLIST: 'hilmy_deleted_sms_blacklist_v1'
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

// Permanent Blacklist Management (Prevents deleted products, sales, vodafone txs and sms from EVER resurrecting)

export function getDeletedBlacklist() {
  const list = getLocal(STORAGE_KEYS.DELETED_PRODUCTS_BLACKLIST, []);
  // Only keep document IDs (strings that are not raw barcodes) so duplicate items are never accidentally blacklisted
  const set = new Set();
  if (Array.isArray(list)) {
    list.forEach(item => {
      if (item && typeof item === 'string') {
        const clean = item.trim();
        if (clean.startsWith('prod_') || clean.length >= 15) {
          set.add(clean);
        }
      }
    });
  }
  return set;
}

export function saveDeletedBlacklist(set) {
  setLocal(STORAGE_KEYS.DELETED_PRODUCTS_BLACKLIST, Array.from(set));
}

export function blacklistProduct(id) {
  if (!id) return;
  const set = getDeletedBlacklist();
  const cleanId = String(id).trim();
  if (cleanId) {
    set.add(cleanId);
  }
  saveDeletedBlacklist(set);
}

export function unblacklistProduct(id) {
  if (!id) return;
  const set = getDeletedBlacklist();
  const cleanId = String(id).trim();
  if (cleanId) {
    set.delete(cleanId);
  }
  saveDeletedBlacklist(set);
}

export function getDeletedSalesBlacklist() {
  const list = getLocal(STORAGE_KEYS.DELETED_SALES_BLACKLIST, []);
  return new Set(Array.isArray(list) ? list : []);
}

export function blacklistSale(invoiceId, invoiceNumber) {
  const set = getDeletedSalesBlacklist();
  if (invoiceId) set.add(String(invoiceId).trim());
  if (invoiceNumber) set.add(String(invoiceNumber).trim());
  setLocal(STORAGE_KEYS.DELETED_SALES_BLACKLIST, Array.from(set));
}

export function getDeletedVodaTxsBlacklist() {
  const list = getLocal(STORAGE_KEYS.DELETED_VODAFONE_TXS_BLACKLIST, []);
  return new Set(Array.isArray(list) ? list : []);
}

export function blacklistVodafoneTx(txId) {
  if (!txId) return;
  const set = getDeletedVodaTxsBlacklist();
  set.add(String(txId).trim());
  setLocal(STORAGE_KEYS.DELETED_VODAFONE_TXS_BLACKLIST, Array.from(set));
}

export function getDeletedSMSBlacklist() {
  const list = getLocal(STORAGE_KEYS.DELETED_SMS_BLACKLIST, []);
  return new Set(Array.isArray(list) ? list : []);
}

export function blacklistSMS(smsId) {
  if (!smsId) return;
  const set = getDeletedSMSBlacklist();
  set.add(String(smsId).trim());
  setLocal(STORAGE_KEYS.DELETED_SMS_BLACKLIST, Array.from(set));
}

function getInitialCleanProducts() {
  const rawList = getLocal(STORAGE_KEYS.PRODUCTS, []);
  const blacklist = getDeletedBlacklist();
  if (!Array.isArray(rawList)) return [];
  return rawList.filter(p => {
    if (!p) return false;
    const pid = p.id || '';
    if (pid && blacklist.has(pid)) return false;
    return true;
  });
}

function getInitialCleanSales() {
  const rawList = getLocal(STORAGE_KEYS.SALES, []);
  const blacklist = getDeletedSalesBlacklist();
  if (!Array.isArray(rawList)) return [];
  return rawList.filter(s => {
    if (!s) return false;
    const sid = s.id || '';
    const snum = s.invoiceNumber || '';
    if (blacklist.has(sid) || blacklist.has(snum)) return false;
    return true;
  });
}

function getInitialCleanVodafoneTxs() {
  const rawList = getLocal(STORAGE_KEYS.VODAFONE_TXS, []);
  const blacklist = getDeletedVodaTxsBlacklist();
  if (!Array.isArray(rawList)) return [];
  return rawList.filter(t => {
    if (!t) return false;
    const tid = t.id || '';
    const tRef = t.transactionId || '';
    if (blacklist.has(tid) || (tRef && blacklist.has(tRef))) return false;
    return true;
  });
}

function getInitialCleanSMS() {
  const rawList = getLocal(STORAGE_KEYS.SMS_INBOX, []);
  const blacklist = getDeletedSMSBlacklist();
  if (!Array.isArray(rawList)) return [];
  return rawList.filter(s => {
    if (!s) return false;
    const sid = s.id || '';
    if (blacklist.has(sid)) return false;
    return true;
  });
}

// Data store in-memory mirror
export const Store = {
  products: getInitialCleanProducts(),
  vodafoneLines: getLocal(STORAGE_KEYS.VODAFONE_LINES, []),
  vodafoneTransactions: getInitialCleanVodafoneTxs(),
  salesInvoices: getInitialCleanSales(),
  smsInbox: getInitialCleanSMS(),
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

// Ensure 18 Vodafone Lines exist (Zero money default per user request: "عايز الخطوط مفيش فيها فلوس")
export function ensureVodafoneLines() {
  const needsZeroReset = !localStorage.getItem(STORAGE_KEYS.ZERO_CHECK);
  
  if (!Store.vodafoneLines || Store.vodafoneLines.length === 0 || needsZeroReset) {
    const existing = Store.vodafoneLines || [];
    const lines = [];
    for (let i = 1; i <= 18; i++) {
      const prev = existing.find(l => l.lineNum === i) || {};
      lines.push({
        id: `line_${i}`,
        lineNum: i,
        phone: prev.phone || '',
        deviceName: prev.deviceName || `هاتف محمول خط ${i}`,
        deviceStatus: prev.deviceStatus || 'connected',
        monthlyLimit: prev.monthlyLimit || 100000,
        balance: 0.00, // zero money as requested
        totalTransferredMonth: 0.00,
        isActive: true,
        updatedAt: new Date().toISOString()
      });
    }
    Store.vodafoneLines = lines;
    setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);
    localStorage.setItem(STORAGE_KEYS.ZERO_CHECK, 'true');
  } else {
    // Ensure all 18 lines have deviceName
    let changed = false;
    Store.vodafoneLines.forEach((l) => {
      if (!l.deviceName) {
        l.deviceName = `هاتف محمول خط ${l.lineNum}`;
        l.deviceStatus = l.deviceStatus || 'connected';
        changed = true;
      }
    });
    if (changed) setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);
  }
}
ensureVodafoneLines();

// Reset all 18 lines to 0.00 balance
export function resetAllVodafoneLines() {
  const lines = [];
  for (let i = 1; i <= 18; i++) {
    const existing = (Store.vodafoneLines || []).find(l => l.lineNum === i) || {};
    lines.push({
      id: `line_${i}`,
      lineNum: i,
      phone: existing.phone || '',
      deviceName: existing.deviceName || `هاتف محمول خط ${i}`,
      deviceStatus: existing.deviceStatus || 'connected',
      monthlyLimit: existing.monthlyLimit || 100000,
      balance: 0.00,
      totalTransferredMonth: 0.00,
      isActive: true,
      updatedAt: new Date().toISOString()
    });
  }
  Store.vodafoneLines = lines;
  setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);
  notifySubscribers("vodafone_lines_updated", Store.vodafoneLines);

  if (db) {
    for (let i = 1; i <= 18; i++) {
      setDoc(doc(db, "vodafone_lines", `line_${i}`), lines[i - 1], { merge: true }).catch(console.warn);
    }
  }
  return lines;
}

// ==========================================
// FIRESTORE REALTIME SYNC ENGINE
// ==========================================

export async function initRealtimeSync() {
  if (!db) {
    updateConnectionUI(false, "غير متصل (يعمل محلياً)");
    return;
  }

  try {
    // 1. Sync Products (Filtered with permanent deleted blacklist)
    const productsCol = collection(db, "products");
    onSnapshot(productsCol, (snapshot) => {
      Store.isFirebaseConnected = true;
      updateConnectionUI(true, "متصل بالسيرفر (Firebase Live)");
      
      const blacklist = getDeletedBlacklist();
      const prods = [];
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const internalId = data.id || '';
        const barcode = (data.barcode || '').trim();
        const imei = (data.imei || '').trim();

        // Check if this product was permanently deleted by the user (only by unique document ID, preserving duplicate rows)
        const isDeleted = (docId && blacklist.has(docId)) ||
                          (internalId && blacklist.has(internalId));

        if (isDeleted) {
          // Permanently purge this zombie document from Firestore in the cloud
          deleteDoc(doc(db, "products", docId)).catch(console.warn);
          return; // NEVER restore it to Store.products!
        }

        prods.push({ ...data, id: docId });
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
              balance: 0.00,
              totalTransferredMonth: 0.00
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

    // 3. Sync Vodafone Transactions (Filtered with permanent deleted blacklist)
    const txCol = collection(db, "vodafone_transactions");
    onSnapshot(txCol, (snapshot) => {
      const blacklist = getDeletedVodaTxsBlacklist();
      const txs = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const docId = docSnap.id;
        const internalId = d.id || '';
        const txRef = d.transactionId || '';

        if (blacklist.has(docId) || (internalId && blacklist.has(internalId)) || (txRef && blacklist.has(txRef))) {
          deleteDoc(doc(db, "vodafone_transactions", docId)).catch(console.warn);
          return;
        }

        txs.push({ id: docId, ...d });
      });
      txs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      Store.vodafoneTransactions = txs;
      setLocal(STORAGE_KEYS.VODAFONE_TXS, txs);
      notifySubscribers("vodafone_txs_updated", txs);
    }, (error) => {
      console.warn("Vodafone tx sync error:", error);
    });

    // 4. Sync Sales Invoices (Filtered with permanent deleted blacklist)
    const salesCol = collection(db, "sales_invoices");
    onSnapshot(salesCol, (snapshot) => {
      const salesBlacklist = getDeletedSalesBlacklist();
      const invoices = [];
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const invNum = data.invoiceNumber || '';
        const internalId = data.id || '';

        // Check if invoice was permanently deleted
        if (salesBlacklist.has(docId) || (internalId && salesBlacklist.has(internalId)) || (invNum && salesBlacklist.has(invNum))) {
          deleteDoc(doc(db, "sales_invoices", docId)).catch(console.warn);
          return;
        }

        invoices.push({ ...data, id: docId });
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

    // 6. Sync SMS Inbox (Filtered with permanent deleted blacklist)
    const smsCol = collection(db, "sms_inbox");
    onSnapshot(smsCol, (snapshot) => {
      const blacklist = getDeletedSMSBlacklist();
      const messages = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        const docId = docSnap.id;
        const internalId = d.id || '';
        if (blacklist.has(docId) || (internalId && blacklist.has(internalId))) {
          deleteDoc(doc(db, "sms_inbox", docId)).catch(console.warn);
          return;
        }
        messages.push({ id: docId, ...d });
      });
      messages.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      Store.smsInbox = messages;
      setLocal(STORAGE_KEYS.SMS_INBOX, messages);
      notifySubscribers("sms_inbox_updated", messages);
    }, (error) => {
      console.warn("SMS inbox sync error:", error);
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
  const now = new Date().toISOString();
  const cleanBarcode = (productData.barcode || '').trim();
  const cleanImei = (productData.imei || '').trim();

  // If this barcode / imei was previously in the deleted blacklist, remove it now because user is deliberately adding it as a new product!
  unblacklistProduct(cleanBarcode);
  if (cleanImei) unblacklistProduct(cleanImei);

  // Generate Firestore document reference FIRST so local and remote IDs are 100% identical!
  let docRef = null;
  let finalId = 'prod_' + Date.now();
  if (db) {
    try {
      docRef = doc(collection(db, "products"));
      finalId = docRef.id;
    } catch (e) {}
  }

  const newProduct = {
    id: finalId,
    barcode: cleanBarcode, // Serves as code (e.g. "70") or barcode
    name: (productData.name || '').trim(),
    category: productData.category || 'chargers', // 'chargers' | 'cables' | 'headphones' | 'speakers' | 'phones' | 'covers' | 'accessories' | 'manual'
    subcategory: productData.subcategory || '',
    buyPrice: parseFloat(productData.buyPrice) || 0,
    sellPrice: parseFloat(productData.sellPrice) || 0,
    quantity: parseInt(productData.quantity, 10) || 0,
    brand: productData.brand || '',
    model: productData.model || '',
    imei: cleanImei,
    storage: productData.storage || '',
    color: productData.color || '',
    status: productData.status || 'available',
    linkedPhoneNumber: (productData.linkedPhoneNumber || productData.phone || '').trim(),
    notes: (productData.notes || '').trim(),
    customerName: productData.customerName || '',
    customerPhone: productData.customerPhone || '',
    createdAt: productData.createdAt || now,
    updatedAt: now,
    lastRestockedAt: productData.lastRestockedAt || productData.createdAt || now
  };

  // Local optimistic update
  Store.products.unshift(newProduct);
  setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
  notifySubscribers("products_updated", Store.products);

  // Firestore sync using setDoc on the predefined docRef
  if (db && docRef) {
    try {
      await setDoc(docRef, newProduct);
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
  if (db) {
    try {
      const ref = doc(db, "products", id);
      await updateDoc(ref, updateData);
    } catch (err) {
      try {
        const q = query(collection(db, "products"), where("id", "==", id));
        const snap = await getDocs(q);
        snap.forEach(d => {
          updateDoc(doc(db, "products", d.id), updateData).catch(console.warn);
        });
      } catch (err2) {
        console.warn("Failed to update product in Firestore:", err2);
      }
    }
  }
}

export async function deleteProduct(id) {
  if (!id) return;

  const targetId = String(id).trim();

  // 1. Add specific targetId ONLY to permanent blacklist (never blacklists barcode or duplicates)
  blacklistProduct(targetId);

  // 2. Remove ONLY this single item from local Store.products and localStorage
  // Duplicate items or items sharing code/barcode/name are 100% PRESERVED!
  Store.products = Store.products.filter(p => p.id !== targetId);
  setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
  notifySubscribers("products_updated", Store.products);

  // 3. Permanently delete ONLY this specific document from Firestore
  if (db) {
    try {
      await deleteDoc(doc(db, "products", targetId));
    } catch (err) {
      console.warn("Error deleting product doc directly from Firestore:", err);
    }

    try {
      const qId = query(collection(db, "products"), where("id", "==", targetId));
      const snapId = await getDocs(qId);
      snapId.forEach(d => {
        deleteDoc(doc(db, "products", d.id)).catch(console.warn);
      });
    } catch (err) {}
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

// Direct Category Sale (Single-item fast sale by Code or Table action)
export async function recordDirectCategorySale({ productId, barcode, name, category, quantity, sellPrice, buyPrice, customerName, customerPhone, saleDate }) {
  const numQty = parseInt(quantity, 10) || 1;
  const numSellPrice = parseFloat(sellPrice) || 0;
  const numBuyPrice = parseFloat(buyPrice) || 0;
  const totalAmount = numSellPrice * numQty;
  const totalProfit = (numSellPrice - numBuyPrice) * numQty;
  const timestamp = saleDate || new Date().toISOString();

  // 1. Deduct stock from product
  let prod = null;
  if (productId) {
    prod = Store.products.find(p => p.id === productId);
  }
  if (!prod && barcode) {
    const cleanBar = String(barcode).trim().toLowerCase();
    prod = Store.products.find(p => (p.barcode && p.barcode.trim().toLowerCase() === cleanBar) || (p.imei && p.imei.trim().toLowerCase() === cleanBar));
  }

  if (prod) {
    await adjustProductStock(prod.id, -numQty);
    if (prod.category === 'phones') {
      await updateProduct(prod.id, {
        status: 'sold',
        customerName: customerName || 'عميل نقدي',
        customerPhone: customerPhone || prod.linkedPhoneNumber || '',
        soldAt: timestamp
      });
    }
  }

  // 2. Create Sale Record
  const invoiceNumber = 'INV-' + (1000 + Store.salesInvoices.length + 1);
  const saleItem = {
    productId: prod ? prod.id : (productId || ''),
    barcode: barcode || (prod ? prod.barcode : ''),
    name: name || (prod ? prod.name : 'صنف غير محدد'),
    category: category || (prod ? prod.category : 'general'),
    price: numSellPrice,
    buyPrice: numBuyPrice,
    profit: totalProfit,
    quantity: numQty,
    total: totalAmount
  };

  const invoiceData = {
    id: 'inv_' + Date.now(),
    invoiceNumber,
    items: [saleItem],
    subtotal: totalAmount,
    discount: 0,
    totalAmount,
    cashPaid: totalAmount,
    change: 0,
    customerName: customerName || 'عميل كود نقدي',
    customerPhone: customerPhone || '',
    cashier: 'كاشير سنترال حلمي',
    timestamp
  };

  Store.salesInvoices.unshift(invoiceData);
  setLocal(STORAGE_KEYS.SALES, Store.salesInvoices);

  // 3. Add cash to drawer
  await recordCashDrawerEntry({
    type: 'in',
    amount: totalAmount,
    reason: `بيع مباشر بالكود (${saleItem.barcode}) - ${saleItem.name}`
  });

  notifySubscribers("sales_updated", Store.salesInvoices);

  // 4. Firestore sync
  if (db) {
    try {
      const docRef = await addDoc(collection(db, "sales_invoices"), invoiceData);
      invoiceData.id = docRef.id;
      const idx = Store.salesInvoices.findIndex(s => s.invoiceNumber === invoiceNumber);
      if (idx !== -1) Store.salesInvoices[idx] = invoiceData;
      setLocal(STORAGE_KEYS.SALES, Store.salesInvoices);
    } catch (err) {
      console.warn("Failed to sync sale to Firestore:", err);
    }
  }

  return invoiceData;
}

// Direct Category Restock (Fast stock intake by Code or Table action)
export async function recordDirectCategoryRestock({ productId, deltaQty, newBuyPrice, newSellPrice, restockDate, totalCost }) {
  const prod = Store.products.find(p => p.id === productId);
  if (!prod) return;

  const currentQty = parseInt(prod.quantity, 10) || 0;
  const addQty = parseInt(deltaQty, 10) || 0;
  const newQty = Math.max(0, currentQty + addQty);
  const buyP = (newBuyPrice !== undefined && newBuyPrice !== '' && !isNaN(parseFloat(newBuyPrice))) ? parseFloat(newBuyPrice) : (prod.buyPrice || 0);

  const updates = {
    quantity: newQty,
    lastRestockedAt: restockDate || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (newBuyPrice !== undefined && newBuyPrice !== '' && !isNaN(parseFloat(newBuyPrice))) {
    updates.buyPrice = parseFloat(newBuyPrice);
  }
  if (newSellPrice !== undefined && newSellPrice !== '' && !isNaN(parseFloat(newSellPrice))) {
    updates.sellPrice = parseFloat(newSellPrice);
  }

  await updateProduct(productId, updates);

  // Automatic Cash Drawer integration: deduct purchase cost from cash drawer
  const cost = (totalCost !== undefined && !isNaN(parseFloat(totalCost))) ? parseFloat(totalCost) : (addQty * buyP);
  if (cost > 0) {
    await recordCashDrawerEntry({
      type: 'out',
      amount: cost,
      reason: `توريد مخزون (${addQty} حبة) - ${prod.name}`
    });
  }

  return updates;
}

// --- VODAFONE CASH OPERATIONS ---

export async function updateVodafoneLineSettings(lineNum, data) {
  const cleanLine = parseInt(lineNum, 10);
  const lineIdx = Store.vodafoneLines.findIndex(l => l.lineNum === cleanLine);
  if (lineIdx !== -1) {
    Store.vodafoneLines[lineIdx] = {
      ...Store.vodafoneLines[lineIdx],
      phone: data.phone !== undefined ? data.phone : Store.vodafoneLines[lineIdx].phone,
      deviceName: data.deviceName !== undefined ? data.deviceName : (Store.vodafoneLines[lineIdx].deviceName || `هاتف محمول خط ${cleanLine}`),
      deviceStatus: data.deviceStatus !== undefined ? data.deviceStatus : (Store.vodafoneLines[lineIdx].deviceStatus || 'connected'),
      monthlyLimit: data.monthlyLimit !== undefined ? parseFloat(data.monthlyLimit) : Store.vodafoneLines[lineIdx].monthlyLimit,
      updatedAt: new Date().toISOString()
    };
    setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);
    notifySubscribers("vodafone_lines_updated", Store.vodafoneLines);

    if (db) {
      try {
        const lineDoc = doc(db, "vodafone_lines", `line_${cleanLine}`);
        await setDoc(lineDoc, Store.vodafoneLines[lineIdx], { merge: true });
      } catch (err) {
        console.warn("Error updating line settings in Firestore:", err);
      }
    }
  }
}

export async function recordVodafoneTransaction({ lineNum, type, amount, commission, customerPhone, notes, transactionId }) {
  const cleanLineNum = parseInt(lineNum, 10);
  if (isNaN(cleanLineNum) || cleanLineNum < 1 || cleanLineNum > 18) {
    throw new Error("رقم الخط غير صحيح، يجب أن يكون بين 1 و 18");
  }

  const numAmount = parseFloat(amount) || 0;
  const numCommission = parseFloat(commission) || 0;
  const lineIdx = Store.vodafoneLines.findIndex(l => l.lineNum === cleanLineNum);
  if (lineIdx === -1) throw new Error("Line not found");

  const line = Store.vodafoneLines[lineIdx];
  let currentBalance = parseFloat(line.balance) || 0;
  let newBalance = currentBalance;

  if (type === 'deposit') {
    newBalance += numAmount;
  } else if (type === 'withdraw') {
    newBalance -= numAmount;
  }

  line.balance = newBalance;
  line.totalTransferredMonth = (line.totalTransferredMonth || 0) + numAmount;
  line.updatedAt = new Date().toISOString();
  setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);

  const finalTxRef = transactionId || ('TX-' + Date.now().toString().slice(-7) + Math.floor(Math.random() * 90 + 10));

  const txData = {
    lineNum: cleanLineNum,
    type,
    amount: numAmount,
    commission: numCommission,
    customerPhone: customerPhone || '',
    notes: notes || '',
    transactionId: finalTxRef,
    balanceAfter: newBalance,
    timestamp: new Date().toISOString()
  };

  const localTxId = 'vtx_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  txData.id = localTxId;
  Store.vodafoneTransactions.unshift(txData);
  setLocal(STORAGE_KEYS.VODAFONE_TXS, Store.vodafoneTransactions);

  // AUTOMATIC CASH DRAWER INTEGRATION
  // For deposit: Customer pays cash to store (+amount +commission)
  // For withdraw: Store gives cash out to customer (-amount) while keeping commission (-amount + commission)
  if (type === 'deposit') {
    const cashIn = numAmount + numCommission;
    await recordCashDrawerEntry({
      type: 'in',
      amount: cashIn,
      reason: `إيداع فودافون كاش - خط ${cleanLineNum} (${line.phone || 'بدون رقم'}) - عمولة: ${numCommission} ج.م`
    });
  } else {
    const cashOut = Math.max(0, numAmount - numCommission);
    await recordCashDrawerEntry({
      type: 'out',
      amount: cashOut,
      reason: `سحب فودافون كاش - خط ${cleanLineNum} (${line.phone || 'بدون رقم'}) - بعد خصم عمولة: ${numCommission} ج.م`
    });
  }

  notifySubscribers("vodafone_lines_updated", Store.vodafoneLines);
  notifySubscribers("vodafone_txs_updated", Store.vodafoneTransactions);

  if (db) {
    try {
      await setDoc(doc(db, "vodafone_lines", `line_${cleanLineNum}`), line, { merge: true });
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

export async function updateVodafoneTransaction(txId, { amount, commission, customerPhone, notes, transactionId }) {
  const txIdx = Store.vodafoneTransactions.findIndex(t => t.id === txId);
  if (txIdx === -1) return;

  const oldTx = Store.vodafoneTransactions[txIdx];
  const newAmount = parseFloat(amount) || 0;
  const newCommission = parseFloat(commission) || 0;
  const amountDelta = newAmount - oldTx.amount;

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

  // AUTOMATIC CASH DRAWER ADJUSTMENT ON EDIT
  if (oldTx.type === 'deposit') {
    const oldCashIn = oldTx.amount + (oldTx.commission || 0);
    const newCashIn = newAmount + newCommission;
    const cashDelta = newCashIn - oldCashIn;
    if (cashDelta !== 0) {
      await recordCashDrawerEntry({
        type: cashDelta > 0 ? 'in' : 'out',
        amount: Math.abs(cashDelta),
        reason: `تعديل إيداع فودافون كاش - خط ${oldTx.lineNum} (${cashDelta > 0 ? 'زيادة' : 'نقص'})`
      });
    }
  } else {
    const oldCashOut = Math.max(0, oldTx.amount - (oldTx.commission || 0));
    const newCashOut = Math.max(0, newAmount - newCommission);
    const cashDelta = newCashOut - oldCashOut;
    if (cashDelta !== 0) {
      await recordCashDrawerEntry({
        type: cashDelta > 0 ? 'out' : 'in',
        amount: Math.abs(cashDelta),
        reason: `تعديل سحب فودافون كاش - خط ${oldTx.lineNum} (${cashDelta > 0 ? 'صرف إضافي' : 'استرجاع'})`
      });
    }
  }

  const updatedTx = {
    ...oldTx,
    amount: newAmount,
    commission: newCommission,
    customerPhone: customerPhone || '',
    notes: notes || '',
    transactionId: transactionId || oldTx.transactionId || '',
    updatedAt: new Date().toISOString()
  };

  Store.vodafoneTransactions[txIdx] = updatedTx;
  setLocal(STORAGE_KEYS.VODAFONE_TXS, Store.vodafoneTransactions);

  notifySubscribers("vodafone_lines_updated", Store.vodafoneLines);
  notifySubscribers("vodafone_txs_updated", Store.vodafoneTransactions);

  if (db) {
    try {
      await updateDoc(doc(db, "vodafone_transactions", txId), {
        amount: newAmount,
        commission: newCommission,
        customerPhone: customerPhone || '',
        notes: notes || '',
        transactionId: updatedTx.transactionId,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      try {
        const q = query(collection(db, "vodafone_transactions"), where("id", "==", txId));
        const snap = await getDocs(q);
        snap.forEach(d => {
          updateDoc(doc(db, "vodafone_transactions", d.id), {
            amount: newAmount,
            commission: newCommission,
            customerPhone: customerPhone || '',
            notes: notes || '',
            transactionId: updatedTx.transactionId,
            updatedAt: new Date().toISOString()
          }).catch(console.warn);
        });
      } catch (err2) {
        console.warn("Error updating tx in Firestore:", err2);
      }
    }
  }
}

export async function deleteVodafoneTransaction(txId) {
  const tx = Store.vodafoneTransactions.find(t => t.id === txId);
  if (!tx) return;

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

  // AUTOMATIC CASH DRAWER REVERSAL ON DELETE
  const numAmount = parseFloat(tx.amount) || 0;
  const numComm = parseFloat(tx.commission) || 0;
  if (tx.type === 'deposit') {
    const cashToReverse = numAmount + numComm;
    await recordCashDrawerEntry({
      type: 'out',
      amount: cashToReverse,
      reason: `إلغاء وحذف حركة إيداع فودافون كاش نهائياً - خط ${tx.lineNum}`
    });
  } else {
    const cashToReverse = Math.max(0, numAmount - numComm);
    await recordCashDrawerEntry({
      type: 'in',
      amount: cashToReverse,
      reason: `إلغاء وحذف حركة سحب فودافون كاش نهائياً - خط ${tx.lineNum}`
    });
  }

  // Add to permanent blacklist
  blacklistVodafoneTx(txId);
  if (tx.transactionId) blacklistVodafoneTx(tx.transactionId);

  Store.vodafoneTransactions = Store.vodafoneTransactions.filter(t => t.id !== txId && (!tx.transactionId || t.transactionId !== tx.transactionId));
  setLocal(STORAGE_KEYS.VODAFONE_TXS, Store.vodafoneTransactions);
  notifySubscribers("vodafone_lines_updated", Store.vodafoneLines);
  notifySubscribers("vodafone_txs_updated", Store.vodafoneTransactions);

  if (db) {
    try {
      await deleteDoc(doc(db, "vodafone_transactions", txId));
    } catch (err) {
      console.warn("Error deleting tx directly in Firestore:", err);
    }
    try {
      const q = query(collection(db, "vodafone_transactions"), where("id", "==", txId));
      const snap = await getDocs(q);
      snap.forEach(d => {
        deleteDoc(doc(db, "vodafone_transactions", d.id)).catch(console.warn);
      });
    } catch (err2) {}
    if (tx.transactionId) {
      try {
        const qRef = query(collection(db, "vodafone_transactions"), where("transactionId", "==", tx.transactionId));
        const snapRef = await getDocs(qRef);
        snapRef.forEach(d => {
          deleteDoc(doc(db, "vodafone_transactions", d.id)).catch(console.warn);
        });
      } catch (err3) {}
    }
  }
}

export function deleteSMS(smsId) {
  if (!smsId) return;
  blacklistSMS(smsId);
  if (Store.smsInbox) {
    Store.smsInbox = Store.smsInbox.filter(s => s.id !== smsId);
    setLocal(STORAGE_KEYS.SMS_INBOX, Store.smsInbox);
    notifySubscribers("sms_inbox_updated", Store.smsInbox);
  }
  if (db && smsId) {
    deleteDoc(doc(db, "sms_inbox", smsId)).catch(console.warn);
  }
}

export function clearAllSMS() {
  const current = Store.smsInbox || [];
  current.forEach(s => {
    if (s.id) blacklistSMS(s.id);
  });
  Store.smsInbox = [];
  setLocal(STORAGE_KEYS.SMS_INBOX, []);
  notifySubscribers("sms_inbox_updated", []);
  if (typeof fetch !== 'undefined') {
    fetch('/api/clear-sms', { method: 'POST' }).catch(() => {});
  }
  if (db) {
    getDocs(collection(db, "sms_inbox")).then(snap => {
      snap.forEach(d => deleteDoc(doc(db, "sms_inbox", d.id)).catch(console.warn));
    }).catch(console.warn);
  }
}

export async function resetVodafoneLine(lineNum) {
  const lineIdx = Store.vodafoneLines.findIndex(l => l.lineNum === lineNum);
  if (lineIdx !== -1) {
    Store.vodafoneLines[lineIdx].balance = 0.00;
    Store.vodafoneLines[lineIdx].totalTransferredMonth = 0.00;
    Store.vodafoneLines[lineIdx].updatedAt = new Date().toISOString();
    setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);

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
      buyPrice: item.buyPrice || 0,
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
    cashier: cashier || 'كاشير سنترال حلمي',
    timestamp: new Date().toISOString()
  };

  for (const item of items) {
    if (item.id) {
      await adjustProductStock(item.id, -item.quantity);
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

  const localId = 'inv_' + Date.now();
  invoiceData.id = localId;
  Store.salesInvoices.unshift(invoiceData);
  setLocal(STORAGE_KEYS.SALES, Store.salesInvoices);

  await recordCashDrawerEntry({
    type: 'in',
    amount: invoiceData.totalAmount,
    reason: `فاتورة بيع ${invoiceNumber}`
  });

  notifySubscribers("sales_updated", Store.salesInvoices);

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

export async function updateSaleInvoice(invoiceId, updatedData) {
  const invIdx = Store.salesInvoices.findIndex(s => s.id === invoiceId);
  if (invIdx === -1) return false;

  const invoice = Store.salesInvoices[invIdx];
  const oldTotal = parseFloat(invoice.totalAmount) || 0;

  // If specific item quantity, price, or details changed
  if (updatedData.itemIndex !== undefined || updatedData.productId) {
    let targetItem = null;
    if (updatedData.itemIndex !== undefined && invoice.items && invoice.items[updatedData.itemIndex]) {
      targetItem = invoice.items[updatedData.itemIndex];
    } else if (updatedData.productId && invoice.items) {
      targetItem = invoice.items.find(i => i.productId === updatedData.productId);
    } else if (invoice.items && invoice.items.length > 0) {
      targetItem = invoice.items[0];
    }

    if (targetItem) {
      const oldQty = parseInt(targetItem.quantity, 10) || 1;
      const newQty = updatedData.quantity !== undefined ? (parseInt(updatedData.quantity, 10) || 1) : oldQty;
      const newPrice = updatedData.price !== undefined ? (parseFloat(updatedData.price) || 0) : targetItem.price;
      const newBuyPrice = updatedData.buyPrice !== undefined ? (parseFloat(updatedData.buyPrice) || 0) : (targetItem.buyPrice || 0);

      const qtyDiff = newQty - oldQty; // >0 means sold more, <0 means returned items to stock
      if (qtyDiff !== 0 && targetItem.productId) {
        const prod = Store.products.find(p => p.id === targetItem.productId);
        if (prod) {
          prod.quantity = Math.max(0, (parseInt(prod.quantity, 10) || 0) - qtyDiff);
          prod.updatedAt = new Date().toISOString();
          setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
          notifySubscribers("products_updated", Store.products);
          if (db) {
            setDoc(doc(db, "products", prod.id), prod, { merge: true }).catch(console.warn);
          }
        }
      }

      targetItem.quantity = newQty;
      targetItem.price = newPrice;
      targetItem.buyPrice = newBuyPrice;
      targetItem.total = newPrice * newQty;
    }
  }

  // Recalculate invoice totals
  const newSubtotal = invoice.items.reduce((acc, it) => acc + (parseFloat(it.total) || 0), 0);
  const discount = updatedData.discount !== undefined ? (parseFloat(updatedData.discount) || 0) : (invoice.discount || 0);
  const newTotal = Math.max(0, newSubtotal - discount);

  invoice.subtotal = newSubtotal;
  invoice.discount = discount;
  invoice.totalAmount = newTotal;
  if (updatedData.customerName !== undefined) invoice.customerName = updatedData.customerName;
  if (updatedData.customerPhone !== undefined) invoice.customerPhone = updatedData.customerPhone;
  if (updatedData.timestamp) invoice.timestamp = updatedData.timestamp;
  invoice.updatedAt = new Date().toISOString();

  // Adjust Cash Drawer if total amount changed
  const cashDelta = newTotal - oldTotal;
  if (cashDelta !== 0) {
    await recordCashDrawerEntry({
      type: cashDelta > 0 ? 'in' : 'out',
      amount: Math.abs(cashDelta),
      reason: `تعديل إجمالي فاتورة بيع ${invoice.invoiceNumber} (${cashDelta > 0 ? 'زيادة' : 'خصم'})`
    });
  }

  // Save to local store & localStorage
  setLocal(STORAGE_KEYS.SALES, Store.salesInvoices);

  // Update Firestore
  if (db) {
    try {
      await updateDoc(doc(db, "sales_invoices", invoiceId), {
        items: invoice.items,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        totalAmount: invoice.totalAmount,
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        timestamp: invoice.timestamp,
        updatedAt: invoice.updatedAt
      });
    } catch (err) {
      try {
        await setDoc(doc(db, "sales_invoices", invoiceId), invoice, { merge: true });
      } catch (e2) {
        console.warn("Error updating sale invoice in Firestore:", e2);
      }
    }
  }

  notifySubscribers("sales_updated", Store.salesInvoices);
  return invoice;
}

export async function deleteSaleInvoice(invoiceId) {
  const invIdx = Store.salesInvoices.findIndex(s => s.id === invoiceId);
  if (invIdx === -1) return false;

  const invoice = Store.salesInvoices[invIdx];

  // 1. Revert product stock for each sold item
  if (invoice.items && Array.isArray(invoice.items)) {
    for (const item of invoice.items) {
      if (item.productId) {
        const prod = Store.products.find(p => p.id === item.productId);
        if (prod) {
          const qty = parseInt(item.quantity, 10) || 1;
          prod.quantity = (parseInt(prod.quantity, 10) || 0) + qty;
          if (prod.category === 'phones') {
            prod.status = 'available';
            delete prod.customerName;
            delete prod.customerPhone;
            delete prod.soldAt;
          }
          prod.updatedAt = new Date().toISOString();
          if (db) {
            try {
              await setDoc(doc(db, "products", prod.id), prod, { merge: true });
            } catch (err) {
              console.warn("Error updating product stock in Firestore upon sale deletion:", err);
            }
          }
        }
      }
    }
    setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
    notifySubscribers("products_updated", Store.products);
  }

  // 2. Adjust Cash Drawer (remove the cash that came in from this sale)
  const amountToDeduct = parseFloat(invoice.totalAmount) || 0;
  if (amountToDeduct > 0) {
    await recordCashDrawerEntry({
      type: 'out',
      amount: amountToDeduct,
      reason: `إلغاء وحذف نهائي لفاتورة بيع ${invoice.invoiceNumber || ''}`
    });
  }

  // Add to permanent deleted sales blacklist
  blacklistSale(invoiceId, invoice.invoiceNumber);

  // 3. Remove permanently from local store & localStorage
  Store.salesInvoices.splice(invIdx, 1);
  setLocal(STORAGE_KEYS.SALES, Store.salesInvoices);

  // 4. Delete permanently from Firestore
  if (db) {
    try {
      await deleteDoc(doc(db, "sales_invoices", invoiceId));
    } catch (err) {
      console.warn("Error permanently deleting sale from Firestore:", err);
    }
    if (invoice.invoiceNumber) {
      try {
        const q = query(collection(db, "sales_invoices"), where("invoiceNumber", "==", invoice.invoiceNumber));
        const snap = await getDocs(q);
        snap.forEach(d => {
          deleteDoc(doc(db, "sales_invoices", d.id)).catch(console.warn);
        });
      } catch (err) {}
    }
  }

  // 5. Notify all listeners
  notifySubscribers("sales_updated", Store.salesInvoices);
  return true;
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

// ==========================================
// EGYPTIAN TELECOM CASH SMS REGEX PARSER & SYNC
// ==========================================

export function parseCashSMS(smsText, sender = '') {
  if (!smsText || typeof smsText !== 'string') return null;
  const text = smsText.trim();
  const lower = text.toLowerCase();
  const senderLower = (sender || '').toLowerCase();

  const isVodafone = senderLower.includes('voda') || senderLower.includes('vf') || text.includes('فودافون كاش') || text.includes('Vodafone Cash') || text.includes('010');
  const isInstapay = senderLower.includes('insta') || text.includes('انستاباي') || text.includes('InstaPay');
  const isOrange = senderLower.includes('orange') || text.includes('أورنج') || text.includes('Orange Cash');
  const isEtisalat = senderLower.includes('etisalat') || text.includes('اتصالات') || text.includes('Etisalat Cash');
  const isWe = senderLower.includes('we') || text.includes('وي باي') || text.includes('WE Pay');

  let provider = 'unknown';
  if (isVodafone) provider = 'vodafone';
  else if (isInstapay) provider = 'instapay';
  else if (isOrange) provider = 'orange';
  else if (isEtisalat) provider = 'etisalat';
  else if (isWe) provider = 'we';

  // Determine type: deposit (استلام/إيداع) vs withdraw (تحويل/سحب)
  let type = 'deposit';
  const isWithdraw = text.includes('تم تحويل') || text.includes('تم سحب') || text.includes('سحبت') || lower.includes('transferred') || lower.includes('debited') || lower.includes('withdrawn');
  const isDeposit = text.includes('تم استلام') || text.includes('تم إيداع') || text.includes('استلمت') || text.includes('إيداع') || lower.includes('received') || lower.includes('credited');
  
  if (isWithdraw) type = 'withdraw';
  else if (isDeposit) type = 'deposit';

  // Extract Amount:
  let amount = 0;
  const amountMatch = text.match(/(?:مبلغ|قيمة|مبلغ وقدره|استلام|تحويل|سحب|بمبلغ|EGP|LE|جنيه)\s*:?\s*([\d]+(?:[\.,]\d{1,2})?)/i) ||
                      text.match(/([\d]+(?:[\.,]\d{1,2})?)\s*(?:جنيه|ج\.م|EGP|LE)/i);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1].replace(',', '.'));
  }

  // Extract Phone Number (from or to):
  let customerPhone = '';
  const phoneMatch = text.match(/(?:من رقم|إلى رقم|من|إلى|لـ|from|to)\s*:?\s*(01[0125]\d{8})/i) ||
                     text.match(/(01[0125]\d{8})/);
  if (phoneMatch) {
    customerPhone = phoneMatch[1];
  }

  // Extract Balance After:
  let balanceAfter = null;
  const balanceMatch = text.match(/(?:رصيدك الحالي هو|رصيدك الجديد|رصيدك الحالي|رصيدك|your current balance is|balance is)\s*:?\s*([\d]+(?:[\.,]\d{1,2})?)/i);
  if (balanceMatch) {
    balanceAfter = parseFloat(balanceMatch[1].replace(',', '.'));
  }

  // Extract Transaction ID / Reference:
  let transactionId = '';
  const txMatch = text.match(/(?:رقم العملية|مرجع|المرجع|كود العملية|Trans ID|Ref ID|Ref No|Reference)\s*:?\s*([a-zA-Z0-9_-]+)/i);
  if (txMatch) {
    transactionId = txMatch[1];
  }

  // Extract Service Fee / Commission:
  let commission = 0;
  const feeMatch = text.match(/(?:مصاريف الخدمة|الرسوم|العمولة|fee)\s*:?\s*([\d]+(?:[\.,]\d{1,2})?)/i);
  if (feeMatch) {
    commission = parseFloat(feeMatch[1].replace(',', '.'));
  }

  const isCashSMS = (amount > 0) && (isVodafone || isInstapay || isOrange || isEtisalat || isWe || text.includes('جنيه') || text.includes('رصيدك') || text.includes('EGP'));

  return {
    isCashSMS,
    provider,
    type,
    amount,
    customerPhone,
    balanceAfter,
    transactionId,
    commission,
    rawText: text,
    timestamp: new Date().toISOString()
  };
}

export async function processIncomingSMS({ sender, body, simPhone, slot, timestamp }) {
  const parsed = parseCashSMS(body, sender);
  if (!parsed || !parsed.isCashSMS) return null;

  // Match line:
  let matchedLine = null;
  if (simPhone) {
    const cleanSim = simPhone.replace(/\D/g, '').slice(-11);
    matchedLine = Store.vodafoneLines.find(l => l.phone && l.phone.replace(/\D/g, '').slice(-11) === cleanSim);
  }
  if (!matchedLine && slot) {
    const slotNum = parseInt(slot, 10);
    if (!isNaN(slotNum) && slotNum >= 1 && slotNum <= 18) {
      matchedLine = Store.vodafoneLines.find(l => l.lineNum === slotNum);
    }
  }

  const smsRecord = {
    id: 'sms_' + Date.now(),
    sender: sender || 'شبكة المحمول',
    body,
    parsed,
    matchedLineNum: matchedLine ? matchedLine.lineNum : null,
    isProcessed: false,
    timestamp: timestamp || new Date().toISOString()
  };

  if (!Store.smsInbox) Store.smsInbox = [];
  Store.smsInbox.unshift(smsRecord);
  setLocal(STORAGE_KEYS.SMS_INBOX, Store.smsInbox);

  // If matched to a specific line, record transaction automatically!
  if (matchedLine) {
    await recordVodafoneTransaction({
      lineNum: matchedLine.lineNum,
      type: parsed.type,
      amount: parsed.amount,
      commission: parsed.commission || 0,
      customerPhone: parsed.customerPhone || '',
      notes: `رسالة تلقائية من الهاتف (${parsed.transactionId ? 'عملية #' + parsed.transactionId : 'SMS'})`
    });

    if (parsed.balanceAfter !== null && !isNaN(parsed.balanceAfter)) {
      const lineIdx = Store.vodafoneLines.findIndex(l => l.lineNum === matchedLine.lineNum);
      if (lineIdx !== -1) {
        Store.vodafoneLines[lineIdx].balance = parsed.balanceAfter;
        setLocal(STORAGE_KEYS.VODAFONE_LINES, Store.vodafoneLines);
        notifySubscribers("vodafone_lines_updated", Store.vodafoneLines);
        if (db) {
          setDoc(doc(db, "vodafone_lines", `line_${matchedLine.lineNum}`), { balance: parsed.balanceAfter }, { merge: true }).catch(console.warn);
        }
      }
    }
    smsRecord.isProcessed = true;
    setLocal(STORAGE_KEYS.SMS_INBOX, Store.smsInbox);
  }

  if (db) {
    try {
      await setDoc(doc(db, "sms_inbox", smsRecord.id), smsRecord);
    } catch (err) {
      console.warn("Failed to sync SMS to Firestore:", err);
    }
  }

  notifySubscribers("sms_received", smsRecord);
  return smsRecord;
}
