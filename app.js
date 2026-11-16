/* ===== KONFIGURASI SUPABASE (boleh ditukar di sini atau melalui modal UI) ===== */
const SUPABASE_URL = 'https://gnfkkuqlopkwzlerizqv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wDU1YZM_RD1GAilOZHlBMw_v_zw5MyT';

/* ===== UTILITI ===== */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CARD = 'bg-slate-900/90 border border-slate-800 rounded-xl p-4';
const BTN = 'px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 hover:bg-cyan-400/30 text-sm font-medium';
const BTN2 = 'px-3 py-1.5 rounded-lg border border-slate-600 hover:border-slate-400 text-sm';
const BTNG = 'px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 hover:bg-emerald-400/30 text-sm font-medium';
const BTNA = 'px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/50 hover:bg-amber-400/30 text-sm font-medium';
const BTND = 'px-2 py-1 rounded-md text-pink-400 hover:bg-pink-500/20 text-xs';
const BTNE = 'px-2 py-1 rounded-md text-cyan-300 hover:bg-cyan-500/20 text-xs';
const INP = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none';
const SPLITS = ['1', '2', '3', '1+1', '2+1', '2+2', '1+1+1', '2+2+1', '2+1+1', '3+2'];
const DEFAULT_DAYS = ['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat'];

const S = { session: 'Pagi', tab: 't1', settings: null, bells: [], teachers: [], classes: [], subjects: [], assigns: [] };
let sb = null;

function toast(msg, type = 'ok') {
  const c = { ok: 'border-emerald-400 text-emerald-300', err: 'border-pink-500 text-pink-300', warn: 'border-amber-400 text-amber-300' }[type];
  const d = document.createElement('div');
  d.className = `bg-slate-900 border ${c} rounded-lg px-4 py-2 text-sm shadow-lg max-w-sm`;
  d.textContent = msg;
  $('#toasts').appendChild(d);
  setTimeout(() => d.remove(), type === 'err' ? 6000 : 3000);
}
const icons = () => window.lucide && lucide.createIcons();
const sess = () => S.session;
const byId = (arr, id) => arr.find(x => x.id === id);
const addMin = (t, m) => { const [h, mi] = t.split(':').map(Number); const x = h * 60 + mi + m; return String(Math.floor(x / 60) % 24).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
const hhmm = t => (t || '').slice(0, 5);

/* ===== SAMBUNGAN ===== */
function getCfg() {
  return {
    url: localStorage.getItem('sb_url') || SUPABASE_URL,
    key: localStorage.getItem('sb_key') || SUPABASE_ANON_KEY
  };
}
function initClient() {
  const { url, key } = getCfg();
  if (!url || !key) { sb = null; $('#conn-dot').className = 'w-2.5 h-2.5 rounded-full bg-pink-500'; return false; }
  try { sb = supabase.createClient(url, key); return true; }
  catch (e) { sb = null; toast('Konfigurasi Supabase tidak sah: ' + e.message, 'err'); return false; }
}
async function loadAll() {
  if (!sb) { renderAll(); return; }
  try {
    const q = [
      sb.from('school_settings').select('*').limit(1),
      sb.from('bell_schedules').select('*').order('period_number'),
      sb.from('teachers').select('*').order('name'),
      sb.from('classes').select('*').order('class_name'),
      sb.from('subjects').select('*').order('subject_name'),
      sb.from('teaching_assignments').select('*')
    ];
    const r = await Promise.all(q);
    const bad = r.find(x => x.error);
    if (bad) throw bad.error;
    S.settings = r[0].data[0] || null;
    [S.bells, S.teachers, S.classes, S.subjects, S.assigns] = r.slice(1).map(x => x.data || []);
    $('#conn-dot').className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]';
    $('#conn-dot').title = 'Bersambung';
  } catch (e) {
    $('#conn-dot').className = 'w-2.5 h-2.5 rounded-full bg-pink-500';
    toast('Gagal memuat data: ' + (e.message || e) + ' (semak URL/Key & polisi RLS)', 'err');
  }
  renderAll();
}
async function dbSave(table, id, obj) {
  if (!sb) throw new Error('Belum bersambung ke Supabase');
  const { error } = id ? await sb.from(table).update(obj).eq('id', id) : await sb.from(table).insert(obj);
  if (error) throw error;
}
async function dbDel(table, id) {
  if (!sb) throw new Error('Belum bersambung ke Supabase');
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw error;
}

/* ===== BORANG MODAL GENERIK ===== */
function fieldHtml(f, v) {
  const lab = `<label class="text-xs text-slate-400">${esc(f.label)}${f.req ? ' *' : ''}</label>`;
  const n = `name="${f.k}"`;
  if (f.t === 'select') return `<div>${lab}<select ${n} class="${INP}">${f.opts.map(([a, b]) => `<option value="${esc(a)}" ${String(v ?? '') === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
  if (f.t === 'check') return `<label class="flex items-center gap-2 text-sm"><input type="checkbox" ${n} ${v ? 'checked' : ''} class="accent-cyan-400 w-4 h-4"> ${esc(f.label)}</label>`;
  if (f.t === 'multi') {
    const sel = v || [];
    return `<div>${lab}<div class="max-h-40 overflow-y-auto bg-slate-950 border border-slate-700 rounded-lg p-2 grid grid-cols-2 gap-1">${f.opts.map(([a, b]) => `<label class="flex items-center gap-2 text-xs"><input type="checkbox" ${n} value="${esc(a)}" ${sel.includes(a) ? 'checked' : ''} class="accent-cyan-400"> ${esc(b)}</label>`).join('') || '<span class="text-xs text-slate-500">Tiada data</span>'}</div></div>`;
  }
  const val = f.t === 'time' ? hhmm(v) : (v ?? '');
  const extra = f.list ? `list="${f.list}"` : '';
  return `<div>${lab}<input ${n} ${extra} type="${f.t || 'text'}" value="${esc(val)}" ${f.min !== undefined ? `min="${f.min}"` : ''} placeholder="${esc(f.ph || '')}" class="${f.t === 'color' ? 'w-full h-10 bg-slate-950 border border-slate-700 rounded-lg' : INP}"></div>`;
}
function openForm(title, fields, v, onSave, pre = '') {
  const m = document.createElement('div');
  m.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4';
  m.innerHTML = `<div class="${CARD} w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-[0_0_30px_-8px_#22d3ee]"><h3 class="text-lg font-bold text-cyan-400 mb-3">${esc(title)}</h3><div class="space-y-3">${pre}${fields.map(f => fieldHtml(f, v[f.k])).join('')}</div><div class="flex justify-end gap-2 mt-4"><button data-x class="${BTN2}">Batal</button><button data-ok class="${BTN}">Simpan</button></div></div>`;
  document.body.appendChild(m);
  $('[data-x]', m).onclick = () => m.remove();
  $('[data-ok]', m).onclick = async () => {
    const o = {};
    for (const f of fields) {
      const els = [...m.querySelectorAll(`[name="${f.k}"]`)];
      if (f.t === 'multi') o[f.k] = els.filter(e => e.checked).map(e => e.value);
      else if (f.t === 'check') o[f.k] = els[0].checked;
      else {
        let x = els[0].value.trim();
        if (f.req && !x) return toast(`"${f.label}" wajib diisi`, 'warn');
        if (f.t === 'number') x = x === '' ? null : Number(x);
        else if (x === '') x = null;
        o[f.k] = x;
      }
    }
    try { await onSave(o); m.remove(); } catch (e) { toast('Gagal simpan: ' + (e.message || e), 'err'); }
  };
  $('input,select', m)?.focus();
}

/* ===== KONFIGURASI JADUAL CRUD ===== */
const sessOpts = [['Pagi', 'Pagi'], ['Petang', 'Petang']];
const CFG = {
  bell_schedules: {
    title: 'Waktu Loceng',
    fields: () => [
      { k: 'period_number', label: 'No. Waktu', t: 'number', req: 1, min: 1 },
      { k: 'label', label: 'Label (cth: Waktu 1 / Rehat)', req: 1 },
      { k: 'start_time', label: 'Masa Mula', t: 'time', req: 1 },
      { k: 'end_time', label: 'Masa Tamat', t: 'time', req: 1 },
      { k: 'is_recess', label: 'Waktu Rehat', t: 'check' },
      { k: 'recess_level', label: 'Tahap Rehat (jika rehat, cth: Semua / Rendah / Menengah)' }
    ],
    pre: o => { o.session_type = sess(); if (!o.is_recess) o.recess_level = null; if (o.start_time >= o.end_time) throw new Error('Masa tamat mesti selepas masa mula'); },
    list: 'bells'
  },
  teachers: {
    title: 'Guru',
    fields: () => [
      { k: 'name', label: 'Nama Guru', req: 1 },
      { k: 'short_code', label: 'Kod Singkatan', req: 1 },
      { k: 'session_type', label: 'Sesi', t: 'select', opts: [...sessOpts, ['Kedua-dua', 'Kedua-dua']] },
      { k: 'role_title', label: 'Jawatan' },
      { k: 'max_periods_per_week', label: 'Had Waktu Mengajar / Minggu', t: 'number', min: 0 },
      { k: 'max_relief_per_week', label: 'Had Relief / Minggu', t: 'number', min: 0 },
      { k: 'is_relief_exempt', label: 'Dikecualikan daripada Relief', t: 'check' }
    ],
    defaults: () => ({ session_type: sess(), max_periods_per_week: 30, max_relief_per_week: 3 })
  },
  classes: {
    title: 'Kelas',
    fields: () => [
      { k: 'class_name', label: 'Nama Kelas (cth: 4 UPM)', req: 1 },
      { k: 'year_level', label: 'Tahun / Tingkatan (1-6)', t: 'number', min: 1 },
      { k: 'session_type', label: 'Sesi', t: 'select', opts: sessOpts },
      { k: 'homeroom_teacher_id', label: 'Guru Kelas', t: 'select', opts: [['', '— Tiada —'], ...S.teachers.map(t => [t.id, `${t.short_code} - ${t.name}`])] }
    ],
    defaults: () => ({ session_type: sess() })
  },
  subjects: {
    title: 'Mata Pelajaran',
    fields: () => [
      { k: 'subject_code', label: 'Kod', req: 1 },
      { k: 'subject_name', label: 'Nama Mata Pelajaran', req: 1 },
      { k: 'color_hex', label: 'Warna Kad', t: 'color' },
      { k: 'requires_double_period', label: 'Perlu Double Period', t: 'check' },
      { k: 'preferred_morning_only', label: 'Utamakan Waktu Pagi Sahaja', t: 'check' }
    ],
    defaults: () => ({ color_hex: '#22d3ee' })
  },
  teaching_assignments: {
    title: 'Agihan Tugas',
    fields: () => [
      { k: 'subject_id', label: 'Mata Pelajaran', t: 'select', req: 1, opts: [['', '— Pilih —'], ...S.subjects.map(s => [s.id, `${s.subject_code} - ${s.subject_name}`])] },
      { k: 'teacher_ids', label: 'Guru (pilih 1+ untuk Co-Teaching)', t: 'multi', opts: S.teachers.filter(t => t.session_type === sess() || t.session_type === 'Kedua-dua').map(t => [t.id, t.short_code + ' ' + t.name]) },
      { k: 'class_ids', label: 'Kelas (pilih 1+ untuk Kelas Bergabung)', t: 'multi', opts: S.classes.filter(c => c.session_type === sess()).map(c => [c.id, c.class_name]) },
      { k: 'periods_per_week', label: 'Waktu / Minggu', t: 'number', req: 1, min: 1 },
      { k: 'period_split', label: 'Pecahan Waktu', t: 'select', opts: SPLITS.map(x => [x, x]) },
      { k: 'concurrent_group_tag', label: 'Tag Kumpulan Serentak (pilihan)', list: 'tag-list', ph: 'THN4_AGAMA_MORAL_BC_BT' }
    ],
    defaults: () => ({ periods_per_week: 2, period_split: '2' }),
    pre: o => {
      o.session_type = sess();
      if (!o.teacher_ids.length) throw new Error('Pilih sekurang-kurangnya seorang guru');
      if (!o.class_ids.length) throw new Error('Pilih sekurang-kurangnya satu kelas');
      const sum = o.period_split.split('+').reduce((a, b) => a + Number(b), 0);
      if (sum !== o.periods_per_week) throw new Error(`Pecahan ${o.period_split} = ${sum} waktu, tidak sama dengan ${o.periods_per_week} waktu/minggu`);
      if (o.concurrent_group_tag) o.concurrent_group_tag = o.concurrent_group_tag.toUpperCase().replace(/\s+/g, '_');
    }
  }
};
function crudForm(table, id) {
  const c = CFG[table];
  const row = id ? S[{ bell_schedules: 'bells', teachers: 'teachers', classes: 'classes', subjects: 'subjects', teaching_assignments: 'assigns' }[table]].find(x => x.id === id) : null;
  const tags = [...new Set(S.assigns.map(a => a.concurrent_group_tag).filter(Boolean))];
  const pre = table === 'teaching_assignments' ? `<datalist id="tag-list">${tags.map(t => `<option value="${esc(t)}">`).join('')}</datalist>` : '';
  openForm((id ? 'Edit ' : 'Tambah ') + c.title, c.fields(), row || (c.defaults ? c.defaults() : {}), async o => {
    if (c.pre) c.pre(o);
    await dbSave(table, id, o);
    toast('Berjaya disimpan');
    await loadAll();
  }, pre);
}
async function crudDel(table, id) {
  if (!confirm('Padam rekod ini? Tindakan ini tidak boleh dibatalkan.')) return;
  try { await dbDel(table, id); toast('Rekod dipadam'); await loadAll(); }
  catch (e) { toast('Gagal padam: ' + (e.message || e) + ' (rekod mungkin sedang digunakan)', 'err'); }
}

/* ===== TAB 1: PROFIL & LOCENG ===== */
function renderT1() {
  const s = S.settings || {};
  const days = (Array.isArray(s.days_of_week) ? s.days_of_week : DEFAULT_DAYS).join(', ');
  const bells = S.bells.filter(b => b.session_type === sess()).sort((a, b) => a.period_number - b.period_number);
  $('#tab-t1').innerHTML = `
  <div class="grid lg:grid-cols-2 gap-4">
    <div class="${CARD}">
      <h2 class="font-bold text-cyan-400 mb-3 flex items-center gap-2"><i data-lucide="school" class="w-5 h-5"></i> Profil Sekolah</h2>
      <div class="space-y-3">
        <div><label class="text-xs text-slate-400">Nama Sekolah</label><input id="f-name" class="${INP}" value="${esc(s.school_name)}"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="text-xs text-slate-400">Kod Sekolah</label><input id="f-code" class="${INP}" value="${esc(s.school_code)}"></div>
          <div><label class="text-xs text-slate-400">Sesi Akademik</label><input id="f-year" class="${INP}" value="${esc(s.academic_year)}" placeholder="2026"></div>
        </div>
        <div><label class="text-xs text-slate-400">Hari Persekolahan (pisahkan dengan koma)</label><input id="f-days" class="${INP}" value="${esc(days)}"></div>
        <div><label class="text-xs text-slate-400">URL Logo</label><input id="f-logo" class="${INP}" value="${s.logo_url && s.logo_url.startsWith('data:') ? '' : esc(s.logo_url)}" placeholder="https://... atau muat naik fail di bawah"></div>
        <div class="flex items-center gap-3">
          <input type="file" id="f-logofile" accept="image/*" class="text-xs text-slate-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-amber-500/20 file:text-amber-300">
          <img id="logo-prev" src="${esc(s.logo_url || '')}" class="h-14 w-14 object-contain rounded-lg bg-slate-950 ${s.logo_url ? '' : 'hidden'}" alt="">
        </div>
        <input type="hidden" id="f-logo64" value="${s.logo_url && s.logo_url.startsWith('data:') ? esc(s.logo_url) : ''}">
        <button data-act="saveSchool" class="${BTN}">Simpan Profil</button>
      </div>
    </div>
    <div class="${CARD}">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 class="font-bold text-emerald-400 flex items-center gap-2"><i data-lucide="bell" class="w-5 h-5"></i> Waktu Loceng — Sesi ${sess()}</h2>
        <div class="flex gap-2"><button data-act="genBells" class="${BTNA}">Jana Waktu Loceng Piawai</button><button data-act="add" data-t="bell_schedules" class="${BTNG}">+ Waktu</button></div>
      </div>
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead class="text-xs text-slate-500 text-left"><tr><th class="py-1">#</th><th>Label</th><th>Mula</th><th>Tamat</th><th>Rehat</th><th></th></tr></thead>
        <tbody>${bells.map(b => `<tr class="border-t border-slate-800 ${b.is_recess ? 'bg-amber-500/10' : ''}">
          <td class="py-1.5 text-cyan-400 font-bold">${b.period_number}</td><td>${esc(b.label)}</td><td>${hhmm(b.start_time)}</td><td>${hhmm(b.end_time)}</td>
          <td>${b.is_recess ? `<span class="text-amber-400 text-xs">${esc(b.recess_level || 'Rehat')}</span>` : ''}</td>
          <td class="text-right whitespace-nowrap"><button data-act="edit" data-t="bell_schedules" data-id="${b.id}" class="${BTNE}">Edit</button><button data-act="del" data-t="bell_schedules" data-id="${b.id}" class="${BTND}">Padam</button></td></tr>`).join('') || '<tr><td colspan="6" class="py-4 text-center text-slate-500">Tiada waktu loceng. Klik "Jana Waktu Loceng Piawai".</td></tr>'}</tbody>
      </table></div>
    </div>
  </div>`;
}
function resizeImage(file, max = 256) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('Gagal membaca fail'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error('Fail bukan imej sah'));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/png'));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
async function saveSchool() {
  const name = $('#f-name').value.trim();
  if (!name) return toast('Nama sekolah wajib diisi', 'warn');
  const obj = {
    school_name: name,
    school_code: $('#f-code').value.trim() || null,
    academic_year: $('#f-year').value.trim() || null,
    logo_url: $('#f-logo64').value || $('#f-logo').value.trim() || null,
    days_of_week: $('#f-days').value.split(',').map(x => x.trim()).filter(Boolean)
  };
  try { await dbSave('school_settings', S.settings?.id, obj); toast('Profil sekolah disimpan'); await loadAll(); }
  catch (e) { toast('Gagal simpan profil: ' + (e.message || e), 'err'); }
}
async function genBells() {
  if (!sb) return toast('Belum bersambung ke Supabase', 'err');
  const existing = S.bells.filter(b => b.session_type === sess());
  if (existing.length && !confirm(`Ini akan MENGGANTI ${existing.length} waktu loceng Sesi ${sess()}. Teruskan?`)) return;
  const rows = []; let t = sess() === 'Pagi' ? '07:30' : '13:10';
  for (let i = 1; i <= 12; i++) {
    const rec = i === 5, end = addMin(t, rec ? 20 : 30);
    rows.push({ session_type: sess(), period_number: i, label: rec ? 'Rehat' : 'Waktu ' + i, start_time: t, end_time: end, is_recess: rec, recess_level: rec ? 'Semua' : null });
    t = end;
  }
  try {
    const d = await sb.from('bell_schedules').delete().eq('session_type', sess()); if (d.error) throw d.error;
    const r = await sb.from('bell_schedules').insert(rows); if (r.error) throw r.error;
    toast('Waktu loceng piawai dijana (1–12)'); await loadAll();
  } catch (e) { toast('Gagal jana waktu loceng: ' + (e.message || e), 'err'); }
}

/* ===== TAB 2: GURU, KELAS, SUBJEK ===== */
const teacherLoad = id => S.assigns.filter(a => (a.teacher_ids || []).includes(id)).reduce((n, a) => n + (a.periods_per_week || 0), 0);
function renderT2() {
  const teachers = S.teachers.filter(t => t.session_type === sess() || t.session_type === 'Kedua-dua');
  const classes = S.classes.filter(c => c.session_type === sess());
  const head = (title, color, t, n) => `<div class="flex items-center justify-between mb-3"><h2 class="font-bold ${color}">${title} <span class="text-xs text-slate-500">(${n})</span></h2><button data-act="add" data-t="${t}" class="${BTNG}">+ Tambah</button></div>`;
  const acts = (t, id) => `<div class="whitespace-nowrap"><button data-act="edit" data-t="${t}" data-id="${id}" class="${BTNE}">Edit</button><button data-act="del" data-t="${t}" data-id="${id}" class="${BTND}">Padam</button></div>`;
  $('#tab-t2').innerHTML = `
  <div class="${CARD} mb-4">${head('Guru — Sesi ' + sess(), 'text-cyan-400', 'teachers', teachers.length)}
    <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">${teachers.map(t => {
      const L = teacherLoad(t.id), M = t.max_periods_per_week || 0, p = M ? Math.min(100, L / M * 100) : 0;
      const col = L > M ? 'bg-pink-500' : p > 85 ? 'bg-amber-400' : 'bg-emerald-400';
      return `<div class="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
        <div class="flex justify-between items-start gap-2"><div class="min-w-0"><div class="font-semibold truncate">${esc(t.name)}</div><div class="text-xs text-slate-500">${esc(t.role_title || '—')} · <span class="text-cyan-400">${esc(t.short_code)}</span> · ${esc(t.session_type)}</div></div>${acts('teachers', t.id)}</div>
        <div class="mt-2 text-xs flex justify-between"><span>Bebanan: <b class="${L > M ? 'text-pink-400' : 'text-emerald-400'}">${L}</b> / ${M} waktu</span><span class="text-slate-500">Relief max ${t.max_relief_per_week ?? 0}${t.is_relief_exempt ? ' · <span class="text-amber-400">Dikecualikan</span>' : ''}</span></div>
        <div class="h-1.5 bg-slate-800 rounded mt-1"><div class="h-1.5 rounded ${col}" style="width:${p}%"></div></div>
        ${L > M ? '<div class="text-xs text-pink-400 mt-1">⚠ Melebihi had waktu mengajar</div>' : ''}</div>`;
    }).join('') || '<div class="text-slate-500 text-sm">Tiada guru untuk sesi ini.</div>'}</div></div>
  <div class="grid lg:grid-cols-2 gap-4">
    <div class="${CARD}">${head('Kelas — Sesi ' + sess(), 'text-emerald-400', 'classes', classes.length)}
      <div class="space-y-1">${classes.map(c => { const h = byId(S.teachers, c.homeroom_teacher_id); return `<div class="flex justify-between items-center border-t border-slate-800 py-1.5 text-sm"><div><b>${esc(c.class_name)}</b> <span class="text-xs text-slate-500">Thn ${c.year_level ?? '-'} · Guru Kelas: ${h ? esc(h.short_code) : '—'}</span></div>${acts('classes', c.id)}</div>`; }).join('') || '<div class="text-slate-500 text-sm">Tiada kelas.</div>'}</div></div>
    <div class="${CARD}">${head('Mata Pelajaran', 'text-amber-400', 'subjects', S.subjects.length)}
      <div class="grid sm:grid-cols-2 gap-2">${S.subjects.map(s => `<div class="rounded-lg p-2 border flex justify-between items-center" style="border-color:${esc(s.color_hex)};background:${esc(s.color_hex)}1f"><div class="text-sm min-w-0"><b style="color:${esc(s.color_hex)}">${esc(s.subject_code)}</b> <span class="truncate">${esc(s.subject_name)}</span>${s.requires_double_period ? '<span class="text-[10px] text-amber-400 ml-1">2×</span>' : ''}${s.preferred_morning_only ? '<span class="text-[10px] text-cyan-400 ml-1">☀</span>' : ''}</div>${acts('subjects', s.id)}</div>`).join('') || '<div class="text-slate-500 text-sm">Tiada mata pelajaran.</div>'}</div></div>
  </div>`;
}

/* ===== TAB 3: AGIHAN TUGAS ===== */
function assignRow(a) {
  const sub = byId(S.subjects, a.subject_id), col = sub?.color_hex || '#94a3b8';
  const T = (a.teacher_ids || []).map(i => byId(S.teachers, i)?.short_code || '?').join(' + ');
  const C = (a.class_ids || []).map(i => byId(S.classes, i)?.class_name || '?').join(' + ');
  const co = (a.teacher_ids || []).length > 1 ? '<span class="text-[10px] px-1.5 rounded bg-cyan-500/20 text-cyan-300">Co-Teaching</span>' : '';
  const cc = (a.class_ids || []).length > 1 ? '<span class="text-[10px] px-1.5 rounded bg-emerald-500/20 text-emerald-300">Kelas Bergabung</span>' : '';
  return `<div class="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 border-l-4 rounded-lg p-2.5" style="border-color:${esc(col)}">
    <div class="text-sm min-w-0"><b style="color:${esc(col)}">${esc(sub?.subject_code || '?')}</b> · <span class="text-cyan-300">${esc(T)}</span> → <span class="text-emerald-300">${esc(C)}</span> ${co} ${cc}</div>
    <div class="flex items-center gap-2 text-xs"><span class="px-2 py-0.5 rounded bg-slate-800">${a.periods_per_week} wkt/mgu</span><span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">${esc(a.period_split || '-')}</span>
    <button data-act="edit" data-t="teaching_assignments" data-id="${a.id}" class="${BTNE}">Edit</button><button data-act="del" data-t="teaching_assignments" data-id="${a.id}" class="${BTND}">Padam</button></div></div>`;
}
function renderT3() {
  const list = S.assigns.filter(a => a.session_type === sess());
  const groups = {}, singles = [];
  list.forEach(a => a.concurrent_group_tag ? (groups[a.concurrent_group_tag] ||= []).push(a) : singles.push(a));
  const total = list.reduce((n, a) => n + (a.periods_per_week || 0), 0);
  $('#tab-t3').innerHTML = `
  <div class="${CARD}">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div><h2 class="font-bold text-cyan-400">Agihan Tugas — Sesi ${sess()}</h2><div class="text-xs text-slate-500">${list.length} agihan · ${total} waktu · ${Object.keys(groups).length} kumpulan serentak</div></div>
      <button data-act="add" data-t="teaching_assignments" class="${BTNG}">+ Agihan Baharu</button></div>
    ${Object.entries(groups).map(([tag, items]) => `
      <div class="mb-3 border border-pink-500/50 rounded-xl p-3 bg-pink-500/5 shadow-[0_0_14px_-6px_#ec4899]">
        <div class="flex items-center gap-2 mb-2"><i data-lucide="link" class="w-4 h-4 text-pink-500"></i><b class="text-pink-400 text-sm">${esc(tag)}</b><span class="text-xs text-slate-400">— wajib dijadualkan pada hari & waktu yang sama (${items.length} agihan)</span></div>
        <div class="space-y-2">${items.map(assignRow).join('')}</div></div>`).join('')}
    <div class="space-y-2">${singles.map(assignRow).join('')}</div>
    ${list.length ? '' : '<div class="text-center text-slate-500 py-6 text-sm">Belum ada agihan tugas untuk sesi ini.</div>'}
  </div>`;
}

/* ===== PAPARAN & NAVIGASI ===== */
function renderHeader() {
  const s = S.settings;
  $('#hdr-school').textContent = s?.school_name || 'Sistem Jadual Waktu Pintar';
  $('#hdr-sub').textContent = s ? `${s.school_code || ''} ${s.academic_year ? '· ' + s.academic_year : ''}`.trim() || 'Gaya aSc Timetables' : 'Gaya aSc Timetables';
  const img = $('#hdr-logo');
  if (s?.logo_url) { img.src = s.logo_url; img.classList.remove('hidden'); } else img.classList.add('hidden');
  document.querySelectorAll('.sess-btn').forEach(b => b.classList.toggle('active', b.dataset.sess === S.session));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === S.tab));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + S.tab));
}
function renderAll() {
  renderHeader();
  try { renderT1(); renderT2(); renderT3(); }
  catch (e) { console.error(e); toast('Ralat paparan: ' + e.message, 'err'); }
  icons();
}

/* ===== PENGENDALI PERISTIWA ===== */
const ACT = {
  add: b => crudForm(b.dataset.t),
  edit: b => crudForm(b.dataset.t, b.dataset.id),
  del: b => crudDel(b.dataset.t, b.dataset.id),
  saveSchool, genBells,
  openConn: () => { const c = getCfg(); $('#conn-url').value = c.url; $('#conn-key').value = c.key; $('#conn-modal').classList.replace('hidden', 'flex'); },
  closeConn: () => $('#conn-modal').classList.replace('flex', 'hidden'),
  saveConn: async () => {
    const u = $('#conn-url').value.trim(), k = $('#conn-key').value.trim();
    if (!/^https:\/\/.+/.test(u) || !k) return toast('URL (https://...) dan Anon Key wajib diisi', 'warn');
    localStorage.setItem('sb_url', u); localStorage.setItem('sb_key', k);
    ACT.closeConn(); initClient(); await loadAll();
  },
  resetConn: () => { localStorage.removeItem('sb_url'); localStorage.removeItem('sb_key'); toast('Kembali kepada konfigurasi lalai app.js', 'warn'); ACT.openConn(); }
};
document.addEventListener('click', e => {
  const sb_ = e.target.closest('[data-sess]');
  if (sb_) { S.session = sb_.dataset.sess; return renderAll(); }
  const tb = e.target.closest('[data-tab]');
  if (tb) { S.tab = tb.dataset.tab; return renderHeader(); }
  const a = e.target.closest('[data-act]');
  if (a && ACT[a.dataset.act]) ACT[a.dataset.act](a);
});
document.addEventListener('change', async e => {
  if (e.target.id !== 'f-logofile' || !e.target.files[0]) return;
  try {
    const d = await resizeImage(e.target.files[0]);
    $('#f-logo64').value = d; $('#logo-prev').src = d; $('#logo-prev').classList.remove('hidden');
    toast('Logo ditukar kepada Base64 — klik "Simpan Profil"', 'warn');
  } catch (err) { toast(err.message, 'err'); }
});
document.addEventListener('input', e => { if (e.target.id === 'f-logo') $('#f-logo64').value = ''; });
window.addEventListener('DOMContentLoaded', async () => {
  renderAll();
  if (initClient()) await loadAll(); else ACT.openConn();
});

/* =====================================================================
   FASA 2: TAB 4 (PAPAN JADUAL + ENJIN AUTO-GENERATE) & TAB 6 (CETAKAN)
   ===================================================================== */
Object.assign(S, { slots: [], view: 'class', sel: null, drag: null, hov: null, report: null, pMode: 'teacher', pScope: 'one', pId: '' });
const bellsOf = () => S.bells.filter(b => b.session_type === sess()).sort((a, b) => a.period_number - b.period_number);
const daysList = () => (Array.isArray(S.settings?.days_of_week) && S.settings.days_of_week.length ? S.settings.days_of_week : DEFAULT_DAYS);
const sSlots = () => S.slots.filter(x => x.session_type === sess());
const tCodes = ids => (ids || []).map(i => byId(S.teachers, i)?.short_code || '?').join('+');
const cNames = ids => (ids || []).map(i => byId(S.classes, i)?.class_name || '?').join(', ');

const _renderAll = renderAll;
renderAll = function () { _renderAll(); try { renderT4(); renderT6(); } catch (e) { console.error(e); toast('Ralat paparan Fasa 2: ' + e.message, 'err'); } icons(); };
const _loadAll = loadAll;
loadAll = async function () {
  if (sb) {
    const r = await sb.from('timetable_slots').select('*');
    if (r.error) toast('Gagal memuat timetable_slots: ' + r.error.message, 'err'); else S.slots = r.data || [];
  }
  await _loadAll();
};

/* ---------- Pengesan Pertindihan ---------- */
function clashPair(a, b) {
  const t = (a.teacher_ids || []).filter(x => (b.teacher_ids || []).includes(x));
  if (t.length) return { type: 'Guru', who: tCodes(t) };
  if (!(a.concurrent_group_tag && a.concurrent_group_tag === b.concurrent_group_tag)) {
    const c = (a.class_ids || []).filter(x => (b.class_ids || []).includes(x));
    if (c.length) return { type: 'Kelas', who: cNames(c) };
  }
  return null;
}
function clashScan(slots) {
  const ids = new Set(), list = [], g = {}, rec = new Set(bellsOf().filter(b => b.is_recess).map(b => b.period_number));
  slots.forEach(s => {
    (g[s.day_name + '|' + s.period_number] ||= []).push(s);
    if (rec.has(s.period_number)) { ids.add(s.id); list.push(`${s.day_name} W${s.period_number}: slot jatuh pada waktu rehat`); }
  });
  for (const k in g) { const a = g[k]; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { const c = clashPair(a[i], a[j]); if (c) { ids.add(a[i].id); ids.add(a[j].id); list.push(`${k.replace('|', ' W')}: ${c.type} ${c.who} bertindih`); } } }
  return { ids, list };
}
const unitOf = s => s.concurrent_group_tag ? S.slots.filter(x => x.session_type === s.session_type && x.day_name === s.day_name && x.period_number === s.period_number && x.concurrent_group_tag === s.concurrent_group_tag) : [s];
function planMove(sid, day, p) {
  const s = S.slots.find(x => x.id === sid);
  if (!s) return { ok: false, msg: 'Slot tidak dijumpai' };
  if (s.day_name === day && s.period_number === p) return { ok: false, msg: '' };
  const U = unitOf(s);
  if (U.some(x => x.is_locked)) return { ok: false, msg: 'Slot dikunci (Freeze) — buka kunci dahulu' };
  const b = bellsOf().find(x => x.period_number === p);
  if (!b || b.is_recess) return { ok: false, msg: 'Tidak boleh diletakkan pada waktu rehat' };
  const inU = new Set(U.map(x => x.id)), at = (d, q) => sSlots().filter(x => x.day_name === d && x.period_number === q);
  const C = at(day, p).filter(t => !inU.has(t.id) && U.some(u => clashPair(u, t)));
  const moves = U.map(u => ({ id: u.id, day_name: day, period_number: p }));
  if (!C.length) return { ok: true, moves };
  const f = U.map(u => clashPair(u, C[0])).find(Boolean), why = `${f.type} ${f.who} bertindih`;
  const V = [...new Map(C.flatMap(unitOf).map(x => [x.id, x])).values()];
  if (V.some(x => x.is_locked)) return { ok: false, msg: why + ' (slot sasaran dikunci)' };
  const inV = new Set(V.map(x => x.id)), rest = at(s.day_name, s.period_number).filter(x => !inU.has(x.id) && !inV.has(x.id));
  if (V.some(v => rest.some(r => clashPair(v, r)))) return { ok: false, msg: why + '; pertukaran juga akan menyebabkan pertindihan' };
  return { ok: true, swap: true, moves: [...moves, ...V.map(v => ({ id: v.id, day_name: s.day_name, period_number: s.period_number }))] };
}
async function applyMoves(moves) {
  if (!sb) return toast('Belum bersambung ke Supabase', 'err');
  moves.forEach(m => Object.assign(S.slots.find(x => x.id === m.id), { day_name: m.day_name, period_number: m.period_number }));
  S.sel = null; renderT4(); renderT6();
  try {
    const r = await Promise.all(moves.map(m => sb.from('timetable_slots').update({ day_name: m.day_name, period_number: m.period_number }).eq('id', m.id)));
    const e = r.find(x => x.error); if (e) throw e.error;
    toast(moves.length > 1 ? 'Slot dipindah / ditukar' : 'Slot dipindahkan');
  } catch (e) { toast('Gagal simpan pemindahan: ' + (e.message || e), 'err'); await loadAll(); }
}

/* ---------- Enjin Auto-Generate (heuristik CSP + percubaan rawak berulang) ---------- */
function genSchedule(assigns, locked, tries = 40) {
  const days = daysList(), per = bellsOf().filter(b => !b.is_recess).map(b => b.period_number), isT = new Set(per);
  const lbl = u => u.members.map(m => `${byId(S.subjects, m.a.subject_id)?.subject_code || '?'} (${tCodes(m.a.teacher_ids)} → ${cNames(m.a.class_ids)})`).join(' / ');
  const blocksFor = a => {
    let bl = String(a.period_split || a.periods_per_week).split('+').map(Number).filter(Boolean);
    if (byId(S.subjects, a.subject_id)?.requires_double_period && bl.length > 1 && bl.every(x => x === 1)) { const n = bl.length; bl = Array(n >> 1).fill(2); if (n % 2) bl.push(1); }
    let rem = locked.filter(l => l.assignment_id === a.id).length;
    while (rem > 0 && bl.length) { if (bl[0] <= rem) rem -= bl.shift(); else { bl[0] -= rem; rem = 0; } }
    return bl;
  };
  const base = [], groups = {};
  assigns.forEach(x => {
    const a = { ...x, teacher_ids: x.teacher_ids || [], class_ids: x.class_ids || [] }, bl = blocksFor(a);
    if (a.concurrent_group_tag) (groups[a.concurrent_group_tag] ||= []).push({ a, bl });
    else bl.forEach(n => base.push({ members: [{ a, n }], size: n, rank: (a.teacher_ids.length > 1 || a.class_ids.length > 1) ? 2 : n > 1 ? 1 : 0 }));
  });
  for (const tag in groups) {
    const g = groups[tag], mx = Math.max(...g.map(m => m.bl.length), 0);
    for (let i = 0; i < mx; i++) { const mem = g.filter(m => m.bl[i]).map(m => ({ a: m.a, n: m.bl[i] })); base.push({ tag, members: mem, size: Math.max(...mem.map(m => m.n)), rank: 3 }); }
  }
  const required = base.reduce((n, u) => n + u.members.reduce((k, m) => k + m.n, 0), 0);
  let best = null;
  for (let it = 0; it < tries; it++) {
    const tb = {}, cb = {}, dl = {}, tl = {}, sd = {}, out = [], unplaced = [];
    const busy = (m, id, k) => m[id]?.has(k), mark = (m, id, k) => (m[id] ||= new Set()).add(k);
    const reg = (s, d, p) => {
      const k = d + '|' + p;
      (s.teacher_ids || []).forEach(t => { mark(tb, t, k); tl[t + d] = (tl[t + d] || 0) + 1; });
      (s.class_ids || []).forEach(c => { mark(cb, c, k); dl[c + d] = (dl[c + d] || 0) + 1; sd[c + '|' + s.subject_id + '|' + d] = (sd[c + '|' + s.subject_id + '|' + d] || 0) + 1; });
    };
    locked.forEach(l => reg(l, l.day_name, l.period_number));
    const put = (a, d, p) => { const s = { session_type: sess(), day_name: d, period_number: p, assignment_id: a.id, subject_id: a.subject_id, teacher_ids: a.teacher_ids, class_ids: a.class_ids, concurrent_group_tag: a.concurrent_group_tag || null, is_locked: false, slot_note: null }; out.push(s); reg(s, d, p); };
    const place = (u, n) => {
      const tch = u.members.flatMap(m => m.a.teacher_ids), cls = [...new Set(u.members.flatMap(m => m.a.class_ids))];
      if (new Set(tch).size !== tch.length) return false;
      let bs = Infinity, bc = null;
      for (const d of days) for (const p of per) {
        let ok = true;
        for (let j = 0; j < n && ok; j++) { const q = p + j, k = d + '|' + q; if (!isT.has(q) || tch.some(t => busy(tb, t, k)) || cls.some(c => busy(cb, c, k))) ok = false; }
        if (!ok) continue;
        const idx = per.indexOf(p); let sc = Math.random() * (it ? 4 : .5) + idx * .15;
        cls.forEach(c => { sc += (dl[c + d] || 0) * 1.5; u.members.forEach(m => { if (m.a.class_ids.includes(c)) sc += (sd[c + '|' + m.a.subject_id + '|' + d] || 0) * (n > 1 ? 2 : 12); }); });
        tch.forEach(t => sc += (tl[t + d] || 0));
        u.members.forEach(m => { if (byId(S.subjects, m.a.subject_id)?.preferred_morning_only && idx >= per.length / 2) sc += 6; });
        if (sc < bs) { bs = sc; bc = [d, p]; }
      }
      if (!bc) return false;
      u.members.forEach(m => { for (let j = 0; j < m.n; j++) put(m.a, bc[0], bc[1] + j); });
      return true;
    };
    const units = base.map(u => ({ ...u, key: u.rank * 1000 + u.size * 100 + u.members.length + (it ? Math.random() * 30 : 0) })).sort((a, b) => b.key - a.key);
    for (const u of units) {
      if (place(u, u.size)) continue;
      if (u.size > 1) for (let j = 0; j < u.size; j++) { const su = { ...u, size: 1, members: u.members.filter(m => m.n > j).map(m => ({ a: m.a, n: 1 })) }; if (!place(su, 1)) unplaced.push(lbl(su)); }
      else unplaced.push(lbl(u));
    }
    if (!best || unplaced.length < best.unplaced.length) best = { out, unplaced };
    if (!unplaced.length) break;
  }
  const cnt = {}; [...locked, ...best.out].forEach(s => (s.teacher_ids || []).forEach(t => cnt[t] = (cnt[t] || 0) + 1));
  best.over = S.teachers.filter(t => t.max_periods_per_week && (cnt[t.id] || 0) > t.max_periods_per_week).map(t => `${t.short_code}: ${cnt[t.id]}/${t.max_periods_per_week}`);
  best.required = required; return best;
}

/* ---------- TAB 4: PAPAN JADUAL ---------- */
function renderT4() {
  const el = $('#jadual-container'); if (!el) return;
  const bells = bellsOf(), days = daysList(), slots = sSlots(), cl = clashScan(slots), T = S.view === 'teacher';
  const sb_ = v => `class="px-3 py-1.5 ${S.view === v ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'}"`;
  const rows = T ? S.teachers.filter(t => t.session_type === sess() || t.session_type === 'Kedua-dua').map(t => ({ id: t.id, name: t.short_code, sub: t.name }))
    : S.classes.filter(c => c.session_type === sess()).map(c => ({ id: c.id, name: c.class_name, sub: '' }));
  const idx = {}; slots.forEach(s => (T ? s.teacher_ids : s.class_ids || []).forEach(r => (idx[`${r}|${s.day_name}|${s.period_number}`] ||= []).push(s)));
  const card = s => {
    const sub = byId(S.subjects, s.subject_id), col = sub?.color_hex || '#64748b', bad = cl.ids.has(s.id);
    return `<div ${s.is_locked ? '' : 'draggable="true"'} data-sid="${s.id}" class="relative rounded px-1 py-0.5 mb-0.5 leading-tight cursor-pointer border ${bad ? 'border-pink-500' : 'border-transparent'} ${S.sel === s.id ? 'ring-2 ring-amber-400' : ''}" style="background:${esc(col)}33;border-left:3px solid ${esc(col)}">
      <div class="font-bold text-[11px] pr-3" style="color:${esc(col)}">${esc(sub?.subject_code || '?')}</div><div class="text-[9px] text-slate-300 truncate">${esc(tCodes(s.teacher_ids))}</div>${T ? `<div class="text-[9px] text-emerald-300 truncate">${esc(cNames(s.class_ids))}</div>` : ''}
      <button data-act="lock" data-id="${s.id}" class="absolute top-0 right-0 text-[9px] ${s.is_locked ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'}" title="Freeze / Lock">${s.is_locked ? '🔒' : '🔓'}</button></div>`;
  };
  const rp = S.report;
  el.innerHTML = `<div class="${CARD}">
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <div class="flex rounded-lg border border-slate-700 overflow-hidden text-sm"><button data-act="view" data-v="class" ${sb_('class')}>Mengikut Kelas</button><button data-act="view" data-v="teacher" ${sb_('teacher')}>Mengikut Guru</button></div>
      <button data-act="generate" class="${BTNG}">⚡ Jana Jadual Automatik (Sesi ${sess()})</button>
      <span class="text-xs ${cl.list.length ? 'text-pink-400' : 'text-emerald-400'}">${cl.list.length ? '⚠ ' + cl.list.length + ' pertindihan' : '✓ Tiada pertindihan'}</span>
      <span class="text-xs text-slate-500">Klik slot → klik sel sasaran, atau seret. 🔒 = Freeze. ${slots.length} slot.</span></div>
    ${cl.list.length ? `<details class="mb-3 text-xs text-pink-300"><summary class="cursor-pointer">Senarai pertindihan</summary><ul class="list-disc ml-5 mt-1">${cl.list.slice(0, 30).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
    ${rp ? `<details class="mb-3 text-xs ${rp.unplaced.length || rp.over.length ? 'text-amber-300' : 'text-emerald-300'}" ${rp.unplaced.length || rp.over.length ? 'open' : ''}><summary class="cursor-pointer">Laporan janaan: ${rp.out.length}/${rp.required} waktu ditempatkan, ${rp.unplaced.length} gagal${rp.over.length ? ', ' + rp.over.length + ' guru melebihi had' : ''}</summary>
      <ul class="list-disc ml-5 mt-1">${rp.unplaced.map(x => `<li>Tidak dapat ditempatkan: ${esc(x)}</li>`).join('')}${rp.over.map(x => `<li>Melebihi had waktu: ${esc(x)}</li>`).join('')}</ul></details>` : ''}
    ${bells.length ? `<div class="overflow-auto max-h-[70vh] border border-slate-800 rounded-lg"><table class="border-collapse text-xs">
      <thead class="sticky top-0 z-20 bg-slate-900"><tr><th rowspan="2" class="sticky left-0 z-30 bg-slate-900 border border-slate-800 p-2 min-w-[90px]">${T ? 'Guru' : 'Kelas'}</th>${days.map(d => `<th colspan="${bells.length}" class="border border-slate-700 border-l-2 border-l-cyan-400/50 py-1 text-cyan-300">${esc(d)}</th>`).join('')}</tr>
      <tr>${days.map(() => bells.map(b => `<th title="${hhmm(b.start_time)}–${hhmm(b.end_time)}" class="border border-slate-800 py-0.5 text-slate-400 ${b.is_recess ? 'bg-amber-500/10 text-amber-400' : ''}">${b.is_recess ? 'R' : b.period_number}</th>`).join('')).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr><td class="sticky left-0 z-10 bg-slate-900 border border-slate-800 px-2 py-1 font-semibold whitespace-nowrap">${esc(r.name)}<div class="text-[9px] font-normal text-slate-500 max-w-[110px] truncate">${esc(r.sub)}</div></td>
        ${days.map(d => bells.map(b => b.is_recess ? `<td class="border border-slate-800 bg-amber-500/10 w-5"></td>` : `<td data-d="${esc(d)}" data-p="${b.period_number}" class="border border-slate-800 align-top p-0.5 min-w-[58px] ${b.period_number === bells[0].period_number ? 'border-l-2 border-l-cyan-400/30' : ''}">${(idx[`${r.id}|${d}|${b.period_number}`] || []).map(card).join('')}</td>`).join('')).join('')}</tr>`).join('') || '<tr><td class="p-4 text-slate-500">Tiada data baris untuk sesi ini.</td></tr>'}</tbody></table></div>`
      : '<div class="text-slate-500 text-sm py-6 text-center">Tetapkan Waktu Loceng di Tab 1 dahulu.</div>'}</div>`;
}
Object.assign(ACT, {
  view: b => { S.view = b.dataset.v; S.sel = null; renderT4(); },
  lock: async b => {
    const s = S.slots.find(x => x.id === b.dataset.id); if (!s || !sb) return;
    const U = unitOf(s), v = !s.is_locked;
    const r = await Promise.all(U.map(u => sb.from('timetable_slots').update({ is_locked: v }).eq('id', u.id)));
    if (r.some(x => x.error)) return toast('Gagal tukar status kunci: ' + r.find(x => x.error).error.message, 'err');
    U.forEach(u => u.is_locked = v); renderT4(); toast(v ? 'Slot dikunci (Freeze)' : 'Kunci dibuka');
  },
  generate: async () => {
    if (!sb) return toast('Belum bersambung ke Supabase', 'err');
    const as = S.assigns.filter(a => a.session_type === sess());
    if (!as.length) return toast('Tiada agihan tugas untuk sesi ini (Tab 3)', 'warn');
    if (!bellsOf().some(b => !b.is_recess)) return toast('Tetapkan Waktu Loceng di Tab 1 dahulu', 'warn');
    const locked = sSlots().filter(x => x.is_locked === true);
    toast('Menjana jadual…', 'warn'); await new Promise(r => setTimeout(r, 40));
    let r; try { r = genSchedule(as, locked); } catch (e) { return toast('Ralat enjin: ' + e.message, 'err'); }
    S.report = r;
    if (!confirm(`Dijana ${r.out.length}/${r.required} waktu; ${r.unplaced.length} gagal ditempatkan; ${locked.length} slot dikunci dikekalkan.\n\nGantikan semua slot TIDAK dikunci bagi Sesi ${sess()} dengan hasil ini?`)) return renderT4();
    try {
      const d = await sb.from('timetable_slots').delete().eq('session_type', sess()).or('is_locked.is.null,is_locked.eq.false'); if (d.error) throw d.error;
      for (let i = 0; i < r.out.length; i += 400) { const x = await sb.from('timetable_slots').insert(r.out.slice(i, i + 400)); if (x.error) throw x.error; }
      toast(`Jadual disimpan (${r.out.length} slot)`); await loadAll();
    } catch (e) { toast('Gagal simpan jadual: ' + (e.message || e), 'err'); await loadAll(); }
  },
  print: () => window.print()
});
document.addEventListener('dragstart', e => { const c = e.target.closest?.('[data-sid]'); if (!c) return; S.drag = c.dataset.sid; e.dataTransfer.setData('text/plain', S.drag); e.dataTransfer.effectAllowed = 'move'; });
document.addEventListener('dragover', e => {
  const td = e.target.closest?.('td[data-p]'); if (!td || !S.drag) return; e.preventDefault();
  if (S.hov !== td) { if (S.hov) S.hov.style.outline = ''; S.hov = td; const r = planMove(S.drag, td.dataset.d, +td.dataset.p); td.style.outline = r.ok ? '2px solid #34d399' : '2px solid #ec4899'; }
});
const endDrag = () => { if (S.hov) S.hov.style.outline = ''; S.hov = null; S.drag = null; };
document.addEventListener('dragend', endDrag);
document.addEventListener('drop', e => {
  const td = e.target.closest?.('td[data-p]'); if (!td || !S.drag) return; e.preventDefault();
  const sid = S.drag; endDrag(); const r = planMove(sid, td.dataset.d, +td.dataset.p);
  if (r.ok) applyMoves(r.moves); else if (r.msg) toast(r.msg, 'warn');
});
document.addEventListener('click', e => {
  const td = e.target.closest?.('#jadual-container td[data-p]'); if (!td || e.target.closest('[data-act]')) return;
  const card = e.target.closest('[data-sid]');
  if (!S.sel) { if (card) { S.sel = card.dataset.sid; renderT4(); } return; }
  if (card && card.dataset.sid === S.sel) { S.sel = null; return renderT4(); }
  const sid = S.sel, r = planMove(sid, td.dataset.d, +td.dataset.p);
  if (r.ok) applyMoves(r.moves); else { S.sel = null; if (r.msg) toast(r.msg, 'warn'); renderT4(); }
});

/* ---------- TAB 6: PREVIEW & CETAKAN ---------- */
(function () {
  const st = document.createElement('style');
  st.textContent = `.page{background:#fff;color:#000;width:297mm;min-height:200mm;padding:8mm 10mm;margin:0 auto 16px;box-sizing:border-box;display:flex;flex-direction:column;font-family:Arial,Helvetica,sans-serif;box-shadow:0 0 22px rgba(34,211,238,.25);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:3mm;margin-bottom:4mm}.page .hd .l{display:flex;gap:4mm;align-items:center}.page .hd img{height:20mm;width:20mm;object-fit:contain}
.page .big{font-size:26pt;font-weight:800;text-align:right;line-height:1.1}.page .cap{font-size:9pt;text-align:right;letter-spacing:.1em}
.page table{border-collapse:collapse;width:100%;table-layout:fixed}.mx th,.mx td{border:1px solid #000;text-align:center;font-size:8pt;padding:0}.mx th{background:#e5e7eb;padding:1mm}
.mx td.d{background:#e5e7eb;font-weight:700;width:18mm;font-size:9pt}.mx th.d{width:18mm}.mx .rc{background:#f3f4f6;width:7mm;font-size:6pt}.cell{display:flex;flex-direction:column;min-height:17mm}
.sl{position:relative;flex:1;display:flex;align-items:center;justify-content:center;min-height:8mm}.sl b{font-size:10pt}.sl i{position:absolute;bottom:.5mm;font-size:6.5pt;font-style:normal}.sl .cl{left:1mm}.sl .tc{right:1mm}
.sum{margin-top:5mm;font-size:8.5pt}.sum th,.sum td{border:1px solid #000;padding:1mm 2mm;text-align:left}.sum th{background:#e5e7eb}.sum .tot td{font-weight:800;background:#f3f4f6}
.sig{margin-top:auto;padding-top:6mm;display:flex;justify-content:space-between;break-inside:avoid}.sig div{width:75mm;text-align:center;font-size:9pt}.sig .ln{border-top:1px solid #000;margin-top:14mm;padding-top:1mm}.pb{page-break-after:always;break-after:page}
@page{size:A4 landscape;margin:6mm}
@media print{body{background:#fff!important}main{padding:0!important;max-width:none!important}#print-area{overflow:visible!important}.page{box-shadow:none;margin:0;width:auto;min-height:196mm}.page:last-child{page-break-after:auto;break-after:auto}}`;
  document.head.appendChild(st);
})();
function pageHtml(e) {
  const s = S.settings || {}, bells = bellsOf(), days = daysList(), T = S.pMode === 'teacher', slots = sSlots().filter(x => (T ? x.teacher_ids : x.class_ids || []).includes(e.id));
  const head = `<tr><th class="d">HARI</th>${bells.map(b => b.is_recess ? `<th class="rc">${esc(b.label)}</th>` : `<th><b>${esc(b.label)}</b><br><small>${hhmm(b.start_time)}–${hhmm(b.end_time)}</small></th>`).join('')}</tr>`;
  const body = days.map(d => `<tr><td class="d">${esc(d)}</td>${bells.map(b => b.is_recess ? '<td class="rc"></td>' : `<td><div class="cell">${slots.filter(x => x.day_name === d && x.period_number === b.period_number).map(x => { const sub = byId(S.subjects, x.subject_id); return `<div class="sl" style="background:${esc(sub?.color_hex || '#ccc')}2e"><b>${esc(sub?.subject_code || '?')}</b><i class="cl">${esc(cNames(x.class_ids))}</i><i class="tc">${esc(tCodes(x.teacher_ids).replace(/\+/g, '/'))}</i></div>`; }).join('')}</div></td>`).join('')}</tr>`).join('');
  let sum = '';
  if (T) {
    let tot = 0;
    const trs = S.assigns.filter(a => a.session_type === sess() && (a.teacher_ids || []).includes(e.id)).map((a, i) => { const sub = byId(S.subjects, a.subject_id); tot += a.periods_per_week || 0; return `<tr><td>${i + 1}</td><td>${esc(sub?.subject_code || '?')}</td><td>${esc(sub?.subject_name || '')}</td><td>${esc(cNames(a.class_ids))}</td><td>${a.periods_per_week || 0}</td></tr>`; }).join('');
    sum = `<table class="sum"><thead><tr><th style="width:12mm">Bil</th><th style="width:28mm">Kod Subjek</th><th>Nama Mata Pelajaran</th><th>Kelas</th><th style="width:38mm">Jumlah Waktu Seminggu</th></tr></thead><tbody>${trs}<tr class="tot"><td colspan="4">JUMLAH KESELURUHAN WAKTU MENGAJAR</td><td>${tot}</td></tr></tbody></table>`;
  }
  const hr = !T && byId(S.teachers, byId(S.classes, e.id)?.homeroom_teacher_id)?.name;
  return `<div class="page pb"><div class="hd"><div class="l">${s.logo_url ? `<img src="${esc(s.logo_url)}" alt="">` : ''}<div><div style="font-size:15pt;font-weight:800">${esc(s.school_name || 'NAMA SEKOLAH')}</div><div style="font-size:10pt">Sesi ${sess()} · Tahun Akademik ${esc(s.academic_year || '')}${s.school_code ? ' · ' + esc(s.school_code) : ''}</div></div></div>
    <div><div class="cap">${T ? 'JADUAL WAKTU GURU' : 'JADUAL WAKTU KELAS'}</div><div class="big">${esc(e.name)}</div></div></div>
    <table class="mx"><thead>${head}</thead><tbody>${body}</tbody></table>${sum}
    <div class="sig"><div><div class="ln">Tandatangan ${T ? 'Guru' : 'Guru Kelas'}</div>${esc(T ? e.name : hr || '')}</div><div><div class="ln">Tandatangan Guru Besar</div>&nbsp;</div></div></div>`;
}
function renderT6() {
  const el = $('#cetak-container'); if (!el) return;
  const T = S.pMode === 'teacher';
  const ents = T ? S.teachers.filter(t => t.session_type === sess() || t.session_type === 'Kedua-dua').map(t => ({ id: t.id, name: t.name })) : S.classes.filter(c => c.session_type === sess()).map(c => ({ id: c.id, name: c.class_name }));
  if (!ents.find(x => x.id === S.pId)) S.pId = ents[0]?.id || '';
  const list = S.pScope === 'all' ? ents : ents.filter(x => x.id === S.pId);
  const sel = (k, opts, v) => `<select data-pr="${k}" class="${INP} !w-auto">${opts.map(([a, b]) => `<option value="${esc(a)}" ${a === v ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  el.innerHTML = `<div class="${CARD} mb-4 no-print flex flex-wrap items-center gap-3">
    <b class="text-pink-400">Cetakan Rasmi</b>${sel('pMode', [['teacher', 'Jadual Mengikut Guru'], ['class', 'Jadual Mengikut Kelas']], S.pMode)}
    ${sel('pScope', [['one', 'Satu ' + (T ? 'Guru' : 'Kelas')], ['all', 'Cetak Semua Sekaligus']], S.pScope)}
    ${S.pScope === 'one' ? sel('pId', ents.map(x => [x.id, x.name]), S.pId) : `<span class="text-xs text-slate-400">${ents.length} halaman</span>`}
    <button data-act="print" class="${BTN}">🖨 Cetak / Simpan PDF (A4 Landskap)</button><span class="text-xs text-slate-500">Pratonton sentiasa bertema putih.</span></div>
    <div id="print-area" class="overflow-x-auto">${list.length ? list.map(pageHtml).join('') : '<div class="text-slate-500 text-sm">Tiada data untuk dicetak.</div>'}</div>`;
}
document.addEventListener('change', e => { const k = e.target.dataset?.pr; if (!k) return; S[k] = e.target.value; if (k === 'pMode') S.pId = ''; renderT6(); });

/* =====================================================================
   FASA 3: TAB 5 - PENGURUSAN GURU GANTI (RELIEF) PINTAR
   ===================================================================== */
const DN = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOf = d => d ? DN[new Date(d + 'T00:00:00').getDay()] : '';
const fdate = d => (d || '').split('-').reverse().join('/');
const tn = id => byId(S.teachers, id)?.name || '?';
function weekRange(d) { const x = new Date(d + 'T00:00:00'), a = new Date(x); a.setDate(x.getDate() - (x.getDay() + 6) % 7); const b = new Date(a); b.setDate(a.getDate() + 6); return [ymd(a), ymd(b)]; }
Object.assign(S, { leaves: [], reliefs: [], rDate: ymd(new Date()), rSess: 'Pagi' });

const _renderAll3 = renderAll;
renderAll = function () { _renderAll3(); try { renderT5(); } catch (e) { console.error(e); toast('Ralat paparan Tab 5: ' + e.message, 'err'); } icons(); };
const _loadAll3 = loadAll;
loadAll = async function () {
  if (sb) {
    const [a, b] = await Promise.all([sb.from('teacher_leaves').select('*'), sb.from('relief_assignments').select('*')]);
    if (a.error || b.error) toast('Gagal memuat data relief: ' + (a.error || b.error).message, 'err'); else { S.leaves = a.data || []; S.reliefs = b.data || []; }
  }
  await _loadAll3();
};

/* ---------- Enjin kelayakan & cadangan ---------- */
const tspan = (sn, p) => { const b = S.bells.find(x => x.session_type === sn && x.period_number === p); return b ? [hhmm(b.start_time), hhmm(b.end_time)] : null; };
const overlap = (s1, p1, s2, p2) => { const a = tspan(s1, p1), b = tspan(s2, p2); return a && b ? a[0] < b[1] && b[0] < a[1] : s1 === s2 && p1 === p2; };
const findSlot = r => S.slots.find(s => s.session_type === r.session_type && s.day_name === r.day_name && s.period_number === r.period_number && (s.teacher_ids || []).includes(r.absent_teacher_id));
function relBusy(tid, r) { // bertindih masa dengan jadual tetap (mana-mana sesi) atau relief lain pada tarikh sama
  return S.slots.some(s => s.day_name === r.day_name && (s.teacher_ids || []).includes(tid) && overlap(s.session_type, s.period_number, r.session_type, r.period_number))
    || S.reliefs.some(x => x.id !== r.id && x.relief_teacher_id === tid && x.status !== 'Tidak Perlu' && x.leave_date === r.leave_date && overlap(x.session_type, x.period_number, r.session_type, r.period_number));
}
function relCands(r) {
  const slot = findSlot(r), cls = slot?.class_ids || [], [ws, we] = weekRange(r.leave_date);
  const absent = new Set(S.leaves.filter(l => l.leave_date === r.leave_date).map(l => l.absent_teacher_id));
  return S.teachers.filter(t => (t.session_type === r.session_type || t.session_type === 'Kedua-dua') && !t.is_relief_exempt && !absent.has(t.id) && !relBusy(t.id, r)).map(t => {
    const mine = S.slots.filter(s => (s.teacher_ids || []).includes(t.id));
    const rl = S.reliefs.filter(x => x.relief_teacher_id === t.id && x.id !== r.id && x.status !== 'Tidak Perlu');
    const wk = rl.filter(x => x.leave_date >= ws && x.leave_date <= we).length, dy = rl.filter(x => x.leave_date === r.leave_date).length, max = t.max_relief_per_week || 0;
    return { t, wk, dy, max, over: max > 0 && wk >= max, dayLoad: mine.filter(s => s.day_name === r.day_name && s.session_type === r.session_type).length,
      match: mine.some(s => (s.class_ids || []).some(c => cls.includes(c))) ? 2 : (slot && mine.some(s => s.subject_id === slot.subject_id)) ? 1 : 0 };
  }).sort((a, b) => a.over - b.over || a.wk - b.wk || a.dy - b.dy || b.match - a.match || a.dayLoad - b.dayLoad);
}
async function setRelief(id, tid, quiet) {
  const r = S.reliefs.find(x => x.id === id); if (!r || !sb) return false;
  if (tid && relBusy(tid, r)) { toast('Guru ini bertindih waktu dengan kelas/relief lain', 'warn'); return false; }
  const st = tid ? 'Ditugaskan' : 'Menunggu', e = await sb.from('relief_assignments').update({ relief_teacher_id: tid || null, status: st }).eq('id', id);
  if (e.error) { toast('Gagal simpan: ' + e.error.message, 'err'); return false; }
  Object.assign(r, { relief_teacher_id: tid || null, status: st }); if (!quiet) renderT5(); return true;
}

/* ---------- Paparan Tab 5 ---------- */
const reliefRows = () => S.reliefs.filter(r => r.leave_date === S.rDate && r.session_type === S.rSess).sort((a, b) => tn(a.absent_teacher_id).localeCompare(tn(b.absent_teacher_id)) || a.period_number - b.period_number);
const wktLabel = (sn, p) => { const b = S.bells.find(x => x.session_type === sn && x.period_number === p); return b ? `${b.label} (${hhmm(b.start_time)}–${hhmm(b.end_time)})` : 'Waktu ' + p; };
function renderT5() {
  const el = $('#relief-container'); if (!el) return;
  const day = dayOf(S.rDate), valid = daysList().includes(day);
  const leaves = S.leaves.filter(l => l.leave_date === S.rDate && l.session_type === S.rSess), rows = reliefRows();
  const absentDate = new Set(S.leaves.filter(l => l.leave_date === S.rDate).map(l => l.absent_teacher_id));
  const elig = S.teachers.filter(t => (t.session_type === S.rSess || t.session_type === 'Kedua-dua') && !absentDate.has(t.id));
  const reasonOf = id => S.leaves.find(l => l.id === id)?.reason || '';
  const trs = rows.map(r => {
    const slot = findSlot(r), comp = (slot?.teacher_ids || []).filter(t => t !== r.absent_teacher_id && !absentDate.has(t)), skip = r.status === 'Tidak Perlu';
    const opts = skip ? '' : `<option value="">— Pilih guru ganti —</option>` + relCands(r).map(c => `<option value="${c.t.id}" ${c.t.id === r.relief_teacher_id ? 'selected' : ''}>${esc(c.t.name)} (Waktu Hari Ini: ${c.dayLoad} | Relief Minggu Ini: ${c.wk}/${c.max || '∞'})${c.match ? ' ★' : ''}${c.over ? ' ⚠ had' : ''}</option>`).join('');
    return `<tr class="border-t border-slate-800 align-top ${skip ? 'opacity-50' : ''}"><td class="py-2 pr-2"><b>${esc(tn(r.absent_teacher_id))}</b><div class="text-[10px] text-pink-400">${esc(reasonOf(r.leave_id))}</div></td>
      <td class="pr-2 whitespace-nowrap">${esc(wktLabel(r.session_type, r.period_number))}</td><td class="pr-2">${esc(r.class_names)}</td><td class="pr-2">${esc(r.subject_code)}</td>
      <td class="pr-2">${comp.length ? `<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] whitespace-nowrap">Ada Guru Pendamping: ${esc(tCodes(comp))}</span>` : ''}</td>
      <td class="pr-2">${skip ? '<span class="text-xs text-slate-500">Tidak perlu ganti</span>' : `<select data-rsel="${r.id}" class="${INP} !w-72 !py-1">${opts}</select>`}</td>
      <td class="whitespace-nowrap">${skip ? '' : `<button data-act="rSuggest" data-id="${r.id}" class="${BTNA}">Cadang Automatik</button> `}<button data-act="rNone" data-id="${r.id}" class="${BTNE}">${skip ? 'Batal' : 'Tak perlu'}</button></td></tr>`;
  }).join('');
  el.innerHTML = `<div class="${CARD} mb-4 no-print">
    <div class="flex flex-wrap items-end gap-3 mb-3"><b class="text-amber-400 mr-2">Guru Ganti (Relief)</b>
      <div><label class="text-xs text-slate-400">Tarikh</label><input type="date" data-rl="rDate" value="${S.rDate}" class="${INP} !w-auto"></div>
      <div><label class="text-xs text-slate-400">Sesi</label><select data-rl="rSess" class="${INP} !w-auto"><option ${S.rSess === 'Pagi' ? 'selected' : ''}>Pagi</option><option ${S.rSess === 'Petang' ? 'selected' : ''}>Petang</option></select></div>
      <span class="px-3 py-1.5 rounded-lg text-sm ${valid ? 'bg-cyan-500/20 text-cyan-300' : 'bg-pink-500/20 text-pink-300'}">${esc(day)}${valid ? '' : ' — bukan hari persekolahan'}</span></div>
    <div class="text-xs text-slate-400 mb-1">Tandakan guru tidak hadir (hanya guru Sesi ${S.rSess} / Kedua-dua):</div>
    <div class="max-h-40 overflow-y-auto bg-slate-950 border border-slate-700 rounded-lg p-2 grid sm:grid-cols-3 lg:grid-cols-4 gap-1">${elig.map(t => `<label class="flex items-center gap-2 text-xs"><input type="checkbox" name="lv" value="${t.id}" class="accent-pink-500"> ${esc(t.short_code)} ${esc(t.name)}</label>`).join('') || '<span class="text-xs text-slate-500">Tiada guru tersedia</span>'}</div>
    <div class="flex flex-wrap items-end gap-3 mt-3"><div><label class="text-xs text-slate-400">Sebab</label><select id="lv-reason" class="${INP} !w-auto">${['CRK', 'Kursus', 'MC', 'Tugas Rasmi'].map(x => `<option>${x}</option>`).join('')}</select></div>
      <div class="flex-1 min-w-[160px]"><label class="text-xs text-slate-400">Catatan</label><input id="lv-notes" class="${INP}"></div><button data-act="leaveAdd" class="${BTN}" ${valid ? '' : 'disabled'}>+ Tandakan Tidak Hadir</button></div>
    ${leaves.length ? `<div class="flex flex-wrap gap-2 mt-3">${leaves.map(l => `<span class="px-2 py-1 rounded-lg bg-pink-500/15 border border-pink-500/40 text-xs">${esc(tn(l.absent_teacher_id))} · ${esc(l.reason || '')}<button data-act="leaveDel" data-id="${l.id}" class="ml-2 text-pink-400" title="Padam">✕</button></span>`).join('')}</div>` : ''}
  </div>
  <div class="${CARD} mb-4 no-print"><div class="flex flex-wrap items-center justify-between gap-2 mb-3"><b class="text-cyan-400">Slot Perlu Ganti (${rows.length})</b>
    <div class="flex flex-wrap gap-2"><button data-act="rAll" class="${BTNA}">⚡ Cadang Semua Automatik</button><button data-act="waCopy" class="${BTNG}">📋 Salin Mesej WhatsApp/Telegram</button><button data-act="print" class="${BTN}">🖨 Cetak</button></div></div>
    <div class="overflow-x-auto">${rows.length ? `<table class="w-full text-sm"><thead class="text-xs text-slate-500 text-left"><tr><th>Guru Tidak Hadir</th><th>Waktu</th><th>Kelas</th><th>Subjek</th><th></th><th>Guru Ganti</th><th></th></tr></thead><tbody>${trs}</tbody></table>` : '<div class="text-slate-500 text-sm py-4 text-center">Tiada slot. Tandakan guru tidak hadir di atas (slot diambil automatik daripada jadual).</div>'}</div>
    <div class="text-[11px] text-slate-500 mt-2">★ = mengajar kelas/subjek sama · Susunan: relief paling sedikit → kelas/subjek sama → beban harian rendah.</div></div>
  <div id="relief-print" class="overflow-x-auto">${rows.length ? reliefPage(rows) : ''}</div>`;
}
function reliefPage(rows) {
  const s = S.settings || {}, list = rows.filter(r => r.status !== 'Tidak Perlu');
  return `<div class="page"><div class="hd"><div class="l">${s.logo_url ? `<img src="${esc(s.logo_url)}" alt="">` : ''}<div><div style="font-size:15pt;font-weight:800">${esc(s.school_name || 'NAMA SEKOLAH')}</div><div style="font-size:10pt">Sesi ${esc(S.rSess)} · Tahun Akademik ${esc(s.academic_year || '')}</div></div></div>
    <div><div class="cap">SENARAI JADUAL GURU GANTI HARIAN</div><div class="big" style="font-size:20pt">${esc(dayOf(S.rDate))}, ${fdate(S.rDate)}</div></div></div>
    <table class="sum" style="margin-top:0"><thead><tr><th style="width:10mm">Bil</th><th>Guru Tidak Hadir</th><th>Waktu / Masa</th><th>Kelas</th><th>Subjek</th><th>Guru Ganti</th><th style="width:38mm">Tandatangan Makluman</th></tr></thead><tbody>
    ${list.map((r, i) => { const sub = S.subjects.find(x => x.subject_code === r.subject_code); const l = S.leaves.find(x => x.id === r.leave_id);
      return `<tr style="height:11mm"><td>${i + 1}</td><td>${esc(tn(r.absent_teacher_id))}${l?.reason ? ` <small>(${esc(l.reason)})</small>` : ''}</td><td>${esc(wktLabel(r.session_type, r.period_number))}</td><td>${esc(r.class_names)}</td><td>${esc(r.subject_code || '')}${sub ? ' <small>' + esc(sub.subject_name) + '</small>' : ''}</td><td><b>${r.relief_teacher_id ? esc(tn(r.relief_teacher_id)) : '—'}</b></td><td></td></tr>`; }).join('')}</tbody></table>
    <div class="sig"><div><div class="ln">Penyelaras Guru Ganti</div>&nbsp;</div><div><div class="ln">Disahkan: Guru Besar / Penolong Kanan</div>&nbsp;</div></div></div>`;
}
function waText() {
  const rows = reliefRows().filter(r => r.status !== 'Tidak Perlu'), g = {};
  rows.forEach(r => (g[r.absent_teacher_id] ||= []).push(r));
  let t = `📋 *JADUAL GURU GANTI*\n🏫 ${S.settings?.school_name || ''}\n📅 ${dayOf(S.rDate)}, ${fdate(S.rDate)} | Sesi ${S.rSess}\n`;
  for (const id in g) {
    t += `\n👤 *${tn(id)}* (${S.leaves.find(l => l.id === g[id][0].leave_id)?.reason || 'Tidak hadir'})\n`;
    g[id].forEach(r => { const b = tspan(r.session_type, r.period_number); t += `• W${r.period_number}${b ? ` (${b[0]}-${b[1]})` : ''} | ${r.class_names} | ${r.subject_code || ''} ➜ *${r.relief_teacher_id ? tn(r.relief_teacher_id) : 'BELUM DITETAPKAN'}*\n`; });
  }
  return t + '\n_Sila maklum dan laksanakan. Terima kasih._ 🙏';
}
Object.assign(ACT, {
  leaveAdd: async () => {
    if (!sb) return toast('Belum bersambung ke Supabase', 'err');
    const day = dayOf(S.rDate), ids = [...document.querySelectorAll('#relief-container [name="lv"]:checked')].map(x => x.value);
    if (!daysList().includes(day)) return toast('Tarikh bukan hari persekolahan', 'warn');
    if (!ids.length) return toast('Pilih sekurang-kurangnya seorang guru', 'warn');
    try {
      const lr = await sb.from('teacher_leaves').insert(ids.map(i => ({ leave_date: S.rDate, session_type: S.rSess, absent_teacher_id: i, reason: $('#lv-reason').value, notes: $('#lv-notes').value.trim() || null }))).select();
      if (lr.error) throw lr.error;
      const rows = [];
      lr.data.forEach(l => S.slots.filter(s => s.session_type === S.rSess && s.day_name === day && (s.teacher_ids || []).includes(l.absent_teacher_id)).forEach(s => rows.push({
        leave_id: l.id, leave_date: S.rDate, session_type: S.rSess, day_name: day, period_number: s.period_number, class_names: cNames(s.class_ids),
        subject_code: byId(S.subjects, s.subject_id)?.subject_code || null, absent_teacher_id: l.absent_teacher_id, relief_teacher_id: null, status: 'Menunggu', notes: null })));
      if (rows.length) { const rr = await sb.from('relief_assignments').insert(rows); if (rr.error) throw rr.error; }
      toast(`${ids.length} guru ditandakan; ${rows.length} slot mengajar dikesan`); await loadAll();
    } catch (e) { toast('Gagal mendaftar: ' + (e.message || e), 'err'); }
  },
  leaveDel: async b => {
    if (!confirm('Padam rekod tidak hadir ini beserta semua slot gantinya?')) return;
    try {
      const a = await sb.from('relief_assignments').delete().eq('leave_id', b.dataset.id); if (a.error) throw a.error;
      const l = await sb.from('teacher_leaves').delete().eq('id', b.dataset.id); if (l.error) throw l.error;
      toast('Rekod dipadam'); await loadAll();
    } catch (e) { toast('Gagal padam: ' + (e.message || e), 'err'); }
  },
  rSuggest: async b => { const r = S.reliefs.find(x => x.id === b.dataset.id), c = r && relCands(r).find(x => !x.over); if (!c) return toast('Tiada guru layak (semua sibuk / dikecualikan / melebihi had relief)', 'warn'); if (await setRelief(r.id, c.t.id)) toast('Dicadangkan: ' + c.t.name); },
  rAll: async () => {
    let ok = 0, fail = 0;
    for (const r of reliefRows()) { if (r.status === 'Tidak Perlu' || r.relief_teacher_id) continue; const c = relCands(r).find(x => !x.over); if (c && await setRelief(r.id, c.t.id, true)) ok++; else fail++; }
    renderT5(); toast(`${ok} slot diisi automatik${fail ? `, ${fail} tiada guru layak` : ''}`, fail ? 'warn' : 'ok');
  },
  rNone: async b => {
    const r = S.reliefs.find(x => x.id === b.dataset.id); if (!r) return; const skip = r.status !== 'Tidak Perlu';
    const e = await sb.from('relief_assignments').update({ status: skip ? 'Tidak Perlu' : 'Menunggu', relief_teacher_id: null }).eq('id', r.id);
    if (e.error) return toast('Gagal kemas kini: ' + e.error.message, 'err');
    Object.assign(r, { status: skip ? 'Tidak Perlu' : 'Menunggu', relief_teacher_id: null }); renderT5();
  },
  waCopy: async () => {
    const t = waText();
    try { await navigator.clipboard.writeText(t); } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); }
    toast('Mesej disalin — tampal ke WhatsApp/Telegram');
  }
});
document.addEventListener('change', e => {
  const k = e.target.dataset?.rl, id = e.target.dataset?.rsel;
  if (k) { S[k] = e.target.value; renderT5(); } else if (id) setRelief(id, e.target.value || null);
});
