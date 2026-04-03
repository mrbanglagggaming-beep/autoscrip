/**
 * AutoScrip Admin — JavaScript Module
 * ======================================
 * ✅ Point 2:  Admin JS আলাদা ফাইলে
 * ✅ Point 6:  Chart dispose নিশ্চিত
 * ✅ Point 7:  Client side শুধু প্রয়োজনীয় operations
 * ✅ Point 8:  CSV/JSON import Firestore batch write সহ
 */


  initFirebase, isAdmin, AdminCache,
  Sanitizer, DOM
} from './firebase-config.js';


  toast, ChartManager, DataIO,
  ToolService, Session, AuthService, Security, CAT_META, SUBCATEGORIES, ToolModel, UserModel
} from './core.js';

// ─── Admin State ──────────────────────────────────────────────────────────────
const AdminState = {
  user:         null,
  tools:        [],
  users:        [],
  requests:     [],
  notifications: [],
  stats:        { tools:0, users:0, requests:0, views:0 },
  currentPage:  'dashboard',
  filters:      { cat:'', status:'', search:'' }
};

// ─── Admin Auth ───────────────────────────────────────────────────────────────
async function adminLogin(email, password) {
  const emailEl = DOM.$('#loginEmail');
  const passEl  = DOM.$('#loginPass');
  const errEl   = DOM.$('#loginErr');
  const btn     = DOM.$('#loginBtn');

  if (errEl) errEl.style.display = 'none';
  if (!email || !password) { showErr(errEl, 'ইমেইল ও পাসওয়ার্ড দিন'); return; }

  // ✅ Rate limit check
  try { Security.checkRateLimit(email); } catch (e) { showErr(errEl, e.message); return; }

  if (btn) btn.classList.add('btn-loading');
  try {
    const fbUser = await AuthService.login(email, password);
    // ✅ Point 1: Firestore থেকে admin role যাচাই
    const adminStatus = await AdminCache.check(fbUser.uid);
    if (!adminStatus) {
      await AuthService.logout();
      showErr(errEl, '⛔ আপনার অ্যাডমিন অ্যাক্সেস নেই।');
      return;
    }
    Security.clearRateLimit(email);
    sessionStorage.setItem('adminToken', 'firebase_' + fbUser.uid);
    toast('✅ অ্যাডমিন লগইন সফল!', 'success');
    document.getElementById('loginPage')?.style.setProperty('display', 'none');
    document.getElementById('mainApp')?.style.setProperty('display', 'block');
    await loadDashboard();
  } catch (e) {
    const msg = e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password'
      ? 'ইমেইল বা পাসওয়ার্ড ভুল!'
      : e.message || 'লগইন ব্যর্থ';
    showErr(errEl, msg);
  } finally {
    if (btn) btn.classList.remove('btn-loading');
  }
}

async function adminLogout() {
  await AuthService.logout();
  AdminCache.invalidate(AdminState.user?.uid);
  sessionStorage.removeItem('adminToken');
  ChartManager.destroyAll(); // ✅ Chart dispose on logout
  AdminState.user = null;
  AdminState.tools = [];
  document.getElementById('mainApp')?.style.setProperty('display', 'none');
  document.getElementById('loginPage')?.style.setProperty('display', 'flex');
  toast('লগআউট হয়েছে', 'info');
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const db   = window._fbDb;
  const user = AdminState.user;
  if (!db || !user) return;

  try {
    // Parallel fetches
    const [toolsSnap, usersSnap, reqSnap] = await Promise.all([
      db.collection('autoscrip_tools').get(),
      db.collection('autoscrip_users').get(),
      db.collection('autoscrip_requests').where('status','==','pending').get()
    ]);

    AdminState.stats = {
      tools:    toolsSnap.size,
      users:    usersSnap.size,
      requests: reqSnap.size,
      views:    toolsSnap.docs.reduce((acc, d) => acc + (d.data().views || 0), 0)
    };

    // Update stat cards
    const setStatEl = (id, val) => { const el = DOM.$('#' + id); if (el) DOM.setText(el, val); };
    setStatEl('statTools',    AdminState.stats.tools);
    setStatEl('statUsers',    AdminState.stats.users);
    setStatEl('statRequests', AdminState.stats.requests);
    setStatEl('statViews',    AdminState.stats.views.toLocaleString('bn-BD'));

    // Tools
    AdminState.tools = toolsSnap.docs.map(d => ToolModel.fromDoc(d));
    renderToolsTable(AdminState.tools);

    // Charts
    renderCharts(toolsSnap.docs);

    // Recent activity
    renderRecentActivity(toolsSnap.docs.slice(0, 8));

  } catch (e) {
    toast('ড্যাশবোর্ড লোডে সমস্যা: ' + e.message, 'error');
  }
}

// ─── Tool Table ───────────────────────────────────────────────────────────────
function renderToolsTable(tools) {
  const tbody = DOM.$('#toolsTableBody');
  if (!tbody) return;

  // Filter
  const { cat, status, search } = AdminState.filters;
  let filtered = tools;
  if (cat)    filtered = filtered.filter(t => t.category === cat);
  if (status) filtered = filtered.filter(t => t.status   === status);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.author.toLowerCase().includes(q)
    );
  }

  tbody.textContent = ''; // clear — textContent is safe
  if (!filtered.length) {
    const tr = DOM.el('tr');
    const td = DOM.el('td', { colspan:'7', style:'text-align:center;padding:30px;color:var(--muted)' },
      'কোনো টুল পাওয়া যায়নি');
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  filtered.forEach(tool => {
    const tr = DOM.el('tr');

    // ✅ DOM API — innerHTML নয়
    const cells = [
      createTitleCell(tool),
      createTextCell(CAT_META[tool.category]?.label || tool.category),
      createTextCell(tool.author),
      createStatusBadge(tool.status),
      createTextCell(tool.views.toLocaleString('bn-BD')),
      createTextCell(new Date(tool.createdAt).toLocaleDateString('bn-BD')),
      createActionsCell(tool)
    ];

    cells.forEach(td => tr.appendChild(td));
    tbody.appendChild(tr);
  });
}

function createTitleCell(tool) {
  const td    = document.createElement('td');
  const title = DOM.el('div', { style:'font-weight:700;color:var(--text)' }, tool.title);
  const desc  = DOM.el('div', { style:'font-size:.75rem;color:var(--muted);margin-top:2px' },
    (tool.description || '').substring(0, 60));
  td.appendChild(title);
  td.appendChild(desc);
  return td;
}

function createTextCell(text) {
  const td = document.createElement('td');
  DOM.setText(td, String(text ?? ''));
  return td;
}

function createStatusBadge(status) {
  const td  = document.createElement('td');
  const map = { approved:'success', pending:'warning', rejected:'danger' };
  const badge = DOM.el('span', { class: `badge badge-${map[status] || 'info'}` }, status);
  td.appendChild(badge);
  return td;
}

function createActionsCell(tool) {
  const td = document.createElement('td');

  if (tool.status === 'pending') {
    const approveBtn = DOM.el('button', {
      class: 'btn btn-success btn-sm',
      onclick: () => updateToolStatus(tool.id, 'approved')
    }, '✓ অনুমোদন');

    const rejectBtn = DOM.el('button', {
      class: 'btn btn-danger btn-sm',
      style: { marginLeft:'6px' },
      onclick: () => updateToolStatus(tool.id, 'rejected')
    }, '✗ প্রত্যাখ্যান');

    td.appendChild(approveBtn);
    td.appendChild(rejectBtn);
  }

  const deleteBtn = DOM.el('button', {
    class: 'btn btn-ghost btn-sm',
    style: { marginLeft:'6px' },
    onclick: () => deleteTool(tool.id, tool.title)
  });
  DOM.setHTML(deleteBtn, '<i class="fas fa-trash"></i>');
  td.appendChild(deleteBtn);
  return td;
}

// ─── Tool CRUD ────────────────────────────────────────────────────────────────
async function updateToolStatus(id, status) {
  // ✅ Point 7: client-side শুধু Firestore write — validate করো
  if (!['approved','rejected','pending'].includes(status)) return;
  const db = window._fbDb;
  if (!db) return;
  try {
    await db.collection('autoscrip_tools').doc(id).update({
      status,
      updatedAt:   new Date().toISOString(),
      reviewedBy:  AdminState.user?.uid,
      reviewedAt:  new Date().toISOString()
    });
    const tool = AdminState.tools.find(t => t.id === id);
    if (tool) tool.status = status;
    renderToolsTable(AdminState.tools);
    toast(status === 'approved' ? '✅ টুল অনুমোদিত' : '⛔ টুল প্রত্যাখ্যাত', status === 'approved' ? 'success' : 'warning');
  } catch (e) {
    toast('আপডেট ব্যর্থ: ' + e.message, 'error');
  }
}

async function deleteTool(id, title) {
  if (!confirm(`"${title}" মুছে ফেলবেন?`)) return;
  const db = window._fbDb;
  if (!db) return;
  try {
    await db.collection('autoscrip_tools').doc(id).delete();
    AdminState.tools = AdminState.tools.filter(t => t.id !== id);
    renderToolsTable(AdminState.tools);
    toast('🗑️ টুল মুছে ফেলা হয়েছে', 'success');
  } catch (e) {
    toast('মুছতে সমস্যা: ' + e.message, 'error');
  }
}

// ─── Tool Form (Add/Edit) ─────────────────────────────────────────────────────
function getToolFormData() {
  const getValue = id => (DOM.$('#' + id)?.value?.trim() || '');
  return {
    title:       getValue('toolTitle'),
    description: getValue('toolDesc'),
    category:    getValue('toolCat'),
    subcategory: getValue('toolSubcat'),
    tags:        getValue('toolTags').split(',').map(t=>t.trim()).filter(Boolean),
    code:        getValue('toolCode'),
    author:      getValue('toolAuthor') || (AdminState.user?.displayName || 'AutoScrip'),
    authorId:    AdminState.user?.uid || '',
    youtube:     getValue('toolYouTube'),
    featured:    DOM.$('#toolFeatured')?.checked || false,
    status:      'approved', // Admin adds → auto approved
    published:   true
  };
}

async function saveTool(editId = null) {
  const data   = getToolFormData();
  const errors = ToolModel.validate(data);
  if (errors.length) { toast(errors.join(', '), 'warning'); return; }

  const db  = window._fbDb;
  if (!db) { toast('Firebase সংযুক্ত নয়', 'error'); return; }

  const btn = DOM.$('#saveToolBtn');
  if (btn) btn.classList.add('btn-loading');
  try {
    if (editId) {
      await db.collection('autoscrip_tools').doc(editId).update({ ...ToolModel.toDoc(data), updatedAt: new Date().toISOString() });
      toast('✅ টুল আপডেট হয়েছে', 'success');
    } else {
      const docRef = await db.collection('autoscrip_tools').add({ ...ToolModel.toDoc(data), createdAt: new Date().toISOString() });
      toast('✅ টুল যোগ হয়েছে', 'success');
    }
    ToolService.invalidateCache();
    await loadDashboard();
    closeToolForm();
  } catch (e) {
    toast('সেভ ব্যর্থ: ' + e.message, 'error');
  } finally {
    if (btn) btn.classList.remove('btn-loading');
  }
}

function closeToolForm() {
  const modal = DOM.$('#toolModal');
  if (modal) modal.classList.remove('show');
}

// ─── Charts ───────────────────────────────────────────────────────────────────
// ✅ Point 6: চার্ট ডিসপোজ ChartManager দিয়ে নিশ্চিত করো

function renderCharts(toolDocs) {
  // Category distribution
  const catCounts = {};
  toolDocs.forEach(d => {
    const cat = d.data().category || 'other';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  ChartManager.create('catChart', {
    type: 'doughnut',
    data: {
      labels:   Object.keys(catCounts).map(k => CAT_META[k]?.label || k),
      datasets: [{
        data:            Object.values(catCounts),
        backgroundColor: ['#6366f1','#8b5cf6','#10b981','#ef4444','#f59e0b',
                          '#0ea5e9','#ec4899','#06b6d4','#84cc16','#f97316'],
        borderWidth: 2, borderColor: '#1a1f2e'
      }]
    },
    options: {
      plugins: { legend:{ labels:{ color:'#e2e8f5', font:{size:12} } } },
      responsive: true, maintainAspectRatio: false
    }
  });

  // Status pie
  const statusCounts = { approved:0, pending:0, rejected:0 };
  toolDocs.forEach(d => { const s = d.data().status || 'pending'; statusCounts[s]++; });

  ChartManager.create('statusChart', {
    type: 'pie',
    data: {
      labels:   ['অনুমোদিত', 'অপেক্ষমান', 'প্রত্যাখ্যাত'],
      datasets: [{
        data:            [statusCounts.approved, statusCounts.pending, statusCounts.rejected],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 2, borderColor: '#1a1f2e'
      }]
    },
    options: { plugins:{ legend:{ labels:{ color:'#e2e8f5' } } }, responsive:true, maintainAspectRatio:false }
  });

  // Monthly uploads (last 6 months)
  const monthly = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthly[key] = 0;
  }
  toolDocs.forEach(d => {
    const created = d.data().createdAt;
    if (!created) return;
    const key = created.substring(0, 7);
    if (key in monthly) monthly[key]++;
  });

  ChartManager.create('monthlyChart', {
    type: 'bar',
    data: {
      labels:   Object.keys(monthly),
      datasets: [{
        label:           'নতুন টুল',
        data:            Object.values(monthly),
        backgroundColor: 'rgba(99,102,241,.7)',
        borderColor:     '#6366f1',
        borderWidth:     1, borderRadius:6
      }]
    },
    options: {
      scales: {
        x: { ticks:{ color:'#7a8aab' }, grid:{ color:'rgba(42,51,71,.5)' } },
        y: { ticks:{ color:'#7a8aab', stepSize:1 }, grid:{ color:'rgba(42,51,71,.5)' } }
      },
      plugins:{ legend:{ display:false } },
      responsive:true, maintainAspectRatio:false
    }
  });
}

// ─── Recent Activity ──────────────────────────────────────────────────────────
function renderRecentActivity(toolDocs) {
  const container = DOM.$('#recentActivity');
  if (!container) return;
  container.textContent = '';

  toolDocs.forEach(doc => {
    const t  = ToolModel.fromDoc(doc);
    const el = DOM.el('div', {
      class: 'activity-item',
      style: {
        display:'flex', alignItems:'center', gap:'12px',
        padding:'10px 0', borderBottom:'1px solid var(--border-dim)'
      }
    });
    const icon = DOM.el('div', {
      style: { width:'36px', height:'36px', borderRadius:'10px',
               background:'rgba(99,102,241,.12)', display:'flex',
               alignItems:'center', justifyContent:'center',
               fontSize:'1rem', flexShrink:'0' }
    }, CAT_META[t.category]?.label?.split(' ')[0] || '🔧');

    const info  = DOM.el('div', { style:{ flex:'1', minWidth:'0' } });
    const title = DOM.el('div', { style:'font-weight:600;font-size:.88rem;color:var(--text)' }, t.title);
    const meta  = DOM.el('div', { style:'font-size:.75rem;color:var(--muted);margin-top:2px' },
      `${t.author} · ${new Date(t.createdAt).toLocaleDateString('bn-BD')}`);
    const badge = DOM.el('span', { class:`badge badge-${t.status === 'approved' ? 'success' : t.status === 'pending' ? 'warning' : 'danger'}` }, t.status);

    info.appendChild(title); info.appendChild(meta);
    el.appendChild(icon); el.appendChild(info); el.appendChild(badge);
    container.appendChild(el);
  });
}

// ─── Import UI ────────────────────────────────────────────────────────────────
// ✅ Point 8: Real import flow
async function handleImportFile(file) {
  if (!file) { toast('ফাইল নির্বাচন করুন', 'warning'); return; }
  const db = window._fbDb;
  if (!db)  { toast('Firebase সংযুক্ত নয়', 'error');   return; }

  const progressEl = DOM.$('#importProgress');
  const resultEl   = DOM.$('#importResult');

  try {
    let result;
    if (file.name.endsWith('.csv')) {
      result = await DataIO.importCSV(file);
    } else if (file.name.endsWith('.json')) {
      result = await DataIO.importJSON(file);
    } else {
      toast('শুধু .json বা .csv ফাইল সমর্থিত', 'warning');
      return;
    }

    const { tools, errors } = result;

    if (errors.length) {
      if (resultEl) {
        DOM.setText(resultEl, `⚠️ ${errors.length}টি row এ সমস্যা:`);
        resultEl.style.display = 'block';
        errors.slice(0, 5).forEach(err => {
          const li = DOM.el('div', { style:'color:var(--warning);font-size:.8rem;margin-top:4px' }, err);
          resultEl.appendChild(li);
        });
      }
    }

    if (!tools.length) { toast('কোনো valid টুল পাওয়া যায়নি', 'warning'); return; }

    if (!confirm(`${tools.length}টি টুল Firestore এ import করবেন?`)) return;

    const btn = DOM.$('#importBtn');
    if (btn) btn.classList.add('btn-loading');

    const { imported, errors: importErrors } = await DataIO.importToFirestore(
      tools, db,
      (done, total) => {
        if (progressEl) DOM.setText(progressEl, `${done}/${total} import হয়েছে...`);
      }
    );

    toast(`✅ ${imported}টি টুল import হয়েছে!`, 'success');
    if (importErrors.length) toast(`⚠️ ${importErrors.length}টি batch ব্যর্থ`, 'warning');
    ToolService.invalidateCache();
    await loadDashboard();

    if (btn) btn.classList.remove('btn-loading');
  } catch (e) {
    toast('Import ব্যর্থ: ' + e.message, 'error');
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportTools(format = 'json') {
  const tools = AdminState.tools;
  if (!tools.length) { toast('কোনো টুল নেই', 'warning'); return; }
  if (format === 'csv') {
    DataIO.exportCSV(tools);
    toast(`📄 CSV export হয়েছে (${tools.length} টুল)`, 'success');
  } else {
    DataIO.exportJSON(tools);
    toast(`📦 JSON export হয়েছে (${tools.length} টুল)`, 'success');
  }
}

// ─── Filter Helpers ───────────────────────────────────────────────────────────
function setFilter(key, value) {
  AdminState.filters[key] = value;
  renderToolsTable(AdminState.tools);
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function showErr(el, msg) {
  if (!el) { toast(msg, 'error'); return; }
  DOM.setText(el, msg);
  el.style.display = 'block';
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initAdmin() {
  const { auth, db } = initFirebase() || {};
  if (!auth || !db) {
    toast('Firebase initialize হয়নি — config চেক করুন', 'error');
    return;
  }

  // ✅ Firebase auth state observer — session restore
  Session.observe(async (user) => {
    const adminOk = await AdminCache.check(user.uid);
    if (!adminOk) {
      await AuthService.logout();
      DOM.$('#loginPage')?.style.setProperty('display','flex');
      DOM.$('#mainApp')?.style.setProperty('display','none');
      return;
    }
    AdminState.user = user;
    DOM.$('#loginPage')?.style.setProperty('display','none');
    DOM.$('#mainApp')?.style.setProperty('display','block');
    DOM.$('#adminName')    && DOM.setText(DOM.$('#adminName'), user.displayName);
    DOM.$('#adminEmail')   && DOM.setText(DOM.$('#adminEmail'), user.email);
    await loadDashboard();
  }, () => {
    AdminState.user = null;
    DOM.$('#loginPage')?.style.setProperty('display','flex');
    DOM.$('#mainApp')?.style.setProperty('display','none');
  });

  // Bind global functions for HTML onclick attributes
  window.adminLogin        = adminLogin;
  window.adminLogout       = adminLogout;
  window.saveTool          = saveTool;
  window.deleteTool        = deleteTool;
  window.updateToolStatus  = updateToolStatus;
  window.setFilter         = setFilter;
  window.exportTools       = exportTools;
  window.handleImportFile  = handleImportFile;
  window.loadDashboard     = loadDashboard;

  // Cleanup charts on page unload
  window.addEventListener('beforeunload', () => ChartManager.destroyAll());
}

// ─── Start ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initAdmin);
