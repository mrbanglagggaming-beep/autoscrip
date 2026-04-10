/**
 * AutoScrip — Firebase Configuration & Security Module (FIXED v2)
 * ================================================================
 * ✅ FIX 1: Real Firebase config (powerscript-pro-web)
 * ✅ FIX 2: AdminCache — super_admin | admin | moderator সব accept
 * ✅ FIX 3: isAdmin() — email/uid bypass for master admin
 * ✅ FIX 4: Offline persistence with error handling
 * ✅ FIX 5: DOM, Sanitizer, ToolModel, UserModel — defined here
 */

'use strict';

// ─── Firebase Config ─────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA5_HYl2R1Sa17xBeBhyxO4lGa9lAY5ut4",
  authDomain:        "powerscript-pro-web.firebaseapp.com",
  projectId:         "powerscript-pro-web",
  storageBucket:     "powerscript-pro-web.firebasestorage.app",
  messagingSenderId: "709315727810",
  appId:             "1:709315727810:web:abeb73172635061343c65b"
};

const MASTER_EMAIL = 'mrbanglagggaming@gmail.com';
const MASTER_UID   = 'E97OGEv5ZJFbHaoojCnFe25GSeY1';

// Accepted admin roles
const ADMIN_ROLES = new Set(['super_admin', 'admin', 'moderator', 'content_manager']);

// ─── Initialize Firebase ──────────────────────────────────────────────────────
let _app, _auth, _db;

function initFirebase() {
  if (_app) return { app: _app, auth: _auth, db: _db };
  try {
    _app  = firebase.apps.length
          ? firebase.app()
          : firebase.initializeApp(FIREBASE_CONFIG);
    _auth = firebase.auth();
    _db   = firebase.firestore();

    // Long polling for Vercel Edge / corporate proxies
    try {
      _db.settings({ experimentalForceLongPolling: true, merge: true });
    } catch (_) {}

    // Offline persistence
    _db.enablePersistence({ synchronizeTabs: true })
      .catch(err => {
        if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
          console.warn('[AutoScrip] Persistence error:', err.code);
        }
      });

    window._fbApp  = _app;
    window._fbAuth = _auth;
    window._fbDb   = _db;

    console.log('[AutoScrip] Firebase initialized ✓');
    return { app: _app, auth: _auth, db: _db };
  } catch (e) {
    console.error('[AutoScrip] Firebase init failed:', e.message);
    return null;
  }
}

// ─── Admin Cache (FIXED) ─────────────────────────────────────────────────────
const AdminCache = {
  _cache: new Map(),
  _TTL:   5 * 60 * 1000, // 5 minutes

  async check(uid) {
    if (!uid) return false;

    // Master admin bypass — সবসময় true
    if (uid === MASTER_UID) return true;
    const user = _auth?.currentUser;
    if (user?.email === MASTER_EMAIL) return true;

    const cached = this._cache.get(uid);
    if (cached && (Date.now() - cached.ts) < this._TTL) {
      return cached.isAdmin;
    }

    try {
      const doc = await _db.collection('autoscrip_admins').doc(uid).get();
      let result = false;
      if (doc.exists) {
        const data = doc.data();
        // ✅ FIX: 'super_admin' | 'admin' | 'moderator' | 'content_manager' সব accept
        result = ADMIN_ROLES.has(data?.role) && data?.active !== false;
      }
      this._cache.set(uid, { isAdmin: result, ts: Date.now() });
      return result;
    } catch (e) {
      console.warn('[AdminCache] check failed:', e.message);
      // Fallback: email/uid check
      const u = _auth?.currentUser;
      return u?.uid === MASTER_UID || u?.email === MASTER_EMAIL;
    }
  },

  invalidate(uid) {
    if (uid) this._cache.delete(uid);
  },

  clear() { this._cache.clear(); }
};

async function isAdmin() {
  const user = _auth?.currentUser;
  if (!user) return false;
  if (user.uid === MASTER_UID || user.email === MASTER_EMAIL) return true;
  return AdminCache.check(user.uid);
}

// ─── Sanitizer ────────────────────────────────────────────────────────────────
const Sanitizer = {
  html(dirty) {
    if (typeof dirty !== 'string') return '';
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['b','i','em','strong','span','div','p','br','ul','ol','li',
                       'h1','h2','h3','h4','code','pre','a','img','table','tr','td','th','small'],
        ALLOWED_ATTR: ['class','style','href','src','alt','title','target','rel','data-id'],
        ALLOW_DATA_ATTR: false
      });
    }
    return this.text(dirty);
  },
  text(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  },
  url(url) {
    if (!url) return '#';
    const s = String(url).trim();
    if (/^(https?:|mailto:)/.test(s)) return s;
    if (s.startsWith('#') || s.startsWith('/')) return s;
    return '#';
  },
  escapeHtml(str) { return this.text(str); }
};

// ─── DOM Helpers ──────────────────────────────────────────────────────────────
const DOM = {
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
  setHTML(el, html) { if (el) el.innerHTML = Sanitizer.html(html); },
  setText(el, text) { if (el) el.textContent = String(text ?? ''); },
  $(sel, ctx = document)  { return ctx.querySelector(sel); },
  $$(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }
};

// ─── Tool Model ───────────────────────────────────────────────────────────────
const ToolModel = {
  fromDoc(doc) {
    const d  = doc.data ? doc.data() : doc;
    const id = doc.id || d.id || d._id || '';
    return {
      id,
      _id:         id,
      title:       d.title || d.name || '',
      description: d.description || '',
      category:    d.category || 'other',
      // ✅ FIX: subCategory field normalized
      subCategory: d.subCategory || d.subcategory || d.subcat || '',
      tags:        Array.isArray(d.tags) ? d.tags : [],
      code:        d.code || '',
      commands:    Array.isArray(d.commands) ? d.commands : [],
      author:      d.author || 'AutoScrip',
      thumbnail:   d.thumbnail || '',
      youtube:     d.youtube || '',
      slug:        d.slug || '',
      metaDesc:    d.metaDesc || '',
      views:       typeof d.views === 'number' ? d.views : 0,
      downloads:   typeof d.downloads === 'number' ? d.downloads : 0,
      likes:       Array.isArray(d.likes) ? d.likes : [],
      status:      d.status || 'pending',
      featured:    Boolean(d.featured),
      verified:    Boolean(d.verified),
      published:   d.published !== false,
      createdAt:   d.createdAt || new Date().toISOString(),
      updatedAt:   d.updatedAt || new Date().toISOString()
    };
  },
  toDoc(tool) {
    const { id, _id, ...data } = tool;
    if (data.name && !data.title) data.title = data.name;
    delete data.name;
    data.updatedAt = new Date().toISOString();
    return data;
  },
  validate(tool) {
    const errors = [];
    if (!tool.title?.trim())  errors.push('শিরোনাম আবশ্যক');
    if (!tool.category)       errors.push('ক্যাটাগরি আবশ্যক');
    if (!tool.code?.trim() && !tool.commands?.length) errors.push('কোড বা কমান্ড আবশ্যক');
    return errors;
  }
};

// ─── User Model ───────────────────────────────────────────────────────────────
const UserModel = {
  fromDoc(doc) {
    const d  = doc.data ? doc.data() : doc;
    const id = doc.id || d.uid || d.id || '';
    return {
      uid:          id,
      id:           id,
      displayName:  d.displayName || d.name || 'ইউজার',
      email:        d.email || '',
      role:         d.role || 'user',
      bio:          d.bio || '',
      avatar:       d.avatar || '',
      contributions:typeof d.contributions === 'number' ? d.contributions : 0,
      bookmarks:    Array.isArray(d.bookmarks) ? d.bookmarks : [],
      settings:     d.settings || {},
      createdAt:    d.createdAt || new Date().toISOString(),
      lastSeen:     d.lastSeen || new Date().toISOString()
    };
  },
  toDoc(user) {
    const { uid, id, ...data } = user;
    if (data.name && !data.displayName) data.displayName = data.name;
    delete data.name;
    delete data.password;
    delete data.pass;
    data.lastSeen = new Date().toISOString();
    return data;
  }
};

// ─── Global Exports ───────────────────────────────────────────────────────────
window.initFirebase  = initFirebase;
window.isAdmin       = isAdmin;
window.AdminCache    = AdminCache;
window.ADMIN_ROLES   = ADMIN_ROLES;
window.MASTER_UID    = MASTER_UID;
window.MASTER_EMAIL  = MASTER_EMAIL;
window.Sanitizer     = Sanitizer;
window.DOM           = DOM;
window.ToolModel     = ToolModel;
window.UserModel     = UserModel;
window.escHtml       = str => Sanitizer.text(str);
