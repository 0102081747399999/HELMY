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

// Your exact web app's Firebase configuration (helmy-10237)
export const firebaseConfig = {
  apiKey: "AIzaSyD6eTVkZHX0sBSUUO7xaS4vqOsdk5T08YI",
  authDomain: "helmy-10237.firebaseapp.com",
  projectId: "helmy-10237",
  storageBucket: "helmy-10237.firebasestorage.app",
  messagingSenderId: "711437937828",
  appId: "1:711437937828:web:3822db5c405e89dc98ca31",
  measurementId: "G-TCLXH8MVFY"
};

// Initialize Firebase App & Firestore
let app = null;
let db = null;
let isOnline = false;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  isOnline = true;
  console.log("🔥 Firebase initialized successfully for project: helmy-10237 (سنترال حلمي)");
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
  // Only keep document IDs (strings that are not raw barcodes or numeric IMEIs) so items are never accidentally blacklisted
  const set = new Set();
  if (Array.isArray(list)) {
    list.forEach(item => {
      if (item && typeof item === 'string') {
        const clean = item.trim();
        // Never blacklist pure numeric strings (which are barcodes or IMEIs)
        if (clean && !/^\d+$/.test(clean) && (clean.startsWith('prod_') || clean.length >= 20)) {
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
  // Don't blacklist raw numeric barcodes/IMEIs
  if (cleanId && !/^\d+$/.test(cleanId) && (cleanId.startsWith('prod_') || cleanId.length >= 20)) {
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
  // Filter out any sequential invoice numbers (e.g. INV-1001) so they never block new sales
  const cleanList = (Array.isArray(list) ? list : []).filter(item => {
    if (!item) return false;
    if (typeof item === 'string' && item.startsWith('INV-')) return false;
    return true;
  });
  setLocal(STORAGE_KEYS.DELETED_SALES_BLACKLIST, cleanList);
  return new Set(cleanList);
}

export function blacklistSale(invoiceId) {
  if (!invoiceId) return;
  const set = getDeletedSalesBlacklist();
  const cleanId = String(invoiceId).trim();
  if (cleanId && !cleanId.startsWith('INV-')) {
    set.add(cleanId);
  }
  setLocal(STORAGE_KEYS.DELETED_SALES_BLACKLIST, Array.from(set));
}

export function unblacklistSale(invoiceId) {
  if (!invoiceId) return;
  const set = getDeletedSalesBlacklist();
  const cleanId = String(invoiceId).trim();
  if (cleanId) {
    set.delete(cleanId);
  }
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
    if (sid && blacklist.has(sid)) return false;
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

// Clean object payload for Firestore (removes private _ fields and undefined values)
export function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (key && typeof key === 'string' && key.startsWith('_')) return undefined;
    if (value === undefined) return null;
    return value;
  }));
}

// Generate unique next product code
export function generateNextProductCode(category = 'chargers') {
  let maxCode = 100;
  (Store.products || []).forEach(p => {
    if (p && p.barcode) {
      const num = parseInt(String(p.barcode).trim(), 10);
      if (!isNaN(num) && num >= maxCode && num < 999999) {
        maxCode = num;
      }
    }
  });
  return String(maxCode + 1);
}

// Local Disk Persistence Sync (Zero Data Loss)
let _localServerSyncTimer = null;
export function syncToLocalServer() {
  if (typeof fetch === 'undefined') return;
  clearTimeout(_localServerSyncTimer);
  _localServerSyncTimer = setTimeout(() => {
    try {
      fetch('/api/pos-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: Store.products || [],
          salesInvoices: Store.salesInvoices || [],
          drawer: Store.drawer || null,
          vodafoneLines: Store.vodafoneLines || [],
          vodafoneTransactions: Store.vodafoneTransactions || []
        })
      }).catch(() => {});
    } catch (e) {}
  }, 300);
}

export async function loadFromLocalServer() {
  if (typeof fetch === 'undefined') return;
  try {
    const res = await fetch('/api/pos-data');
    if (!res.ok) return;
    const json = await res.json();
    if (!json || !json.success || !json.data) return;

    let prodsChanged = false;
    const blacklist = getDeletedBlacklist();
    if (Array.isArray(json.data.products) && json.data.products.length > 0) {
      const curProds = Store.products || [];
      json.data.products.forEach(p => {
        if (!p || !p.id || blacklist.has(p.id)) return;
        const exists = curProds.some(cp => cp.id === p.id || (p.barcode && cp.barcode && cp.barcode.trim() === p.barcode.trim()));
        if (!exists) {
          curProds.push(p);
          prodsChanged = true;
        }
      });
      if (prodsChanged) {
        Store.products = curProds;
        setLocal(STORAGE_KEYS.PRODUCTS, curProds);
        notifySubscribers("products_updated", curProds);
      }
    }

    let salesChanged = false;
    const salesBlacklist = getDeletedSalesBlacklist();
    if (Array.isArray(json.data.salesInvoices) && json.data.salesInvoices.length > 0) {
      const curSales = Store.salesInvoices || [];
      json.data.salesInvoices.forEach(s => {
        if (!s || !s.id || salesBlacklist.has(s.id)) return;
        const exists = curSales.some(cs => cs.id === s.id || (s.invoiceNumber && cs.invoiceNumber === s.invoiceNumber && Math.abs(new Date(cs.timestamp || 0) - new Date(s.timestamp || 0)) < 60000));
        if (!exists) {
          curSales.push(s);
          salesChanged = true;
        }
      });
      if (salesChanged) {
        curSales.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        Store.salesInvoices = curSales;
        setLocal(STORAGE_KEYS.SALES, curSales);
        notifySubscribers("sales_updated", curSales);
      }
    }

    if (json.data.drawer && (!Store.drawer || (Store.drawer.history || []).length < (json.data.drawer.history || []).length)) {
      Store.drawer = json.data.drawer;
      setLocal(STORAGE_KEYS.DRAWER, Store.drawer);
      notifySubscribers("drawer_updated", Store.drawer);
    }
  } catch (err) {}
}

// Generate collision-proof next invoice number
export function generateNextInvoiceNumber() {
  let maxNum = 1000;
  (Store.salesInvoices || []).forEach(inv => {
    if (inv && inv.invoiceNumber) {
      const m = String(inv.invoiceNumber).match(/\d+/);
      if (m) {
        const n = parseInt(m[0], 10);
        if (n > maxNum) maxNum = n;
      }
    }
  });
  if (Store.drawer && Store.drawer.history) {
    Store.drawer.history.forEach(h => {
      if (h && h.reason) {
        const m = String(h.reason).match(/INV-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    });
  }
  return 'INV-' + (maxNum + 1);
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
  // First, load persistent data from local disk server if available
  await loadFromLocalServer();

  if (!db) {
    updateConnectionUI(false, "غير متصل (يعمل محلياً)");
    return;
  }

  try {
    // 1. Sync Products (Filtered with permanent deleted blacklist & Local merge protection)
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

      // Preserve local products that are not yet in remote snapshot (Zero inventory data loss!)
      const currentLocal = Store.products || [];
      const pendingLocal = currentLocal.filter(loc => {
        if (!loc || !loc.id) return false;
        if (blacklist.has(loc.id)) return false;
        const exists = prods.some(rem => rem.id === loc.id || (loc.barcode && rem.barcode && loc.barcode.trim().toLowerCase() === rem.barcode.trim().toLowerCase()) || (loc.imei && rem.imei && loc.imei.trim().toLowerCase() === rem.imei.trim().toLowerCase()));
        return !exists;
      });

      // Automatically sync pending local products to Firestore in background
      pendingLocal.forEach(p => {
        if (db && !p._isSyncing) {
          p._isSyncing = true;
          const cleanProd = sanitizeForFirestore(p);
          const targetDocRef = p.id ? doc(db, "products", p.id) : doc(collection(db, "products"));
          p.id = targetDocRef.id;
          setDoc(targetDocRef, cleanProd).then(() => {
            delete p._isSyncing;
          }).catch(console.warn);
        }
      });

      const mergedProducts = [...prods, ...pendingLocal];
      Store.products = mergedProducts;
      setLocal(STORAGE_KEYS.PRODUCTS, mergedProducts);
      syncToLocalServer();
      notifySubscribers("products_updated", mergedProducts);
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
      } else {
        // Initial setup on fresh Firebase project: push local 18 lines to Firestore
        (Store.vodafoneLines || []).forEach(l => {
          if (l && l.lineNum) {
            setDoc(doc(db, "vodafone_lines", l.id || `line_${l.lineNum}`), sanitizeForFirestore(l), { merge: true }).catch(console.warn);
          }
        });
      }
    }, (error) => {
      console.warn("Vodafone lines sync error:", error);
    });

    // 3. Sync Vodafone Transactions (Filtered with permanent deleted blacklist & Local merge protection)
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

      // Preserve any pending local transactions that haven't been saved in Firestore yet
      const currentLocal = Store.vodafoneTransactions || [];
      const pendingLocal = currentLocal.filter(loc => {
        if (!loc || !loc.id) return false;
        if (blacklist.has(loc.id) || (loc.transactionId && blacklist.has(loc.transactionId))) return false;
        const exists = txs.some(rem => rem.id === loc.id || (loc.transactionId && rem.transactionId === loc.transactionId));
        return !exists;
      });

      pendingLocal.forEach(t => {
        if (db && !t._isSyncing) {
          t._isSyncing = true;
          const cleanTx = sanitizeForFirestore(t);
          const targetDoc = t.id ? doc(db, "vodafone_transactions", t.id) : doc(collection(db, "vodafone_transactions"));
          t.id = targetDoc.id;
          setDoc(targetDoc, cleanTx).then(() => {
            delete t._isSyncing;
          }).catch(console.warn);
        }
      });

      const mergedTxs = [...txs, ...pendingLocal];
      mergedTxs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      Store.vodafoneTransactions = mergedTxs;
      setLocal(STORAGE_KEYS.VODAFONE_TXS, mergedTxs);
      notifySubscribers("vodafone_txs_updated", mergedTxs);
    }, (error) => {
      console.warn("Vodafone tx sync error:", error);
    });

    // 4. Sync Sales Invoices (Filtered with permanent deleted blacklist & Local merge protection)
    const salesCol = collection(db, "sales_invoices");
    onSnapshot(salesCol, (snapshot) => {
      const salesBlacklist = getDeletedSalesBlacklist();
      const remoteInvoices = [];
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const internalId = data.id || '';

        // Check if invoice was permanently deleted by docId
        if (salesBlacklist.has(docId) || (internalId && salesBlacklist.has(internalId))) {
          deleteDoc(doc(db, "sales_invoices", docId)).catch(console.warn);
          return;
        }

        remoteInvoices.push({ ...data, id: docId });
      });

      // Preserve any pending local invoices that haven't been saved in Firestore yet
      const currentLocal = Store.salesInvoices || [];
      const pendingLocal = currentLocal.filter(loc => {
        if (!loc || !loc.id) return false;
        if (salesBlacklist.has(loc.id)) return false;
        const exists = remoteInvoices.some(rem => rem.id === loc.id || (loc.invoiceNumber && rem.invoiceNumber === loc.invoiceNumber && Math.abs(new Date(rem.timestamp || 0) - new Date(loc.timestamp || 0)) < 60000));
        return !exists;
      });

      // Automatically sync pending local invoices to Firestore in background
      pendingLocal.forEach(p => {
        if (db && !p._isSyncing) {
          p._isSyncing = true;
          const cleanInv = sanitizeForFirestore(p);
          const targetDoc = p.id ? doc(db, "sales_invoices", p.id) : doc(collection(db, "sales_invoices"));
          p.id = targetDoc.id;
          setDoc(targetDoc, cleanInv).then(() => {
            delete p._isSyncing;
          }).catch(console.warn);
        }
      });

      const mergedInvoices = [...remoteInvoices, ...pendingLocal];
      mergedInvoices.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

      Store.salesInvoices = mergedInvoices;
      setLocal(STORAGE_KEYS.SALES, mergedInvoices);
      syncToLocalServer();
      notifySubscribers("sales_updated", mergedInvoices);
    }, (error) => {
      console.warn("Sales sync error:", error);
    });

    // 5. Sync Cash Drawer
    const drawerDoc = doc(db, "cash_drawer", "current_shift");
    onSnapshot(drawerDoc, (docSnap) => {
      if (docSnap.exists()) {
        Store.drawer = docSnap.data();
        setLocal(STORAGE_KEYS.DRAWER, Store.drawer);
        syncToLocalServer();
        notifySubscribers("drawer_updated", Store.drawer);
      } else if (Store.drawer) {
        setDoc(drawerDoc, sanitizeForFirestore(Store.drawer), { merge: true }).catch(console.warn);
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
      badge.classList.remove("bg-amber-500/10", "text-amber-400", "border-amber-500/40");
      badge.classList.add("bg-emerald-500/10", "text-emerald-300", "border-emerald-500/40");
      if (dot) {
        dot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
      }
    } else {
      badge.classList.remove("bg-emerald-500/10", "text-emerald-300", "border-emerald-500/40");
      badge.classList.add("bg-amber-500/10", "text-amber-400", "border-amber-500/40");
      if (dot) {
        dot.className = "w-2 h-2 rounded-full bg-amber-400";
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
  let cleanBarcode = (productData.barcode || '').trim();
  const cleanImei = (productData.imei || '').trim();

  // If no barcode provided, handle intelligently so product is ALWAYS saved and searchable
  if (!cleanBarcode) {
    if (productData.category === 'phones' && cleanImei) {
      cleanBarcode = cleanImei;
    } else {
      cleanBarcode = generateNextProductCode(productData.category);
    }
  }

  // Clear from blacklist so this product is never blocked
  unblacklistProduct(cleanBarcode);
  if (cleanImei) unblacklistProduct(cleanImei);
  if (productData.id) unblacklistProduct(productData.id);

  // Generate Firestore document reference FIRST so local and remote IDs are 100% identical!
  let docRef = null;
  let finalId = 'prod_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  if (db) {
    try {
      docRef = doc(collection(db, "products"));
      finalId = docRef.id;
    } catch (e) {}
  }

  const buyP = !isNaN(parseFloat(productData.buyPrice)) ? Math.max(0, parseFloat(productData.buyPrice)) : 0;
  const sellP = !isNaN(parseFloat(productData.sellPrice)) ? Math.max(0, parseFloat(productData.sellPrice)) : 0;
  const qty = !isNaN(parseInt(productData.quantity, 10)) ? Math.max(0, parseInt(productData.quantity, 10)) : 1;

  const newProduct = {
    id: finalId,
    barcode: cleanBarcode, // Serves as code (e.g. "70") or barcode
    name: (productData.name || '').trim() || (productData.category === 'phones' ? 'هاتف محمول' : 'صنف جديد'),
    category: productData.category || 'chargers', // 'chargers' | 'cables' | 'headphones' | 'speakers' | 'phones' | 'covers' | 'accessories' | 'manual'
    subcategory: productData.subcategory || '',
    buyPrice: buyP,
    sellPrice: sellP,
    quantity: qty,
    brand: productData.brand || '',
    model: productData.model || '',
    imei: cleanImei || (productData.category === 'phones' ? cleanBarcode : ''),
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
  syncToLocalServer();
  notifySubscribers("products_updated", Store.products);

  // Firestore sync using setDoc with sanitizeForFirestore
  if (db && docRef) {
    setDoc(docRef, sanitizeForFirestore(newProduct)).catch(err => {
      console.warn("Failed to write product to Firestore, saved locally:", err);
    });
  }

  return newProduct;
}

export async function updateProduct(id, updateData) {
  updateData.updatedAt = new Date().toISOString();

  // Local optimistic update
  const idx = Store.products.findIndex(p => p.id === id);
  if (idx !== -1) {
    Store.products[idx] = { ...Store.products[idx], ...updateData };
    setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
    syncToLocalServer();
    notifySubscribers("products_updated", Store.products);
  }

  // Firestore update in background
  if (db) {
    updateDoc(doc(db, "products", id), sanitizeForFirestore(updateData)).catch(err => {
      const q = query(collection(db, "products"), where("id", "==", id));
      getDocs(q).then(snap => {
        snap.forEach(d => {
          updateDoc(doc(db, "products", d.id), sanitizeForFirestore(updateData)).catch(console.warn);
        });
      }).catch(console.warn);
    });
  }
}

export async function deleteProduct(id) {
  if (!id) return;

  const targetId = String(id).trim();

  // 1. Add specific targetId ONLY to permanent blacklist
  blacklistProduct(targetId);

  // 2. Remove immediately from local Store.products and localStorage
  Store.products = Store.products.filter(p => p.id !== targetId);
  setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
  syncToLocalServer();
  notifySubscribers("products_updated", Store.products);

  // 3. Permanently delete from Firestore in background
  if (db) {
    deleteDoc(doc(db, "products", targetId)).catch(console.warn);
    const qId = query(collection(db, "products"), where("id", "==", targetId));
    getDocs(qId).then(snapId => {
      snapId.forEach(d => {
        deleteDoc(doc(db, "products", d.id)).catch(console.warn);
      });
    }).catch(console.warn);
  }
}

// Adjust stock quantity immediately
export async function adjustProductStock(id, changeQty) {
  const prod = Store.products.find(p => p.id === id);
  if (prod) {
    const newQty = Math.max(0, (prod.quantity || 0) + changeQty);
    prod.quantity = newQty;
    prod.updatedAt = new Date().toISOString();
    setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
    notifySubscribers("products_updated", Store.products);

    if (db) {
      updateDoc(doc(db, "products", id), { quantity: newQty, updatedAt: prod.updatedAt }).catch(err => {
        const q = query(collection(db, "products"), where("id", "==", id));
        getDocs(q).then(snap => {
          snap.forEach(d => {
            updateDoc(doc(db, "products", d.id), { quantity: newQty, updatedAt: prod.updatedAt }).catch(console.warn);
          });
        }).catch(console.warn);
      });
    }
  }
}

// Direct Category Sale (Instant 0-delay Sale by Code or POS)
export async function recordDirectCategorySale({ productId, barcode, name, category, quantity, sellPrice, buyPrice, customerName, customerPhone, saleDate }) {
  const numQty = parseInt(quantity, 10) || 1;
  const numSellPrice = parseFloat(sellPrice) || 0;
  const numBuyPrice = parseFloat(buyPrice) || 0;
  const totalAmount = numSellPrice * numQty;
  const totalProfit = (numSellPrice - numBuyPrice) * numQty;
  const timestamp = saleDate || new Date().toISOString();

  // 1. Deduct stock from product locally and immediately
  let prod = null;
  if (productId) {
    prod = Store.products.find(p => p.id === productId);
  }
  if (!prod && barcode) {
    const cleanBar = String(barcode).trim().toLowerCase();
    prod = Store.products.find(p => (p.barcode && p.barcode.trim().toLowerCase() === cleanBar) || (p.imei && p.imei.trim().toLowerCase() === cleanBar));
  }

  let remainingQty = 0;
  if (prod) {
    prod.quantity = Math.max(0, (prod.quantity || 0) - numQty);
    remainingQty = prod.quantity;
    prod.updatedAt = timestamp;
    if (prod.category === 'phones') {
      prod.status = 'sold';
      prod.customerName = customerName || 'عميل نقدي';
      prod.customerPhone = customerPhone || prod.linkedPhoneNumber || '';
      prod.soldAt = timestamp;
    }
    setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
  }

  // 2. Create Sale Record
  const invoiceNumber = generateNextInvoiceNumber();
  const localId = 'inv_' + Date.now();
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
    id: localId,
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
  syncToLocalServer();

  // 3. Add cash to drawer locally
  if (!Store.drawer) {
    Store.drawer = {
      shiftId: '#402',
      openingCash: 0,
      currentCash: 0,
      history: []
    };
  }
  let currentDrawer = parseFloat(Store.drawer.currentCash) || 0;
  currentDrawer += totalAmount;
  Store.drawer.currentCash = currentDrawer;
  if (!Store.drawer.history) Store.drawer.history = [];
  Store.drawer.history.unshift({
    type: 'in',
    amount: totalAmount,
    reason: `فاتورة بيع ${invoiceNumber} - بيع مباشر بالكود (${saleItem.barcode || '-'}) - ${saleItem.name}`,
    balanceAfter: currentDrawer,
    timestamp
  });
  setLocal(STORAGE_KEYS.DRAWER, Store.drawer);
  syncToLocalServer();

  // 4. INSTANT LOCAL-FIRST NOTIFICATIONS (0ms UI latency!)
  notifySubscribers("sales_updated", Store.salesInvoices);
  notifySubscribers("products_updated", Store.products);
  notifySubscribers("drawer_updated", Store.drawer);

  // 5. ASYNC CLOUD SYNC (Runs in background, never delays user)
  if (db) {
    if (prod) {
      const prodUpdates = {
        quantity: prod.quantity,
        updatedAt: prod.updatedAt
      };
      if (prod.category === 'phones') {
        prodUpdates.status = 'sold';
        prodUpdates.customerName = prod.customerName;
        prodUpdates.customerPhone = prod.customerPhone;
        prodUpdates.soldAt = prod.soldAt;
      }
      updateDoc(doc(db, "products", prod.id), sanitizeForFirestore(prodUpdates)).catch(err => {
        const q = query(collection(db, "products"), where("id", "==", prod.id));
        getDocs(q).then(snap => {
          snap.forEach(d => updateDoc(doc(db, "products", d.id), sanitizeForFirestore(prodUpdates)).catch(console.warn));
        }).catch(console.warn);
      });
    }

    setDoc(doc(db, "cash_drawer", "current_shift"), sanitizeForFirestore(Store.drawer)).catch(console.warn);

    setDoc(doc(db, "sales_invoices", localId), sanitizeForFirestore(invoiceData)).catch(err => {
      console.warn("Failed to write sale invoice to Firestore, saved locally:", err);
    });
  }

  return {
    ...invoiceData,
    _remainingStock: remainingQty,
    _soldProduct: prod
  };
}

// Direct Category Restock (Fast stock intake by Code or Table action)
export async function recordDirectCategoryRestock({ productId, deltaQty, newBuyPrice, newSellPrice, restockDate, totalCost }) {
  const prod = Store.products.find(p => p.id === productId);
  if (!prod) return;

  const currentQty = parseInt(prod.quantity, 10) || 0;
  const addQty = parseInt(deltaQty, 10) || 0;
  const newQty = Math.max(0, currentQty + addQty);
  const buyP = (newBuyPrice !== undefined && newBuyPrice !== '' && !isNaN(parseFloat(newBuyPrice))) ? parseFloat(newBuyPrice) : (prod.buyPrice || 0);

  prod.quantity = newQty;
  prod.lastRestockedAt = restockDate || new Date().toISOString();
  prod.updatedAt = new Date().toISOString();

  if (newBuyPrice !== undefined && newBuyPrice !== '' && !isNaN(parseFloat(newBuyPrice))) {
    prod.buyPrice = parseFloat(newBuyPrice);
  }
  if (newSellPrice !== undefined && newSellPrice !== '' && !isNaN(parseFloat(newSellPrice))) {
    prod.sellPrice = parseFloat(newSellPrice);
  }

  setLocal(STORAGE_KEYS.PRODUCTS, Store.products);
  notifySubscribers("products_updated", Store.products);

  // Automatic Cash Drawer integration: deduct purchase cost from cash drawer
  const cost = (totalCost !== undefined && !isNaN(parseFloat(totalCost))) ? parseFloat(totalCost) : (addQty * buyP);
  if (cost > 0) {
    if (!Store.drawer) Store.drawer = { shiftId: '#402', openingCash: 0, currentCash: 0, history: [] };
    let currentDrawer = parseFloat(Store.drawer.currentCash) || 0;
    currentDrawer -= cost;
    Store.drawer.currentCash = currentDrawer;
    if (!Store.drawer.history) Store.drawer.history = [];
    Store.drawer.history.unshift({
      type: 'out',
      amount: cost,
      reason: `توريد مخزون (${addQty} حبة) - ${prod.name}`,
      balanceAfter: currentDrawer,
      timestamp: new Date().toISOString()
    });
    setLocal(STORAGE_KEYS.DRAWER, Store.drawer);
    notifySubscribers("drawer_updated", Store.drawer);
    if (db) {
      setDoc(doc(db, "cash_drawer", "current_shift"), Store.drawer).catch(console.warn);
    }
  }

  if (db) {
    const updates = {
      quantity: prod.quantity,
      lastRestockedAt: prod.lastRestockedAt,
      updatedAt: prod.updatedAt,
      buyPrice: prod.buyPrice,
      sellPrice: prod.sellPrice
    };
    updateDoc(doc(db, "products", productId), updates).catch(err => {
      const q = query(collection(db, "products"), where("id", "==", productId));
      getDocs(q).then(snap => {
        snap.forEach(d => updateDoc(doc(db, "products", d.id), updates).catch(console.warn));
      }).catch(console.warn);
    });
  }

  return prod;
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
  const invoiceNumber = generateNextInvoiceNumber();
  const localId = 'inv_' + Date.now();
  const invoiceTimestamp = new Date().toISOString();

  const invoiceData = {
    id: localId,
    invoiceNumber,
    items: items.map(item => {
      const p = Store.products.find(prod => prod.id === item.id || (item.barcode && prod.barcode === item.barcode));
      const sellP = parseFloat(item.price) || 0;
      const buyP = (item.buyPrice !== undefined && item.buyPrice !== null) ? parseFloat(item.buyPrice) : (p ? parseFloat(p.buyPrice) || 0 : 0);
      const q = parseInt(item.quantity, 10) || 1;
      const tot = sellP * q;
      const prof = tot - (buyP * q);
      const cat = item.category || (p ? p.category : 'chargers');
      return {
        productId: item.id || (p ? p.id : ''),
        barcode: item.barcode || (p ? p.barcode : ''),
        name: item.name || (p ? p.name : 'منتج'),
        category: cat,
        price: sellP,
        buyPrice: buyP,
        profit: prof,
        quantity: q,
        total: tot
      };
    }),
    subtotal: parseFloat(subtotal) || 0,
    discount: parseFloat(discount) || 0,
    totalAmount: parseFloat(totalAmount) || 0,
    cashPaid: parseFloat(cashPaid) || 0,
    change: parseFloat(change) || 0,
    customerName: customerName || 'عميل نقدي',
    customerPhone: customerPhone || '',
    cashier: cashier || 'كاشير سنترال حلمي',
    timestamp: invoiceTimestamp
  };

  // 1. Immediately deduct stock locally from all items
  const productStockUpdates = [];
  for (const item of items) {
    if (item.id) {
      const prod = Store.products.find(p => p.id === item.id);
      if (prod) {
        prod.quantity = Math.max(0, (prod.quantity || 0) - item.quantity);
        prod.updatedAt = invoiceTimestamp;
        const prodSyncData = {
          id: prod.id,
          quantity: prod.quantity,
          updatedAt: prod.updatedAt
        };
        if (prod.category === 'phones') {
          prod.status = 'sold';
          prod.customerName = customerName || 'عميل نقدي';
          prod.customerPhone = customerPhone || '';
          prod.soldAt = invoiceTimestamp;
          prodSyncData.status = 'sold';
          prodSyncData.customerName = prod.customerName;
          prodSyncData.customerPhone = prod.customerPhone;
          prodSyncData.soldAt = prod.soldAt;
        }
        productStockUpdates.push(prodSyncData);
      }
    }
  }
  setLocal(STORAGE_KEYS.PRODUCTS, Store.products);

  // 2. Prepend invoice to local sales
  Store.salesInvoices.unshift(invoiceData);
  setLocal(STORAGE_KEYS.SALES, Store.salesInvoices);
  syncToLocalServer();

  // 3. Add cash to drawer locally
  if (!Store.drawer) {
    Store.drawer = {
      shiftId: '#402',
      openingCash: 0,
      currentCash: 0,
      history: []
    };
  }
  let currentDrawer = parseFloat(Store.drawer.currentCash) || 0;
  currentDrawer += invoiceData.totalAmount;
  Store.drawer.currentCash = currentDrawer;
  if (!Store.drawer.history) Store.drawer.history = [];
  Store.drawer.history.unshift({
    type: 'in',
    amount: invoiceData.totalAmount,
    reason: `فاتورة بيع ${invoiceNumber}`,
    balanceAfter: currentDrawer,
    timestamp: invoiceTimestamp
  });
  setLocal(STORAGE_KEYS.DRAWER, Store.drawer);
  syncToLocalServer();

  // 4. INSTANT NOTIFICATIONS (0ms UI latency!)
  notifySubscribers("sales_updated", Store.salesInvoices);
  notifySubscribers("products_updated", Store.products);
  notifySubscribers("drawer_updated", Store.drawer);

  // 5. ASYNC BACKGROUND FIRESTORE SYNC (Never block UI!)
  if (db) {
    productStockUpdates.forEach(syncItem => {
      const { id, ...dataToUpdate } = syncItem;
      updateDoc(doc(db, "products", id), sanitizeForFirestore(dataToUpdate)).catch(err => {
        const q = query(collection(db, "products"), where("id", "==", id));
        getDocs(q).then(snap => {
          snap.forEach(d => updateDoc(doc(db, "products", d.id), sanitizeForFirestore(dataToUpdate)).catch(console.warn));
        }).catch(console.warn);
      });
    });

    setDoc(doc(db, "cash_drawer", "current_shift"), sanitizeForFirestore(Store.drawer)).catch(console.warn);

    setDoc(doc(db, "sales_invoices", localId), sanitizeForFirestore(invoiceData)).catch(err => {
      console.warn("Failed to write checkout sale to Firestore, saved locally:", err);
    });
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
    recordCashDrawerEntry({
      type: cashDelta > 0 ? 'in' : 'out',
      amount: Math.abs(cashDelta),
      reason: `تعديل إجمالي فاتورة بيع ${invoice.invoiceNumber} (${cashDelta > 0 ? 'زيادة' : 'خصم'})`
    });
  }

  // Save to local store & localStorage
  setLocal(STORAGE_KEYS.SALES, Store.salesInvoices);
  syncToLocalServer();
  notifySubscribers("sales_updated", Store.salesInvoices);

  // Update Firestore in background
  if (db) {
    updateDoc(doc(db, "sales_invoices", invoiceId), {
      items: invoice.items,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      totalAmount: invoice.totalAmount,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      timestamp: invoice.timestamp,
      updatedAt: invoice.updatedAt
    }).catch(err => {
      setDoc(doc(db, "sales_invoices", invoiceId), invoice, { merge: true }).catch(console.warn);
    });
  }

  return invoice;
}

export async function deleteSaleInvoice(invoiceId) {
  const invIdx = Store.salesInvoices.findIndex(s => s.id === invoiceId);
  if (invIdx === -1) return false;

  const invoice = Store.salesInvoices[invIdx];

  // 1. Revert product stock for each sold item immediately
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
            setDoc(doc(db, "products", prod.id), prod, { merge: true }).catch(console.warn);
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
    recordCashDrawerEntry({
      type: 'out',
      amount: amountToDeduct,
      reason: `إلغاء وحذف نهائي لفاتورة بيع ${invoice.invoiceNumber || ''}`
    });
  }

  // Add to permanent deleted sales blacklist (by unique ID only)
  blacklistSale(invoiceId);

  // 3. Remove permanently from local store & localStorage
  Store.salesInvoices.splice(invIdx, 1);
  setLocal(STORAGE_KEYS.SALES, Store.salesInvoices);
  syncToLocalServer();
  notifySubscribers("sales_updated", Store.salesInvoices);

  // 4. Delete permanently from Firestore in background
  if (db) {
    deleteDoc(doc(db, "sales_invoices", invoiceId)).catch(console.warn);
  }

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
    setDoc(doc(db, "cash_drawer", "current_shift"), Store.drawer).catch(console.warn);
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

// Complete push of all local data to Firebase Cloud Firestore
export async function pushAllLocalDataToFirestore() {
  if (!db) {
    console.warn("Firestore not connected, cannot push data");
    return false;
  }
  try {
    console.log("🚀 Starting complete push of all local data to Firebase project: helmy-10237...");
    const blacklist = getDeletedBlacklist();
    const salesBlacklist = getDeletedSalesBlacklist();
    const txBlacklist = getDeletedVodaTxsBlacklist();

    // 1. Products
    const prods = (Store.products || []).filter(p => p && p.id && !blacklist.has(p.id));
    for (const p of prods) {
      const clean = sanitizeForFirestore(p);
      await setDoc(doc(db, "products", p.id), clean, { merge: true });
    }

    // 2. Sales Invoices
    const sales = (Store.salesInvoices || []).filter(s => s && s.id && !salesBlacklist.has(s.id));
    for (const s of sales) {
      const clean = sanitizeForFirestore(s);
      await setDoc(doc(db, "sales_invoices", s.id), clean, { merge: true });
    }

    // 3. Vodafone Lines
    const lines = Store.vodafoneLines || [];
    for (const l of lines) {
      if (l && l.lineNum) {
        const clean = sanitizeForFirestore(l);
        await setDoc(doc(db, "vodafone_lines", l.id || `line_${l.lineNum}`), clean, { merge: true });
      }
    }

    // 4. Vodafone Transactions
    const txs = (Store.vodafoneTransactions || []).filter(t => t && t.id && !txBlacklist.has(t.id));
    for (const t of txs) {
      const clean = sanitizeForFirestore(t);
      await setDoc(doc(db, "vodafone_transactions", t.id), clean, { merge: true });
    }

    // 5. Cash Drawer
    if (Store.drawer) {
      await setDoc(doc(db, "cash_drawer", "current_shift"), sanitizeForFirestore(Store.drawer), { merge: true });
    }

    console.log(`✅ All local data pushed to Firebase successfully: ${prods.length} products, ${sales.length} invoices, ${lines.length} lines, ${txs.length} transactions.`);
    return true;
  } catch (err) {
    console.error("Error during pushAllLocalDataToFirestore:", err);
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.pushAllLocalDataToFirestore = pushAllLocalDataToFirestore;
}
