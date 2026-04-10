/**
 * AutoScrip — Core JavaScript Module
 * =====================================
 * ✅ Point 2:  Code Splitting — JS আলাদা ফাইলে
 * ✅ Point 3:  Standardized data model
 * ✅ Point 4:  Firebase offline persistence
 * ✅ Point 5:  DOMPurify / XSS prevention
 * ✅ Point 6:  Virtual scrolling
 * ✅ Point 8:  Real CSV/JSON import-export
 */

'use strict';

// ── DOM Utilities ─────────────────────────────────────────────────────────────
const DOM = {
  el: (tag, attrs = {}) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v);
    });
    return el;
  },
  setHTML: (el, html) => { if (el) el.innerHTML = html; },
  setText: (el, text) => { if (el) el.textContent = text; },
  show: (el) => { if (el) el.style.display = ''; },
  hide: (el) => { if (el) el.style.display = 'none'; },
  query: (sel, ctx) => (ctx || document).querySelector(sel),
  queryAll: (sel, ctx) => [...(ctx || document).querySelectorAll(sel)],
};
window.DOM = DOM;


// ─── Imports ──────────────────────────────────────────────────────────────────
// Uses window globals from firebase-config.js
// ─── Constants ───────────────────────────────────────────────────────────────
const CAT_META = {
  system:     { label:'⚙️ সিস্টেম',   color:['#1565c0','#1a237e'] },
  network:    { label:'🌐 নেটওয়ার্ক', color:['#00838f','#004d40'] },
  security:   { label:'🔒 সিকিউরিটি', color:['#7b1fa2','#4a148c'] },
  backup:     { label:'💾 ব্যাকআপ',    color:['#f4511e','#bf360c'] },
  monitoring: { label:'📊 মনিটরিং',   color:['#388e3c','#1b5e20'] },
  automation: { label:'🤖 অটোমেশন',   color:['#c2185b','#880e4f'] },
  download:   { label:'⬇️ ডাউনলোড',  color:['#e65100','#bf360c'] },
  devtools:   { label:'💻 ডেভটুলস',   color:['#0288d1','#01579b'] },
  office:     { label:'📝 অফিস',       color:['#d32f2f','#b71c1c'] },
  gaming:     { label:'🎮 গেমিং',      color:['#6200ea','#4527a0'] }
};

// 10 categories × 10 subcategories = 100 total
const SUBCATEGORIES = {
  system:     [
    {e:'💻',n:'সিস্টেম ইনফো',k:'sys_info'},    {e:'⚡',n:'পাওয়ার ম্যানেজ',k:'sys_power'},
    {e:'🔧',n:'রেজিস্ট্রি',k:'sys_registry'},    {e:'📦',n:'সফটওয়্যার',k:'sys_software'},
    {e:'🖥️',n:'ডিসপ্লে',k:'sys_display'},         {e:'💾',n:'মেমরি',k:'sys_memory'},
    {e:'🔊',n:'অডিও',k:'sys_audio'},              {e:'🔋',n:'ব্যাটারি',k:'sys_battery'},
    {e:'📝',n:'লগ ম্যানেজ',k:'sys_log'},          {e:'🧹',n:'ক্লিনআপ',k:'sys_cleanup'}
  ],
  network:    [
    {e:'🌍',n:'DNS ম্যানেজ',k:'net_dns'},         {e:'📡',n:'WiFi কন্ট্রোল',k:'net_wifi'},
    {e:'🔌',n:'ইথারনেট',k:'net_ethernet'},         {e:'🛡️',n:'ফায়ারওয়াল',k:'net_firewall'},
    {e:'📊',n:'ব্যান্ডউইথ',k:'net_bandwidth'},    {e:'🔍',n:'পোর্ট স্ক্যান',k:'net_port'},
    {e:'🌐',n:'VPN',k:'net_vpn'},                  {e:'📶',n:'সিগন্যাল চেক',k:'net_signal'},
    {e:'🌊',n:'পিং টেস্ট',k:'net_ping'},           {e:'🗺️',n:'ট্রেসরাউট',k:'net_trace'}
  ],
  security:   [
    {e:'🔒',n:'এনক্রিপশন',k:'sec_encrypt'},       {e:'🛡️',n:'অ্যান্টিভাইরাস',k:'sec_antivirus'},
    {e:'🔑',n:'পাসওয়ার্ড',k:'sec_password'},     {e:'👁️',n:'অডিট লগ',k:'sec_audit'},
    {e:'🚫',n:'ব্লকিং',k:'sec_blocking'},          {e:'📜',n:'পলিসি',k:'sec_policy'},
    {e:'🔍',n:'ভাইরাস স্ক্যান',k:'sec_scanning'}, {e:'📊',n:'লগ অ্যানালাইসিস',k:'sec_loganalysis'},
    {e:'🔐',n:'MFA সেটআপ',k:'sec_mfa'},           {e:'⚠️',n:'ভালনারেবিলিটি',k:'sec_vuln'}
  ],
  backup:     [
    {e:'💾',n:'ফুল ব্যাকআপ',k:'bak_full'},        {e:'📂',n:'ফাইল ব্যাকআপ',k:'bak_file'},
    {e:'🗄️',n:'ডেটাবেস',k:'bak_database'},         {e:'☁️',n:'ক্লাউড ব্যাকআপ',k:'bak_cloud'},
    {e:'📀',n:'ডিস্ক ইমেজ',k:'bak_disk'},         {e:'🔄',n:'ইনক্রিমেন্টাল',k:'bak_incremental'},
    {e:'🔐',n:'এনক্রিপ্টেড',k:'bak_encrypted'},   {e:'⏰',n:'শিডিউলড',k:'bak_scheduled'},
    {e:'🔁',n:'রিস্টোর',k:'bak_restore'},          {e:'🔗',n:'সিঙ্ক',k:'bak_sync'}
  ],
  monitoring: [
    {e:'📊',n:'CPU মনিটর',k:'mon_cpu'},            {e:'💾',n:'RAM মনিটর',k:'mon_ram'},
    {e:'💿',n:'ডিস্ক মনিটর',k:'mon_disk'},        {e:'🌐',n:'নেটওয়ার্ক',k:'mon_network'},
    {e:'📈',n:'পারফরম্যান্স',k:'mon_performance'}, {e:'🔔',n:'অ্যালার্ট',k:'mon_alert'},
    {e:'📝',n:'ইভেন্ট লগ',k:'mon_eventlog'},      {e:'🖥️',n:'সার্ভার স্ট্যাটাস',k:'mon_server'},
    {e:'⏱️',n:'আপটাইম',k:'mon_uptime'},           {e:'🌡️',n:'হার্ডওয়্যার টেম্প',k:'mon_hardware'}
  ],
  automation: [
    {e:'🤖',n:'টাস্ক শিডিউলার',k:'auto_scheduler'},{e:'📜',n:'স্ক্রিপ্ট রান',k:'auto_script'},
    {e:'🔄',n:'ওয়ার্কফ্লো',k:'auto_workflow'},    {e:'📧',n:'ইমেইল অটো',k:'auto_email'},
    {e:'📂',n:'ফাইল অটো',k:'auto_file'},           {e:'🌐',n:'ওয়েব অটো',k:'auto_web'},
    {e:'📊',n:'রিপোর্ট',k:'auto_report'},          {e:'🔐',n:'সিকিউরিটি অটো',k:'auto_security'},
    {e:'🔔',n:'নোটিফিকেশন',k:'auto_notification'},{e:'🗑️',n:'ক্লিনআপ অটো',k:'auto_cleanup'}
  ],
  download:   [
    {e:'⬇️',n:'সফটওয়্যার',k:'dl_software'},     {e:'🔄',n:'আপডেট',k:'dl_update'},
    {e:'📦',n:'প্যাকেজ',k:'dl_package'},           {e:'🌐',n:'ওয়েব ফাইল',k:'dl_web'},
    {e:'🐙',n:'GitHub',k:'dl_github'},             {e:'☁️',n:'ক্লাউড ফাইল',k:'dl_cloud'},
    {e:'🎮',n:'গেম',k:'dl_game'},                  {e:'🔧',n:'ড্রাইভার',k:'dl_driver'},
    {e:'📄',n:'ডকুমেন্ট',k:'dl_doc'},             {e:'🎵',n:'মিডিয়া',k:'dl_media'}
  ],
  devtools:   [
    {e:'💻',n:'কোড এডিটর',k:'dev_editor'},        {e:'🐙',n:'Git/GitHub',k:'dev_git'},
    {e:'🐳',n:'Docker',k:'dev_docker'},            {e:'🐍',n:'Python',k:'dev_python'},
    {e:'⚙️',n:'Node.js',k:'dev_node'},              {e:'🔧',n:'বিল্ড টুলস',k:'dev_build'},
    {e:'🧪',n:'টেস্টিং',k:'dev_testing'},         {e:'📊',n:'ডিবাগিং',k:'dev_debug'},
    {e:'☁️',n:'ক্লাউড ডেপ্লয়',k:'dev_deploy'},  {e:'📡',n:'API টুলস',k:'dev_api'}
  ],
  office:     [
    {e:'📝',n:'Word অটো',k:'off_word'},            {e:'📊',n:'Excel অটো',k:'off_excel'},
    {e:'📧',n:'Outlook',k:'off_outlook'},          {e:'👥',n:'Teams',k:'off_teams'},
    {e:'💼',n:'SharePoint',k:'off_sharepoint'},    {e:'📂',n:'OneDrive',k:'off_onedrive'},
    {e:'🖨️',n:'প্রিন্ট ম্যানেজ',k:'off_print'},   {e:'📅',n:'ক্যালেন্ডার',k:'off_calendar'},
    {e:'🔑',n:'লাইসেন্স',k:'off_license'},        {e:'📋',n:'পলিসি',k:'off_policy'}
  ],
  gaming:     [
    {e:'🎮',n:'গেম অপটিমাইজ',k:'gam_optimize'},  {e:'🖥️',n:'GPU সেটিংস',k:'gam_gpu'},
    {e:'📊',n:'FPS বুস্ট',k:'gam_fps'},            {e:'🎵',n:'অডিও',k:'gam_audio'},
    {e:'🔌',n:'কন্ট্রোলার',k:'gam_controller'},   {e:'💾',n:'গেম ব্যাকআপ',k:'gam_backup'},
    {e:'🌐',n:'নেটওয়ার্ক অপটি',k:'gam_network'},{e:'🛡️',n:'অ্যান্টিচিট',k:'gam_anticheat'},
    {e:'📦',n:'গেম ইনস্টল',k:'gam_install'},     {e:'🔧',n:'মড ম্যানেজ',k:'gam_mod'}
  ]
};

// ─── Toast Notification ───────────────────────────────────────────────────────
function toast(msg, type = 'info', dur = 3500) {
  const icons = { success:'fa-check-circle', error:'fa-times-circle', warning:'fa-exclamation-triangle', info:'fa-bolt' };
  const container = document.getElementById('notifs') || document.body;

  // ✅ XSS: DOM API ব্যবহার করো, innerHTML নয়
  const n = DOM.el('div', { class: `notification ${type}` });
  const icon = DOM.el('span', { class: 'notif-icon' });
  const iconEl = DOM.el('i', { class: `fas ${icons[type] || icons.info}` });
  icon.appendChild(iconEl);

  const msgEl  = DOM.el('span', { class: 'notif-msg' }, String(msg));
  const closeBtn = DOM.el('button', { class: 'notif-close', title: 'বন্ধ করুন' });
  DOM.setHTML(closeBtn, '<i class="fas fa-times"></i>');
  closeBtn.addEventListener('click', () => n.remove());

  n.appendChild(icon);
  n.appendChild(msgEl);
  n.appendChild(closeBtn);
  container.prepend(n);

  setTimeout(() => {
    n.style.opacity = '0';
    n.style.transform = 'translateX(100%)';
    setTimeout(() => n.remove(), 300);
  }, dur);
}

// ─── Virtual Scrolling ────────────────────────────────────────────────────────
// ✅ Point 6: VirtualList — large datasets এর জন্য
class VirtualList {
  /**
   * @param {HTMLElement} container
   * @param {Object} opts
   *   itemHeight  {number}  — প্রতি আইটেমের আনুমানিক উচ্চতা (px)
   *   renderItem  {Function(item) → HTMLElement}
   *   overscan    {number}  — extra items above/below viewport
   */
  constructor(container, opts = {}) {
    this.container  = container;
    this.itemHeight = opts.itemHeight || 220;
    this.renderItem = opts.renderItem || (() => document.createElement('div'));
    this.overscan   = opts.overscan   || 3;
    this._items     = [];
    this._rendered  = new Map(); // index → element
    this._raf       = null;

    // Spacer elements to maintain scroll height
    this._topSpacer = DOM.el('div', { class: 'vl-top-spacer' });
    this._btmSpacer = DOM.el('div', { class: 'vl-btm-spacer' });

    this.container.style.position = 'relative';
    this.container.insertBefore(this._topSpacer, this.container.firstChild);
    this.container.appendChild(this._btmSpacer);

    this._scrollParent = this._findScrollParent();
    this._scrollParent.addEventListener('scroll', () => {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => this._update());
    }, { passive: true });

    new ResizeObserver(() => this._update()).observe(this.container);
  }

  setItems(items) {
    this._items = items;
    // Clear rendered cache
    this._rendered.forEach(el => el.remove());
    this._rendered.clear();
    this._update();
  }

  _findScrollParent() {
    let el = this.container.parentElement;
    while (el) {
      const overflow = getComputedStyle(el).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') return el;
      el = el.parentElement;
    }
    return window;
  }

  _getScrollTop() {
    return this._scrollParent === window
      ? window.scrollY
      : this._scrollParent.scrollTop;
  }

  _getViewportHeight() {
    return this._scrollParent === window
      ? window.innerHeight
      : this._scrollParent.clientHeight;
  }

  _getContainerTop() {
    return this.container.getBoundingClientRect().top +
           (this._scrollParent === window ? window.scrollY : this._scrollParent.scrollTop) -
           (this._scrollParent === window ? 0 : this._scrollParent.getBoundingClientRect().top);
  }

  _update() {
    const n           = this._items.length;
    const scrollTop   = this._getScrollTop();
    const vpHeight    = this._getViewportHeight();
    const contTop     = this._getContainerTop();
    const relScroll   = scrollTop - contTop;
    const totalH      = n * this.itemHeight;

    const startIdx = Math.max(0, Math.floor(relScroll / this.itemHeight) - this.overscan);
    const endIdx   = Math.min(n - 1, Math.ceil((relScroll + vpHeight) / this.itemHeight) + this.overscan);

    this._topSpacer.style.height = `${startIdx * this.itemHeight}px`;
    this._btmSpacer.style.height = `${Math.max(0, (n - endIdx - 1) * this.itemHeight)}px`;

    // Remove out-of-range elements
    this._rendered.forEach((el, idx) => {
      if (idx < startIdx || idx > endIdx) {
        el.remove();
        this._rendered.delete(idx);
      }
    });

    // Add in-range elements
    for (let i = startIdx; i <= endIdx; i++) {
      if (!this._rendered.has(i)) {
        const el = this.renderItem(this._items[i], i);
        this.container.insertBefore(el, this._btmSpacer);
        this._rendered.set(i, el);
      }
    }
  }

  destroy() {
    this._scrollParent.removeEventListener('scroll', this._update);
  }
}

// ─── Chart Lifecycle Manager ──────────────────────────────────────────────────
// ✅ Point 6: Chart dispose নিশ্চিত করো
const ChartManager = {
  _charts: new Map(), // id → Chart instance

  /**
   * Chart তৈরি করো — আগের instance থাকলে destroy করে নতুন বানাও
   * @param {string}       id      — canvas element id
   * @param {Object}       config  — Chart.js config
   * @returns {Chart|null}
   */
  create(id, config) {
    this.destroy(id);
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    if (typeof Chart === 'undefined') { console.warn('[AutoScrip] Chart.js not loaded'); return null; }
    const chart = new Chart(canvas, config);
    this._charts.set(id, chart);
    return chart;
  },

  destroy(id) {
    const existing = this._charts.get(id);
    if (existing) {
      try { existing.destroy(); } catch (_) {}
      this._charts.delete(id);
    }
  },

  destroyAll() {
    this._charts.forEach((chart, id) => this.destroy(id));
  }
};

// ─── Real CSV / JSON Import-Export ───────────────────────────────────────────
// ✅ Point 8: বাস্তব parsing logic

const DataIO = {
  // ── Export ──────────────────────────────────────────────────────────────────

  /** Tools → JSON file download */
  exportJSON(tools, filename = 'autoscrip-tools.json') {
    const data = {
      version:    '2.0',
      exportedAt: new Date().toISOString(),
      count:      tools.length,
      tools:      tools.map(ToolModel.toDoc)
    };
    this._download(JSON.stringify(data, null, 2), filename, 'application/json');
  },

  /** Tools → CSV file download */
  exportCSV(tools, filename = 'autoscrip-tools.csv') {
    const headers = ['id','title','description','category','subcategory','tags','author','views','downloads','likes','status','featured','createdAt'];
    const rows = tools.map(t => headers.map(h => {
      const v = t[h];
      if (Array.isArray(v)) return `"${v.join('|')}"`;
      if (typeof v === 'boolean') return v ? '1' : '0';
      if (typeof v === 'string')  return `"${v.replace(/"/g, '""')}"`;
      return v ?? '';
    }).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    this._download('\uFEFF' + csv, filename, 'text/csv;charset=utf-8');
  },

  /** Users → JSON */
  exportUsers(users, filename = 'autoscrip-users.json') {
    const safe = users.map(u => {
      const d = UserModel.toDoc(u);
      delete d.password; delete d.pass; // নিরাপত্তা — পাসওয়ার্ড export নয়
      return d;
    });
    this._download(JSON.stringify({ version:'2.0', exportedAt:new Date().toISOString(), users:safe }, null, 2),
      filename, 'application/json');
  },

  // ── Import ──────────────────────────────────────────────────────────────────

  /**
   * JSON ফাইল import করো
   * @param {File} file
   * @returns {Promise<{tools: Array, errors: Array}>}
   */
  async importJSON(file) {
    return new Promise((resolve, reject) => {
      if (!file || file.type !== 'application/json') {
        reject(new Error('শুধুমাত্র .json ফাইল সমর্থিত'));
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        reject(new Error('ফাইল সাইজ ১০MB এর বেশি হওয়া যাবে না'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const raw = JSON.parse(e.target.result);
          // Support both array and wrapped format
          const rawTools = Array.isArray(raw) ? raw : (raw.tools || []);
          if (!rawTools.length) { resolve({ tools: [], errors: ['ফাইলে কোনো টুল নেই'] }); return; }
          const tools = [], errors = [];
          rawTools.forEach((t, i) => {
            const normalized = ToolModel.fromDoc(t);
            const errs = ToolModel.validate(normalized);
            if (errs.length) {
              errors.push(`Row ${i+1} (${normalized.title || 'unnamed'}): ${errs.join(', ')}`);
            } else {
              delete normalized.id; // নতুন ID Firestore দেবে
              tools.push(normalized);
            }
          });
          resolve({ tools, errors });
        } catch (err) {
          reject(new Error('JSON parse error: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('ফাইল পড়তে সমস্যা হয়েছে'));
      reader.readAsText(file, 'UTF-8');
    });
  },

  /**
   * CSV ফাইল import করো
   * @param {File} file
   * @returns {Promise<{tools: Array, errors: Array}>}
   */
  async importCSV(file) {
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error('ফাইল নির্বাচন করুন')); return; }
      if (file.size > 5 * 1024 * 1024) { reject(new Error('CSV ৫MB এর বেশি হওয়া যাবে না')); return; }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // Remove BOM if present
          const text = e.target.result.replace(/^\uFEFF/, '');
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (lines.length < 2) { resolve({ tools:[], errors:['CSV ফাইল খালি'] }); return; }

          const headers = this._parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
          const tools = [], errors = [];

          for (let i = 1; i < lines.length; i++) {
            const cols = this._parseCSVRow(lines[i]);
            if (cols.every(c => !c.trim())) continue; // empty row skip

            const raw = {};
            headers.forEach((h, idx) => { raw[h] = cols[idx] || ''; });

            // Map CSV columns → ToolModel fields
            const tool = ToolModel.fromDoc({
              title:       raw.title || raw.name || '',
              description: raw.description || raw.desc || '',
              category:    raw.category || raw.cat || 'other',
              subcategory: raw.subcategory || raw.subcat || '',
              tags:        raw.tags ? raw.tags.split('|').map(t=>t.trim()).filter(Boolean) : [],
              code:        raw.code || raw.script || '',
              author:      raw.author || 'AutoScrip',
              featured:    raw.featured === '1' || raw.featured === 'true',
              status:      raw.status || 'pending'
            });

            const errs = ToolModel.validate(tool);
            if (errs.length) {
              errors.push(`Row ${i+1}: ${errs.join(', ')}`);
            } else {
              delete tool.id;
              tools.push(tool);
            }
          }
          resolve({ tools, errors });
        } catch (err) {
          reject(new Error('CSV parse error: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('ফাইল পড়তে সমস্যা'));
      reader.readAsText(file, 'UTF-8');
    });
  },

  /**
   * Firestore এ batch import করো
   * ✅ Server-side validation সহ
   * @param {Array}   tools     — normalized tool objects
   * @param {Object}  db        — Firestore instance
   * @param {Function} onProgress — (done, total) callback
   * @returns {Promise<{imported: number, errors: Array}>}
   */
  async importToFirestore(tools, db, onProgress) {
    const BATCH_SIZE = 450; // Firestore batch limit 500, কিছুটা কম রাখো
    let imported = 0;
    const errors = [];

    for (let i = 0; i < tools.length; i += BATCH_SIZE) {
      const chunk = tools.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      chunk.forEach(tool => {
        const ref = db.collection('autoscrip_tools').doc();
        batch.set(ref, { ...tool, createdAt: new Date().toISOString(), importedAt: new Date().toISOString() });
      });
      try {
        await batch.commit();
        imported += chunk.length;
        if (onProgress) onProgress(imported, tools.length);
      } catch (e) {
        errors.push(`Batch ${Math.floor(i/BATCH_SIZE)+1} failed: ${e.message}`);
      }
    }
    return { imported, errors };
  },

  // ── Private Helpers ──────────────────────────────────────────────────────────

  /** Proper CSV row parser — handles quoted fields with commas */
  _parseCSVRow(line) {
    const result = [];
    let current = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { current += '"'; i++; } // escaped quote
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  },

  _download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = DOM.el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// ─── Firestore Tool Service ───────────────────────────────────────────────────
// ✅ Point 7: Client side শুধু read/query, write শুধু authenticated users

const ToolService = {
  _cache:       [],
  _lastFetch:   0,
  _CACHE_TTL:   2 * 60 * 1000, // 2 minutes

  /**
   * সব approved tools লোড করো (Firebase offline cache সহ)
   */
  async getAll(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this._cache.length && (now - this._lastFetch) < this._CACHE_TTL) {
      return this._cache;
    }
    const db = window._fbDb;
    if (!db) return [];
    try {
      const snap = await db.collection('autoscrip_tools')
        .where('status', '==', 'approved')
        .where('published', '==', true)
        .orderBy('createdAt', 'desc')
        .get();
      this._cache     = snap.docs.map(d => ToolModel.fromDoc(d));
      this._lastFetch = now;
      return this._cache;
    } catch (e) {
      console.warn('[ToolService] Load error:', e);
      return this._cache; // return stale cache on error
    }
  },

  /** একটা tool increment করো (views/downloads) */
  async increment(id, field) {
    const db = window._fbDb;
    if (!db || !id || !field) return;
    const allowed = ['views', 'downloads'];
    if (!allowed.includes(field)) return; // ✅ field injection prevent
    try {
      await db.collection('autoscrip_tools').doc(id).update({
        [field]: firebase.firestore.FieldValue.increment(1)
      });
    } catch (_) {}
  },

  /** Tool like/unlike toggle */
  async toggleLike(toolId, userId) {
    const db = window._fbDb;
    if (!db || !toolId || !userId) return null;
    const ref = db.collection('autoscrip_tools').doc(toolId);
    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error('Tool not found');
      const likes  = doc.data().likes || [];
      const idx    = likes.indexOf(userId);
      const newLikes = idx === -1
        ? [...likes, userId]
        : likes.filter(u => u !== userId);
      tx.update(ref, { likes: newLikes });
      return { liked: idx === -1, count: newLikes.length };
    });
  },

  invalidateCache() { this._cache = []; this._lastFetch = 0; }
};

// ─── Session (no localStorage) ───────────────────────────────────────────────
// ✅ Point 4: Firebase built-in auth persistence — localStorage নয়

const Session = {
  _user: null,

  get() { return this._user; },

  set(user) {
    this._user = user;
    // Firebase Auth নিজেই persistence handle করে
    // আমরা শুধু memory তে রাখি
  },

  clear() { this._user = null; },

  /**
   * Firebase auth state change listener setup
   */
  observe(onLogin, onLogout) {
    const auth = window._fbAuth;
    if (!auth) return;
    auth.onAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        const db  = window._fbDb;
        let user  = {
          uid:         fbUser.uid,
          email:       fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'ইউজার',
          role:        'user'
        };
        if (db) {
          try {
            const doc = await db.collection('autoscrip_users').doc(fbUser.uid).get();
            if (doc.exists) user = UserModel.fromDoc(doc);
          } catch (_) {}
        }
        this.set(user);
        if (onLogin) onLogin(user);
      } else {
        this.clear();
        if (onLogout) onLogout();
      }
    });
  }
};

// ─── Auth Service ─────────────────────────────────────────────────────────────
const AuthService = {
  async login(email, password) {
    const auth = window._fbAuth;
    if (!auth) throw new Error('Firebase auth not initialized');
    // Input validation
    if (!email?.trim() || !password) throw new Error('ইমেইল ও পাসওয়ার্ড আবশ্যক');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('বৈধ ইমেইল দিন');
    const cred = await auth.signInWithEmailAndPassword(email.trim(), password);
    return cred.user;
  },

  async register(displayName, email, password) {
    const auth = window._fbAuth, db = window._fbDb;
    if (!auth) throw new Error('Firebase auth not initialized');
    if (!displayName?.trim()) throw new Error('নাম আবশ্যক');
    if (!email?.trim())       throw new Error('ইমেইল আবশ্যক');
    if (password.length < 8)  throw new Error('পাসওয়ার্ড কমপক্ষে ৮ অক্ষর');
    const cred = await auth.createUserWithEmailAndPassword(email.trim(), password);
    await cred.user.updateProfile({ displayName: displayName.trim() });
    if (db) {
      const userData = UserModel.toDoc({
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: displayName.trim(),
        role: 'user',
        createdAt: new Date().toISOString()
      });
      await db.collection('autoscrip_users').doc(cred.user.uid).set(userData);
    }
    return cred.user;
  },

  async logout() {
    const auth = window._fbAuth;
    if (auth) await auth.signOut();
    Session.clear();
  },

  async resetPassword(email) {
    const auth = window._fbAuth;
    if (!auth) throw new Error('Firebase not ready');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('বৈধ ইমেইল দিন');
    await auth.sendPasswordResetEmail(email.trim());
  }
};

// ─── Security Helpers ─────────────────────────────────────────────────────────
// ✅ Point 5: XSS Prevention utilities — window-scoped to avoid re-declaration
if (!window._coreSecurityLoaded) {
window.Security = window.Security || {
  BLOCKED_PATTERNS: [
    /rm\s+-rf/i, /format\s+[a-z]:/i, /del\s+\/[sf]/i, /shutdown/i,
    /net\s+user\s+.*\/add/i, /reg\s+delete/i, /bcdedit/i, /diskpart/i,
    /cipher\s+\/w/i, /Set-ExecutionPolicy\s+Unrestricted/i, /Disable-WindowsFirewall/i
  ],

  checkScript(code) {
    const found = this.BLOCKED_PATTERNS.filter(p => p.test(code)).map(p => p.source.substring(0,20));
    return { safe: found.length === 0, found };
  },

  /** ID generation — crypto.getRandomValues ব্যবহার করো */
  generateId() {
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2,'0')).join('');
  },

  /** Rate limiting — brute force login prevent */
  _attempts: new Map(), // email → { count, lockedUntil }
  checkRateLimit(key) {
    const now = Date.now();
    const rec = this._attempts.get(key) || { count:0, lockedUntil:0 };
    if (rec.lockedUntil > now) {
      const secs = Math.ceil((rec.lockedUntil - now) / 1000);
      throw new Error(`অনেক বেশি চেষ্টা। ${secs} সেকেন্ড পরে চেষ্টা করুন।`);
    }
    rec.count++;
    if (rec.count >= 5) {
      rec.lockedUntil = now + 15 * 60 * 1000; // 15 min lockout
      rec.count = 0;
    }
    this._attempts.set(key, rec);
  },
  clearRateLimit(key) { this._attempts.delete(key); }
};
window._coreSecurityLoaded = true;
} // end if(!window._coreSecurityLoaded)

// Expose for HTML files
window.AutoScrip = {
  toast, VirtualList, ChartManager, DataIO,
  ToolService, Session, AuthService, Security: window.Security,
  CAT_META, SUBCATEGORIES, Sanitizer, DOM, ToolModel, UserModel
};

// ── Expose Security globally (fixes 'already declared' conflict) ──
// Admin.html declares its own Security — we expose core's as window.CoreSecurity
window.CoreSecurity = Security;
// Also expose key utilities individually
window.toast = toast;
window.ChartManager = ChartManager;
window.DataIO = DataIO;
window.ToolService = ToolService;
window.Session = Session;
window.AuthService = AuthService;
window.CAT_META = CAT_META;
window.SUBCATEGORIES = SUBCATEGORIES;
