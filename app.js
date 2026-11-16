/**
 * ============================================================================
 * SISTEM PENGURUSAN JADUAL WAKTU & GURU GANTI PINTAR (GAYA aSc TIMETABLES)
 * Fail: app.js (Fasa 1: Teras, Profil & Loceng, Guru/Kelas/Subjek, Agihan aSc)
 * ============================================================================
 */

// 1. KONFIGURASI LALAI SUPABASE (Boleh diisi terus atau melalui Modal UI)
const DEFAULT_SUPABASE_URL = "https://gnfkkuqlopkwzlerizqv.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_wDU1YZM_RD1GAilOZHlBMw_v_zw5MyT";

const App = {
  supabase: null,
  state: {
    currentSession: "Pagi", // 'Pagi' | 'Petang'
    activeTab: "tab-1",
    schoolSettings: null,
    bellSchedules: [],
    teachers: [],
    classes: [],
    subjects: [],
    teachingAssignments: [],
    timetableSlots: [],
    teacherLeaves: [],
    reliefAssignments: []
  },

  // ==========================================================================
  // INISIALISASI & SAMBUNGAN SUPABASE
  // ==========================================================================
  async init() {
    this.initSupabaseClient();
    this.bindAssignmentSplitChange();
    await this.refreshAllData();
  },

  getSupabaseCredentials() {
    const savedUrl = localStorage.getItem("ASC_SUPABASE_URL") || DEFAULT_SUPABASE_URL;
    const savedKey = localStorage.getItem("ASC_SUPABASE_KEY") || DEFAULT_SUPABASE_ANON_KEY;
    return { url: savedUrl.trim(), key: savedKey.trim() };
  },

  initSupabaseClient() {
    const { url, key } = this.getSupabaseCredentials();
    const dot = document.getElementById("db-status-dot");
    const text = document.getElementById("db-status-text");

    if (!url || !key || url.includes("MASUKKAN_PROJECT_ID")) {
      dot.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
      text.textContent = "Tiada Kunci DB";
      this.showToast("Sila tetapkan URL & Anon Key Supabase pada butang Tetapan DB di penjuru kanan atas.", "warning");
      return;
    }

    try {
      this.supabase = window.supabase.createClient(url, key);
      dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
      text.textContent = "Supabase Aktif";
    } catch (err) {
      dot.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
      text.textContent = "Ralat Sambungan";
      this.showToast("Gagal memulakan klien Supabase: " + err.message, "error");
    }
  },

  openConfigModal() {
    const { url, key } = this.getSupabaseCredentials();
    document.getElementById("config-supabase-url").value = url.includes("MASUKKAN_") ? "" : url;
    document.getElementById("config-supabase-key").value = key.includes("MASUKKAN_") ? "" : key;
    const modal = document.getElementById("modal-supabase-config");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  },

  closeConfigModal() {
    const modal = document.getElementById("modal-supabase-config");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  },

  async saveSupabaseConfig() {
    const url = document.getElementById("config-supabase-url").value.trim();
    const key = document.getElementById("config-supabase-key").value.trim();
    if (!url || !key) {
      this.showToast("Sila lengkapkan kedua-dua URL dan Anon Key.", "error");
      return;
    }
    localStorage.setItem("ASC_SUPABASE_URL", url);
    localStorage.setItem("ASC_SUPABASE_KEY", key);
    this.closeConfigModal();
    this.initSupabaseClient();
    await this.refreshAllData();
    this.showToast("Sambungan Supabase berjaya dikemas kini!", "success");
  },

  clearSupabaseConfig() {
    localStorage.removeItem("ASC_SUPABASE_URL");
    localStorage.removeItem("ASC_SUPABASE_KEY");
    document.getElementById("config-supabase-url").value = "";
    document.getElementById("config-supabase-key").value = "";
    this.showToast("Tetapan localStorage telah dipadam.", "info");
  },

  // ==========================================================================
  // MUAT TURUN SEMUA DATA DARI SUPABASE
  // ==========================================================================
  async refreshAllData() {
    if (!this.supabase) return;
    try {
      const [
        settingsRes,
        bellsRes,
        teachersRes,
        classesRes,
        subjectsRes,
        assignRes
      ] = await Promise.all([
        this.supabase.from("school_settings").select("*").limit(1),
        this.supabase.from("bell_schedules").select("*").order("period_number", { ascending: true }),
        this.supabase.from("teachers").select("*").order("name", { ascending: true }),
        this.supabase.from("classes").select("*").order("year_level", { ascending: true }).order("class_name", { ascending: true }),
        this.supabase.from("subjects").select("*").order("subject_code", { ascending: true }),
        this.supabase.from("teaching_assignments").select("*").order("created_at", { ascending: false })
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (bellsRes.error) throw bellsRes.error;
      if (teachersRes.error) throw teachersRes.error;
      if (classesRes.error) throw classesRes.error;
      if (subjectsRes.error) throw subjectsRes.error;
      if (assignRes.error) throw assignRes.error;

      this.state.schoolSettings = settingsRes.data?.[0] || null;
      this.state.bellSchedules = bellsRes.data || [];
      this.state.teachers = teachersRes.data || [];
      this.state.classes = classesRes.data || [];
      this.state.subjects = subjectsRes.data || [];
      this.state.teachingAssignments = assignRes.data || [];

      this.renderAll();
    } catch (err) {
      console.error(err);
      this.showToast("Ralat memuatkan data Supabase: " + err.message, "error");
    }
  },

  renderAll() {
    this.renderSchoolSettings();
    this.renderBellSchedules();
    this.renderTeachers();
    this.renderClasses();
    this.renderSubjects();
    this.populateAssignmentFormOptions();
    this.renderAssignments();
  },

  // ==========================================================================
  // KAWALAN NAVIGASI TAB & SESI GLOBAL ('Pagi' / 'Petang')
  // ==========================================================================
  setGlobalSession(session) {
    this.state.currentSession = session;
    const btnPagi = document.getElementById("btn-session-pagi");
    const btnPetang = document.getElementById("btn-session-petang");

    if (session === "Pagi") {
      btnPagi.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 bg-cyan-400 text-slate-950 shadow-neon-cyan";
      btnPetang.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 text-slate-400 hover:text-white";
    } else {
      btnPetang.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 bg-amber-400 text-slate-950 shadow-neon-amber";
      btnPagi.className = "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 text-slate-400 hover:text-white";
    }

    document.getElementById("bell-session-badge").textContent = `Sesi ${session}`;
    document.getElementById("tab2-session-indicator").textContent = session;
    document.getElementById("assign-session-badge").textContent = `Sesi ${session}`;

    // Kemas kini semua komponen yang bergantung pada sesi
    this.renderBellSchedules();
    this.renderTeachers();
    this.renderClasses();
    this.populateAssignmentFormOptions();
    this.renderAssignments();

    if (typeof this.onSessionChangedPhase2 === "function") {
      this.onSessionChangedPhase2(session);
    }
  },

  switchTab(tabId) {
    this.state.activeTab = tabId;
    document.querySelectorAll(".tab-panel").forEach(el => el.classList.add("hidden"));
    document.getElementById(tabId)?.classList.remove("hidden");

    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.className = "tab-btn px-4 py-2.5 text-xs md:text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 whitespace-nowrap flex items-center gap-2 transition";
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) {
      activeBtn.className = "tab-btn px-4 py-2.5 text-xs md:text-sm font-semibold border-b-2 border-cyan-400 text-cyan-400 whitespace-nowrap flex items-center gap-2 transition";
    }
  },

  switchSubTab2(subId) {
    ["sub-teachers", "sub-classes", "sub-subjects"].forEach(id => {
      document.getElementById(id).classList.add("hidden");
    });
    document.getElementById(subId).classList.remove("hidden");

    const mapBtn = {
      "sub-teachers": "btn-sub-teachers",
      "sub-classes": "btn-sub-classes",
      "sub-subjects": "btn-sub-subjects"
    };
    Object.entries(mapBtn).forEach(([key, btnId]) => {
      const btn = document.getElementById(btnId);
      if (key === subId) {
        btn.className = "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-400 text-slate-950 shadow-neon-cyan transition";
      } else {
        btn.className = "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300 hover:text-white transition";
      }
    });
  },

  // ==========================================================================
  // TAB 1: PROFIL SEKOLAH & WAKTU LOCENG
  // ==========================================================================
  renderSchoolSettings() {
    const s = this.state.schoolSettings;
    if (!s) return;

    document.getElementById("header-school-name").textContent = s.school_name || "SISTEM JADUAL WAKTU & RELIEF";
    document.getElementById("header-school-code").textContent = s.school_code || "KOD";
    document.getElementById("header-academic-year").textContent = s.academic_year || "2026";

    document.getElementById("input-school-name").value = s.school_name || "";
    document.getElementById("input-school-code").value = s.school_code || "";
    document.getElementById("input-academic-year").value = s.academic_year || "";
    document.getElementById("input-days-of-week").value = Array.isArray(s.days_of_week)
      ? s.days_of_week.join(",")
      : "Isnin,Selasa,Rabu,Khamis,Jumaat";
    document.getElementById("input-logo-url").value = s.logo_url || "";

    this.updateLogoPreview(s.logo_url || "");
  },

  handleLogoFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      this.showToast("Saiz fail imej melebihi 1.5MB. Sila pilih logo yang lebih kecil.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const base64 = e.target.result;
      document.getElementById("input-logo-url").value = base64;
      this.updateLogoPreview(base64);
      this.showToast("Logo ditukar kepada Data URL Base64. Klik Simpan Profil Sekolah.", "info");
    };
    reader.readAsDataURL(file);
  },

  updateLogoPreview(url) {
    const previewImg = document.getElementById("preview-school-logo");
    const previewIcon = document.getElementById("preview-logo-icon");
    const headerImg = document.getElementById("header-school-logo");
    const headerIcon = document.getElementById("header-logo-fallback");

    if (url && url.trim().length > 5) {
      previewImg.src = url;
      previewImg.classList.remove("hidden");
      previewIcon.classList.add("hidden");

      headerImg.src = url;
      headerImg.classList.remove("hidden");
      headerIcon.classList.add("hidden");
    } else {
      previewImg.classList.add("hidden");
      previewIcon.classList.remove("hidden");
      headerImg.classList.add("hidden");
      headerIcon.classList.remove("hidden");
    }
  },

  async saveSchoolSettings(event) {
    event.preventDefault();
    if (!this.supabase) return;

    const payload = {
      school_name: document.getElementById("input-school-name").value.trim(),
      school_code: document.getElementById("input-school-code").value.trim().toUpperCase(),
      academic_year: document.getElementById("input-academic-year").value.trim(),
      days_of_week: document.getElementById("input-days-of-week").value.split(",").map(d => d.trim()).filter(Boolean),
      logo_url: document.getElementById("input-logo-url").value.trim(),
      updated_at: new Date().toISOString()
    };

    try {
      let res;
      if (this.state.schoolSettings?.id) {
        res = await this.supabase.from("school_settings").update(payload).eq("id", this.state.schoolSettings.id).select();
      } else {
        res = await this.supabase.from("school_settings").insert([payload]).select();
      }
      if (res.error) throw res.error;
      this.state.schoolSettings = res.data[0];
      this.renderSchoolSettings();
      this.showToast("Profil sekolah berjaya disimpan!", "success");
    } catch (err) {
      this.showToast("Gagal menyimpan profil: " + err.message, "error");
    }
  },

  // --- Waktu Loceng ---
  renderBellSchedules() {
    const tbody = document.getElementById("tbody-bell-schedules");
    const list = this.state.bellSchedules
      .filter(b => b.session_type === this.state.currentSession)
      .sort((a, b) => a.period_number - b.period_number);

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-slate-500 text-xs">
            Tiada waktu loceng bagi <strong>Sesi ${this.state.currentSession}</strong>. Klik butang <em>"Jana Waktu Piawai (1-12)"</em> di atas untuk mula pantas.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => `
      <tr class="hover:bg-slate-950/50 transition ${item.is_recess ? 'bg-amber-500/10' : ''}">
        <td class="py-2.5 px-3 font-mono font-bold text-cyan-300">#${item.period_number}</td>
        <td class="py-2.5 px-3 font-semibold text-white">${this.escapeHtml(item.label)}</td>
        <td class="py-2.5 px-3 font-mono text-xs text-slate-300">${item.start_time} – ${item.end_time}</td>
        <td class="py-2.5 px-3">
          ${item.is_recess
            ? '<span class="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[11px] font-bold">REHAT</span>'
            : '<span class="px-2 py-0.5 rounded bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 text-[11px]">Waktu PdP</span>'
          }
        </td>
        <td class="py-2.5 px-3 text-right space-x-1">
          <button onclick="App.editBellPeriod('${item.id}')" class="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-500/20 text-cyan-400 text-xs">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button onclick="App.deleteBellPeriod('${item.id}')" class="px-2 py-1 rounded bg-slate-800 hover:bg-rose-500/20 text-rose-400 text-xs">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join("");
  },

  async saveBellPeriod(event) {
    event.preventDefault();
    if (!this.supabase) return;

    const id = document.getElementById("bell-id").value;
    const payload = {
      session_type: this.state.currentSession,
      period_number: parseInt(document.getElementById("bell-period-number").value, 10),
      label: document.getElementById("bell-label").value.trim(),
      start_time: document.getElementById("bell-start-time").value,
      end_time: document.getElementById("bell-end-time").value,
      is_recess: document.getElementById("bell-is-recess").value === "true"
    };

    try {
      let res;
      if (id) {
        res = await this.supabase.from("bell_schedules").update(payload).eq("id", id);
      } else {
        res = await this.supabase.from("bell_schedules").upsert([payload], { onConflict: "session_type,period_number" });
      }
      if (res.error) throw res.error;
      this.resetBellForm();
      await this.refreshAllData();
      this.showToast("Slot waktu loceng berjaya disimpan.", "success");
    } catch (err) {
      this.showToast("Gagal menyimpan waktu loceng: " + err.message, "error");
    }
  },

  editBellPeriod(id) {
    const item = this.state.bellSchedules.find(b => b.id === id);
    if (!item) return;
    document.getElementById("bell-id").value = item.id;
    document.getElementById("bell-period-number").value = item.period_number;
    document.getElementById("bell-label").value = item.label;
    document.getElementById("bell-start-time").value = item.start_time;
    document.getElementById("bell-end-time").value = item.end_time;
    document.getElementById("bell-is-recess").value = item.is_recess ? "true" : "false";
    document.getElementById("bell-submit-text").textContent = "Kemas Kini";
  },

  resetBellForm() {
    document.getElementById("form-bell-schedule").reset();
    document.getElementById("bell-id").value = "";
    document.getElementById("bell-submit-text").textContent = "Simpan";
  },

  async deleteBellPeriod(id) {
    if (!confirm("Padam waktu loceng ini?")) return;
    const { error } = await this.supabase.from("bell_schedules").delete().eq("id", id);
    if (error) {
      this.showToast("Gagal memadam waktu loceng: " + error.message, "error");
      return;
    }
    await this.refreshAllData();
    this.showToast("Waktu loceng dipadam.", "info");
  },

  async generateStandardBellSchedule() {
    if (!this.supabase) return;
    const s = this.state.currentSession;
    if (!confirm(`Jana 12 waktu loceng piawai (30 minit setiap slot) untuk Sesi ${s}? Rekod sedia ada bagi sesi ini akan dikemas kini.`)) return;

    const templatePagi = [
      { period_number: 1, label: "W1", start_time: "07:40", end_time: "08:10", is_recess: false },
      { period_number: 2, label: "W2", start_time: "08:10", end_time: "08:40", is_recess: false },
      { period_number: 3, label: "W3", start_time: "08:40", end_time: "09:10", is_recess: false },
      { period_number: 4, label: "W4", start_time: "09:10", end_time: "09:40", is_recess: false },
      { period_number: 5, label: "W5", start_time: "09:40", end_time: "10:10", is_recess: false },
      { period_number: 6, label: "REHAT", start_time: "10:10", end_time: "10:30", is_recess: true },
      { period_number: 7, label: "W7", start_time: "10:30", end_time: "11:00", is_recess: false },
      { period_number: 8, label: "W8", start_time: "11:00", end_time: "11:30", is_recess: false },
      { period_number: 9, label: "W9", start_time: "11:30", end_time: "12:00", is_recess: false },
      { period_number: 10, label: "W10", start_time: "12:00", end_time: "12:30", is_recess: false },
      { period_number: 11, label: "W11", start_time: "12:30", end_time: "13:00", is_recess: false },
      { period_number: 12, label: "W12", start_time: "13:00", end_time: "13:30", is_recess: false }
    ];

    const templatePetang = [
      { period_number: 1, label: "P1", start_time: "13:00", end_time: "13:30", is_recess: false },
      { period_number: 2, label: "P2", start_time: "13:30", end_time: "14:00", is_recess: false },
      { period_number: 3, label: "P3", start_time: "14:00", end_time: "14:30", is_recess: false },
      { period_number: 4, label: "P4", start_time: "14:30", end_time: "15:00", is_recess: false },
      { period_number: 5, label: "REHAT", start_time: "15:00", end_time: "15:20", is_recess: true },
      { period_number: 6, label: "P6", start_time: "15:20", end_time: "15:50", is_recess: false },
      { period_number: 7, label: "P7", start_time: "15:50", end_time: "16:20", is_recess: false },
      { period_number: 8, label: "P8", start_time: "16:20", end_time: "16:50", is_recess: false },
      { period_number: 9, label: "P9", start_time: "16:50", end_time: "17:20", is_recess: false },
      { period_number: 10, label: "P10", start_time: "17:20", end_time: "17:50", is_recess: false },
      { period_number: 11, label: "P11", start_time: "17:50", end_time: "18:20", is_recess: false }
    ];

    const rows = (s === "Pagi" ? templatePagi : templatePetang).map(r => ({
      ...r,
      session_type: s
    }));

    const { error } = await this.supabase.from("bell_schedules").upsert(rows, { onConflict: "session_type,period_number" });
    if (error) {
      this.showToast("Ralat menjana waktu loceng: " + error.message, "error");
      return;
    }
    await this.refreshAllData();
    this.showToast(`Waktu loceng piawai Sesi ${s} berjaya dijana!`, "success");
  },

  // ==========================================================================
  // TAB 2: PENGURUSAN GURU, KELAS & MATA PELAJARAN
  // ==========================================================================
  calculateTeacherWorkload(teacherId) {
    return this.state.teachingAssignments
      .filter(a => Array.isArray(a.teacher_ids) && a.teacher_ids.includes(teacherId))
      .reduce((sum, a) => sum + (Number(a.periods_per_week) || 0), 0);
  },

  renderTeachers() {
    const container = document.getElementById("grid-teachers");
    const query = (document.getElementById("search-teacher")?.value || "").toLowerCase();

    const filtered = this.state.teachers.filter(t => {
      const matchSession = t.session_type === "Kedua-dua" || t.session_type === this.state.currentSession;
      const matchSearch = t.name.toLowerCase().includes(query) || t.short_code.toLowerCase().includes(query);
      return matchSession && matchSearch;
    });

    document.getElementById("count-teachers").textContent = filtered.length;

    if (filtered.length === 0) {
      container.innerHTML = `<div class="col-span-2 py-10 text-center text-slate-500 text-xs">Tiada rekod guru ditemui bagi Sesi ${this.state.currentSession}.</div>`;
      return;
    }

    container.innerHTML = filtered.map(t => {
      const load = this.calculateTeacherWorkload(t.id);
      const max = t.max_periods_per_week || 30;
      const pct = Math.min(100, Math.round((load / max) * 100));
      const barColor = load > max ? "bg-rose-500" : load >= max * 0.85 ? "bg-amber-400" : "bg-emerald-400";

      return `
        <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/40 transition flex flex-col justify-between gap-2">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold border border-cyan-400/30">${this.escapeHtml(t.short_code)}</span>
                <h4 class="font-bold text-sm text-white">${this.escapeHtml(t.name)}</h4>
              </div>
              <p class="text-[11px] text-slate-400 mt-0.5">
                ${this.escapeHtml(t.role_title || "Guru Akademik")} • <span class="text-cyan-400">${t.session_type}</span>
                ${t.is_relief_exempt ? ' • <span class="text-pink-400 font-semibold">Kecuali Relief</span>' : ''}
              </p>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="App.editTeacher('${t.id}')" class="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-500/20 text-cyan-400 text-xs">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button onclick="App.deleteTeacher('${t.id}')" class="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-rose-400 text-xs">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>

          <!-- Bar Simulasi Bebanan Waktu -->
          <div class="space-y-1 pt-1">
            <div class="flex justify-between text-[11px] font-mono">
              <span class="text-slate-400">Bebanan Mengajar Semasa:</span>
              <span class="${load > max ? 'text-rose-400 font-bold' : 'text-emerald-300 font-bold'}">${load} / ${max} waktu</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div class="h-full ${barColor} transition-all duration-300" style="width: ${pct}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  },

  async saveTeacher(event) {
    event.preventDefault();
    if (!this.supabase) return;

    const id = document.getElementById("teacher-id").value;
    const payload = {
      name: document.getElementById("teacher-name").value.trim(),
      short_code: document.getElementById("teacher-code").value.trim().toUpperCase(),
      session_type: document.getElementById("teacher-session").value,
      role_title: document.getElementById("teacher-role").value.trim(),
      max_periods_per_week: parseInt(document.getElementById("teacher-max-periods").value, 10) || 30,
      max_relief_per_week: parseInt(document.getElementById("teacher-max-relief").value, 10) || 5,
      is_relief_exempt: document.getElementById("teacher-relief-exempt").checked
    };

    try {
      const res = id
        ? await this.supabase.from("teachers").update(payload).eq("id", id)
        : await this.supabase.from("teachers").insert([payload]);
      if (res.error) throw res.error;
      this.resetTeacherForm();
      await this.refreshAllData();
      this.showToast("Data guru berjaya disimpan!", "success");
    } catch (err) {
      this.showToast("Gagal menyimpan guru: " + err.message, "error");
    }
  },

  editTeacher(id) {
    const t = this.state.teachers.find(x => x.id === id);
    if (!t) return;
    document.getElementById("teacher-id").value = t.id;
    document.getElementById("teacher-name").value = t.name;
    document.getElementById("teacher-code").value = t.short_code;
    document.getElementById("teacher-session").value = t.session_type;
    document.getElementById("teacher-role").value = t.role_title || "Guru Akademik";
    document.getElementById("teacher-max-periods").value = t.max_periods_per_week || 30;
    document.getElementById("teacher-max-relief").value = t.max_relief_per_week || 5;
    document.getElementById("teacher-relief-exempt").checked = !!t.is_relief_exempt;
    document.getElementById("teacher-form-title").textContent = "Kemas Kini Guru: " + t.short_code;
  },

  resetTeacherForm() {
    document.getElementById("form-teacher").reset();
    document.getElementById("teacher-id").value = "";
    document.getElementById("teacher-form-title").textContent = "Tambah Guru Baharu";
  },

  async deleteTeacher(id) {
    if (!confirm("Padam rekod guru ini?")) return;
    const { error } = await this.supabase.from("teachers").delete().eq("id", id);
    if (error) return this.showToast("Ralat memadam guru: " + error.message, "error");
    await this.refreshAllData();
    this.showToast("Guru telah dipadam.", "info");
  },

  // --- Pengurusan Kelas ---
  renderClasses() {
    const homeroomSelect = document.getElementById("class-homeroom");
    homeroomSelect.innerHTML = `<option value="">-- Tiada / Pilih Guru --</option>` +
      this.state.teachers.map(t => `<option value="${t.id}">${this.escapeHtml(t.name)} (${t.short_code})</option>`).join("");

    const list = this.state.classes.filter(c => c.session_type === this.state.currentSession);
    document.getElementById("count-classes").textContent = list.length;

    const grid = document.getElementById("grid-classes");
    if (list.length === 0) {
      grid.innerHTML = `<div class="col-span-3 py-8 text-center text-slate-500 text-xs">Tiada kelas didaftarkan untuk Sesi ${this.state.currentSession}.</div>`;
      return;
    }

    grid.innerHTML = list.map(c => {
      const hr = this.state.teachers.find(t => t.id === c.homeroom_teacher_id);
      return `
        <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div>
            <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Tahun ${c.year_level} • ${c.session_type}</span>
            <h4 class="text-base font-bold text-white mt-1">${this.escapeHtml(c.class_name)}</h4>
            <p class="text-xs text-slate-400">Guru Kelas: <strong class="text-slate-200">${hr ? this.escapeHtml(hr.short_code) : "-"}</strong></p>
          </div>
          <div class="flex gap-1">
            <button onclick="App.editClass('${c.id}')" class="p-2 rounded-lg bg-slate-900 hover:bg-cyan-500/20 text-cyan-400 text-xs"><i class="fa-solid fa-pen"></i></button>
            <button onclick="App.deleteClass('${c.id}')" class="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-rose-400 text-xs"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join("");
  },

  async saveClass(event) {
    event.preventDefault();
    if (!this.supabase) return;

    const id = document.getElementById("class-id").value;
    const payload = {
      class_name: document.getElementById("class-name").value.trim().toUpperCase(),
      year_level: parseInt(document.getElementById("class-year").value, 10),
      session_type: document.getElementById("class-session").value,
      homeroom_teacher_id: document.getElementById("class-homeroom").value || null
    };

    try {
      const res = id
        ? await this.supabase.from("classes").update(payload).eq("id", id)
        : await this.supabase.from("classes").insert([payload]);
      if (res.error) throw res.error;
      this.resetClassForm();
      await this.refreshAllData();
      this.showToast("Data kelas disimpan!", "success");
    } catch (err) {
      this.showToast("Gagal menyimpan kelas: " + err.message, "error");
    }
  },

  editClass(id) {
    const c = this.state.classes.find(x => x.id === id);
    if (!c) return;
    document.getElementById("class-id").value = c.id;
    document.getElementById("class-name").value = c.class_name;
    document.getElementById("class-year").value = c.year_level;
    document.getElementById("class-session").value = c.session_type;
    document.getElementById("class-homeroom").value = c.homeroom_teacher_id || "";
  },

  resetClassForm() {
    document.getElementById("form-class").reset();
    document.getElementById("class-id").value = "";
    document.getElementById("class-session").value = this.state.currentSession;
  },

  async deleteClass(id) {
    if (!confirm("Padam kelas ini?")) return;
    const { error } = await this.supabase.from("classes").delete().eq("id", id);
    if (error) return this.showToast("Gagal memadam kelas: " + error.message, "error");
    await this.refreshAllData();
    this.showToast("Kelas dipadam.", "info");
  },

  // --- Pengurusan Mata Pelajaran ---
  renderSubjects() {
    document.getElementById("count-subjects").textContent = this.state.subjects.length;
    const grid = document.getElementById("grid-subjects");

    if (this.state.subjects.length === 0) {
      grid.innerHTML = `<div class="col-span-3 py-8 text-center text-slate-500 text-xs">Tiada mata pelajaran didaftarkan.</div>`;
      return;
    }

    grid.innerHTML = this.state.subjects.map(sub => `
      <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2" style="border-left: 5px solid ${sub.color_hex || '#22d3ee'}">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-mono font-bold text-sm px-2 py-0.5 rounded bg-slate-900 text-white">${this.escapeHtml(sub.subject_code)}</span>
            <h4 class="font-semibold text-sm text-slate-100">${this.escapeHtml(sub.subject_name)}</h4>
          </div>
          <div class="flex gap-2 mt-1 text-[10px] text-slate-400">
            ${sub.requires_double_period ? '<span class="text-cyan-400"><i class="fa-solid fa-clone"></i> Double Period</span>' : ''}
            ${sub.preferred_morning_only ? '<span class="text-amber-400"><i class="fa-solid fa-sun"></i> Waktu Pagi</span>' : ''}
          </div>
        </div>
        <div class="flex gap-1">
          <button onclick="App.editSubject('${sub.id}')" class="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-500/20 text-cyan-400 text-xs"><i class="fa-solid fa-pen"></i></button>
          <button onclick="App.deleteSubject('${sub.id}')" class="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-rose-400 text-xs"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join("");
  },

  async saveSubject(event) {
    event.preventDefault();
    if (!this.supabase) return;

    const id = document.getElementById("subject-id").value;
    const payload = {
      subject_code: document.getElementById("subject-code").value.trim().toUpperCase(),
      subject_name: document.getElementById("subject-name").value.trim(),
      color_hex: document.getElementById("subject-color").value,
      requires_double_period: document.getElementById("subject-double").checked,
      preferred_morning_only: document.getElementById("subject-morning").checked
    };

    try {
      const res = id
        ? await this.supabase.from("subjects").update(payload).eq("id", id)
        : await this.supabase.from("subjects").insert([payload]);
      if (res.error) throw res.error;
      this.resetSubjectForm();
      await this.refreshAllData();
      this.showToast("Mata pelajaran berjaya disimpan!", "success");
    } catch (err) {
      this.showToast("Gagal menyimpan subjek: " + err.message, "error");
    }
  },

  editSubject(id) {
    const s = this.state.subjects.find(x => x.id === id);
    if (!s) return;
    document.getElementById("subject-id").value = s.id;
    document.getElementById("subject-code").value = s.subject_code;
    document.getElementById("subject-name").value = s.subject_name;
    document.getElementById("subject-color").value = s.color_hex || "#22d3ee";
    document.getElementById("subject-double").checked = !!s.requires_double_period;
    document.getElementById("subject-morning").checked = !!s.preferred_morning_only;
  },

  resetSubjectForm() {
    document.getElementById("form-subject").reset();
    document.getElementById("subject-id").value = "";
  },

  async deleteSubject(id) {
    if (!confirm("Padam mata pelajaran ini?")) return;
    const { error } = await this.supabase.from("subjects").delete().eq("id", id);
    if (error) return this.showToast("Gagal memadam subjek: " + error.message, "error");
    await this.refreshAllData();
    this.showToast("Subjek dipadam.", "info");
  },

  // ==========================================================================
  // TAB 3: AGIHAN TUGAS & KEKANGAN GAYA aSc TIMETABLES
  // ==========================================================================
  bindAssignmentSplitChange() {
    this.syncTotalPeriodsFromSplit();
  },

  syncTotalPeriodsFromSplit() {
    const splitVal = document.getElementById("assign-split")?.value || "2+2+1";
    const total = splitVal.split("+").reduce((acc, n) => acc + (parseInt(n, 10) || 0), 0);
    const inputPeriods = document.getElementById("assign-periods");
    if (inputPeriods) inputPeriods.value = total;
  },

  populateAssignmentFormOptions() {
    // 1. Subjek
    const subSelect = document.getElementById("assign-subject");
    subSelect.innerHTML = `<option value="">-- Pilih Mata Pelajaran --</option>` +
      this.state.subjects.map(s => `<option value="${s.id}">[${this.escapeHtml(s.subject_code)}] ${this.escapeHtml(s.subject_name)}</option>`).join("");

    // 2. Kotak Pilihan Berbilang Guru (Co-Teaching)
    const teachersBox = document.getElementById("assign-teachers-box");
    const sessionTeachers = this.state.teachers.filter(
      t => t.session_type === "Kedua-dua" || t.session_type === this.state.currentSession
    );
    teachersBox.innerHTML = sessionTeachers.map(t => `
      <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-900 cursor-pointer text-xs">
        <input type="checkbox" name="assign-teacher-chk" value="${t.id}" class="rounded accent-emerald-400" />
        <span class="font-mono font-bold text-cyan-300">${this.escapeHtml(t.short_code)}</span>
        <span class="text-slate-300 truncate">${this.escapeHtml(t.name)}</span>
      </label>
    `).join("");

    // 3. Kotak Pilihan Berbilang Kelas (Combined Classes)
    const classesBox = document.getElementById("assign-classes-box");
    const sessionClasses = this.state.classes.filter(c => c.session_type === this.state.currentSession);
    classesBox.innerHTML = sessionClasses.map(c => `
      <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-900 cursor-pointer text-xs">
        <input type="checkbox" name="assign-class-chk" value="${c.id}" class="rounded accent-amber-400" />
        <span class="font-bold text-white">${this.escapeHtml(c.class_name)}</span>
      </label>
    `).join("");

    // Penapis Kelas
    const filterClass = document.getElementById("filter-assign-class");
    const currentVal = filterClass.value;
    filterClass.innerHTML = `<option value="">Semua Kelas (${this.state.currentSession})</option>` +
      sessionClasses.map(c => `<option value="${c.id}">${this.escapeHtml(c.class_name)}</option>`).join("");
    filterClass.value = currentVal;
  },

  async saveAssignment(event) {
    event.preventDefault();
    if (!this.supabase) return;

    const id = document.getElementById("assign-id").value;
    const subjectId = document.getElementById("assign-subject").value;
    const teacherIds = Array.from(document.querySelectorAll('input[name="assign-teacher-chk"]:checked')).map(el => el.value);
    const classIds = Array.from(document.querySelectorAll('input[name="assign-class-chk"]:checked')).map(el => el.value);
    const periodSplit = document.getElementById("assign-split").value;
    const periodsPerWeek = parseInt(document.getElementById("assign-periods").value, 10) || 1;
    const concurrentTag = document.getElementById("assign-concurrent-tag").value.trim().toUpperCase() || null;

    if (!subjectId) return this.showToast("Sila pilih satu Mata Pelajaran.", "warning");
    if (teacherIds.length === 0) return this.showToast("Sila pilih sekurang-kurangnya seorang guru.", "warning");
    if (classIds.length === 0) return this.showToast("Sila pilih sekurang-kurangnya sebuah kelas.", "warning");

    const payload = {
      session_type: this.state.currentSession,
      subject_id: subjectId,
      teacher_ids: teacherIds,
      class_ids: classIds,
      periods_per_week: periodsPerWeek,
      period_split: periodSplit,
      concurrent_group_tag: concurrentTag
    };

    try {
      const res = id
        ? await this.supabase.from("teaching_assignments").update(payload).eq("id", id)
        : await this.supabase.from("teaching_assignments").insert([payload]);
      if (res.error) throw res.error;

      this.resetAssignmentForm();
      await this.refreshAllData();
      this.showToast("Kontrak pengajaran aSc berjaya disimpan!", "success");
    } catch (err) {
      this.showToast("Gagal menyimpan agihan tugas: " + err.message, "error");
    }
  },

  renderAssignments() {
    const container = document.getElementById("list-assignments");
    const classFilter = document.getElementById("filter-assign-class")?.value || "";
    const search = (document.getElementById("filter-assign-search")?.value || "").toLowerCase();

    const list = this.state.teachingAssignments.filter(a => {
      if (a.session_type !== this.state.currentSession) return false;
      if (classFilter && !(a.class_ids || []).includes(classFilter)) return false;

      if (search) {
        const sub = this.state.subjects.find(s => s.id === a.subject_id);
        const tNames = (a.teacher_ids || []).map(tid => this.state.teachers.find(t => t.id === tid)?.name || "").join(" ");
        const cNames = (a.class_ids || []).map(cid => this.state.classes.find(c => c.id === cid)?.class_name || "").join(" ");
        const haystack = `${sub?.subject_code || ""} ${sub?.subject_name || ""} ${tNames} ${cNames} ${a.concurrent_group_tag || ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    if (list.length === 0) {
      container.innerHTML = `<div class="py-12 text-center text-slate-500 text-xs">Tiada kontrak pengajaran ditemui untuk Sesi ${this.state.currentSession}.</div>`;
      return;
    }

    container.innerHTML = list.map(a => {
      const sub = this.state.subjects.find(s => s.id === a.subject_id);
      const teachers = (a.teacher_ids || []).map(id => this.state.teachers.find(t => t.id === id)).filter(Boolean);
      const classes = (a.class_ids || []).map(id => this.state.classes.find(c => c.id === id)).filter(Boolean);

      const isCoTeaching = teachers.length > 1;
      const isCombinedClass = classes.length > 1;
      const hasConcurrent = !!a.concurrent_group_tag;

      return `
        <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/40 transition flex flex-wrap items-center justify-between gap-3" style="border-left: 5px solid ${sub?.color_hex || '#22d3ee'}">
          <div class="space-y-1.5 flex-1 min-w-[240px]">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-900 text-white border border-slate-700">${this.escapeHtml(sub?.subject_code || "SUB")}</span>
              <h4 class="font-bold text-sm text-white">${this.escapeHtml(sub?.subject_name || "Mata Pelajaran")}</h4>
              <span class="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono text-xs border border-cyan-500/30">
                Split: ${this.escapeHtml(a.period_split)} (${a.periods_per_week}W)
              </span>
            </div>

            <!-- Baris Guru & Kelas -->
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <div class="flex items-center gap-1 text-emerald-300">
                <i class="fa-solid fa-chalkboard-user"></i>
                <span>${teachers.map(t => `${this.escapeHtml(t.short_code)}`).join(" + ") || "Tiada Guru"}</span>
              </div>
              <span class="text-slate-600">•</span>
              <div class="flex items-center gap-1 text-amber-300 font-semibold">
                <i class="fa-solid fa-door-open"></i>
                <span>${classes.map(c => this.escapeHtml(c.class_name)).join(" + ") || "Tiada Kelas"}</span>
              </div>
            </div>

            <!-- Lencana Kekangan Khas aSc -->
            <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
              ${isCoTeaching ? `<span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold"><i class="fa-solid fa-users mr-1"></i>CO-TEACHING (${teachers.length} Guru)</span>` : ''}
              ${isCombinedClass ? `<span class="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold"><i class="fa-solid fa-object-group mr-1"></i>KELAS GABUNG (${classes.length} Kelas)</span>` : ''}
              ${hasConcurrent ? `<span class="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/40 text-[10px] font-mono font-bold"><i class="fa-solid fa-link mr-1"></i>BLOK SERENTAK: ${this.escapeHtml(a.concurrent_group_tag)}</span>` : ''}
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button onclick="App.editAssignment('${a.id}')" class="p-2 rounded-lg bg-slate-900 hover:bg-cyan-500/20 text-cyan-400 text-xs" title="Edit Kontrak">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button onclick="App.deleteAssignment('${a.id}')" class="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-rose-400 text-xs" title="Padam Kontrak">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");
  },

  editAssignment(id) {
    const a = this.state.teachingAssignments.find(x => x.id === id);
    if (!a) return;

    document.getElementById("assign-id").value = a.id;
    document.getElementById("assign-subject").value = a.subject_id;
    document.getElementById("assign-split").value = a.period_split || "2+2+1";
    document.getElementById("assign-periods").value = a.periods_per_week || 5;
    document.getElementById("assign-concurrent-tag").value = a.concurrent_group_tag || "";

    document.querySelectorAll('input[name="assign-teacher-chk"]').forEach(chk => {
      chk.checked = (a.teacher_ids || []).includes(chk.value);
    });
    document.querySelectorAll('input[name="assign-class-chk"]').forEach(chk => {
      chk.checked = (a.class_ids || []).includes(chk.value);
    });
  },

  resetAssignmentForm() {
    document.getElementById("form-assignment").reset();
    document.getElementById("assign-id").value = "";
    document.querySelectorAll('input[name="assign-teacher-chk"]').forEach(chk => (chk.checked = false));
    document.querySelectorAll('input[name="assign-class-chk"]').forEach(chk => (chk.checked = false));
    this.syncTotalPeriodsFromSplit();
  },

  async deleteAssignment(id) {
    if (!confirm("Padam kontrak pengajaran ini?")) return;
    const { error } = await this.supabase.from("teaching_assignments").delete().eq("id", id);
    if (error) return this.showToast("Gagal memadam kontrak: " + error.message, "error");
    await this.refreshAllData();
    this.showToast("Kontrak pengajaran dipadam.", "info");
  },

  // ==========================================================================
  // UTILITI TOAST & KESELAMATAN HTML
  // ==========================================================================
  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const styles = {
      success: "bg-slate-900 border-emerald-400 text-emerald-300 shadow-neon-emerald",
      error: "bg-slate-900 border-rose-500 text-rose-300 shadow-neon-pink",
      warning: "bg-slate-900 border-amber-400 text-amber-300 shadow-neon-amber",
      info: "bg-slate-900 border-cyan-400 text-cyan-300 shadow-neon-cyan"
    };
    const icons = {
      success: "fa-circle-check",
      error: "fa-triangle-exclamation",
      warning: "fa-circle-exclamation",
      info: "fa-circle-info"
    };

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl border text-xs font-medium transition-all duration-300 ${styles[type] || styles.info}`;
    toast.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info} text-sm mt-0.5"></i>
      <div class="flex-1 leading-relaxed">${this.escapeHtml(message)}</div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-x-3");
      setTimeout(() => toast.remove(), 300);
    }, 4200);
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, """)
      .replace(/'/g, "'");
  }
};

// Mulakan aplikasi sebaik sahaja DOM selesai dimuatkan
window.addEventListener("DOMContentLoaded", () => App.init());
