/**
 * AutoScrip Admin — admin.js (FIXED v3)
 * ========================================
 * ✅ FIX 1: saveTool() — Firestore-এ সেভ, localStorage নয়
 * ✅ FIX 2: editTool() — subcategory লোড হবে
 * ✅ FIX 3: loadTools() — মাত্র ১ বার কল, 5 min cache
 * ✅ FIX 4: loadYoutubeVideos() — Firestore + fallback
 * ✅ FIX 5: Quota exceeded handling
 * ✅ FIX 6: No setInterval loops for data loading
 */

'use strict';

// ══════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════
const AdminState = {
  user:       null,
  tools:      [],
  users:      [],
  requests:   [],
  charts:     {},
  ytVideos:   [],
  customCats: [],
  biSubData:  {},
  selectedTools: [],

  // ✅ FIX: Tools cache — quota prevent করতে
  _toolsCache:    null,
  _toolsCacheTs:  0,
  _TOOLS_TTL:     5 * 60 * 1000, // 5 minutes
  _toolsFetching: false,
};

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const getVal = (id, def='') => $(id)?.value?.trim() ?? def;
const setVal = (id, v) => { const e=$(id); if(e) e.value = v ?? ''; };
const DB  = () => window._fbDb;
const TS  = () => firebase.firestore.FieldValue.serverTimestamp();
const INC = n => firebase.firestore.FieldValue.increment(n ?? 1);
const docSnap = snap => snap.docs.map(d => ({ id:d.id, _id:d.id, ...d.data() }));
const fmtDate = v => {
  if(!v) return '—';
  try { const d = v?.toDate ? v.toDate() : new Date(v); return isNaN(d) ? '—' : d.toLocaleDateString('bn-BD', {day:'numeric',month:'short',year:'numeric'}); }
  catch { return '—'; }
};

// ══════════════════════════════════════════════════════════════════
// LOAD TOOLS — ✅ FIX: 5 min cache, no loop, Firestore only
// ══════════════════════════════════════════════════════════════════
async function loadTools(forceRefresh = false) {
  const db = DB(); if(!db) { toast('Firebase সংযুক্ত নয়','error'); return; }

  // ✅ FIX: Cache check — quota prevent
  const now = Date.now();
  if (!forceRefresh && AdminState._toolsCache &&
      (now - AdminState._toolsCacheTs) < AdminState._TOOLS_TTL) {
    AdminState.tools = AdminState._toolsCache;
    renderToolsTable(AdminState.tools);
    return;
  }

  // ✅ FIX: Prevent concurrent fetches
  if (AdminState._toolsFetching) return;
  AdminState._toolsFetching = true;

  const tb = $('toolsTb');
  if(tb) tb.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:30px"><i class="fas fa-spinner fa-spin"></i> লোড হচ্ছে...</td></tr>';

  try {
    // ✅ FIX: Quota check
    if(window._fbQuotaUntil && Date.now() < window._fbQuotaUntil) {
      toast('Firebase quota limit — কিছুক্ষণ পরে চেষ্টা করুন','warning');
      if(AdminState._toolsCache) {
        AdminState.tools = AdminState._toolsCache;
        renderToolsTable(AdminState.tools);
      }
      return;
    }

    // Simple get() — no composite index needed
    const snap = await db.collection('autoscrip_tools').get();
    const tools = docSnap(snap).sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));

    // Update cache
    AdminState.tools        = tools;
    AdminState._toolsCache  = tools;
    AdminState._toolsCacheTs = Date.now();

    renderToolsTable(tools);
    const tc = $('toolCount'); if(tc) tc.textContent = tools.length;
    updateAllCategorySelects();

  } catch(e) {
    // ✅ FIX: Quota exceeded
    if(e.code === 'resource-exhausted' || (e.message||'').includes('Quota')) {
      window._fbQuotaUntil = Date.now() + 60000;
      toast('Firebase quota limit! ৬০ সেকেন্ড পরে চেষ্টা করুন','warning');
    } else {
      toast('টুলস লোড ব্যর্থ: '+e.message,'error');
    }
    if(tb) tb.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:30px;color:var(--danger)">লোড ব্যর্থ — <button class="btn btn-xs btn-gh" onclick="loadTools(true)">পুনরায় চেষ্টা</button></td></tr>`;
  } finally {
    AdminState._toolsFetching = false;
  }
}
window.loadTools = loadTools;

// ══════════════════════════════════════════════════════════════════
// RENDER TOOLS TABLE
// ══════════════════════════════════════════════════════════════════
function renderToolsTable(tools) {
  const tb = $('toolsTb'); if(!tb) return;
  const em = $('toolsEm');
  if(!tools.length) { tb.innerHTML=''; if(em) em.style.display='block'; return; }
  if(em) em.style.display='none';

  tb.innerHTML = tools.map(t => {
    const id = t.id||t._id;
    const chk = AdminState.selectedTools.includes(id) ? 'checked' : '';
    const cmds = t.commands?.length || (t.code ? 1 : 0);
    const catLbl = getCategoryLabel(t.category);
    const subLbl = t.subCategory ? `<br><small style="color:var(--text-muted);font-size:.68rem">${esc(t.subCategory)}</small>` : '';
    const likeCount = Array.isArray(t.likes) ? t.likes.length : (t.likes||0);
    return `<tr>
      <td style="padding:10px 8px"><input type="checkbox" class="tool-checkbox" value="${id}" ${chk} onchange="updateSelectedTools(this)"></td>
      <td style="padding:10px"><div style="width:60px;height:36px;border-radius:5px;overflow:hidden;background:var(--card2);display:flex;align-items:center;justify-content:center">${getThumbnailHtml(t)}</div></td>
      <td style="padding:10px"><div style="font-weight:700;font-size:.84rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.title||t.name||'')}">${esc(t.title||t.name||'')}</div><div style="font-size:.72rem;color:var(--text-muted)">${esc(t.author||'')}</div></td>
      <td style="padding:10px;font-size:.8rem">${catLbl}${subLbl}</td>
      <td style="padding:10px">${t.views||0}</td>
      <td class="hide-md" style="padding:10px">❤️ ${likeCount}</td>
      <td class="hide-md" style="padding:10px">⬇️ ${t.downloads||0}</td>
      <td style="padding:10px"><span class="bdg bdg-p" style="font-size:.72rem">${cmds}টি</span></td>
      <td style="padding:10px"><label class="tg" style="margin:0"><input type="checkbox" ${t.published!==false?'checked':''} onchange="toggleToolField('${id}','published',this.checked)"><div class="tg-sl"></div></label></td>
      <td class="hide-sm" style="padding:10px"><label class="tg" style="margin:0"><input type="checkbox" ${t.featured?'checked':''} onchange="toggleToolField('${id}','featured',this.checked)"><div class="tg-sl"></div></label></td>
      <td style="padding:10px"><div style="display:flex;gap:4px">
        <button class="bti" onclick="editTool('${id}')"><i class="fas fa-edit"></i></button>
        <button class="bti dn" onclick="deleteTool('${id}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}

function getThumbnailHtml(t) {
  if(t.thumbnail) return `<img src="${esc(t.thumbnail)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`;
  if(t.youtube){ const m=(t.youtube||'').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/); if(m) return `<img src="https://img.youtube.com/vi/${m[1]}/default.jpg" style="width:100%;height:100%;object-fit:cover">`; }
  return `<span style="font-size:1.2rem">${getCategoryIcon(t.category)}</span>`;
}
window.getThumbnailHtml = getThumbnailHtml;

// ══════════════════════════════════════════════════════════════════
// SAVE TOOL — ✅ FIX: Firestore-এ সেভ, localStorage নয়
// ══════════════════════════════════════════════════════════════════
async function saveTool(preview = false) {
  const db = DB();
  if(!db) { toast('Firebase সংযুক্ত নয়','error'); return; }

  const title      = getVal('toolTitle');
  const desc       = getVal('toolDesc');
  const cat        = getVal('toolCat') || 'system';
  // ✅ FIX: subCategory সঠিকভাবে নেওয়া
  const subCat     = $('toolSubCat')?.value || $('toolSubcat')?.value || '';
  const author     = getVal('toolAuthor') || 'AutoScrip Team';
  const tags       = getVal('toolTags').split(',').map(s=>s.trim()).filter(Boolean);
  const youtube    = getVal('toolYT') || null;
  const thumb      = getVal('toolThumb') || null;
  const slug       = getVal('toolSlug') || generateSlugFromTitle(title);
  const metaDesc   = getVal('toolMetaDesc') || desc.substring(0,160);
  const published  = $('toolPublished')?.checked !== false;
  const featured   = !!$('toolFeatured')?.checked;
  const verified   = !!$('toolVerified')?.checked;
  const commands   = window.cmdManager ? window.cmdManager.getBlocksData() : [];
  const editId     = getVal('editToolId');

  if(!title) { toast('শিরোনাম লিখুন!','error'); $('toolTitle')?.focus(); return; }
  if(!desc)  { toast('বিবরণ লিখুন!','error'); $('toolDesc')?.focus(); return; }
  if(!commands.length || !commands[0]?.code?.trim()) { toast('কমপক্ষে একটি কমান্ড ব্লক দিন!','error'); return; }

  const btn = $('toolSaveBtn');
  if(btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> সেভ হচ্ছে...'; }

  try {
    // ✅ FIX: সম্পূর্ণ toolData Firestore-এ যাবে
    const toolData = {
      title,
      name:        title,   // compatibility
      category:    cat,
      subCategory: subCat || null,   // ✅ subcategory Firestore-এ
      description: desc,
      author,
      tags,
      youtube,
      thumbnail:   thumb,
      slug,
      metaDesc,
      commands,
      published,
      featured,
      verified,
      status:      published ? 'approved' : 'pending',
      updatedAt:   TS(),
      updatedBy:   AdminState.user?.email || 'admin',
    };

    if(editId) {
      // ✅ FIX: Firestore update
      await db.collection('autoscrip_tools').doc(editId).update(toolData);
      toast(`✅ "${title}" আপডেট হয়েছে!`, 'success');
    } else {
      // ✅ FIX: Firestore add
      toolData.createdAt = TS();
      toolData.views     = 0;
      toolData.downloads = 0;
      toolData.likes     = [];
      const ref = await db.collection('autoscrip_tools').add(toolData);
      toast(`✅ "${title}" Firestore-এ যোগ হয়েছে! (${ref.id})`, 'success');
    }

    // ✅ FIX: Cache invalidate করুন যাতে পরের বার নতুন data আসে
    AdminState._toolsCache  = null;
    AdminState._toolsCacheTs = 0;

    showP('tools');
    await loadTools(true); // force refresh

  } catch(e) {
    toast('সেভ ব্যর্থ: '+e.message,'error');
    console.error('[saveTool]', e);
  } finally {
    if(btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-save"></i> সেভ করুন'; }
  }
}
window.saveTool = saveTool;

// ══════════════════════════════════════════════════════════════════
// EDIT TOOL — ✅ FIX: subcategory লোড হবে
// ══════════════════════════════════════════════════════════════════
async function editTool(id) {
  try {
    const db = DB(); if(!db) throw new Error('Firebase নেই');
    const doc = await db.collection('autoscrip_tools').doc(id).get();
    if(!doc.exists) { toast('টুল পাওয়া যায়নি','error'); return; }
    const t = { id:doc.id, _id:doc.id, ...doc.data() };

    setVal('editToolId', t.id);
    setVal('toolTitle',  t.title || t.name || '');
    setVal('toolDesc',   t.description || '');
    setVal('toolAuthor', t.author || '');
    setVal('toolTags',   (t.tags||[]).join(', '));
    setVal('toolYT',     t.youtube || '');
    setVal('toolThumb',  t.thumbnail || '');
    setVal('toolSlug',   t.slug || '');
    setVal('toolMetaDesc', t.metaDesc || '');

    const cat = $('toolCat'); if(cat) cat.value = t.category || 'system';
    const pub = $('toolPublished'); if(pub) pub.checked = t.published !== false;
    const feat = $('toolFeatured'); if(feat) feat.checked = !!t.featured;
    const ver = $('toolVerified'); if(ver) ver.checked = !!t.verified;

    const ttl = $('toolFmTt'); if(ttl) ttl.textContent = `✏️ এডিট: ${t.title||t.name||''}`;

    // Commands
    if(window.cmdManager) {
      if(t.commands?.length) window.cmdManager.loadBlocks(t.commands);
      else if(t.code) window.cmdManager.loadBlocks([{title:'Main Command',code:t.code,comment:''}]);
      else window.cmdManager.clearAll();
    }

    // ✅ FIX: subCategory লোড
    await loadSubCategoriesForTool(t.category || 'system');
    const sc = $('toolSubCat') || $('toolSubcat');
    if(sc && (t.subCategory || t.subcategory)) {
      sc.value = t.subCategory || t.subcategory || '';
    }

    // Thumbnail preview
    if(t.youtube) { const fn = window.previewYT; if(fn) fn(); }
    if(t.thumbnail) { const fn = window.previewCustomThumb; if(fn) fn(); }

    if(typeof updateSeoPreview === 'function') updateSeoPreview();
    const vh = $('versionHistory'); if(vh) vh.style.display='block';

    showP('add-tool');
  } catch(e) {
    toast('এডিট লোড ব্যর্থ: '+e.message,'error');
    console.error('[editTool]', e);
  }
}
window.editTool = editTool;

// ══════════════════════════════════════════════════════════════════
// DELETE TOOL
// ══════════════════════════════════════════════════════════════════
async function deleteTool(id) {
  const t = AdminState.tools.find(x => (x.id||x._id) === id);
  if(!confirm(`"${t?.title||t?.name||'টুল'}" ডিলিট করবেন?`)) return;
  try {
    await DB().collection('autoscrip_tools').doc(id).delete();
    AdminState.tools = AdminState.tools.filter(x => (x.id||x._id) !== id);
    AdminState._toolsCache = AdminState.tools;
    renderToolsTable(AdminState.tools);
    toast('🗑️ ডিলিট হয়েছে','success');
  } catch(e) {
    toast('ডিলিট ব্যর্থ: '+e.message,'error');
  }
}
window.deleteTool = deleteTool;

// ══════════════════════════════════════════════════════════════════
// TOGGLE TOOL FIELD
// ══════════════════════════════════════════════════════════════════
async function toggleToolField(id, field, value) {
  try {
    const upd = { [field]: value, updatedAt: TS() };
    if(field === 'published') upd.status = value ? 'approved' : 'pending';
    await DB().collection('autoscrip_tools').doc(id).update(upd);
    const i = AdminState.tools.findIndex(t => (t.id||t._id) === id);
    if(i >= 0) { AdminState.tools[i][field] = value; AdminState._toolsCache = AdminState.tools; }
    toast(`✅ ${field} আপডেট`,'success');
  } catch(e) { toast('আপডেট ব্যর্থ: '+e.message,'error'); }
}
window.toggleToolField = toggleToolField;

// ══════════════════════════════════════════════════════════════════
// RESET TOOL FORM
// ══════════════════════════════════════════════════════════════════
function rstTool() {
  setVal('editToolId','');
  ['toolTitle','toolDesc','toolAuthor','toolTags','toolYT','toolThumb','toolSlug','toolMetaDesc'].forEach(id=>setVal(id,''));
  const cat = $('toolCat'); if(cat) cat.value='system';
  const sc = $('toolSubCat') || $('toolSubcat'); if(sc) sc.innerHTML='<option value="">কোনোটিই নয়</option>';
  const pub=$('toolPublished'); if(pub) pub.checked=true;
  const feat=$('toolFeatured'); if(feat) feat.checked=false;
  const ver=$('toolVerified'); if(ver) ver.checked=false;
  const ttl=$('toolFmTt'); if(ttl) ttl.textContent='➕ নতুন টুল যুক্ত করুন';
  if(window.cmdManager) window.cmdManager.clearAll();
  if(typeof updateSeoPreview === 'function') updateSeoPreview();
}
window.rstTool = rstTool;

// ══════════════════════════════════════════════════════════════════
// SUB-CATEGORY LOADER — ✅ FIX: সঠিকভাবে কাজ করবে
// ══════════════════════════════════════════════════════════════════
async function loadSubCategoriesForTool(catKey) {
  // Try both possible select IDs
  const sel = $('toolSubCat') || $('toolSubcat');
  if(!sel) return;

  const prevVal = sel.value;
  sel.innerHTML = '<option value="">— সাব-ক্যাটাগরি (ঐচ্ছিক) —</option>';
  if(!catKey) return;

  const subs = [];

  // 1. Built-in subcategories from SUBCATEGORIES constant
  const builtinSubs = window.SUBCATEGORIES?.[catKey] || [];
  builtinSubs.forEach(s => subs.push({ key:s.k, name:s.n, emoji:s.e }));

  // 2. Custom category subs from AdminState
  const cc = AdminState.customCats.find(c => c.key === catKey);
  if(cc?.subCategories?.length) {
    cc.subCategories.forEach(s => {
      if(!subs.find(x => x.key === s.key)) subs.push(s);
    });
  }

  // 3. Firestore categories collection
  try {
    const db = DB();
    if(db) {
      const snap = await db.collection('autoscrip_categories')
        .where('key','==',catKey).limit(1).get()
        .catch(() => ({ empty: true }));
      if(!snap.empty) {
        const data = snap.docs[0].data();
        (data.subCategories || data.subs || []).forEach(s => {
          if(!subs.find(x => x.key === (s.key||s.k))) {
            subs.push({ key: s.key||s.k, name: s.name||s.n, emoji: s.emoji||s.e||'📌' });
          }
        });
      }

      // Also check __builtin_ prefixed docs
      const bsnap = await db.collection('autoscrip_categories')
        .doc('__builtin_'+catKey).get()
        .catch(() => ({ exists: false }));
      if(bsnap.exists) {
        (bsnap.data().subs || []).forEach(s => {
          if(!subs.find(x => x.key === s.key)) {
            subs.push({ key:s.key, name:s.name, emoji:s.emoji||'📌' });
          }
        });
      }
    }
  } catch(_) {}

  // Render options
  subs.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.key;
    opt.textContent = `${s.emoji||'📌'} ${s.name}`;
    sel.appendChild(opt);
  });

  // Restore previous value
  if(prevVal && sel.querySelector(`option[value="${prevVal}"]`)) {
    sel.value = prevVal;
  }
}
window.loadSubCategoriesForTool = loadSubCategoriesForTool;

// ══════════════════════════════════════════════════════════════════
// YOUTUBE — ✅ FIX: Firestore + hardcoded fallback
// ══════════════════════════════════════════════════════════════════
const DEFAULT_YT_ADMIN = [
  {title:'PowerShell পরিচিতি — বাংলায়',desc:'শুরু থেকে শিখুন।',vid:'',chUrl:'https://www.youtube.com/@autoscrip',level:'beginner',views:'12K',date:'২ সপ্তাহ আগে',channel:'AutoScrip'},
  {title:'নেটওয়ার্ক মনিটরিং PowerShell দিয়ে',desc:'Get-NetAdapter, Test-Connection।',vid:'',chUrl:'https://www.youtube.com/@autoscrip',level:'intermediate',views:'8.4K',date:'১ মাস আগে',channel:'AutoScrip'},
  {title:'Windows সিকিউরিটি অডিট',desc:'ইভেন্ট লগ ও ফায়ারওয়াল।',vid:'',chUrl:'https://www.youtube.com/@autoscrip',level:'advanced',views:'15K',date:'৩ সপ্তাহ আগে',channel:'AutoScrip'},
];

async function loadYoutubeVideos() {
  const el = $('ytVideoList');
  if(el) el.innerHTML = '<div style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin"></i></div>';

  try {
    const db = DB();
    if(db) {
      let snap;
      try {
        snap = await db.collection('autoscrip_youtube').orderBy('order','asc').get();
      } catch(_) {
        snap = await db.collection('autoscrip_youtube').get().catch(() => ({ docs:[], empty:true }));
      }

      if(snap && !snap.empty) {
        AdminState.ytVideos = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        renderYoutubeList(AdminState.ytVideos);
        const cnt = $('ytVidCount'); if(cnt) cnt.textContent = AdminState.ytVideos.length+'টি ভিডিও';
        return;
      }
    }
  } catch(e) {
    console.warn('[loadYoutubeVideos]', e.message);
  }

  // ✅ FIX: Fallback to hardcoded defaults
  AdminState.ytVideos = DEFAULT_YT_ADMIN;
  renderYoutubeList(DEFAULT_YT_ADMIN);
  toast('Firestore-এ ভিডিও নেই — ডিফল্ট দেখাচ্ছে','info');
}
window.loadYoutubeVideos = loadYoutubeVideos;

function renderYoutubeList(vids) {
  const el = $('ytVideoList'); if(!el) return;
  if(!vids.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)"><i class="fab fa-youtube" style="font-size:2rem;color:#ff4444;opacity:.4"></i><br>কোনো ভিডিও নেই</div>';
    return;
  }
  const lvlColor = {beginner:'#22c55e',intermediate:'#f59e0b',advanced:'#f43f5e'};
  const lvlName  = {beginner:'বিগিনার',intermediate:'ইন্টারমিডিয়েট',advanced:'অ্যাডভান্সড'};

  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">${vids.map(v => {
    const ytId = (v.vid||'').match(/^[\w-]{11}$/) ? v.vid :
                  ((v.vid||v.chUrl||'').match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)||[])[1]||'';
    const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : '';
    const lc = lvlColor[v.level]||'#888';
    return `<div style="display:flex;gap:10px;align-items:center;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:10px">
      <div style="width:88px;height:50px;border-radius:6px;overflow:hidden;background:#111;flex-shrink:0">
        ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover" loading="lazy">` : '<i class="fab fa-youtube" style="color:#ff4444;font-size:1.5rem;display:flex;align-items:center;justify-content:center;height:100%"></i>'}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.83rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.title||'')}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:3px;display:flex;gap:8px">
          <span style="background:${lc}22;color:${lc};padding:1px 7px;border-radius:99px;font-size:.68rem;font-weight:600">${lvlName[v.level]||''}</span>
          <span>👁 ${v.views||'0'}</span>
          <span>📅 ${v.date||''}</span>
        </div>
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0">
        ${v.id ? `<button class="bti" onclick="editYtVideo('${v.id}')"><i class="fas fa-edit"></i></button>
        <button class="bti dn" onclick="deleteYtVideo('${v.id}')"><i class="fas fa-trash"></i></button>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function resetYtForm() {
  ['ytVidTitle','ytVidDesc','ytVidId','ytVidUrl','ytVidViews','ytVidDate'].forEach(id=>setVal(id,''));
  if($('ytVidLevel')) $('ytVidLevel').value='beginner';
  setVal('editYtId','');
  const ft=$('ytFormTitle'); if(ft) ft.textContent='নতুন ভিডিও যোগ করুন';
}
window.resetYtForm = resetYtForm;

function editYtVideo(id) {
  const v = AdminState.ytVideos.find(x => (x.id||x._id)===id); if(!v) return;
  setVal('editYtId',id); setVal('ytVidTitle',v.title||''); setVal('ytVidDesc',v.desc||'');
  setVal('ytVidId',v.vid||''); setVal('ytVidUrl',v.chUrl||'');
  setVal('ytVidViews',v.views||''); setVal('ytVidDate',v.date||'');
  if($('ytVidLevel')) $('ytVidLevel').value = v.level||'beginner';
  const ft=$('ytFormTitle'); if(ft) ft.textContent='ভিডিও এডিট করুন';
  $('ytVideoForm')?.scrollIntoView({behavior:'smooth'});
}
window.editYtVideo = editYtVideo;

async function saveYtVideo() {
  const title=getVal('ytVidTitle'), vid=getVal('ytVidId'), chUrl=getVal('ytVidUrl');
  if(!title) { toast('শিরোনাম দিন','error'); return; }
  if(!vid && !chUrl) { toast('Video ID বা URL দিন','error'); return; }
  const data = {
    title, desc:getVal('ytVidDesc'), vid, chUrl,
    level: $('ytVidLevel')?.value||'beginner',
    views:getVal('ytVidViews'), date:getVal('ytVidDate'),
    channel:'AutoScrip', updatedAt:TS()
  };
  const editId = getVal('editYtId');
  try {
    if(editId) { await DB().collection('autoscrip_youtube').doc(editId).set(data,{merge:true}); toast('✅ আপডেট!','success'); }
    else { data.createdAt=TS(); data.order=Date.now(); await DB().collection('autoscrip_youtube').add(data); toast('✅ ভিডিও যোগ!','success'); }
    resetYtForm(); loadYoutubeVideos();
  } catch(e) { toast('ব্যর্থ: '+e.message,'error'); }
}
window.saveYtVideo = saveYtVideo;

async function deleteYtVideo(id) {
  if(!confirm('ভিডিও ডিলিট করবেন?')) return;
  try {
    await DB().collection('autoscrip_youtube').doc(id).delete();
    toast('🗑️ ডিলিট','success');
    loadYoutubeVideos();
  } catch(e) { toast('ব্যর্থ: '+e.message,'error'); }
}
window.deleteYtVideo = deleteYtVideo;

// ══════════════════════════════════════════════════════════════════
// CATEGORY HELPERS
// ══════════════════════════════════════════════════════════════════
const CAT_LABELS = {system:'⚙️ সিস্টেম',network:'🌐 নেটওয়ার্ক',security:'🔒 সিকিউরিটি',backup:'💾 ব্যাকআপ',monitoring:'📊 মনিটরিং',automation:'🤖 অটোমেশন',download:'⬇️ ডাউনলোড',files:'📁 ফাইল',windows:'🪟 উইন্ডোজ',devtools:'💻 ডেভটুলস',office:'📝 অফিস',gaming:'🎮 গেমিং',other:'📜 অন্যান্য'};
const CAT_ICONS  = {system:'⚙️',network:'🌐',security:'🔒',backup:'💾',monitoring:'📊',automation:'🤖',download:'⬇️',files:'📁',windows:'🪟',devtools:'💻',office:'📝',gaming:'🎮',other:'📜'};

function getCategoryLabel(cat) {
  if(CAT_LABELS[cat]) return CAT_LABELS[cat];
  const c = AdminState.customCats.find(x => x.key===cat);
  return c ? `${c.emoji||'📦'} ${c.name}` : (cat||'—');
}
function getCategoryIcon(cat) {
  if(CAT_ICONS[cat]) return CAT_ICONS[cat];
  const c = AdminState.customCats.find(x => x.key===cat);
  return c?.emoji || '📦';
}
window.getCategoryLabel = getCategoryLabel;
window.getCategoryIcon  = getCategoryIcon;

function updateAllCategorySelects() {
  ['toolCat','toolCatFilt'].forEach(selId => {
    const sel = $(selId); if(!sel) return;
    Array.from(sel.options).forEach(opt => { if(opt.dataset.custom) sel.removeChild(opt); });
    AdminState.customCats.forEach(c => {
      if(!sel.querySelector(`option[value="${c.key}"]`)) {
        const opt = document.createElement('option');
        opt.value = c.key;
        opt.textContent = `${c.emoji||'📦'} ${c.name}`;
        opt.dataset.custom = '1';
        sel.appendChild(opt);
      }
    });
  });
}
window.updateAllCategorySelects = updateAllCategorySelects;

// ══════════════════════════════════════════════════════════════════
// SEARCH & FILTER
// ══════════════════════════════════════════════════════════════════
function filtTools(q) {
  const f = !q ? AdminState.tools : AdminState.tools.filter(t =>
    (t.title||t.name||'').toLowerCase().includes(q.toLowerCase()) ||
    (t.description||'').toLowerCase().includes(q.toLowerCase()) ||
    (t.tags||[]).some(tag => tag.toLowerCase().includes(q.toLowerCase()))
  );
  renderToolsTable(f);
  const tc=$('toolCount'); if(tc) tc.textContent=f.length;
}
function filtToolsCat() {
  const cat = $('toolCatFilt')?.value||'';
  const f = !cat ? AdminState.tools : AdminState.tools.filter(t => t.category===cat);
  renderToolsTable(f);
}
window.filtTools = filtTools;
window.filtToolsCat = filtToolsCat;

// ══════════════════════════════════════════════════════════════════
// BULK OPERATIONS
// ══════════════════════════════════════════════════════════════════
function updateSelectedTools(cb) {
  const id=cb.value;
  if(cb.checked) { if(!AdminState.selectedTools.includes(id)) AdminState.selectedTools.push(id); }
  else AdminState.selectedTools = AdminState.selectedTools.filter(x=>x!==id);
  const bb=$('bulkBar'), sc=$('selectedCount');
  if(bb) bb.style.display=AdminState.selectedTools.length?'flex':'none';
  if(sc) sc.textContent=`${AdminState.selectedTools.length}টি সিলেক্টেড`;
}
function toggleAllTools(cb) {
  document.querySelectorAll('.tool-checkbox').forEach(c => { c.checked=cb.checked; updateSelectedTools(c); });
}
async function bulkUpdate(updates) {
  if(!AdminState.selectedTools.length) return;
  const batch=DB().batch();
  AdminState.selectedTools.forEach(id => batch.update(DB().collection('autoscrip_tools').doc(id), {...updates, updatedAt:TS()}));
  await batch.commit();
  AdminState.tools = AdminState.tools.map(t => AdminState.selectedTools.includes(t.id||t._id) ? {...t,...updates} : t);
  AdminState._toolsCache = AdminState.tools;
  clearSelection(); renderToolsTable(AdminState.tools);
  toast(`✅ ${AdminState.selectedTools.length}টি আপডেট`,'success');
}
async function bulkPublish()   { await bulkUpdate({published:true,status:'approved'}); }
async function bulkUnpublish() { await bulkUpdate({published:false,status:'pending'}); }
async function bulkFeature()   { await bulkUpdate({featured:true}); }
async function bulkDelete() {
  if(!AdminState.selectedTools.length) return;
  if(!confirm(`${AdminState.selectedTools.length}টি ডিলিট করবেন?`)) return;
  const batch=DB().batch();
  AdminState.selectedTools.forEach(id => batch.delete(DB().collection('autoscrip_tools').doc(id)));
  await batch.commit();
  AdminState.tools = AdminState.tools.filter(t => !AdminState.selectedTools.includes(t.id||t._id));
  AdminState._toolsCache = AdminState.tools;
  clearSelection(); renderToolsTable(AdminState.tools);
  toast('🗑️ ডিলিট হয়েছে','success');
}
function clearSelection() {
  AdminState.selectedTools=[];
  document.querySelectorAll('.tool-checkbox').forEach(c=>c.checked=false);
  const sa=$('selectAllTools'); if(sa) sa.checked=false;
  const bb=$('bulkBar'); if(bb) bb.style.display='none';
}
function exportTools() {
  const blob=new Blob([JSON.stringify(AdminState.tools,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`tools-${new Date().toISOString().slice(0,10)}.json`; a.click();
  toast('✅ এক্সপোর্ট হয়েছে','success');
}
window.updateSelectedTools=updateSelectedTools; window.toggleAllTools=toggleAllTools;
window.bulkPublish=bulkPublish; window.bulkUnpublish=bulkUnpublish;
window.bulkFeature=bulkFeature; window.bulkDelete=bulkDelete;
window.clearSelection=clearSelection; window.exportTools=exportTools;

// ══════════════════════════════════════════════════════════════════
// SEO & SLUG
// ══════════════════════════════════════════════════════════════════
function generateSlugFromTitle(t) {
  return (t||'').toLowerCase().replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').replace(/--+/g,'-').slice(0,60);
}
function generateSlug() {
  const t=getVal('toolTitle'); if(t) { setVal('toolSlug',generateSlugFromTitle(t)); if(typeof updateSeoPreview==='function') updateSeoPreview(); }
}
window.generateSlug=generateSlug;

function updateSeoPreview() {
  const title=getVal('toolTitle')||'নতুন টুল';
  const desc=getVal('toolMetaDesc')||getVal('toolDesc')||'...';
  const slug=getVal('toolSlug')||generateSlugFromTitle(title);
  const st=$('seoTitle'); if(st) st.textContent=`AutoScrip - ${title}`;
  const su=$('seoUrl');   if(su) su.textContent=`autoscrip.com/tools/${slug}`;
  const sd=$('seoDesc');  if(sd) sd.textContent=desc.substring(0,160);
}
window.updateSeoPreview=updateSeoPreview;

// ══════════════════════════════════════════════════════════════════
// THUMBNAIL
// ══════════════════════════════════════════════════════════════════
function previewYT() {
  const url=getVal('toolYT');
  const m=(url||'').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  const p=$('ytThumbPrev'); if(!p) return;
  if(m) p.innerHTML=`<img src="https://img.youtube.com/vi/${m[1]}/mqdefault.jpg" style="width:100%;height:100%;object-fit:cover">`;
  else p.innerHTML='<span style="font-size:1.5rem">▶️</span><span>YT থাম্বনেইল</span>';
}
function previewCustomThumb() {
  const url=getVal('toolThumb'); const p=$('ytThumbPrev'); if(!p) return;
  if(url) p.innerHTML=`<img src="${esc(url)}" style="width:100%;height:100%;object-fit:cover">`;
}
function handleDragOver(e){e.preventDefault(); $('dropZone')?.classList.add('drag-over');}
function handleDrop(e){e.preventDefault(); $('dropZone')?.classList.remove('drag-over'); if(e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);}
function handleFileSelect(input){if(input.files[0]) uploadFile(input.files[0]);}
function uploadFile(file) {
  if(!file.type.startsWith('image/')) { toast('শুধু ইমেজ ফাইল','error'); return; }
  if(file.size>5*1024*1024) { toast('৫MB এর কম হতে হবে','error'); return; }
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas'); const max=800; let w=img.width,h=img.height;
      if(w>max||h>max){if(w>h){h=Math.round(h*max/w);w=max;}else{w=Math.round(w*max/h);h=max;}}
      canvas.width=w; canvas.height=h; canvas.getContext('2d').drawImage(img,0,0,w,h);
      const url=canvas.toDataURL('image/jpeg',.8); setVal('toolThumb',url); previewCustomThumb();
      toast('✅ ইমেজ রেডি!','success');
    }; img.src=e.target.result;
  }; reader.readAsDataURL(file);
}
window.previewYT=previewYT; window.previewCustomThumb=previewCustomThumb;
window.handleDragOver=handleDragOver; window.handleDrop=handleDrop; window.handleFileSelect=handleFileSelect;

// ══════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const db=DB(); if(!db) return;
    const [ts,us,rs] = await Promise.all([
      db.collection('autoscrip_tools').get().catch(()=>({docs:[],size:0})),
      db.collection('autoscrip_users').get().catch(()=>({docs:[],size:0})),
      db.collection('autoscrip_requests').where('status','==','pending').get().catch(()=>({docs:[],size:0})),
    ]);
    const tools=docSnap(ts);
    AdminState.tools=tools; AdminState._toolsCache=tools; AdminState._toolsCacheTs=Date.now();
    let views=0,downloads=0,likes=0;
    tools.forEach(t=>{views+=t.views||0;downloads+=t.downloads||0;likes+=Array.isArray(t.likes)?t.likes.length:(t.likes||0);});
    animNum('d-tools',tools.length); animNum('d-views',views);
    animNum('d-dls',downloads); animNum('d-likes',likes);
    animNum('d-users',us.size||0); animNum('d-reqs',rs.size||0);
    const rc=$('reqCount'); if(rc){rc.textContent=rs.size;rc.style.display=rs.size?'':'none';}
    if(typeof renderRecentTools==='function') renderRecentTools(tools.slice(0,5));
    if(typeof renderDashCharts==='function') renderDashCharts(tools);
  } catch(e){
    if(e.code==='resource-exhausted') {
      window._fbQuotaUntil=Date.now()+60000;
      toast('Firebase quota limit!','warning');
    } else {
      console.warn('[loadDashboard]',e.message);
    }
  }
}
window.loadDashboard=loadDashboard;

function animNum(id,target) {
  const el=$(id); if(!el||isNaN(target)) return;
  const start=parseInt(el.textContent)||0, dur=800, t0=performance.now();
  const tick=t=>{const p=Math.min((t-t0)/dur,1);el.textContent=Math.floor(start+(target-start)*p);if(p<1)requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
}

// ══════════════════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════════════════
async function loadUsers(){
  const tb=$('usersTb'); if(tb) tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:30px"><i class="fas fa-spinner fa-spin"></i></td></tr>';
  try{
    const snap=await DB().collection('autoscrip_users').get().catch(()=>({docs:[]}));
    const users=docSnap(snap);
    const uc=$('userCount'); if(uc) uc.textContent=users.length;
    if(!users.length){if(tb)tb.innerHTML='';const em=$('usersEm');if(em)em.style.display='block';return;}
    if(tb)tb.innerHTML=users.map(u=>`<tr>
      <td style="padding:12px"><div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1fd6b0,#3b82f6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#0f1820;flex-shrink:0">${(u.displayName||u.email||'U')[0].toUpperCase()}</div>
        <div><div style="font-weight:600;font-size:.88rem">${esc(u.displayName||'—')}</div></div>
      </div></td>
      <td style="padding:12px;font-size:.82rem">${esc(u.email||'—')}</td>
      <td style="padding:12px;font-size:.76rem;color:var(--text-muted)">${fmtDate(u.createdAt)}</td>
      <td style="padding:12px"><span class="bdg ${u.banned?'bdg-r':'bdg-g'}">${u.banned?'ব্যান':'সক্রিয়'}</span></td>
      <td style="padding:12px"><div style="display:flex;gap:4px">
        <button class="bti ${u.banned?'sc':'dn'}" onclick="toggleUserBan('${u.id}',${!u.banned})"><i class="fas fa-${u.banned?'unlock':'ban'}"></i></button>
        <button class="bti dn" onclick="deleteUser('${u.id}')"><i class="fas fa-trash"></i></button>
      </div></td></tr>`).join('');
  }catch(e){if(tb)tb.innerHTML=`<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--danger)">লোড ব্যর্থ: ${esc(e.message)}</td></tr>`;}
}
async function toggleUserBan(id,ban){
  try{ await DB().collection('autoscrip_users').doc(id).update({banned:ban,updatedAt:TS()}); toast(ban?'🚫 ব্যান':'✅ আনব্যান','success'); loadUsers(); }catch(e){toast('ব্যর্থ: '+e.message,'error');}
}
async function deleteUser(id){
  if(!confirm('ইউজার ডিলিট করবেন?')) return;
  await DB().collection('autoscrip_users').doc(id).delete();
  toast('🗑️ ডিলিট','success'); loadUsers();
}
function filtUsers(){loadUsers();}
window.loadUsers=loadUsers; window.toggleUserBan=toggleUserBan; window.deleteUser=deleteUser; window.filtUsers=filtUsers;

// ══════════════════════════════════════════════════════════════════
// REQUESTS
// ══════════════════════════════════════════════════════════════════
async function loadReqs(){
  const tb=$('reqsTb'); if(tb) tb.innerHTML='<tr><td colspan="6" style="text-align:center;padding:30px"><i class="fas fa-spinner fa-spin"></i></td></tr>';
  try{
    const snap=await DB().collection('autoscrip_requests').get().catch(()=>({docs:[]}));
    const reqs=docSnap(snap); const pending=reqs.filter(r=>r.status==='pending');
    animNum('d-reqs',pending.length); const rc=$('reqCount'); if(rc){rc.textContent=pending.length;rc.style.display=pending.length?'':'none';}
    const em=$('reqsEm'); if(!reqs.length){if(tb)tb.innerHTML='';if(em)em.style.display='block';return;}
    if(em) em.style.display='none';
    if(tb)tb.innerHTML=reqs.map(r=>`<tr>
      <td style="padding:12px"><span class="bdg bdg-i">${esc(r.type||'টুল')}</span></td>
      <td style="padding:12px;font-weight:600;font-size:.85rem">${esc(r.name||r.topic||'—')}</td>
      <td style="padding:12px;font-size:.8rem">${esc(r.author||r.email||'—')}</td>
      <td style="padding:12px;font-size:.74rem;color:var(--text-muted)">${fmtDate(r.createdAt)}</td>
      <td style="padding:12px"><span class="bdg ${r.status==='approved'?'bdg-g':r.status==='rejected'?'bdg-r':'bdg-w'}">${r.status==='approved'?'অ্যাপ্রুভড':r.status==='rejected'?'রিজেক্টেড':'পেন্ডিং'}</span></td>
      <td style="padding:12px"><div style="display:flex;gap:4px">
        ${r.status==='pending'?`<button class="bti sc" onclick="approveReq('${r.id}')"><i class="fas fa-check"></i></button><button class="bti dn" onclick="rejectReq('${r.id}')"><i class="fas fa-times"></i></button>`:''}
        <button class="bti dn" onclick="deleteReq('${r.id}')"><i class="fas fa-trash"></i></button>
      </div></td></tr>`).join('');
  }catch(e){if(tb)tb.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--danger)">লোড ব্যর্থ</td></tr>`;}
}
async function approveReq(id){await DB().collection('autoscrip_requests').doc(id).update({status:'approved',updatedAt:TS()});toast('✅ অ্যাপ্রুভড','success');loadReqs();}
async function rejectReq(id){await DB().collection('autoscrip_requests').doc(id).update({status:'rejected',updatedAt:TS()});toast('রিজেক্ট','info');loadReqs();}
async function deleteReq(id){await DB().collection('autoscrip_requests').doc(id).delete();toast('🗑️ ডিলিট','success');loadReqs();}
window.loadReqs=loadReqs; window.approveReq=approveReq; window.rejectReq=rejectReq; window.deleteReq=deleteReq;

// ══════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════
async function loadSettings(){
  try{
    const doc=await DB().collection('autoscrip_config').doc('site').get();
    if(!doc.exists) return; const s=doc.data();
    const map={stSiteName:'siteName',stSiteDesc:'siteDesc',stYTChannel:'ytChannel',stSiteURL:'siteURL',stContactEmail:'contactEmail',stTelegramGroup:'telegramGroup',stFacebookGroup:'facebookGroup',stFooterText:'footerText',stHeroTitle:'heroTitle',stHeroSubtitle:'heroSubtitle',stAnnouncement:'announcement',stMaxFreeTools:'maxFreeTools'};
    Object.entries(map).forEach(([elId,key])=>{if($(elId)&&s[key]!==undefined)setVal(elId,s[key]);});
    const toggles={stMaintenance:'maintenance',stRegistration:'registration',stComments:'comments',stRequests:'requests',stCommunityEnabled:'communityEnabled',stShowFeatured:'showFeatured',stShareEnabled:'shareEnabled',stDownloadEnabled:'downloadEnabled',stRunEnabled:'runEnabled'};
    Object.entries(toggles).forEach(([elId,key])=>{const el=$(elId);if(el)el.checked=s[key]!==false;});
  }catch(e){console.warn('[loadSettings]',e.message);}
}
async function saveSettings(){
  const map={stSiteName:'siteName',stSiteDesc:'siteDesc',stYTChannel:'ytChannel',stSiteURL:'siteURL',stContactEmail:'contactEmail',stTelegramGroup:'telegramGroup',stFacebookGroup:'facebookGroup',stFooterText:'footerText',stHeroTitle:'heroTitle',stHeroSubtitle:'heroSubtitle',stAnnouncement:'announcement'};
  const data={updatedAt:TS()};
  Object.entries(map).forEach(([elId,key])=>{if($(elId))data[key]=getVal(elId);});
  const toggles={stMaintenance:'maintenance',stRegistration:'registration',stComments:'comments',stRequests:'requests',stCommunityEnabled:'communityEnabled',stShowFeatured:'showFeatured',stShareEnabled:'shareEnabled',stDownloadEnabled:'downloadEnabled',stRunEnabled:'runEnabled'};
  Object.entries(toggles).forEach(([elId,key])=>{if($(elId))data[key]=$(elId).checked;});
  const mft=getVal('stMaxFreeTools'); if(mft!=='')data.maxFreeTools=parseInt(mft)||0;
  try{await DB().collection('autoscrip_config').doc('site').set(data,{merge:true});toast('✅ সেটিংস সেভ হয়েছে!','success');}
  catch(e){toast('সেভ ব্যর্থ: '+e.message,'error');}
}
async function changePwd(){
  const cur=$('curPwd')?.value, nw=$('newPwd')?.value, cf=$('cfmPwd')?.value;
  if(!cur||!nw){toast('পাসওয়ার্ড দিন','error');return;}
  if(nw!==cf){toast('মিলছে না','error');return;}
  if(nw.length<6){toast('কমপক্ষে ৬ অক্ষর','error');return;}
  try{
    const user=window._fbAuth?.currentUser;
    const cred=firebase.auth.EmailAuthProvider.credential(user.email,cur);
    await user.reauthenticateWithCredential(cred);
    await user.updatePassword(nw);
    toast('✅ পাসওয়ার্ড পরিবর্তিত!','success');
    setVal('curPwd','');setVal('newPwd','');setVal('cfmPwd','');
  }catch(e){toast('ব্যর্থ: '+e.message,'error');}
}
window.loadSettings=loadSettings; window.saveSettings=saveSettings; window.changePwd=changePwd;

// ══════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════
async function sendNotif(){
  const msg=getVal('ntMsg'); if(!msg){toast('বার্তা লিখুন','error');return;}
  try{
    await DB().collection('autoscrip_notifications').add({
      message:msg, icon:$('ntIcon')?.value||'🔔', title:getVal('ntTitle')||null,
      target:$('ntTarget')?.value||'all', link:getVal('ntLink')||null,
      createdAt:TS(), sentBy:AdminState.user?.email||'admin'
    });
    toast('✅ নোটিফিকেশন পাঠানো হয়েছে!','success');
    setVal('ntMsg',''); setVal('ntTitle',''); setVal('ntLink','');
    if(typeof loadNotifHistory==='function') loadNotifHistory();
  }catch(e){toast('ব্যর্থ: '+e.message,'error');}
}
async function loadNotifHistory(){
  const el=$('notifHistory'); if(!el)return;
  try{
    const snap=await DB().collection('autoscrip_notifications').orderBy('createdAt','desc').limit(30).get().catch(()=>({docs:[]}));
    const items=docSnap(snap);
    if(!items.length){el.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:.85rem">কোনো ইতিহাস নেই</div>';return;}
    el.innerHTML=items.map(n=>`<div style="display:flex;gap:10px;padding:10px;border-bottom:1px solid var(--border)">
      <span style="font-size:1.1rem">${n.icon||'🔔'}</span>
      <div style="flex:1"><div style="font-size:.83rem">${esc(n.message||'')}</div><div style="font-size:.72rem;color:var(--text-muted)">${fmtDate(n.createdAt)}</div></div>
      <button class="bti dn" onclick="deleteNotif('${n.id}')" style="width:28px;height:28px"><i class="fas fa-trash" style="font-size:.75rem"></i></button>
    </div>`).join('');
  }catch(_){}
}
async function deleteNotif(id){await DB().collection('autoscrip_notifications').doc(id).delete();loadNotifHistory();}
async function clearNotifs(){
  if(!confirm('সব নোটিফিকেশন মুছবেন?')) return;
  const snap=await DB().collection('autoscrip_notifications').get().catch(()=>({docs:[]}));
  const batch=DB().batch(); snap.docs.forEach(d=>batch.delete(d.ref)); await batch.commit();
  loadNotifHistory(); toast('🗑️ মুছা হয়েছে','success');
}
window.sendNotif=sendNotif; window.loadNotifHistory=loadNotifHistory; window.deleteNotif=deleteNotif; window.clearNotifs=clearNotifs;

// ══════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ══════════════════════════════════════════════════════════════════
async function loadActivityLog(){
  const el=$('actLog'); if(!el)return;
  try{
    const snap=await DB().collection('autoscrip_activity').orderBy('createdAt','desc').limit(50).get().catch(()=>({docs:[]}));
    const logs=docSnap(snap);
    if(!logs.length){el.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-muted)">কোনো লগ নেই</div>';return;}
    el.innerHTML=logs.map(l=>`<div class="act-item"><div class="act-dot ${l.color||'primary'}"></div><div class="act-txt">${esc(l.message||'')}</div><div class="act-time">${fmtDate(l.createdAt)}</div></div>`).join('');
  }catch(_){}
}
async function clearActivityLog(){
  if(!confirm('লগ মুছবেন?'))return;
  const snap=await DB().collection('autoscrip_activity').get().catch(()=>({docs:[]}));
  const batch=DB().batch(); snap.docs.forEach(d=>batch.delete(d.ref)); await batch.commit();
  loadActivityLog(); toast('🗑️ লগ মুছা হয়েছে','success');
}
window.loadActivityLog=loadActivityLog; window.clearActivityLog=clearActivityLog;

// ══════════════════════════════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════════════════════════════
function showP(name) {
  document.querySelectorAll('.pnl').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sb-lnk').forEach(l=>l.classList.remove('active'));
  $(`pnl-${name}`)?.classList.add('active');
  $(`nav-${name}`)?.classList.add('active');
  const titles={dashboard:'ড্যাশবোর্ড',tools:'টুলস ম্যানেজ','add-tool':'টুল যোগ করুন',categories:'ক্যাটাগরি',community:'কমিউনিটি','add-community':'নতুন পোস্ট',users:'ইউজার ম্যানেজ',requests:'রিকোয়েস্ট',notifs:'নোটিফিকেশন',analytics:'অ্যানালিটিক্স',heatmap:'হিটম্যাপ',team:'অ্যাডমিন টিম',settings:'সেটিংস',youtube:'ভিডিও টিউটোরিয়াল'};
  const title=$('pTitle'); if(title) title.textContent=titles[name]||name;
}
window.showP=showP;

function toggleSb(){const sb=$('sidebar');const mn=document.querySelector('.mn');if(sb){sb.classList.toggle('collapsed');if(mn)mn.classList.toggle('expanded');}}
function syncNow(){toast('🔄 রিফ্রেশ...','info');loadDashboard();setTimeout(()=>toast('✅ সিঙ্ক সম্পন্ন','success'),1500);}
function toggleMobileMenu(){const sb=$('sidebar');const ov=$('mobileOverlay');if(sb){sb.classList.toggle('mobile-open');if(ov)ov.classList.toggle('active');}}
function closeMobileMenu(){const sb=$('sidebar');const ov=$('mobileOverlay');if(sb)sb.classList.remove('mobile-open');if(ov)ov.classList.remove('active');}
function togglePasswordVisibility(inputId,icon){const el=$(inputId);if(!el)return;if(el.type==='password'){el.type='text';if(icon)icon.className='fas fa-eye-slash';}else{el.type='password';if(icon)icon.className='fas fa-eye';}}
window.toggleSb=toggleSb; window.syncNow=syncNow; window.toggleMobileMenu=toggleMobileMenu; window.closeMobileMenu=closeMobileMenu; window.togglePasswordVisibility=togglePasswordVisibility;

// Modal helpers
function openModal(id){$(id)?.classList.add('active');}
function closeModal(id){$(id)?.classList.remove('active');}
function closeCfm(){$('cfmDlg')?.classList.remove('active');}
window.openModal=openModal; window.closeModal=closeModal; window.closeCfm=closeCfm;

// Start clock
function startClock(){const u=()=>{const e=$('topbarClock');if(e)e.textContent=new Date().toLocaleTimeString('bn-BD');};u();setInterval(u,1000);}
window.startClock=startClock;

// ══════════════════════════════════════════════════════════════════
// INIT — DOM Ready
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Firebase
  if(typeof initFirebase === 'function') initFirebase();

  // Start clock
  startClock();

  // Command manager
  if(typeof CommandBlockManager !== 'undefined') {
    window.cmdManager = new CommandBlockManager();
  }

  // Auth state
  function setupAuth() {
    const auth = window._fbAuth;
    if(!auth) { setTimeout(setupAuth, 300); return; }

    auth.onAuthStateChanged(async user => {
      if(!user) return;
      const isMaster = user.email===window.MASTER_EMAIL || user.uid===window.MASTER_UID;
      let adminData = null;
      try {
        const snap = await window._fbDb.collection('autoscrip_admins').doc(user.uid).get();
        if(snap.exists) adminData = snap.data();
        else if(isMaster) {
          adminData = {name:'Admin',email:user.email,role:'super_admin',active:true};
          await window._fbDb.collection('autoscrip_admins').doc(user.uid).set({...adminData,createdAt:TS()},{merge:true});
        }
      } catch(e) { if(isMaster) adminData={name:'Admin',email:user.email,role:'super_admin',active:true}; }

      const allowed = isMaster || (adminData && window.ADMIN_ROLES?.has(adminData.role) && adminData.active!==false);
      if(!allowed) { auth.signOut(); return; }

      AdminState.user = {uid:user.uid,email:user.email,name:adminData?.name||user.email.split('@')[0],role:adminData?.role||'super_admin'};

      const ls=$('loginScreen'), ap=$('app');
      if(ls) ls.style.display='none';
      if(ap) ap.style.display='block';
      const nm=$('sbNm'); if(nm) nm.textContent=AdminState.user.name;
      const av=$('sbAv'); if(av) av.textContent=(AdminState.user.name||'A')[0].toUpperCase();
      const rl=$('sbRole'); if(rl) rl.textContent=AdminState.user.role==='super_admin'?'SUPER ADMIN':(AdminState.user.role||'ADMIN');

      // ✅ FIX: শুধু ১ বার লোড করুন, setInterval নয়
      loadDashboard();
      loadTools();
      loadReqs();
      setTimeout(() => {
        if(typeof loadCategories==='function') loadCategories();
        if(typeof loadBuiltinSubBadges==='function') loadBuiltinSubBadges();
        loadNotifHistory();
      }, 1500);

      // Connection status
      const sEl=$('connectionStatus');
      if(sEl) sEl.innerHTML='<i class="fas fa-circle" style="color:#22c55e;font-size:8px"></i><span style="font-size:.8rem">সংযুক্ত</span>';
    });
  }
  setupAuth();
});

console.log('[AutoScrip] admin.js loaded ✓');
