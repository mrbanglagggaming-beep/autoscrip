/**
 * AutoScrip — Firebase Configuration & Security Module
 * =====================================================
 * ১. Firebase initialize (offline persistence সহ)
 * ২. isAdmin() role-based access control
 * ৩. Firestore Security Rules (reference)
 * ৪. DOMPurify XSS sanitizer wrapper
 */

'use strict';

// ─── Firebase Config ────────────────────────────────────────────────────────
// 🔴 এখানে আপনার Firebase project এর config দিন
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

// ─── Initialize Firebase ─────────────────────────────────────────────────────
let _app, _auth, _db;

function initFirebase() {
  if (_app) return { app: _app, auth: _auth, db: _db };
  try {
    _app  = firebase.initializeApp(FIREBASE_CONFIG);
    _auth = firebase.auth();
    _db   = firebase.firestore();

    // ✅ Point 4: অফলাইন পার্সিস্টেন্স — Firebase SDK built-in cache
    _db.enablePersistence({ synchronizeTabs: true })
      .catch(err => {
        if (err.code === 'failed-precondition') {
          // Multiple tabs open — persistence only works in one tab at a time
          console.warn('[AutoScrip] Offline persistence disabled (multiple tabs)');
        } else if (err.code === 'unimplemented') {
          console.warn('[AutoScrip] Browser does not support offline persistence');
        }
      });

    window._fbApp  = _app;
    window._fbAuth = _auth;
    window._fbDb   = _db;

    console.log('[AutoScrip] Firebase initialized ✓');
    return { app: _app, auth: _auth, db: _db };
  } catch (e) {
    console.error('[AutoScrip] Firebase init failed:', e);
    return null;
  }
}

// ─── Admin Role Check ────────────────────────────────────────────────────────
// ✅ Point 1: isAdmin() — Firestore autoscrip_admins collection থেকে যাচাই
const AdminCache = {
  _cache: new Map(),       // uid → { isAdmin, ts }
  _TTL:   5 * 60 * 1000,  // 5 minutes cache

  async check(uid) {
    if (!uid) return false;

    const cached = this._cache.get(uid);
    if (cached && (Date.now() - cached.ts) < this._TTL) {
      return cached.isAdmin;
    }

    try {
      const doc = await _db.collection('autoscrip_admins').doc(uid).get();
      const result = doc.exists && doc.data()?.role === 'admin' && doc.data()?.active !== false;
      this._cache.set(uid, { isAdmin: result, ts: Date.now() });
      return result;
    } catch (e) {
      console.warn('[AutoScrip] Admin check failed:', e);
      return false;
    }
  },

  invalidate(uid) {
    this._cache.delete(uid);
  }
};

// Expose globally for use across modules
window.AdminCache = AdminCache;

/**
 * isAdmin() — current user অ্যাডমিন কিনা চেক করে
 * @returns {Promise<boolean>}
 */
async function isAdmin() {
  const user = _auth?.currentUser;
  if (!user) return false;
  return AdminCache.check(user.uid);
}

window.isAdmin = isAdmin;

// ─── XSS Prevention (DOMPurify wrapper) ─────────────────────────────────────
// ✅ Point 5: DOMPurify wrapper — সব innerHTML এর আগে sanitize করতে হবে
const Sanitizer = {
  /**
   * HTML sanitize করে — ব্যবহার করুন সব innerHTML এর আগে
   * @param {string} dirty
   * @returns {string} clean HTML
   */
  html(dirty) {
    if (typeof dirty !== 'string') return '';
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['b','i','em','strong','span','div','p','br','ul','ol','li',
                       'h1','h2','h3','h4','code','pre','a','img','table','tr','td','th'],
        ALLOWED_ATTR: ['class','style','href','src','alt','title','target','rel'],
        ALLOW_DATA_ATTR: false
      });
    }
    // DOMPurify না থাকলে escape করে দাও
    return this.text(dirty);
  },

  /**
   * Plain text escape — ব্যবহার করুন textContent এর জায়গায় innerHTML হলে
   * @param {string} str
   * @returns {string}
   */
  text(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  },

  /**
   * URL sanitize — href, src এ ব্যবহার করুন
   * @param {string} url
   * @returns {string}
   */
  url(url) {
    if (!url) return '#';
    const s = String(url).trim();
    // শুধু http/https/mailto অনুমতি
    if (/^(https?:|mailto:)/.test(s)) return s;
    if (s.startsWith('#') || s.startsWith('/')) return s;
    return '#';
  }
};

window.Sanitizer = Sanitizer;
// Legacy alias
window.escHtml = str => Sanitizer.text(str);

// ─── Safe DOM Helpers ────────────────────────────────────────────────────────
// ✅ Point 5: innerHTML এড়িয়ে DOM API ব্যবহার করুন

const DOM = {
  /**
   * createElement wrapper — attributes ও children সহ
   */
  el(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v);
    }
    for (const child of children) {
      if (child == null) continue;
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child instanceof Node) el.appendChild(child);
    }
    return el;
  },

  /**
   * Safe innerHTML setter — DOMPurify দিয়ে sanitize করে
   */
  setHTML(el, html) {
    if (!el) return;
    el.innerHTML = Sanitizer.html(html);
  },

  /**
   * Safe text setter
   */
  setText(el, text) {
    if (!el) return;
    el.textContent = String(text ?? '');
  },

  /**
   * Find element
   */
  $(sel, ctx = document) { return ctx.querySelector(sel); },
  $$(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }
};

window.DOM = DOM;

// ─── Data Model Standards ────────────────────────────────────────────────────
// ✅ Point 3: Standardized data models

/**
 * Tool model — সব জায়গায় এই format ব্যবহার করুন
 * title/name দুটো রাখা হবে না — শুধু `title` ব্যবহার
 */
const ToolModel = {
  /**
   * Firestore doc → normalized tool object
   */
  fromDoc(doc) {
    const d = doc.data ? doc.data() : doc;
    const id = doc.id || d.id || d._id;
    return {
      id,
      title:       d.title || d.name || '',   // normalize: একটাই field
      description: d.description || '',
      category:    d.category || 'other',
      subcategory: d.subcategory || '',
      tags:        Array.isArray(d.tags) ? d.tags : [],
      code:        d.code || '',
      commands:    Array.isArray(d.commands) ? d.commands : [],
      author:      d.author || 'AutoScrip',
      authorId:    d.authorId || '',
      thumbnail:   d.thumbnail || '',
      youtube:     d.youtube || '',
      views:       typeof d.views === 'number' ? d.views : 0,
      downloads:   typeof d.downloads === 'number' ? d.downloads : 0,
      likes:       Array.isArray(d.likes) ? d.likes : [],
      status:      d.status || 'pending',      // pending | approved | rejected
      featured:    Boolean(d.featured),
      published:   d.published !== false,
      createdAt:   d.createdAt || new Date().toISOString(),
      updatedAt:   d.updatedAt || new Date().toISOString()
    };
  },

  /**
   * tool object → Firestore-ready data (title/name normalization)
   */
  toDoc(tool) {
    const { id, ...data } = tool;
    // শুধু `title` রাখো, `name` remove করো
    if (data.name && !data.title) data.title = data.name;
    delete data.name;
    data.updatedAt = new Date().toISOString();
    return data;
  },

  validate(tool) {
    const errors = [];
    if (!tool.title?.trim()) errors.push('শিরোনাম আবশ্যক');
    if (!tool.category)      errors.push('ক্যাটাগরি আবশ্যক');
    if (!tool.code?.trim() && !(tool.commands?.length)) errors.push('কোড বা কমান্ড আবশ্যক');
    return errors;
  }
};

window.ToolModel = ToolModel;

/**
 * User model — normalized
 */
const UserModel = {
  fromDoc(doc) {
    const d = doc.data ? doc.data() : doc;
    return {
      uid:          doc.id || d.uid || d.id,
      displayName:  d.displayName || d.name || 'ইউজার',
      email:        d.email || '',
      role:         d.role || 'user',          // user | admin | moderator
      bio:          d.bio || '',
      avatar:       d.avatar || '',
      contributions: typeof d.contributions === 'number' ? d.contributions : 0,
      bookmarks:    Array.isArray(d.bookmarks) ? d.bookmarks : [],
      settings:     d.settings || {},
      createdAt:    d.createdAt || new Date().toISOString(),
      lastSeen:     d.lastSeen || new Date().toISOString()
    };
  },

  toDoc(user) {
    const { uid, ...data } = user;
    // `name` normalize
    if (data.name && !data.displayName) data.displayName = data.name;
    delete data.name;
    delete data.password;
    delete data.pass;
    data.lastSeen = new Date().toISOString();
    return data;
  }
};

window.UserModel = UserModel;

// ─── Export ──────────────────────────────────────────────────────────────────
export { initFirebase, isAdmin, AdminCache, Sanitizer, DOM, ToolModel, UserModel };
