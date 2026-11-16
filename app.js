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

/**
 * ============================================================================
 * FASA 2: TAB 4 (PAPAN JADUAL INTERAKTIF & AUTO-GENERATE CSP)
 *         & TAB 6 (STUDIO PREVIEW & CETAKAN RASMI GAYA aSc TIMETABLES)
 * Cara Guna: Tampal kod ini di bahagian paling bawah fail app.js anda.
 * ============================================================================
 */

Object.assign(App, {
  // State tambahan khusus untuk Fasa 2
  boardState: {
    viewMode: "classes", // 'classes' | 'teachers'
    filterDay: "ALL",    // 'ALL' | 'Isnin' | 'Selasa' ...
    selectedEntityId: "ALL",
    dragSourceSlotIds: null,
    selectedSlotIdsForMove: null,
    printMode: "teacher", // 'teacher' | 'class'
    printTargetId: "ALL", // 'ALL' atau UUID guru/kelas
    printColorMode: "soft" // 'soft' (Warna lembut aSc) | 'bw' (Hitam Putih Rasmi)
  },

  // ==========================================================================
  // 1. INISIALISASI FASA 2 & PENYUNTIKAN UI TAB 4 & TAB 6
  // ==========================================================================
  async initPhase2() {
    this.injectTab4UI();
    this.injectTab6UI();
    await this.loadTimetableSlots();
    this.renderTimetableBoard();
    this.renderPrintStudioControls();
    this.renderAscPrintPreview();
  },

  onSessionChangedPhase2() {
    this.boardState.selectedSlotIdsForMove = null;
    this.renderTimetableBoard();
    this.renderPrintStudioControls();
    this.renderAscPrintPreview();
  },

  async loadTimetableSlots() {
    if (!this.supabase) return;
    try {
      const { data, error } = await this.supabase
        .from("timetable_slots")
        .select("*")
        .order("period_number", { ascending: true });
      if (error) throw error;
      this.state.timetableSlots = data || [];
    } catch (err) {
      console.error("Ralat memuatkan timetable_slots:", err);
      this.showToast("Gagal memuatkan slot jadual: " + err.message, "error");
    }
  },

  getDaysOfWeek() {
    const raw = this.state.schoolSettings?.days_of_week;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat"];
  },

  getSessionPeriods() {
    return this.state.bellSchedules
      .filter(b => b.session_type === this.state.currentSession)
      .sort((a, b) => a.period_number - b.period_number);
  },

  // ==========================================================================
  // 2. BINA ANTARAMUKA TAB 4: PAPAN JADUAL INTERAKTIF & AUTO-GENERATE
  // ==========================================================================
  injectTab4UI() {
    const container = document.getElementById("timetable-board-container");
    if (!container) return;

    container.className = "space-y-4 text-left";
    container.innerHTML = `
      <!-- Bar Kawalan Atas Papan Jadual -->
      <div class="bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <!-- Suis Mod Paparan Baris -->
          <div class="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button id="btn-board-view-classes" onclick="App.setBoardViewMode('classes')" class="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-cyan-400 text-slate-950 shadow-neon-cyan transition flex items-center gap-1.5">
              <i class="fa-solid fa-door-open"></i> Matriks Kelas
            </button>
            <button id="btn-board-view-teachers" onclick="App.setBoardViewMode('teachers')" class="px-3 py-1.5 rounded-lg text-xs font-bold uppercase text-slate-400 hover:text-white transition flex items-center gap-1.5">
              <i class="fa-solid fa-chalkboard-user"></i> Matriks Guru
            </button>
          </div>

          <!-- Penapis Hari -->
          <select id="board-filter-day" onchange="App.setBoardDayFilter(this.value)" class="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-cyan-300 focus:outline-none">
            <option value="ALL">Semua Hari (Isnin - Jumaat)</option>
          </select>

          <!-- Stat Ringkas Slot -->
          <div id="board-stats-badges" class="flex flex-wrap items-center gap-2 text-xs font-mono"></div>
        </div>

        <!-- Butang Tindakan Enjin Auto-Generate & Pengurusan Slot -->
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="App.openManualSlotModal()" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 text-xs font-bold transition flex items-center gap-1.5">
            <i class="fa-solid fa-plus"></i> Slot Manual
          </button>
          <button onclick="App.runAutoGenerateSessionTimetable()" class="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-extrabold uppercase tracking-wider shadow-neon-emerald transition flex items-center gap-2">
            <i class="fa-solid fa-bolt"></i> Jana Jadual Automatik (CSP aSc)
          </button>
          <button onclick="App.clearUnlockedSessionSlots()" class="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold transition flex items-center gap-1.5" title="Kosongkan semua slot yang tidak dikunci">
            <i class="fa-solid fa-eraser"></i> Kosongkan Tidak Dikunci
          </button>
        </div>
      </div>

      <!-- Bar Panduan & Status Pertindihan / Pemilihan Slot -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div class="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div class="flex flex-wrap items-center gap-4 text-slate-300">
            <span class="flex items-center gap-1.5"><i class="fa-solid fa-hand-pointer text-cyan-400"></i> <strong>Drag & Drop</strong> atau <strong>Klik Slot → Klik Sel Kosong</strong> untuk pindah waktu</span>
            <span class="flex items-center gap-1.5"><i class="fa-solid fa-lock text-amber-400"></i> Klik ikon kunci untuk <strong>Freeze / Unfreeze</strong> slot</span>
            <span class="flex items-center gap-1.5"><i class="fa-solid fa-link text-pink-400"></i> Tag Serentak bergerak secara berkumpulan</span>
          </div>
          <div id="board-active-selection-banner" class="hidden items-center gap-2 px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-mono text-[11px]"></div>
        </div>

        <div id="board-clash-summary" class="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs"></div>
      </div>

      <!-- Kontena Jadual Matriks Skrol Mendatar -->
      <div class="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div class="overflow-x-auto max-h-[720px]">
          <table id="timetable-matrix-table" class="w-full border-collapse text-left"></table>
        </div>
      </div>

      <!-- Senarai Kontrak Belum Dijadualkan / Baki Waktu -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <i class="fa-solid fa-clipboard-check"></i> Status Agihan Waktu Mengikut Kontrak Pengajaran (<span id="unscheduled-session-label">Sesi Pagi</span>)
          </h3>
          <span class="text-[11px] text-slate-400">Menunjukkan perbandingan jumlah waktu kontrak berbanding slot yang telah diletakkan di papan jadual.</span>
        </div>
        <div id="assignment-fulfillment-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1"></div>
      </div>

      <!-- Modal Tambah Slot Manual -->
      <div id="modal-manual-slot" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm hidden items-center justify-center p-4">
        <div class="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-md w-full p-5 shadow-neon-cyan space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 class="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <i class="fa-solid fa-calendar-plus"></i> Letak Slot Pengajaran Manual
            </h3>
            <button onclick="App.closeManualSlotModal()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="App.saveManualSlot(event)" class="space-y-3 text-xs">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Pilih Kontrak Pengajaran (Sesi Semasa)</label>
              <select id="manual-slot-assignment" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Hari</label>
                <select id="manual-slot-day" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></select>
              </div>
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Waktu Mula</label>
                <select id="manual-slot-period" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Bilangan Waktu Berturut</label>
                <select id="manual-slot-duration" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 font-mono">
                  <option value="1">1 Waktu (Single)</option>
                  <option value="2">2 Waktu (Double)</option>
                </select>
              </div>
              <div class="flex items-end pb-2">
                <label class="flex items-center gap-2 text-amber-300 cursor-pointer font-semibold">
                  <input type="checkbox" id="manual-slot-lock" checked class="w-4 h-4 accent-amber-400 rounded" />
                  Kunci (Freeze) Slot
                </label>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" onclick="App.closeManualSlotModal()" class="px-3 py-2 rounded-xl bg-slate-800 text-slate-300">Batal</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-cyan-400 text-slate-950 font-bold shadow-neon-cyan">Letak ke Jadual</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  setBoardViewMode(mode) {
    this.boardState.viewMode = mode;
    const btnClasses = document.getElementById("btn-board-view-classes");
    const btnTeachers = document.getElementById("btn-board-view-teachers");
    if (mode === "classes") {
      btnClasses.className = "px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-cyan-400 text-slate-950 shadow-neon-cyan transition flex items-center gap-1.5";
      btnTeachers.className = "px-3 py-1.5 rounded-lg text-xs font-bold uppercase text-slate-400 hover:text-white transition flex items-center gap-1.5";
    } else {
      btnTeachers.className = "px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-emerald-400 text-slate-950 shadow-neon-emerald transition flex items-center gap-1.5";
      btnClasses.className = "px-3 py-1.5 rounded-lg text-xs font-bold uppercase text-slate-400 hover:text-white transition flex items-center gap-1.5";
    }
    this.renderTimetableBoard();
  },

  setBoardDayFilter(day) {
    this.boardState.filterDay = day;
    this.renderTimetableBoard();
  },

  // ==========================================================================
  // 3. PENGESAN PERTINDIHAN MASA NYATA (REAL-TIME CLASH CHECKER)
  // ==========================================================================
  detectSessionClashes(slotsInput = null) {
    const slots = (slotsInput || this.state.timetableSlots).filter(
      s => s.session_type === this.state.currentSession
    );
    const periods = this.getSessionPeriods();
    const recessPeriods = new Set(periods.filter(p => p.is_recess).map(p => p.period_number));

    const clashes = [];
    const slotClashMap = new Map(); // slotId -> array mesej ralat

    const markClash = (slotId, msg) => {
      if (!slotClashMap.has(slotId)) slotClashMap.set(slotId, []);
      if (!slotClashMap.get(slotId).includes(msg)) {
        slotClashMap.get(slotId).push(msg);
      }
    };

    // Kumpulkan mengikut Hari + Waktu
    const byDayPeriod = new Map();
    for (const s of slots) {
      if (recessPeriods.has(s.period_number)) {
        const msg = `Slot berada pada Waktu Rehat (${s.day_name} W${s.period_number})`;
        clashes.push(msg);
        markClash(s.id, msg);
      }
      const key = `${s.day_name}__${s.period_number}`;
      if (!byDayPeriod.has(key)) byDayPeriod.set(key, []);
      byDayPeriod.get(key).push(s);
    }

    for (const [key, cellSlots] of byDayPeriod.entries()) {
      const [dayName, periodStr] = key.split("__");
      // Semak Pertindihan Guru antara dua rekod slot berbeza
      for (let i = 0; i < cellSlots.length; i++) {
        for (let j = i + 1; j < cellSlots.length; j++) {
          const a = cellSlots[i];
          const b = cellSlots[j];

          // Guru bertindih
          const sharedTeachers = (a.teacher_ids || []).filter(tid => (b.teacher_ids || []).includes(tid));
          if (sharedTeachers.length > 0) {
            const tCodes = sharedTeachers.map(tid => this.state.teachers.find(t => t.id === tid)?.short_code || "Guru").join(", ");
            const msg = `Pertindihan Guru [${tCodes}] pada ${dayName} W${periodStr}`;
            clashes.push(msg);
            markClash(a.id, msg);
            markClash(b.id, msg);
          }

          // Kelas bertindih (Kebenaran khas: jika kedua-dua slot berkongsi concurrent_group_tag yang sama dan tidak kosong, ia adalah blok serentak yang sah seperti PI + Moral + BC + BT dalam kelas yang sama)
          const sharedClasses = (a.class_ids || []).filter(cid => (b.class_ids || []).includes(cid));
          if (sharedClasses.length > 0) {
            const sameConcurrentTag =
              a.concurrent_group_tag &&
              b.concurrent_group_tag &&
              a.concurrent_group_tag === b.concurrent_group_tag;

            if (!sameConcurrentTag) {
              const cNames = sharedClasses.map(cid => this.state.classes.find(c => c.id === cid)?.class_name || "Kelas").join(", ");
              const msg = `Pertindihan Kelas [${cNames}] tanpa Tag Serentak pada ${dayName} W${periodStr}`;
              clashes.push(msg);
              markClash(a.id, msg);
              markClash(b.id, msg);
            }
          }
        }
      }
    }

    return { clashes, slotClashMap };
  },

  canPlaceSlotGroupAt(slotsToMove, targetDay, targetPeriod, allSessionSlots) {
    const periods = this.getSessionPeriods();
    const targetPeriodObj = periods.find(p => p.period_number === targetPeriod);
    if (!targetPeriodObj) return { ok: false, reason: "Waktu loceng tidak wujud." };
    if (targetPeriodObj.is_recess) return { ok: false, reason: "Tidak boleh meletakkan PdP pada Waktu Rehat." };

    const movingIds = new Set(slotsToMove.map(s => s.id));
    const otherSlotsAtTarget = allSessionSlots.filter(
      s => !movingIds.has(s.id) && s.day_name === targetDay && s.period_number === targetPeriod
    );

    const movingTeachers = new Set();
    const movingClasses = new Set();
    slotsToMove.forEach(s => {
      (s.teacher_ids || []).forEach(t => movingTeachers.add(t));
      (s.class_ids || []).forEach(c => movingClasses.add(c));
    });

    for (const existing of otherSlotsAtTarget) {
      // Semak guru
      for (const tid of existing.teacher_ids || []) {
        if (movingTeachers.has(tid)) {
          const t = this.state.teachers.find(x => x.id === tid);
          return {
            ok: false,
            reason: `Pertindihan Guru: ${t?.short_code || t?.name || "Guru"} sudah mengajar pada ${targetDay} W${targetPeriod}.`
          };
        }
      }

      // Semak kelas (melainkan tag serentak sama)
      for (const cid of existing.class_ids || []) {
        if (movingClasses.has(cid)) {
          const movingTag = slotsToMove[0]?.concurrent_group_tag;
          const sameConcurrent = movingTag && existing.concurrent_group_tag === movingTag;
          if (!sameConcurrent) {
            const c = this.state.classes.find(x => x.id === cid);
            return {
              ok: false,
              reason: `Pertindihan Kelas: Kelas ${c?.class_name || ""} sudah mempunyai subjek lain pada ${targetDay} W${targetPeriod}.`
            };
          }
        }
      }
    }

    return { ok: true };
  },

  // ==========================================================================
  // 4. PAPARAN MATRIKS PAPAN JADUAL INTERAKTIF (TAB 4)
  // ==========================================================================
  renderTimetableBoard() {
    const table = document.getElementById("timetable-matrix-table");
    if (!table) return;

    const allDays = this.getDaysOfWeek();
    const daySelect = document.getElementById("board-filter-day");
    if (daySelect) {
      const currentVal = this.boardState.filterDay;
      daySelect.innerHTML = `<option value="ALL">Semua Hari (${allDays.length} Hari)</option>` +
        allDays.map(d => `<option value="${this.escapeHtml(d)}">Hari: ${this.escapeHtml(d)}</option>`).join("");
      daySelect.value = allDays.includes(currentVal) ? currentVal : "ALL";
    }

    const days = this.boardState.filterDay === "ALL"
      ? allDays
      : allDays.filter(d => d === this.boardState.filterDay);
    const periods = this.getSessionPeriods();

    if (periods.length === 0) {
      table.innerHTML = `
        <tbody>
          <tr>
            <td class="p-10 text-center text-slate-400 text-xs">
              Waktu loceng bagi <strong>Sesi ${this.state.currentSession}</strong> belum ditetapkan. Sila jana waktu loceng di <strong>Tab 1</strong> terlebih dahulu.
            </td>
          </tr>
        </tbody>`;
      return;
    }

    const sessionSlots = this.state.timetableSlots.filter(
      s => s.session_type === this.state.currentSession
    );
    const { clashes, slotClashMap } = this.detectSessionClashes(sessionSlots);

    // Kemas kini lencana statistik & status pertindihan
    const lockedCount = sessionSlots.filter(s => s.is_locked).length;
    const statsEl = document.getElementById("board-stats-badges");
    if (statsEl) {
      statsEl.innerHTML = `
        <span class="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-cyan-300">Slot Aktif: <strong>${sessionSlots.length}</strong></span>
        <span class="px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-300"><i class="fa-solid fa-lock mr-1"></i>Dikunci: <strong>${lockedCount}</strong></span>
      `;
    }

    const clashEl = document.getElementById("board-clash-summary");
    if (clashEl) {
      if (clashes.length === 0) {
        clashEl.innerHTML = `
          <span class="text-emerald-400 font-bold flex items-center gap-2">
            <i class="fa-solid fa-shield-check"></i> 0 Pertindihan Dikesan (Jadual Bebas Konflik)
          </span>
          <span class="text-[11px] font-mono text-slate-400">Sesi ${this.state.currentSession}</span>
        `;
      } else {
        clashEl.innerHTML = `
          <span class="text-rose-400 font-bold flex items-center gap-2 truncate" title="${this.escapeHtml(clashes.join(' | '))}">
            <i class="fa-solid fa-triangle-exclamation animate-bounce"></i> ${clashes.length} Konflik Dikesan!
          </span>
          <button onclick="App.showToast('${this.escapeHtml(clashes[0])}', 'error')" class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[11px] font-mono border border-rose-500/40">Lihat</button>
        `;
      }
    }

    // Banner slot terpilih untuk gerak secara klik
    const selBanner = document.getElementById("board-active-selection-banner");
    if (selBanner) {
      if (this.boardState.selectedSlotIdsForMove?.length) {
        selBanner.classList.remove("hidden");
        selBanner.classList.add("flex");
        selBanner.innerHTML = `
          <span><i class="fa-solid fa-arrows-up-down-left-right mr-1"></i> ${this.boardState.selectedSlotIdsForMove.length} slot dipilih. Klik mana-mana sel sasaran untuk pindah.</span>
          <button onclick="App.cancelSlotSelection()" class="text-rose-400 hover:text-white ml-1"><i class="fa-solid fa-xmark"></i></button>
        `;
      } else {
        selBanner.classList.add("hidden");
        selBanner.classList.remove("flex");
      }
    }

    // Bina Baris Mengikut Mod ('classes' atau 'teachers')
    const rows = this.boardState.viewMode === "classes"
      ? this.state.classes
          .filter(c => c.session_type === this.state.currentSession)
          .map(c => ({ id: c.id, title: c.class_name, subtitle: `Tahun ${c.year_level}`, type: "class" }))
      : this.state.teachers
          .filter(t => t.session_type === "Kedua-dua" || t.session_type === this.state.currentSession)
          .map(t => ({ id: t.id, title: t.short_code, subtitle: t.name, type: "teacher" }));

    // Kepala Jadual Dua Tingkat (Hari -> Waktu Loceng)
    const theadHtml = `
      <thead class="sticky top-0 z-20 bg-slate-950 shadow-md">
        <tr class="border-b border-slate-800">
          <th rowspan="2" class="sticky left-0 z-30 bg-slate-950 px-3 py-2 border-r border-slate-800 min-w-[140px] text-xs font-extrabold uppercase text-cyan-400">
            ${this.boardState.viewMode === "classes" ? "KELAS" : "GURU"} \\ HARI
          </th>
          ${days.map(day => `
            <th colspan="${periods.length}" class="px-2 py-1.5 text-center text-xs font-extrabold uppercase tracking-wider text-white border-r border-slate-700 bg-slate-900">
              ${this.escapeHtml(day)}
            </th>
          `).join("")}
        </tr>
        <tr class="border-b border-slate-700">
          ${days.map(() => periods.map(p => `
            <th class="px-1 py-1 text-center border-r border-slate-800/80 min-w-[68px] ${p.is_recess ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-950 text-slate-300'}">
              <div class="text-[10px] font-mono font-bold">${this.escapeHtml(p.label)}</div>
              <div class="text-[9px] font-mono text-slate-500">${(p.start_time || "").slice(0,5)}</div>
            </th>
          `).join("")).join("")}
        </tr>
      </thead>
    `;

    // Badan Jadual
    const tbodyHtml = rows.map(row => {
      return `
        <tr class="border-b border-slate-800/80 hover:bg-slate-900/40 transition">
          <td class="sticky left-0 z-10 bg-slate-950 px-3 py-2 border-r border-slate-800">
            <div class="font-bold text-xs text-white">${this.escapeHtml(row.title)}</div>
            <div class="text-[10px] text-slate-400 truncate max-w-[125px]">${this.escapeHtml(row.subtitle)}</div>
          </td>
          ${days.map(day => periods.map(p => {
            if (p.is_recess) {
              return `<td class="bg-amber-500/5 border-r border-slate-800/60 text-center align-middle"><span class="text-[9px] font-mono text-amber-500/60 uppercase">Rehat</span></td>`;
            }

            const matchingSlots = sessionSlots.filter(s => {
              if (s.day_name !== day || s.period_number !== p.period_number) return false;
              return row.type === "class"
                ? (s.class_ids || []).includes(row.id)
                : (s.teacher_ids || []).includes(row.id);
            });

            return `
              <td
                class="p-1 border-r border-slate-800/60 align-top min-w-[68px] h-16 transition hover:bg-cyan-500/10 cursor-pointer"
                ondragover="event.preventDefault()"
                ondrop="App.handleCellDrop(event, '${this.escapeHtml(day)}', ${p.period_number})"
                onclick="App.handleEmptyOrTargetCellClick('${this.escapeHtml(day)}', ${p.period_number})"
              >
                <div class="flex flex-col gap-1 h-full">
                  ${matchingSlots.map(slot => this.renderCompactSlotCard(slot, row.type, slotClashMap)).join("")}
                </div>
              </td>
            `;
          }).join("")).join("")}
        </tr>
      `;
    }).join("");

    table.innerHTML = theadHtml + `<tbody>${tbodyHtml}</tbody>`;
    this.renderAssignmentFulfillmentGrid(sessionSlots);
  },

  renderCompactSlotCard(slot, rowType, slotClashMap) {
    const sub = this.state.subjects.find(s => s.id === slot.subject_id);
    const teachers = (slot.teacher_ids || []).map(id => this.state.teachers.find(t => t.id === id)?.short_code || "?").join("+");
    const classes = (slot.class_ids || []).map(id => this.state.classes.find(c => c.id === id)?.class_name || "?").join("+");

    const clashReasons = slotClashMap.get(slot.id) || [];
    const hasClash = clashReasons.length > 0;
    const isSelected = (this.boardState.selectedSlotIdsForMove || []).includes(slot.id);
    const color = sub?.color_hex || "#22d3ee";

    // Kumpulan slot berkaitan (jika ada tag serentak pada hari & waktu yang sama)
    const groupSlotIds = this.getLinkedConcurrentSlotIds(slot);
    const encodedGroupIds = groupSlotIds.join(",");

    return `
      <div
        draggable="${!slot.is_locked}"
        ondragstart="App.handleSlotDragStart(event, '${encodedGroupIds}')"
        onclick="event.stopPropagation(); App.handleSlotCardClick('${encodedGroupIds}')"
        title="${hasClash ? this.escapeHtml(clashReasons.join(' | ')) : `${this.escapeHtml(sub?.subject_name || '')} (${teachers}) - ${classes}`}"
        class="relative rounded-lg p-1 text-[10px] leading-tight select-none border transition shadow-sm ${
          hasClash
            ? 'bg-rose-950/90 border-rose-500 ring-2 ring-rose-500 animate-pulse'
            : isSelected
            ? 'bg-cyan-950 border-cyan-300 ring-2 ring-cyan-400'
            : 'bg-slate-900/95 border-slate-700/80 hover:border-cyan-400'
        }"
        style="border-left: 4px solid ${color}"
      >
        <div class="flex items-center justify-between gap-1">
          <span class="font-mono font-extrabold text-white truncate">${this.escapeHtml(sub?.subject_code || "SUB")}</span>
          <div class="flex items-center gap-0.5 shrink-0">
            ${slot.concurrent_group_tag ? `<i class="fa-solid fa-link text-[8px] text-pink-400" title="Blok Serentak: ${this.escapeHtml(slot.concurrent_group_tag)}"></i>` : ''}
            <button
              type="button"
              onclick="event.stopPropagation(); App.toggleSlotLock('${encodedGroupIds}', ${!slot.is_locked})"
              class="${slot.is_locked ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'} text-[9px] px-0.5"
              title="${slot.is_locked ? 'Slot Dikunci (Freeze) - Klik untuk buka kunci' : 'Klik untuk Kunci (Freeze) slot ini'}"
            >
              <i class="fa-solid ${slot.is_locked ? 'fa-lock' : 'fa-lock-open'}"></i>
            </button>
            <button
              type="button"
              onclick="event.stopPropagation(); App.deleteSlotGroup('${encodedGroupIds}')"
              class="text-slate-600 hover:text-rose-400 text-[9px] px-0.5"
              title="Padam slot ini"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <div class="text-[9px] font-mono ${rowType === 'class' ? 'text-cyan-300' : 'text-amber-300'} truncate mt-0.5">
          ${this.escapeHtml(rowType === "class" ? teachers : classes)}
        </div>
      </div>
    `;
  },

  getLinkedConcurrentSlotIds(slot) {
    if (!slot.concurrent_group_tag) return [slot.id];
    return this.state.timetableSlots
      .filter(
        s =>
          s.session_type === slot.session_type &&
          s.day_name === slot.day_name &&
          s.period_number === slot.period_number &&
          s.concurrent_group_tag === slot.concurrent_group_tag
      )
      .map(s => s.id);
  },

  renderAssignmentFulfillmentGrid(sessionSlots) {
    const grid = document.getElementById("assignment-fulfillment-grid");
    const label = document.getElementById("unscheduled-session-label");
    if (label) label.textContent = `Sesi ${this.state.currentSession}`;
    if (!grid) return;

    const contracts = this.state.teachingAssignments.filter(
      a => a.session_type === this.state.currentSession
    );

    if (contracts.length === 0) {
      grid.innerHTML = `<div class="col-span-4 text-xs text-slate-500 py-4 text-center">Tiada kontrak pengajaran bagi sesi ini.</div>`;
      return;
    }

    grid.innerHTML = contracts.map(a => {
      const sub = this.state.subjects.find(s => s.id === a.subject_id);
      const tCodes = (a.teacher_ids || []).map(id => this.state.teachers.find(t => t.id === id)?.short_code || "?").join("+");
      const cNames = (a.class_ids || []).map(id => this.state.classes.find(c => c.id === id)?.class_name || "?").join("+");
      const placed = sessionSlots.filter(s => s.assignment_id === a.id).length;
      const target = Number(a.periods_per_week) || 0;
      const done = placed === target;

      return `
        <div class="p-2.5 rounded-xl bg-slate-950 border ${done ? 'border-emerald-500/30' : 'border-amber-500/40'} flex items-center justify-between gap-2 text-xs">
          <div class="truncate">
            <div class="flex items-center gap-1.5">
              <span class="font-mono font-bold text-white">${this.escapeHtml(sub?.subject_code || "SUB")}</span>
              <span class="text-amber-300 font-semibold truncate">${this.escapeHtml(cNames)}</span>
            </div>
            <div class="text-[10px] text-slate-400 font-mono truncate">${this.escapeHtml(tCodes)} ${a.concurrent_group_tag ? `• [${this.escapeHtml(a.concurrent_group_tag)}]` : ''}</div>
          </div>
          <span class="px-2 py-0.5 rounded font-mono font-bold text-[11px] shrink-0 ${done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
            ${placed}/${target}W
          </span>
        </div>
      `;
    }).join("");
  },

  // ==========================================================================
  // 5. KAWALAN INTERAKTIF: FREEZE/LOCK, DRAG-AND-DROP & SLOT MANUAL
  // ==========================================================================
  async toggleSlotLock(encodedIds, lockState) {
    const ids = encodedIds.split(",").filter(Boolean);
    if (!ids.length || !this.supabase) return;

    const { error } = await this.supabase
      .from("timetable_slots")
      .update({ is_locked: lockState })
      .in("id", ids);

    if (error) {
      this.showToast("Gagal menukar status kunci slot: " + error.message, "error");
      return;
    }

    this.state.timetableSlots.forEach(s => {
      if (ids.includes(s.id)) s.is_locked = lockState;
    });
    this.renderTimetableBoard();
    this.showToast(
      lockState ? `Slot dikunci (Freeze). Ia tidak akan diubah semasa Auto-Generate.` : `Kunci slot dibuka.`,
      lockState ? "warning" : "info"
    );
  },

  async deleteSlotGroup(encodedIds) {
    const ids = encodedIds.split(",").filter(Boolean);
    const targetSlots = this.state.timetableSlots.filter(s => ids.includes(s.id));
    if (targetSlots.some(s => s.is_locked)) {
      this.showToast("Slot ini sedang dikunci (Freeze). Buka kunci dahulu sebelum memadam.", "warning");
      return;
    }

    const { error } = await this.supabase.from("timetable_slots").delete().in("id", ids);
    if (error) {
      this.showToast("Gagal memadam slot: " + error.message, "error");
      return;
    }

    this.state.timetableSlots = this.state.timetableSlots.filter(s => !ids.includes(s.id));
    this.renderTimetableBoard();
    this.renderAscPrintPreview();
  },

  handleSlotDragStart(event, encodedIds) {
    const ids = encodedIds.split(",").filter(Boolean);
    const slots = this.state.timetableSlots.filter(s => ids.includes(s.id));
    if (slots.some(s => s.is_locked)) {
      event.preventDefault();
      this.showToast("Slot yang dikunci (Freeze) tidak boleh dialihkan. Buka kunci dahulu.", "warning");
      return;
    }
    this.boardState.dragSourceSlotIds = ids;
    event.dataTransfer.setData("text/plain", encodedIds);
  },

  handleSlotCardClick(encodedIds) {
    const ids = encodedIds.split(",").filter(Boolean);
    const slots = this.state.timetableSlots.filter(s => ids.includes(s.id));
    if (slots.some(s => s.is_locked)) {
      this.showToast("Slot ini dikunci (Freeze). Klik ikon mangga untuk menyahkunci jika mahu alihkan.", "warning");
      return;
    }
    this.boardState.selectedSlotIdsForMove = ids;
    this.renderTimetableBoard();
  },

  cancelSlotSelection() {
    this.boardState.selectedSlotIdsForMove = null;
    this.renderTimetableBoard();
  },

  async handleCellDrop(event, targetDay, targetPeriod) {
    event.preventDefault();
    const encoded = event.dataTransfer.getData("text/plain");
    const ids = (encoded ? encoded.split(",") : this.boardState.dragSourceSlotIds) || [];
    this.boardState.dragSourceSlotIds = null;
    if (ids.length > 0) {
      await this.moveSlotGroupTo(ids, targetDay, Number(targetPeriod));
    }
  },

  async handleEmptyOrTargetCellClick(targetDay, targetPeriod) {
    if (!this.boardState.selectedSlotIdsForMove?.length) return;
    const ids = [...this.boardState.selectedSlotIdsForMove];
    this.boardState.selectedSlotIdsForMove = null;
    await this.moveSlotGroupTo(ids, targetDay, Number(targetPeriod));
  },

  async moveSlotGroupTo(slotIds, targetDay, targetPeriod) {
    const sessionSlots = this.state.timetableSlots.filter(
      s => s.session_type === this.state.currentSession
    );
    const slotsToMove = sessionSlots.filter(s => slotIds.includes(s.id));
    if (!slotsToMove.length) return;

    const check = this.canPlaceSlotGroupAt(slotsToMove, targetDay, targetPeriod, sessionSlots);
    if (!check.ok) {
      this.showToast(check.reason, "error");
      this.renderTimetableBoard();
      return;
    }

    const { error } = await this.supabase
      .from("timetable_slots")
      .update({ day_name: targetDay, period_number: targetPeriod })
      .in("id", slotIds);

    if (error) {
      this.showToast("Gagal mengalihkan slot: " + error.message, "error");
      return;
    }

    slotsToMove.forEach(s => {
      s.day_name = targetDay;
      s.period_number = targetPeriod;
    });
    this.renderTimetableBoard();
    this.renderAscPrintPreview();
    this.showToast(`Slot berjaya dialihkan ke ${targetDay} (Waktu ${targetPeriod}).`, "success");
  },

  openManualSlotModal() {
    const modal = document.getElementById("modal-manual-slot");
    const assignSelect = document.getElementById("manual-slot-assignment");
    const daySelect = document.getElementById("manual-slot-day");
    const periodSelect = document.getElementById("manual-slot-period");

    const contracts = this.state.teachingAssignments.filter(
      a => a.session_type === this.state.currentSession
    );
    assignSelect.innerHTML = contracts.map(a => {
      const sub = this.state.subjects.find(s => s.id === a.subject_id);
      const tCodes = (a.teacher_ids || []).map(id => this.state.teachers.find(t => t.id === id)?.short_code || "").join("+");
      const cNames = (a.class_ids || []).map(id => this.state.classes.find(c => c.id === id)?.class_name || "").join("+");
      return `<option value="${a.id}">[${this.escapeHtml(sub?.subject_code || "")}] ${this.escapeHtml(cNames)} — ${this.escapeHtml(tCodes)}</option>`;
    }).join("");

    daySelect.innerHTML = this.getDaysOfWeek().map(d => `<option value="${this.escapeHtml(d)}">${this.escapeHtml(d)}</option>`).join("");
    periodSelect.innerHTML = this.getSessionPeriods()
      .filter(p => !p.is_recess)
      .map(p => `<option value="${p.period_number}">Waktu ${p.period_number} (${this.escapeHtml(p.label)})</option>`)
      .join("");

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  },

  closeManualSlotModal() {
    const modal = document.getElementById("modal-manual-slot");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  },

  async saveManualSlot(event) {
    event.preventDefault();
    const assignId = document.getElementById("manual-slot-assignment").value;
    const day = document.getElementById("manual-slot-day").value;
    const startPeriod = parseInt(document.getElementById("manual-slot-period").value, 10);
    const duration = parseInt(document.getElementById("manual-slot-duration").value, 10) || 1;
    const isLocked = document.getElementById("manual-slot-lock").checked;

    const contract = this.state.teachingAssignments.find(a => a.id === assignId);
    if (!contract) return;

    const sessionSlots = this.state.timetableSlots.filter(
      s => s.session_type === this.state.currentSession
    );
    const rowsToInsert = [];

    for (let offset = 0; offset < duration; offset++) {
      const pNum = startPeriod + offset;
      const virtualSlot = {
        id: "temp_" + offset,
        session_type: this.state.currentSession,
        day_name: day,
        period_number: pNum,
        assignment_id: contract.id,
        subject_id: contract.subject_id,
        teacher_ids: contract.teacher_ids,
        class_ids: contract.class_ids,
        concurrent_group_tag: contract.concurrent_group_tag || null,
        is_locked: isLocked
      };

      const check = this.canPlaceSlotGroupAt([virtualSlot], day, pNum, sessionSlots);
      if (!check.ok) {
        this.showToast(check.reason, "error");
        return;
      }

      const { id, ...cleanRow } = virtualSlot;
      rowsToInsert.push(cleanRow);
    }

    const { data, error } = await this.supabase.from("timetable_slots").insert(rowsToInsert).select();
    if (error) {
      this.showToast("Gagal menambah slot manual: " + error.message, "error");
      return;
    }

    this.state.timetableSlots.push(...(data || []));
    this.closeManualSlotModal();
    this.renderTimetableBoard();
    this.renderAscPrintPreview();
    this.showToast("Slot manual berjaya diletakkan ke papan jadual!", "success");
  },

  async clearUnlockedSessionSlots() {
    if (!confirm(`Kosongkan semua slot yang TIDAK dikunci bagi Sesi ${this.state.currentSession}? Slot yang mempunyai ikon Kunci (Freeze) akan dikekalkan.`)) return;

    const { error } = await this.supabase
      .from("timetable_slots")
      .delete()
      .eq("session_type", this.state.currentSession)
      .eq("is_locked", false);

    if (error) {
      this.showToast("Gagal mengosongkan slot: " + error.message, "error");
      return;
    }

    await this.loadTimetableSlots();
    this.renderTimetableBoard();
    this.renderAscPrintPreview();
    this.showToast("Semua slot tidak dikunci telah dikosongkan.", "info");
  },

  // ==========================================================================
  // 6. ENJIN AUTO-GENERATE JADUAL WAKTU (ALGORITMA CSP GAYA aSc TIMETABLES)
  // ==========================================================================
  async runAutoGenerateSessionTimetable() {
    if (!this.supabase) return;
    const session = this.state.currentSession;
    const days = this.getDaysOfWeek();
    const periods = this.getSessionPeriods();
    const teachingPeriods = periods.filter(p => !p.is_recess).map(p => p.period_number);

    if (teachingPeriods.length === 0) {
      return this.showToast(`Sila tetapkan Waktu Loceng bagi Sesi ${session} di Tab 1 terlebih dahulu.`, "warning");
    }

    const contracts = this.state.teachingAssignments.filter(a => a.session_type === session);
    if (contracts.length === 0) {
      return this.showToast(`Tiada Kontrak Pengajaran ditemui bagi Sesi ${session} di Tab 3.`, "warning");
    }

    // 1. Kekalkan semua slot yang telah dikunci (is_locked = true)
    const lockedSlots = this.state.timetableSlots.filter(
      s => s.session_type === session && s.is_locked
    );

    // Struktur Memori Semakan Pantas CSP
    const workingSlots = lockedSlots.map(s => ({ ...s }));

    const isSlotFreeForGroup = (contractsGroup, day, startPeriod, duration) => {
      // Pastikan semua waktu berturut wujud dan bukan waktu rehat
      const neededPeriods = [];
      for (let i = 0; i < duration; i++) {
        const p = startPeriod + i;
        if (!teachingPeriods.includes(p)) return false;
        neededPeriods.push(p);
      }

      // Kumpulkan semua guru & kelas dalam kumpulan kontrak ini
      const groupTeachers = new Set();
      const groupClasses = new Set();
      for (const c of contractsGroup) {
        for (const tid of c.teacher_ids || []) {
          // Semak jika ada dua kontrak berbeza dalam blok serentak yang sama berkongsi guru yang sama
          if (groupTeachers.has(tid) && contractsGroup.length > 1) return false;
          groupTeachers.add(tid);
        }
        (c.class_ids || []).forEach(cid => groupClasses.add(cid));
      }

      // Semak terhadap workingSlots sedia ada
      for (const p of neededPeriods) {
        const existingAtCell = workingSlots.filter(
          s => s.day_name === day && s.period_number === p
        );
        for (const ex of existingAtCell) {
          if ((ex.teacher_ids || []).some(tid => groupTeachers.has(tid))) return false;
          if ((ex.class_ids || []).some(cid => groupClasses.has(cid))) return false;
        }
      }

      return true;
    };

    // Kira baki pecahan kad (split cards) bagi setiap kontrak selepas menolak slot yang telah dikunci
    const parseSplitCards = (splitStr, totalPeriods, lockedCount) => {
      let rawCards = String(splitStr || "")
        .split("+")
        .map(n => parseInt(n.trim(), 10))
        .filter(n => n > 0);

      const sumRaw = rawCards.reduce((a, b) => a + b, 0);
      if (sumRaw !== totalPeriods) {
        rawCards = [];
        let rem = totalPeriods;
        while (rem >= 2) { rawCards.push(2); rem -= 2; }
        if (rem === 1) rawCards.push(1);
      }

      // Tolak waktu yang sudah dikunci
      let toDeduct = lockedCount;
      const remainingCards = [];
      for (const card of rawCards) {
        if (toDeduct <= 0) {
          remainingCards.push(card);
        } else if (toDeduct >= card) {
          toDeduct -= card;
        } else {
          remainingCards.push(card - toDeduct);
          toDeduct = 0;
        }
      }
      return remainingCards.sort((a, b) => b - a); // Utamakan kad berkembar (2) dahulu
    };

    // 2. Asingkan Kontrak Mengikut Keutamaan aSc:
    //    (A) Kumpulan Blok Serentak (concurrent_group_tag)
    //    (B) Kontrak Individu (Kelas Bergabung / Guru Bergabung / Biasa)
    const concurrentGroupsMap = new Map();
    const standaloneContracts = [];

    for (const c of contracts) {
      if (c.concurrent_group_tag && c.concurrent_group_tag.trim() !== "") {
        const tag = c.concurrent_group_tag.trim().toUpperCase();
        if (!concurrentGroupsMap.has(tag)) concurrentGroupsMap.set(tag, []);
        concurrentGroupsMap.get(tag).push(c);
      } else {
        standaloneContracts.push(c);
      }
    }

    let unplacedCardsCount = 0;

    // FASA ALGORITMA A: Jadualkan Kumpulan Mata Pelajaran Serentak (Synchronized Blocks)
    for (const [tag, groupContracts] of concurrentGroupsMap.entries()) {
      // Ambil struktur split daripada kontrak pertama dalam kumpulan serentak
      const primary = groupContracts[0];
      const lockedForTag = lockedSlots.filter(
        s => s.concurrent_group_tag === tag && s.assignment_id === primary.id
      ).length;

      const cards = parseSplitCards(primary.period_split, Number(primary.periods_per_week) || 1, lockedForTag);

      for (const cardDuration of cards) {
        // Susun hari supaya tidak berkumpul pada hari yang sama untuk tag ini
        const sortedDays = [...days].sort((dA, dB) => {
          const countA = workingSlots.filter(s => s.day_name === dA && s.concurrent_group_tag === tag).length;
          const countB = workingSlots.filter(s => s.day_name === dB && s.concurrent_group_tag === tag).length;
          return countA - countB;
        });

        let placed = false;
        for (const day of sortedDays) {
          // Elak meletakkan subjek yang sama 2 kali pada hari yang sama jika boleh
          const alreadyOnDay = workingSlots.some(s => s.day_name === day && s.concurrent_group_tag === tag);
          if (alreadyOnDay && sortedDays.length > 1) continue;

          for (const startP of teachingPeriods) {
            if (isSlotFreeForGroup(groupContracts, day, startP, cardDuration)) {
              for (let offset = 0; offset < cardDuration; offset++) {
                for (const gc of groupContracts) {
                  workingSlots.push({
                    session_type: session,
                    day_name: day,
                    period_number: startP + offset,
                    assignment_id: gc.id,
                    subject_id: gc.subject_id,
                    teacher_ids: gc.teacher_ids,
                    class_ids: gc.class_ids,
                    concurrent_group_tag: tag,
                    is_locked: false
                  });
                }
              }
              placed = true;
              break;
            }
          }
          if (placed) break;
        }

        // Cuba semula tanpa syarat hari berbeza jika ruang sempit
        if (!placed) {
          for (const day of days) {
            for (const startP of teachingPeriods) {
              if (isSlotFreeForGroup(groupContracts, day, startP, cardDuration)) {
                for (let offset = 0; offset < cardDuration; offset++) {
                  for (const gc of groupContracts) {
                    workingSlots.push({
                      session_type: session,
                      day_name: day,
                      period_number: startP + offset,
                      assignment_id: gc.id,
                      subject_id: gc.subject_id,
                      teacher_ids: gc.teacher_ids,
                      class_ids: gc.class_ids,
                      concurrent_group_tag: tag,
                      is_locked: false
                    });
                  }
                }
                placed = true;
                break;
              }
            }
            if (placed) break;
          }
        }

        if (!placed) unplacedCardsCount++;
      }
    }

    // FASA ALGORITMA B: Susun Kontrak Bukan Serentak mengikut kesukaran (Co-Teaching + Kelas Gabung + Double Period dahulu)
    standaloneContracts.sort((a, b) => {
      const weightA = ((a.teacher_ids?.length || 1) * 3) + ((a.class_ids?.length || 1) * 3) + (Number(a.periods_per_week) || 0);
      const weightB = ((b.teacher_ids?.length || 1) * 3) + ((b.class_ids?.length || 1) * 3) + (Number(b.periods_per_week) || 0);
      return weightB - weightA;
    });

    for (const contract of standaloneContracts) {
      const sub = this.state.subjects.find(s => s.id === contract.subject_id);
      const lockedForContract = lockedSlots.filter(s => s.assignment_id === contract.id).length;
      const cards = parseSplitCards(contract.period_split, Number(contract.periods_per_week) || 1, lockedForContract);

      for (const cardDuration of cards) {
        // Susun hari mengikut beban paling ringan bagi kelas tersebut supaya taburan seimbang
        const sortedDays = [...days].sort((dA, dB) => {
          const sameSubA = workingSlots.filter(s => s.day_name === dA && s.assignment_id === contract.id).length;
          const sameSubB = workingSlots.filter(s => s.day_name === dB && s.assignment_id === contract.id).length;
          if (sameSubA !== sameSubB) return sameSubA - sameSubB;

          const classLoadA = workingSlots.filter(s => s.day_name === dA && (s.class_ids || []).some(cid => (contract.class_ids || []).includes(cid))).length;
          const classLoadB = workingSlots.filter(s => s.day_name === dB && (s.class_ids || []).some(cid => (contract.class_ids || []).includes(cid))).length;
          return classLoadA - classLoadB;
        });

        const orderedPeriods = sub?.preferred_morning_only
          ? [...teachingPeriods]
          : [...teachingPeriods];

        let placed = false;
        for (const day of sortedDays) {
          for (const startP of orderedPeriods) {
            if (isSlotFreeForGroup([contract], day, startP, cardDuration)) {
              for (let offset = 0; offset < cardDuration; offset++) {
                workingSlots.push({
                  session_type: session,
                  day_name: day,
                  period_number: startP + offset,
                  assignment_id: contract.id,
                  subject_id: contract.subject_id,
                  teacher_ids: contract.teacher_ids,
                  class_ids: contract.class_ids,
                  concurrent_group_tag: null,
                  is_locked: false
                });
              }
              placed = true;
              break;
            }
          }
          if (placed) break;
        }

        if (!placed) unplacedCardsCount++;
      }
    }

    // 3. Simpan Hasil Janaan ke Supabase (Padam slot tidak dikunci & masukkan slot baharu)
    try {
      const { error: delErr } = await this.supabase
        .from("timetable_slots")
        .delete()
        .eq("session_type", session)
        .eq("is_locked", false);
      if (delErr) throw delErr;

      const newlyGenerated = workingSlots
        .filter(s => !s.is_locked)
        .map(({ id, created_at, ...clean }) => clean);

      if (newlyGenerated.length > 0) {
        const { error: insErr } = await this.supabase
          .from("timetable_slots")
          .insert(newlyGenerated);
        if (insErr) throw insErr;
      }

      await this.loadTimetableSlots();
      this.renderTimetableBoard();
      this.renderAscPrintPreview();

      if (unplacedCardsCount === 0) {
        this.showToast(`Jadual Sesi ${session} selesai dijana 100% tanpa sebarang pertindihan!`, "success");
      } else {
        this.showToast(
          `Jadual dijana tetapi ${unplacedCardsCount} pecahan kad tidak dapat dimuatkan kerana kekangan ruang/guru. Sila semak di bawah papan jadual.`,
          "warning"
        );
      }
    } catch (err) {
      this.showToast("Ralat menyimpan janaan jadual: " + err.message, "error");
    }
  },

  // ==========================================================================
  // 7. TAB 6: STUDIO PREVIEW & CETAKAN RASMI GAYA DEFAULT aSc TIMETABLES
  // ==========================================================================
  injectTab6UI() {
    const container = document.getElementById("asc-print-studio-container");
    if (!container) return;

    container.className = "space-y-6 text-left";
    container.innerHTML = `
      <!-- Bar Kawalan Studio Cetakan aSc -->
      <div class="bg-slate-900/95 border border-pink-500/40 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-base font-bold text-pink-400 flex items-center gap-2">
            <i class="fa-solid fa-print"></i> Studio Cetakan Rasmi Gaya Default aSc Timetables (A4 Landskap)
          </h2>
          <p class="text-xs text-slate-400">
            Menjana helaian putih bersih rasmi lengkap dengan Logo Sekolah, Matriks Jadual, Jadual Ringkasan Subjek Guru & Ruang Tandatangan.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <!-- Jenis Cetakan: Mengikut Guru / Mengikut Kelas -->
          <div class="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button id="btn-print-mode-teacher" onclick="App.setPrintMode('teacher')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase bg-pink-500 text-white shadow-neon-pink transition">
              <i class="fa-solid fa-chalkboard-user mr-1"></i> Jadual Guru
            </button>
            <button id="btn-print-mode-class" onclick="App.setPrintMode('class')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase text-slate-400 hover:text-white transition">
              <i class="fa-solid fa-door-open mr-1"></i> Jadual Kelas
            </button>
          </div>

          <!-- Pemilih Individu atau Cetak Semua Sekaligus -->
          <select id="select-print-target" onchange="App.setPrintTarget(this.value)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-cyan-300 focus:outline-none min-w-[230px]"></select>

          <!-- Pilihan Mod Warna Cetakan -->
          <select id="select-print-color" onchange="App.setPrintColorMode(this.value)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200">
            <option value="soft">Tema Putih + Warna Pastel aSc</option>
            <option value="bw">Tema Hitam & Putih Rasmi (100% B&W)</option>
          </select>

          <!-- Butang Cetak Rasmi -->
          <button onclick="App.triggerOfficialPrint()" class="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-neon-cyan transition flex items-center gap-2">
            <i class="fa-solid fa-file-pdf"></i> Cetak / Simpan PDF (A4)
          </button>
        </div>
      </div>

      <!-- Kotak Pratonton Kertas A4 Landskap di Skrin -->
      <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 md:p-8 overflow-x-auto">
        <div id="asc-screen-preview-wrapper" class="space-y-8 mx-auto max-w-[1120px]"></div>
      </div>
    `;
  },

  setPrintMode(mode) {
    this.boardState.printMode = mode;
    const btnT = document.getElementById("btn-print-mode-teacher");
    const btnC = document.getElementById("btn-print-mode-class");
    if (mode === "teacher") {
      btnT.className = "px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase bg-pink-500 text-white shadow-neon-pink transition";
      btnC.className = "px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase text-slate-400 hover:text-white transition";
    } else {
      btnC.className = "px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase bg-cyan-400 text-slate-950 shadow-neon-cyan transition";
      btnT.className = "px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase text-slate-400 hover:text-white transition";
    }
    this.boardState.printTargetId = "ALL";
    this.renderPrintStudioControls();
    this.renderAscPrintPreview();
  },

  setPrintTarget(targetId) {
    this.boardState.printTargetId = targetId;
    this.renderAscPrintPreview();
  },

  setPrintColorMode(colorMode) {
    this.boardState.printColorMode = colorMode;
    this.renderAscPrintPreview();
  },

  renderPrintStudioControls() {
    const select = document.getElementById("select-print-target");
    if (!select) return;

    const s = this.state.currentSession;
    if (this.boardState.printMode === "teacher") {
      const teachers = this.state.teachers.filter(
        t => t.session_type === "Kedua-dua" || t.session_type === s
      );
      select.innerHTML =
        `<option value="ALL">🖨️ Cetak Semua Guru Sekaligus (${teachers.length} Halaman)</option>` +
        teachers.map(t => `<option value="${t.id}">Guru: ${this.escapeHtml(t.name)} (${this.escapeHtml(t.short_code)})</option>`).join("");
    } else {
      const classes = this.state.classes.filter(c => c.session_type === s);
      select.innerHTML =
        `<option value="ALL">🖨️ Cetak Semua Kelas Sekaligus (${classes.length} Halaman)</option>` +
        classes.map(c => `<option value="${c.id}">Kelas: ${this.escapeHtml(c.class_name)} (Tahun ${c.year_level})</option>`).join("");
    }
    select.value = this.boardState.printTargetId;
  },

  renderAscPrintPreview() {
    const previewWrapper = document.getElementById("asc-screen-preview-wrapper");
    const printArea = document.getElementById("print-area");
    if (!previewWrapper || !printArea) return;

    const pagesHtml = this.buildAllPrintPagesHtml();
    previewWrapper.innerHTML = pagesHtml.screenHtml;
    printArea.innerHTML = pagesHtml.printHtml;
  },

  buildAllPrintPagesHtml() {
    const s = this.state.currentSession;
    const mode = this.boardState.printMode;
    const targetId = this.boardState.printTargetId;

    let entities = [];
    if (mode === "teacher") {
      const list = this.state.teachers.filter(t => t.session_type === "Kedua-dua" || t.session_type === s);
      entities = targetId === "ALL" ? list : list.filter(t => t.id === targetId);
    } else {
      const list = this.state.classes.filter(c => c.session_type === s);
      entities = targetId === "ALL" ? list : list.filter(c => c.id === targetId);
    }

    if (entities.length === 0) {
      const emptyMsg = `<div class="bg-white text-black p-10 rounded-xl text-center font-sans">Tiada data ${mode === 'teacher' ? 'Guru' : 'Kelas'} untuk Sesi ${s}.</div>`;
      return { screenHtml: emptyMsg, printHtml: emptyMsg };
    }

    const screenPages = [];
    const printPages = [];

    entities.forEach((entity, idx) => {
      const isLast = idx === entities.length - 1;
      const singleSheetHtml = this.buildSingleAscSheetHtml(entity, mode);

      screenPages.push(`
        <div class="bg-white text-black rounded-xl shadow-2xl p-6 md:p-8 border border-slate-300 overflow-x-auto">
          ${singleSheetHtml}
        </div>
      `);

      printPages.push(`
        <div class="${isLast ? '' : 'page-break'}" style="background:#fff; color:#000; padding: 2mm;">
          ${singleSheetHtml}
        </div>
      `);
    });

    return {
      screenHtml: screenPages.join(""),
      printHtml: printPages.join("")
    };
  },

  buildSingleAscSheetHtml(entity, mode) {
    const school = this.state.schoolSettings || {};
    const schoolName = school.school_name || "SEKOLAH KEBANGSAAN MANTIN";
    const schoolCode = school.school_code || "NBA4031";
    const academicYear = school.academic_year || "2026/2027";
    const logoUrl = school.logo_url || "";
    const session = this.state.currentSession;
    const days = this.getDaysOfWeek();
    const periods = this.getSessionPeriods();
    const useSoftColor = this.boardState.printColorMode === "soft";

    const sessionSlots = this.state.timetableSlots.filter(
      s => s.session_type === session
    );

    const rightBigTitle = mode === "teacher"
      ? `${entity.name} (${entity.short_code})`
      : `KELAS ${entity.class_name}`;

    const rightSubTitle = mode === "teacher"
      ? `JAWATAN: ${(entity.role_title || "GURU AKADEMIK").toUpperCase()} | SESI ${session.toUpperCase()}`
      : (() => {
          const hr = this.state.teachers.find(t => t.id === entity.homeroom_teacher_id);
          return `GURU KELAS: ${hr ? hr.name.toUpperCase() : "-"} | SESI ${session.toUpperCase()}`;
        })();

    // Bina Baris Matriks Hari x Waktu (Dengan cantuman automatik colspan untuk subjek bersebelahan yang sama)
    const matrixRowsHtml = days.map(day => {
      let cellsHtml = "";
      let pIdx = 0;

      while (pIdx < periods.length) {
        const p = periods[pIdx];

        if (p.is_recess) {
          cellsHtml += `
            <td style="border:1.5px solid #000; background:#f1f5f9; text-align:center; vertical-align:middle; font-weight:bold; font-size:10px; color:#334155;">
              REHAT
            </td>`;
          pIdx++;
          continue;
        }

        const cellSlots = sessionSlots.filter(s => {
          if (s.day_name !== day || s.period_number !== p.period_number) return false;
          return mode === "teacher"
            ? (s.teacher_ids || []).includes(entity.id)
            : (s.class_ids || []).includes(entity.id);
        });

        // Kira colspan jika waktu seterusnya mempunyai kontrak/subjek yang sama persis
        let span = 1;
        if (cellSlots.length > 0) {
          const sigCurrent = cellSlots.map(s => `${s.subject_id}_${(s.teacher_ids||[]).join(',')}_${(s.class_ids||[]).join(',')}`).sort().join("|");
          while (pIdx + span < periods.length) {
            const nextP = periods[pIdx + span];
            if (nextP.is_recess) break;
            const nextSlots = sessionSlots.filter(s => {
              if (s.day_name !== day || s.period_number !== nextP.period_number) return false;
              return mode === "teacher"
                ? (s.teacher_ids || []).includes(entity.id)
                : (s.class_ids || []).includes(entity.id);
            });
            const sigNext = nextSlots.map(s => `${s.subject_id}_${(s.teacher_ids||[]).join(',')}_${(s.class_ids||[]).join(',')}`).sort().join("|");
            if (sigNext && sigNext === sigCurrent) {
              span++;
            } else {
              break;
            }
          }
        }

        if (cellSlots.length === 0) {
          cellsHtml += `<td style="border:1.5px solid #000; height:52px;"></td>`;
        } else {
          // Boleh jadi 1 slot atau beberapa slot serentak (contoh: dalam jadual Kelas apabila PI + Moral + BC berjalan serentak)
          const innerBlocks = cellSlots.map(slot => {
            const sub = this.state.subjects.find(x => x.id === slot.subject_id);
            const tCodes = (slot.teacher_ids || []).map(id => this.state.teachers.find(t => t.id === id)?.short_code || "").join("+");
            const cNames = (slot.class_ids || []).map(id => this.state.classes.find(c => c.id === id)?.class_name || "").join("+");
            const bgHex = useSoftColor && sub?.color_hex ? `${sub.color_hex}22` : "#ffffff";

            return `
              <div style="background:${bgHex}; padding:2px 4px; height:100%; display:flex; flex-direction:column; justify-content:space-between; ${cellSlots.length > 1 ? 'border-bottom:1px dashed #64748b;' : ''}">
                <div style="font-size:13px; font-weight:800; text-align:center; color:#000; line-height:1.15;">
                  ${this.escapeHtml(sub?.subject_code || "SUB")}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:flex-end; font-size:9.5px; font-weight:700; color:#1e293b; margin-top:2px;">
                  <span>${this.escapeHtml(cNames)}</span>
                  <span>${this.escapeHtml(tCodes)}</span>
                </div>
              </div>
            `;
          }).join("");

          cellsHtml += `
            <td colspan="${span}" style="border:1.5px solid #000; padding:0; height:52px; vertical-align:stretch;">
              ${innerBlocks}
            </td>
          `;
        }

        pIdx += span;
      }

      return `
        <tr>
          <td style="border:1.5px solid #000; font-weight:800; font-size:11px; text-transform:uppercase; background:#f8fafc; padding:6px 4px; text-align:center;">
            ${this.escapeHtml(day)}
          </td>
          ${cellsHtml}
        </tr>
      `;
    }).join("");

    // Bina Jadual Ringkasan di Bawah (Khusus untuk Jadual Guru & Jadual Kelas)
    const summarySectionHtml = mode === "teacher"
      ? this.buildTeacherSummaryTableHtml(entity, sessionSlots)
      : this.buildClassSummaryTableHtml(entity, sessionSlots);

    return `
      <div style="font-family: Arial, Helvetica, sans-serif; color:#000;">
        <!-- Pengepala Rasmi Gaya Klasik aSc Timetables -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2.5px solid #000; padding-bottom:8px; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${logoUrl
              ? `<img src="${logoUrl}" alt="Logo" style="width:54px; height:54px; object-fit:contain;" />`
              : `<div style="width:48px; height:48px; border:1.5px solid #000; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px;">LOGO</div>`
            }
            <div>
              <div style="font-size:15px; font-weight:900; text-transform:uppercase; letter-spacing:0.3px;">
                ${this.escapeHtml(schoolName)} (${this.escapeHtml(schoolCode)})
              </div>
              <div style="font-size:11px; font-weight:700; color:#334155;">
                JADUAL WAKTU RASMI SESI AKADEMIK ${this.escapeHtml(academicYear)} — SESI ${this.escapeHtml(session.toUpperCase())}
              </div>
            </div>
          </div>

          <div style="text-align:right;">
            <div style="font-size:20px; font-weight:900; text-transform:uppercase; line-height:1.1;">
              ${this.escapeHtml(rightBigTitle)}
            </div>
            <div style="font-size:10px; font-weight:700; color:#334155; margin-top:2px;">
              ${this.escapeHtml(rightSubTitle)}
            </div>
          </div>
        </div>

        <!-- Matriks Utama Jadual Waktu aSc -->
        <table class="asc-table" style="width:100%; border-collapse:collapse; table-layout:fixed; margin-bottom:12px;">
          <thead>
            <tr style="background:#e2e8f0;">
              <th style="border:1.5px solid #000; width:78px; font-size:10px; font-weight:800; padding:4px;">HARI / WAKTU</th>
              ${periods.map(p => `
                <th style="border:1.5px solid #000; padding:3px 2px; text-align:center;">
                  <div style="font-size:11px; font-weight:900;">${this.escapeHtml(p.label)}</div>
                  <div style="font-size:8.5px; font-weight:600; color:#334155;">${(p.start_time || "").slice(0,5)} - ${(p.end_time || "").slice(0,5)}</div>
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            ${matrixRowsHtml}
          </tbody>
        </table>

        <!-- Jadual Ringkasan Mata Pelajaran & Kelas Diajar -->
        ${summarySectionHtml}

        <!-- Ruang Tandatangan Rasmi -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:18px; padding-top:6px; font-size:10.5px;">
          <div style="width:240px; text-align:center;">
            <div style="border-bottom:1px dotted #000; height:32px; margin-bottom:4px;"></div>
            <div style="font-weight:700;">TANDATANGAN ${mode === 'teacher' ? 'GURU' : 'GURU KELAS'}</div>
            <div style="font-size:9.5px; color:#475569;">(${this.escapeHtml(mode === 'teacher' ? entity.name : rightSubTitle.replace('GURU KELAS: ', '').split('|')[0].trim())})</div>
          </div>

          <div style="text-align:center; font-size:9px; color:#475569;">
            Dijana melalui Sistem Jadual Waktu Pintar (Gaya aSc Timetables) • Tarikh Cetakan: ${new Date().toLocaleDateString("ms-MY")}
          </div>

          <div style="width:240px; text-align:center;">
            <div style="border-bottom:1px dotted #000; height:32px; margin-bottom:4px;"></div>
            <div style="font-weight:700;">DISAHKAN OLEH GURU BESAR</div>
            <div style="font-size:9.5px; color:#475569;">${this.escapeHtml(schoolName)}</div>
          </div>
        </div>
      </div>
    `;
  },

  buildTeacherSummaryTableHtml(teacher, sessionSlots) {
    // Kumpulkan mengikut Subjek + Kelas daripada slot jadual sebenar (atau kontrak jika jadual belum dijana)
    const teacherSlots = sessionSlots.filter(s => (s.teacher_ids || []).includes(teacher.id));
    const summaryMap = new Map();

    if (teacherSlots.length > 0) {
      for (const s of teacherSlots) {
        const sub = this.state.subjects.find(x => x.id === s.subject_id);
        const cNames = (s.class_ids || []).map(cid => this.state.classes.find(c => c.id === cid)?.class_name || "").join(" + ");
        const key = `${s.subject_id}__${cNames}`;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            code: sub?.subject_code || "-",
            name: sub?.subject_name || "-",
            classes: cNames || "-",
            periods: 0
          });
        }
        summaryMap.get(key).periods += 1;
      }
    } else {
      // Sandaran daripada kontrak pengajaran jika jadual belum dijana
      const contracts = this.state.teachingAssignments.filter(
        a => a.session_type === this.state.currentSession && (a.teacher_ids || []).includes(teacher.id)
      );
      for (const a of contracts) {
        const sub = this.state.subjects.find(x => x.id === a.subject_id);
        const cNames = (a.class_ids || []).map(cid => this.state.classes.find(c => c.id === cid)?.class_name || "").join(" + ");
        const key = `${a.subject_id}__${cNames}`;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            code: sub?.subject_code || "-",
            name: sub?.subject_name || "-",
            classes: cNames || "-",
            periods: 0
          });
        }
        summaryMap.get(key).periods += Number(a.periods_per_week) || 0;
      }
    }

    const rows = Array.from(summaryMap.values());
    const totalPeriods = rows.reduce((sum, r) => sum + r.periods, 0);

    return `
      <div style="margin-top:6px;">
        <div style="font-size:10px; font-weight:800; text-transform:uppercase; margin-bottom:3px;">
          RINGKASAN AGIHAN MATA PELAJARAN & KELAS DIAJAR:
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:10px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #000; padding:3px 6px; width:36px; text-align:center;">BIL</th>
              <th style="border:1px solid #000; padding:3px 6px; width:80px; text-align:center;">KOD SUBJEK</th>
              <th style="border:1px solid #000; padding:3px 6px; text-align:left;">NAMA MATA PELAJARAN</th>
              <th style="border:1px solid #000; padding:3px 6px; width:180px; text-align:center;">KELAS</th>
              <th style="border:1px solid #000; padding:3px 6px; width:140px; text-align:center;">JUMLAH WAKTU / MINGGU</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0
              ? `<tr><td colspan="5" style="border:1px solid #000; padding:4px; text-align:center;">Tiada rekod pengajaran.</td></tr>`
              : rows.map((r, i) => `
                <tr>
                  <td style="border:1px solid #000; padding:2.5px 6px; text-align:center;">${i + 1}</td>
                  <td style="border:1px solid #000; padding:2.5px 6px; text-align:center; font-weight:700;">${this.escapeHtml(r.code)}</td>
                  <td style="border:1px solid #000; padding:2.5px 6px;">${this.escapeHtml(r.name)}</td>
                  <td style="border:1px solid #000; padding:2.5px 6px; text-align:center; font-weight:700;">${this.escapeHtml(r.classes)}</td>
                  <td style="border:1px solid #000; padding:2.5px 6px; text-align:center; font-weight:700;">${r.periods} Waktu (${r.periods * 30} Minit)</td>
                </tr>
              `).join("")
            }
            <tr style="background:#e2e8f0; font-weight:900;">
              <td colspan="4" style="border:1px solid #000; padding:3.5px 8px; text-align:right;">
                JUMLAH KESELURUHAN WAKTU MENGAJAR SEMINGGU:
              </td>
              <td style="border:1px solid #000; padding:3.5px 6px; text-align:center; font-size:11px;">
                ${totalPeriods} WAKTU (${totalPeriods * 30} MINIT)
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  buildClassSummaryTableHtml(cls, sessionSlots) {
    const classSlots = sessionSlots.filter(s => (s.class_ids || []).includes(cls.id));
    const summaryMap = new Map();

    for (const s of classSlots) {
      const sub = this.state.subjects.find(x => x.id === s.subject_id);
      const tNames = (s.teacher_ids || []).map(tid => {
        const t = this.state.teachers.find(x => x.id === tid);
        return t ? `${t.name} (${t.short_code})` : "";
      }).filter(Boolean).join(" / ");
      const key = `${s.subject_id}__${tNames}`;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          code: sub?.subject_code || "-",
          name: sub?.subject_name || "-",
          teachers: tNames || "-",
          periods: 0
        });
      }
      summaryMap.get(key).periods += 1;
    }

    const rows = Array.from(summaryMap.values());
    return `
      <div style="margin-top:6px;">
        <div style="font-size:10px; font-weight:800; text-transform:uppercase; margin-bottom:3px;">
          SENARAI MATA PELAJARAN & GURU MATAPELAJARAN KELAS ${this.escapeHtml(cls.class_name)}:
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:9.5px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #000; padding:2.5px 6px; width:36px; text-align:center;">BIL</th>
              <th style="border:1px solid #000; padding:2.5px 6px; width:75px; text-align:center;">KOD</th>
              <th style="border:1px solid #000; padding:2.5px 6px; text-align:left;">MATA PELAJARAN</th>
              <th style="border:1px solid #000; padding:2.5px 6px; text-align:left;">NAMA GURU MENGAJAR</th>
              <th style="border:1px solid #000; padding:2.5px 6px; width:100px; text-align:center;">WAKTU/MINGGU</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr>
                <td style="border:1px solid #000; padding:2px 6px; text-align:center;">${i + 1}</td>
                <td style="border:1px solid #000; padding:2px 6px; text-align:center; font-weight:700;">${this.escapeHtml(r.code)}</td>
                <td style="border:1px solid #000; padding:2px 6px;">${this.escapeHtml(r.name)}</td>
                <td style="border:1px solid #000; padding:2px 6px;">${this.escapeHtml(r.teachers)}</td>
                <td style="border:1px solid #000; padding:2px 6px; text-align:center; font-weight:700;">${r.periods}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  },

  triggerOfficialPrint() {
    this.renderAscPrintPreview();
    window.print();
  }
});

// Pautkan initPhase2 secara automatik selepas Fasa 1 selesai dimuatkan
(function hookPhase2Lifecycle() {
  const originalRefresh = App.refreshAllData.bind(App);
  let phase2Initialized = false;

  App.refreshAllData = async function () {
    await originalRefresh();
    if (!phase2Initialized) {
      phase2Initialized = true;
      await App.initPhase2();
    } else {
      await App.loadTimetableSlots();
      App.renderTimetableBoard();
      App.renderPrintStudioControls();
      App.renderAscPrintPreview();
    }
  };

  // Jika DOM sudah sedia, jalankan terus initPhase2
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(() => {
      if (!phase2Initialized && App.supabase) {
        phase2Initialized = true;
        App.initPhase2();
      } else if (!phase2Initialized) {
        App.injectTab4UI();
        App.injectTab6UI();
      }
    }, 150);
  }
})();

/**
 * ============================================================================
 * FASA 3: TAB 5 (SISTEM PENGURUSAN GURU GANTI / RELIEF PINTAR BERASASKAN SESI)
 * Cara Guna: Tampal kod ini di bahagian paling bawah fail app.js anda (selepas Fasa 2).
 * ============================================================================
 */

Object.assign(App, {
  reliefState: {
    selectedDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    detectedDayName: "Isnin",
    leavesOnDate: [],        // Rekod teacher_leaves bagi tarikh & sesi semasa
    reliefsOnDate: [],       // Rekod relief_assignments bagi tarikh & sesi semasa
    weeklyReliefCounts: {},  // teacher_id -> jumlah relief minggu semasa
    includeCoTeachingSlots: true
  },

  // ==========================================================================
  // 1. INISIALISASI FASA 3 & PENYUNTIKAN UI TAB 5
  // ==========================================================================
  async initPhase3() {
    this.updateDetectedDayFromDate(this.reliefState.selectedDate);
    this.injectTab5UI();
    await this.loadReliefDataForCurrentDate();
    this.renderReliefDashboard();
  },

  updateDetectedDayFromDate(dateStr) {
    if (!dateStr) return;
    const [yyyy, mm, dd] = dateStr.split("-").map(Number);
    const dt = new Date(yyyy, mm - 1, dd);
    const dayMap = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
    this.reliefState.detectedDayName = dayMap[dt.getDay()] || "Isnin";
  },

  getWeekRangeFromDate(dateStr) {
    const [yyyy, mm, dd] = dateStr.split("-").map(Number);
    const dt = new Date(yyyy, mm - 1, dd);
    const day = dt.getDay(); // 0 Ahad .. 6 Sabtu
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(dt);
    monday.setDate(dt.getDate() + diffToMon);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const fmt = d => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${da}`;
    };
    return { start: fmt(monday), end: fmt(friday) };
  },

  // ==========================================================================
  // 2. BINA ANTARAMUKA TAB 5 (SISTEM PENGURUSAN RELIEF PINTAR)
  // ==========================================================================
  injectTab5UI() {
    const container = document.getElementById("relief-management-container");
    if (!container) return;

    container.className = "space-y-6 text-left";
    container.innerHTML = `
      <!-- Bar Kawalan Tarikh, Hari, Sesi & Tindakan Pantas -->
      <div class="bg-slate-900/95 border border-emerald-500/40 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-4">
          <div>
            <label class="block text-[10px] font-mono uppercase text-slate-400 mb-1">Tarikh Guru Ganti</label>
            <input
              type="date"
              id="relief-date-input"
              value="${this.reliefState.selectedDate}"
              onchange="App.handleReliefDateChange(this.value)"
              class="px-3.5 py-2 rounded-xl bg-slate-950 border border-emerald-400/50 text-sm font-mono font-bold text-emerald-300 focus:outline-none"
            />
          </div>

          <div class="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800">
            <div class="text-[10px] font-mono uppercase text-slate-400">Hari & Sesi Aktif</div>
            <div class="text-sm font-extrabold text-white flex items-center gap-2 mt-0.5">
              <span id="relief-day-badge" class="text-cyan-400">${this.reliefState.detectedDayName}</span>
              <span class="text-slate-600">•</span>
              <span id="relief-session-badge" class="text-emerald-400">Sesi ${this.state.currentSession}</span>
            </div>
          </div>

          <div id="relief-summary-pills" class="flex flex-wrap items-center gap-2 text-xs font-mono"></div>
        </div>

        <!-- Butang Automasi, WhatsApp & Cetakan Slip -->
        <div class="flex flex-wrap items-center gap-2">
          <button
            onclick="App.autoAssignAllPendingReliefs()"
            class="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-neon-emerald transition flex items-center gap-2"
          >
            <i class="fa-solid fa-wand-magic-sparkles"></i> Cadang & Isi Semua Automatik
          </button>

          <button
            onclick="App.openWhatsAppModal()"
            class="px-3.5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 font-bold text-xs transition flex items-center gap-2"
          >
            <i class="fa-brands fa-whatsapp text-sm"></i> Salin Mesej WhatsApp/Telegram
          </button>

          <button
            onclick="App.printDailyReliefSheet()"
            class="px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs uppercase tracking-wider shadow-neon-pink transition flex items-center gap-2"
          >
            <i class="fa-solid fa-print"></i> Cetak Jadual Ganti (A4)
          </button>
        </div>
      </div>

      <!-- Grid Utama: Kiri (Daftar Guru Tidak Hadir) | Kanan (Jadual Slot Terjejas & Penetapan Guru Ganti) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- KOLUM KIRI (4 Lajur): Pendaftaran Guru Tidak Hadir -->
        <div class="lg:col-span-4 space-y-5">
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 class="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <i class="fa-solid fa-user-minus"></i> 1. Daftar Guru Tidak Hadir
                </h3>
                <p class="text-[11px] text-slate-400 mt-0.5">
                  Hanya memaparkan guru <strong>Sesi ${this.state.currentSession}</strong> & <strong>Kedua-dua</strong>.
                </p>
              </div>
            </div>

            <form id="form-teacher-leave" onsubmit="App.saveTeacherLeave(event)" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-slate-300 mb-1">Pilih Guru Tidak Hadir</label>
                <select id="leave-teacher-select" required class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-amber-400 focus:outline-none"></select>
              </div>

              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="block font-semibold text-slate-300 mb-1">Sebab Ketidakhadiran</label>
                  <select id="leave-reason-select" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-semibold focus:outline-none">
                    <option value="CRK">Cuti Rehat Khas (CRK)</option>
                    <option value="MC">Cuti Sakit (MC)</option>
                    <option value="KURSUS">Kursus / Bengkel PPD/JPN</option>
                    <option value="TUGAS RASMI">Tugas Rasmi Luar / Sukan</option>
                    <option value="CUTI KUARANTIN">Cuti Kuarantin / Kecemasan</option>
                    <option value="LAIN-LAIN">Lain-lain Hal</option>
                  </select>
                </div>
                <div>
                  <label class="block font-semibold text-slate-300 mb-1">Catatan Tambahan</label>
                  <input type="text" id="leave-notes-input" placeholder="Cth: Mesyuarat di PPD" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none" />
                </div>
              </div>

              <button type="submit" class="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-neon-amber transition flex items-center justify-center gap-2">
                <i class="fa-solid fa-plus-circle"></i> Tandakan Tidak Hadir & Tarik Slot
              </button>
            </form>
          </div>

          <!-- Senarai Guru Tidak Hadir Pada Tarikh & Sesi Ini -->
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 class="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <i class="fa-solid fa-clipboard-user text-pink-400"></i> Senarai Tidak Hadir (<span id="count-absent-teachers">0</span>)
              </h3>
              <span class="text-[10px] font-mono text-slate-400" id="absent-list-date-label"></span>
            </div>
            <div id="absent-teachers-list" class="space-y-2.5 max-h-[380px] overflow-y-auto pr-1"></div>
          </div>
        </div>

        <!-- KOLUM KANAN (8 Lajur): Jadual Slot Terjejas & Penetapan Guru Ganti Pintar -->
        <div class="lg:col-span-8 space-y-5">
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 class="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <i class="fa-solid fa-user-check"></i> 2. Slot PdP Terjejas & Cadangan Guru Ganti Pintar
                </h3>
                <p class="text-xs text-slate-400">
                  Senarai dropdown disusun mengikut skor kelayakan: <strong>Baki Relief Mingguan → Subjek/Kelas Sama → Beban Mengajar Harian Rendah</strong>.
                </p>
              </div>
              <button
                onclick="App.syncAffectedSlotsFromTimetable()"
                class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold transition flex items-center gap-1.5"
                title="Segarkan semula slot daripada jadual waktu induk"
              >
                <i class="fa-solid fa-rotate"></i> Segarkan Slot
              </button>
            </div>

            <!-- Jadual Slot Relief -->
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-slate-800 bg-slate-950/80 font-mono uppercase text-[11px] text-slate-400">
                    <th class="py-3 px-3">Waktu / Masa</th>
                    <th class="py-3 px-3">Kelas & Subjek</th>
                    <th class="py-3 px-3">Guru Tidak Hadir & Status Co-Teach</th>
                    <th class="py-3 px-3 min-w-[310px]">Pemilihan Guru Ganti (Disusun Mengikut Skor)</th>
                    <th class="py-3 px-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody id="tbody-relief-slots" class="divide-y divide-slate-800/70"></tbody>
              </table>
            </div>
          </div>

          <!-- Pratonton Kertas Cetakan A4 Jadual Guru Ganti Harian -->
          <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wider text-pink-400 flex items-center gap-2">
                <i class="fa-solid fa-eye"></i> Pratonton Cetakan Rasmi Jadual Guru Ganti Harian (A4)
              </h3>
              <button onclick="App.printDailyReliefSheet()" class="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                <i class="fa-solid fa-print"></i> Cetak Sekarang
              </button>
            </div>
            <div id="relief-print-preview-box" class="bg-white text-black rounded-xl p-6 shadow-xl overflow-x-auto border border-slate-300"></div>
          </div>
        </div>

      </div>

      <!-- MODAL TEKS WHATSAPP / TELEGRAM -->
      <div id="modal-relief-whatsapp" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm hidden items-center justify-center p-4">
        <div class="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-lg w-full p-5 shadow-neon-cyan space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 class="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <i class="fa-brands fa-whatsapp text-emerald-400 text-lg"></i> Jana Mesej Makluman WhatsApp / Telegram
            </h3>
            <button onclick="App.closeWhatsAppModal()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <textarea id="whatsapp-relief-text" rows="12" readonly class="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 focus:outline-none"></textarea>
          <div class="flex justify-end gap-2">
            <button onclick="App.closeWhatsAppModal()" class="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs">Tutup</button>
            <button onclick="App.copyWhatsAppText()" class="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs shadow-neon-emerald flex items-center gap-1.5">
              <i class="fa-solid fa-copy"></i> Salin ke Papan Keratan
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // ==========================================================================
  // 3. MUAT TURUN REKOD CUTI & RELIEF DARIPADA SUPABASE
  // ==========================================================================
  async handleReliefDateChange(newDate) {
    if (!newDate) return;
    this.reliefState.selectedDate = newDate;
    this.updateDetectedDayFromDate(newDate);
    await this.loadReliefDataForCurrentDate();
    this.renderReliefDashboard();
  },

  async loadReliefDataForCurrentDate() {
    if (!this.supabase) return;
    const dateStr = this.reliefState.selectedDate;
    const weekRange = this.getWeekRangeFromDate(dateStr);

    try {
      // Ambil semua cuti pada tarikh tersebut (kedua-dua sesi untuk elak guru 'Kedua-dua' yang cuti dicadangkan)
      const [leavesRes, reliefsRes, weekReliefsRes] = await Promise.all([
        this.supabase
          .from("teacher_leaves")
          .select("*")
          .eq("leave_date", dateStr),
        this.supabase
          .from("relief_assignments")
          .select("*")
          .eq("leave_date", dateStr)
          .order("period_number", { ascending: true }),
        this.supabase
          .from("relief_assignments")
          .select("relief_teacher_id, leave_date, status")
          .gte("leave_date", weekRange.start)
          .lte("leave_date", weekRange.end)
      ]);

      if (leavesRes.error) throw leavesRes.error;
      if (reliefsRes.error) throw reliefsRes.error;
      if (weekReliefsRes.error) throw weekReliefsRes.error;

      this.state.teacherLeaves = leavesRes.data || [];
      this.state.reliefAssignments = reliefsRes.data || [];

      // Kira jumlah relief minggu semasa bagi setiap guru
      const counts = {};
      (weekReliefsRes.data || []).forEach(r => {
        if (r.relief_teacher_id && r.status !== "Dibatalkan") {
          counts[r.relief_teacher_id] = (counts[r.relief_teacher_id] || 0) + 1;
        }
      });
      this.reliefState.weeklyReliefCounts = counts;
    } catch (err) {
      console.error("Ralat memuatkan data relief:", err);
      this.showToast("Gagal memuatkan data guru ganti: " + err.message, "error");
    }
  },

  // ==========================================================================
  // 4. PENDAFTARAN GURU TIDAK HADIR & PENGESANAN SLOT AUTOMATIK
  // ==========================================================================
  getSessionEligibleTeachers() {
    const s = this.state.currentSession;
    return this.state.teachers.filter(
      t => t.session_type === s || t.session_type === "Kedua-dua"
    );
  },

  async saveTeacherLeave(event) {
    event.preventDefault();
    if (!this.supabase) return;

    const teacherId = document.getElementById("leave-teacher-select").value;
    const reason = document.getElementById("leave-reason-select").value;
    const notes = document.getElementById("leave-notes-input").value.trim();
    const dateStr = this.reliefState.selectedDate;
    const session = this.state.currentSession;

    if (!teacherId) return this.showToast("Sila pilih seorang guru.", "warning");

    try {
      // 1. Simpan rekod teacher_leaves
      const { data: leaveRows, error: leaveErr } = await this.supabase
        .from("teacher_leaves")
        .upsert(
          [{
            leave_date: dateStr,
            session_type: session,
            absent_teacher_id: teacherId,
            reason,
            notes
          }],
          { onConflict: "leave_date,session_type,absent_teacher_id" }
        )
        .select();

      if (leaveErr) throw leaveErr;
      const savedLeave = leaveRows?.[0];

      // 2. Tarik semua slot mengajar guru tersebut pada Hari & Sesi berkenaan secara automatik
      await this.generateReliefSlotsForLeave(savedLeave);

      document.getElementById("leave-notes-input").value = "";
      await this.loadReliefDataForCurrentDate();
      this.renderReliefDashboard();
      this.showToast("Guru ditandakan tidak hadir & slot jadual waktu telah ditarik secara automatik!", "success");
    } catch (err) {
      this.showToast("Gagal mendaftarkan guru tidak hadir: " + err.message, "error");
    }
  },

  async generateReliefSlotsForLeave(leaveRecord) {
    if (!leaveRecord || !this.supabase) return;
    const dayName = this.reliefState.detectedDayName;
    const session = leaveRecord.session_type;
    const absentTeacherId = leaveRecord.absent_teacher_id;

    // Cari semua slot guru ini dalam timetable_slots pada hari & sesi tersebut
    const affectedSlots = this.state.timetableSlots.filter(
      s =>
        s.session_type === session &&
        s.day_name === dayName &&
        Array.isArray(s.teacher_ids) &&
        s.teacher_ids.includes(absentTeacherId)
    );

    if (affectedSlots.length === 0) return;

    // Semak slot relief yang sudah wujud untuk leave_id ini supaya tidak berganda
    const { data: existingReliefs } = await this.supabase
      .from("relief_assignments")
      .select("period_number, class_names")
      .eq("leave_id", leaveRecord.id);

    const existingKeys = new Set(
      (existingReliefs || []).map(r => `${r.period_number}__${r.class_names}`)
    );

    const rowsToInsert = [];
    for (const slot of affectedSlots) {
      const sub = this.state.subjects.find(x => x.id === slot.subject_id);
      const classNames = (slot.class_ids || [])
        .map(cid => this.state.classes.find(c => c.id === cid)?.class_name || "")
        .filter(Boolean)
        .join(" + ");

      const key = `${slot.period_number}__${classNames}`;
      if (existingKeys.has(key)) continue;

      // Semak sama ada slot ini ialah Guru Bergabung (Co-Teaching) yang masih mempunyai rakan guru lain yang hadir
      const coTeachers = (slot.teacher_ids || []).filter(tid => tid !== absentTeacherId);
      const hasCoTeacher = coTeachers.length > 0;
      const coTeacherCodes = coTeachers
        .map(tid => this.state.teachers.find(t => t.id === tid)?.short_code || "")
        .filter(Boolean)
        .join(", ");

      rowsToInsert.push({
        leave_id: leaveRecord.id,
        leave_date: leaveRecord.leave_date,
        session_type: session,
        day_name: dayName,
        period_number: slot.period_number,
        class_names: classNames || "-",
        subject_code: sub?.subject_code || "SUB",
        absent_teacher_id: absentTeacherId,
        relief_teacher_id: null,
        status: hasCoTeacher ? "Ada Guru Pendamping" : "Belum Diisi",
        notes: hasCoTeacher ? `Co-Teaching bersama: ${coTeacherCodes}` : null
      });
    }

    if (rowsToInsert.length > 0) {
      const { error } = await this.supabase.from("relief_assignments").insert(rowsToInsert);
      if (error) throw error;
    }
  },

  async syncAffectedSlotsFromTimetable() {
    const sessionLeaves = this.state.teacherLeaves.filter(
      l => l.session_type === this.state.currentSession
    );
    for (const leave of sessionLeaves) {
      await this.generateReliefSlotsForLeave(leave);
    }
    await this.loadReliefDataForCurrentDate();
    this.renderReliefDashboard();
    this.showToast("Slot terjejas telah diselaraskan semula dengan jadual waktu induk.", "info");
  },

  async deleteTeacherLeave(leaveId) {
    if (!confirm("Padam rekod ketidakhadiran guru ini? Semua slot relief berkaitan pada tarikh ini juga akan dipadam.")) return;
    const { error } = await this.supabase.from("teacher_leaves").delete().eq("id", leaveId);
    if (error) {
      this.showToast("Gagal memadam rekod cuti: " + error.message, "error");
      return;
    }
    await this.loadReliefDataForCurrentDate();
    this.renderReliefDashboard();
    this.showToast("Rekod ketidakhadiran & slot relief berkaitan telah dipadam.", "info");
  },

  // ==========================================================================
  // 5. ENJIN CADANGAN GURU GANTI PINTAR (ALGORITMA SKOR & KEUTAMAAN)
  // ==========================================================================
  getRankedReliefCandidatesForSlot(reliefSlot) {
    const session = reliefSlot.session_type; // 'Pagi' | 'Petang'
    const dayName = reliefSlot.day_name;
    const periodNumber = Number(reliefSlot.period_number);

    // 1. Senarai semua guru yang tidak hadir pada tarikh tersebut (merentas sesi untuk keselamatan guru 'Kedua-dua')
    const absentTeacherIds = new Set(
      this.state.teacherLeaves.map(l => l.absent_teacher_id)
    );

    // 2. Guru yang hanya layak mengikut Peraturan Ketat Sesi & tidak dikecualikan relief
    const sessionCandidates = this.state.teachers.filter(t => {
      const validSession = t.session_type === session || t.session_type === "Kedua-dua";
      if (!validSession) return false;
      if (t.is_relief_exempt) return false;
      if (absentTeacherIds.has(t.id)) return false;
      return true;
    });

    // 3. Semak waktu bertindih (termasuk bagi guru berstatus 'Kedua-dua' jika masa loceng Pagi & Petang bertindih)
    const currentBell = this.state.bellSchedules.find(
      b => b.session_type === session && Number(b.period_number) === periodNumber
    );

    const isTimeOverlap = (startA, endA, startB, endB) => {
      if (!startA || !endA || !startB || !endB) return false;
      return startA < endB && startB < endA;
    };

    const busyTeacherIds = new Set();

    // (a) Sibuk mengajar dalam timetable_slots pada sesi yang sama & waktu yang sama
    this.state.timetableSlots.forEach(s => {
      if (s.day_name !== dayName) return;
      if (s.session_type === session && Number(s.period_number) === periodNumber) {
        (s.teacher_ids || []).forEach(tid => busyTeacherIds.add(tid));
      } else if (currentBell && s.session_type !== session) {
        // Semak jika guru 'Kedua-dua' ada kelas pada sesi sebelah yang waktu jamnya bertindih
        const otherBell = this.state.bellSchedules.find(
          b => b.session_type === s.session_type && Number(b.period_number) === Number(s.period_number)
        );
        if (otherBell && isTimeOverlap(currentBell.start_time, currentBell.end_time, otherBell.start_time, otherBell.end_time)) {
          (s.teacher_ids || []).forEach(tid => busyTeacherIds.add(tid));
        }
      }
    });

    // (b) Sudah ditugaskan ke kelas relief lain pada waktu yang sama (kecuali slot relief ini sendiri)
    this.state.reliefAssignments.forEach(r => {
      if (r.id === reliefSlot.id || !r.relief_teacher_id || r.status === "Dibatalkan") return;
      if (r.session_type === session && Number(r.period_number) === periodNumber) {
        busyTeacherIds.add(r.relief_teacher_id);
      } else if (currentBell && r.session_type !== session) {
        const otherBell = this.state.bellSchedules.find(
          b => b.session_type === r.session_type && Number(b.period_number) === Number(r.period_number)
        );
        if (otherBell && isTimeOverlap(currentBell.start_time, currentBell.end_time, otherBell.start_time, otherBell.end_time)) {
          busyTeacherIds.add(r.relief_teacher_id);
        }
      }
    });

    // 4. Tapis guru yang benar-benar Free Period dan kira Skor Keutamaan
    const targetClassNames = (reliefSlot.class_names || "").split("+").map(s => s.trim()).filter(Boolean);
    const targetSubjectCode = reliefSlot.subject_code;

    const scoredCandidates = [];
    for (const teacher of sessionCandidates) {
      if (busyTeacherIds.has(teacher.id)) continue;

      // Semak slot tidak tersedia (unavailable_slots JSONB jika ada)
      const unavail = Array.isArray(teacher.unavailable_slots) ? teacher.unavailable_slots : [];
      if (unavail.includes(`${dayName}_${periodNumber}`)) continue;

      // Kira jumlah waktu mengajar guru ini pada hari berkenaan
      const teachingTodayCount = this.state.timetableSlots.filter(
        s =>
          s.day_name === dayName &&
          (s.session_type === session || teacher.session_type === "Kedua-dua") &&
          (s.teacher_ids || []).includes(teacher.id)
      ).length;

      // Kira jumlah relief guru ini pada hari ini
      const reliefTodayCount = this.state.reliefAssignments.filter(
        r =>
          r.id !== reliefSlot.id &&
          r.relief_teacher_id === teacher.id &&
          r.status !== "Dibatalkan"
      ).length;

      // Kira jumlah relief minggu ini (termasuk perubahan semasa pada tarikh ini)
      const baseWeeklyCount = this.reliefState.weeklyReliefCounts[teacher.id] || 0;
      const maxRelief = Number(teacher.max_relief_per_week) || 5;

      // Semak kaitan kelas atau subjek yang sama daripada teaching_assignments
      const teacherContracts = this.state.teachingAssignments.filter(
        a => (a.teacher_ids || []).includes(teacher.id)
      );

      let teachesSameClass = false;
      let teachesSameSubject = false;

      for (const c of teacherContracts) {
        const sub = this.state.subjects.find(x => x.id === c.subject_id);
        if (sub && sub.subject_code === targetSubjectCode) teachesSameSubject = true;

        const cNames = (c.class_ids || []).map(cid => this.state.classes.find(cl => cl.id === cid)?.class_name || "");
        if (cNames.some(cn => targetClassNames.includes(cn))) teachesSameClass = true;
      }

      // Formula Skor Pintar (Lebih tinggi = Lebih Diutamakan)
      let score = 100;
      score -= baseWeeklyCount * 18;           // Keutamaan #1: Jumlah relief mingguan paling sedikit
      score -= reliefTodayCount * 25;          // Elak seorang guru dapat 2-3 relief sehari
      if (baseWeeklyCount >= maxRelief) score -= 50; // Penalti jika sudah capai had mingguan
      if (teachesSameClass) score += 15;       // Keutamaan #2a: Mengajar kelas yang sama (kenal murid)
      if (teachesSameSubject) score += 10;     // Keutamaan #2b: Opsyen subjek yang sama
      score -= teachingTodayCount * 4;         // Keutamaan #3: Beban waktu harian yang masih rendah

      const tags = [];
      if (teachesSameClass) tags.push("Guru Kelas Ini");
      if (teachesSameSubject) tags.push(`Opsyen ${targetSubjectCode}`);

      scoredCandidates.push({
        teacher,
        score,
        teachingTodayCount,
        reliefTodayCount,
        weeklyReliefCount: baseWeeklyCount,
        maxRelief,
        teachesSameClass,
        teachesSameSubject,
        tags
      });
    }

    // Susun menurun mengikut skor tertinggi
    return scoredCandidates.sort((a, b) => b.score - a.score);
  },

  async assignReliefTeacherToSlot(reliefId, reliefTeacherId) {
    if (!this.supabase) return;
    const slot = this.state.reliefAssignments.find(r => r.id === reliefId);
    if (!slot) return;

    const newStatus = reliefTeacherId
      ? "Telah Diisi"
      : slot.notes?.includes("Co-Teaching")
      ? "Ada Guru Pendamping"
      : "Belum Diisi";

    const { error } = await this.supabase
      .from("relief_assignments")
      .update({
        relief_teacher_id: reliefTeacherId || null,
        status: newStatus
      })
      .eq("id", reliefId);

    if (error) {
      this.showToast("Gagal menetapkan guru ganti: " + error.message, "error");
      return;
    }

    await this.loadReliefDataForCurrentDate();
    this.renderReliefDashboard();
    this.showToast("Guru ganti berjaya dikemas kini!", "success");
  },

  async toggleCoTeachingBypass(reliefId) {
    const slot = this.state.reliefAssignments.find(r => r.id === reliefId);
    if (!slot) return;

    const nextStatus = slot.status === "Dikendalikan Guru Pendamping"
      ? "Ada Guru Pendamping"
      : "Dikendalikan Guru Pendamping";

    const { error } = await this.supabase
      .from("relief_assignments")
      .update({
        relief_teacher_id: null,
        status: nextStatus
      })
      .eq("id", reliefId);

    if (error) {
      this.showToast("Gagal menukar status guru pendamping: " + error.message, "error");
      return;
    }

    await this.loadReliefDataForCurrentDate();
    this.renderReliefDashboard();
  },

  async autoSuggestSingleSlot(reliefId) {
    const slot = this.state.reliefAssignments.find(r => r.id === reliefId);
    if (!slot) return;
    const candidates = this.getRankedReliefCandidatesForSlot(slot);
    if (candidates.length === 0) {
      return this.showToast(`Tiada guru berkelayakan yang lapang pada Waktu ${slot.period_number}.`, "warning");
    }
    const best = candidates[0].teacher;
    await this.assignReliefTeacherToSlot(reliefId, best.id);
  },

  async autoAssignAllPendingReliefs() {
    const session = this.state.currentSession;
    const pendingSlots = this.state.reliefAssignments.filter(
      r =>
        r.session_type === session &&
        !r.relief_teacher_id &&
        r.status !== "Dikendalikan Guru Pendamping"
    );

    if (pendingSlots.length === 0) {
      return this.showToast("Semua slot terjejas telah pun mempunyai guru ganti atau dikendalikan guru pendamping.", "info");
    }

    let assignedCount = 0;
    for (const slot of pendingSlots) {
      const candidates = this.getRankedReliefCandidatesForSlot(slot);
      if (candidates.length > 0) {
        const chosen = candidates[0].teacher;
        const { error } = await this.supabase
          .from("relief_assignments")
          .update({
            relief_teacher_id: chosen.id,
            status: "Telah Diisi"
          })
          .eq("id", slot.id);

        if (!error) {
          slot.relief_teacher_id = chosen.id;
          slot.status = "Telah Diisi";
          this.reliefState.weeklyReliefCounts[chosen.id] =
            (this.reliefState.weeklyReliefCounts[chosen.id] || 0) + 1;
          assignedCount++;
        }
      }
    }

    await this.loadReliefDataForCurrentDate();
    this.renderReliefDashboard();
    this.showToast(`Berjaya mencadangkan dan mengisi ${assignedCount} daripada ${pendingSlots.length} slot secara automatik!`, "success");
  },

  // ==========================================================================
  // 6. PAPARAN DASHBOARD RELIEF, SENARAI CUTI & PRATONTON CETAKAN
  // ==========================================================================
  renderReliefDashboard() {
    const dayBadge = document.getElementById("relief-day-badge");
    const sesBadge = document.getElementById("relief-session-badge");
    const dateLabel = document.getElementById("absent-list-date-label");
    if (!dayBadge || !sesBadge) return;

    const session = this.state.currentSession;
    dayBadge.textContent = `Hari ${this.reliefState.detectedDayName}`;
    sesBadge.textContent = `Sesi ${session}`;
    if (dateLabel) dateLabel.textContent = `${this.reliefState.selectedDate} (${session})`;

    // 1. Isi Dropdown Pilihan Guru Tidak Hadir (Hanya guru Sesi Semasa & Kedua-dua)
    const eligibleTeachers = this.getSessionEligibleTeachers();
    const leaveSelect = document.getElementById("leave-teacher-select");
    if (leaveSelect) {
      leaveSelect.innerHTML =
        `<option value="">-- Pilih Guru Sesi ${session} / Kedua-dua (${eligibleTeachers.length} Guru) --</option>` +
        eligibleTeachers.map(t => `<option value="${t.id}">${this.escapeHtml(t.name)} (${this.escapeHtml(t.short_code)}) — [${t.session_type}]</option>`).join("");
    }

    // 2. Render Senarai Guru Tidak Hadir bagi Sesi Semasa
    const sessionLeaves = this.state.teacherLeaves.filter(l => l.session_type === session);
    document.getElementById("count-absent-teachers").textContent = sessionLeaves.length;
    const absentListEl = document.getElementById("absent-teachers-list");

    if (sessionLeaves.length === 0) {
      absentListEl.innerHTML = `
        <div class="py-8 text-center text-slate-500 text-xs">
          Tiada guru ditandakan tidak hadir bagi <strong>Sesi ${session}</strong> pada tarikh ini.
        </div>`;
    } else {
      absentListEl.innerHTML = sessionLeaves.map(l => {
        const t = this.state.teachers.find(x => x.id === l.absent_teacher_id);
        const slotCount = this.state.reliefAssignments.filter(r => r.leave_id === l.id).length;
        return `
          <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/30">${this.escapeHtml(t?.short_code || "GURU")}</span>
                <span class="font-bold text-xs text-white">${this.escapeHtml(t?.name || "Guru Tidak Dikenali")}</span>
              </div>
              <div class="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                <span class="text-pink-400 font-semibold">${this.escapeHtml(l.reason)}</span>
                <span>•</span>
                <span class="text-cyan-300 font-mono">${slotCount} waktu terjejas</span>
                ${l.notes ? `<span>• ${this.escapeHtml(l.notes)}</span>` : ""}
              </div>
            </div>
            <button onclick="App.deleteTeacherLeave('${l.id}')" class="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-rose-400 text-xs" title="Padam Rekod Cuti">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;
      }).join("");
    }

    // 3. Render Jadual Slot PdP Terjejas & Dropdown Cadangan Guru Ganti
    this.renderReliefSlotsTable();

    // 4. Render Pratonton Cetakan Kertas A4 Jadual Guru Ganti Harian
    this.renderDailyReliefPrintPreview();
  },

  renderReliefSlotsTable() {
    const tbody = document.getElementById("tbody-relief-slots");
    const pillsEl = document.getElementById("relief-summary-pills");
    if (!tbody) return;

    const session = this.state.currentSession;
    const sessionReliefs = this.state.reliefAssignments
      .filter(r => r.session_type === session)
      .sort((a, b) => a.period_number - b.period_number);

    const filledCount = sessionReliefs.filter(
      r => r.relief_teacher_id || r.status === "Dikendalikan Guru Pendamping"
    ).length;

    if (pillsEl) {
      pillsEl.innerHTML = `
        <span class="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-amber-300">Slot Terjejas: <strong>${sessionReliefs.length}</strong></span>
        <span class="px-2.5 py-1 rounded-lg bg-slate-950 border border-emerald-500/40 text-emerald-300">Selesai Diurus: <strong>${filledCount}/${sessionReliefs.length}</strong></span>
      `;
    }

    if (sessionReliefs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-slate-500 text-xs">
            Tiada slot kelas terjejas untuk <strong>Hari ${this.reliefState.detectedDayName} (Sesi ${session})</strong>. Tandakan guru tidak hadir di sebelah kiri untuk menarik slot jadual secara automatik.
          </td>
        </tr>`;
      return;
    }

    const periods = this.getSessionPeriods();

    tbody.innerHTML = sessionReliefs.map(r => {
      const bell = periods.find(p => Number(p.period_number) === Number(r.period_number));
      const timeStr = bell ? `${(bell.start_time || "").slice(0,5)} - ${(bell.end_time || "").slice(0,5)}` : "";
      const absentTeacher = this.state.teachers.find(t => t.id === r.absent_teacher_id);
      const isCoTeachSlot = (r.notes || "").includes("Co-Teaching");
      const isBypassed = r.status === "Dikendalikan Guru Pendamping";

      const rankedCandidates = this.getRankedReliefCandidatesForSlot(r);

      const optionsHtml = rankedCandidates.map(c => {
        const t = c.teacher;
        const selected = r.relief_teacher_id === t.id ? "selected" : "";
        const extraTag = c.tags.length > 0 ? ` ★ ${c.tags.join("/")}` : "";
        return `
          <option value="${t.id}" ${selected}>
            ${this.escapeHtml(t.name)} (${this.escapeHtml(t.short_code)}) — [Waktu Hari Ini: ${c.teachingTodayCount + c.reliefTodayCount} | Relief Minggu Ini: ${c.weeklyReliefCount}/${c.maxRelief}]${this.escapeHtml(extraTag)}
          </option>
        `;
      }).join("");

      return `
        <tr class="hover:bg-slate-950/60 transition ${isBypassed ? 'opacity-70 bg-slate-950/40' : ''}">
          <!-- Waktu / Masa -->
          <td class="py-3 px-3">
            <div class="font-mono font-extrabold text-cyan-300 text-sm">Waktu #${r.period_number}</div>
            <div class="font-mono text-[11px] text-slate-400">${timeStr}</div>
          </td>

          <!-- Kelas & Subjek -->
          <td class="py-3 px-3">
            <div class="font-bold text-white text-sm">${this.escapeHtml(r.class_names)}</div>
            <span class="inline-block mt-0.5 px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 font-mono text-[11px] font-bold">
              ${this.escapeHtml(r.subject_code)}
            </span>
          </td>

          <!-- Guru Tidak Hadir & Status Co-Teaching -->
          <td class="py-3 px-3">
            <div class="font-semibold text-amber-300">${this.escapeHtml(absentTeacher?.name || "-")} (${this.escapeHtml(absentTeacher?.short_code || "")})</div>
            ${isCoTeachSlot ? `
              <div class="mt-1 flex flex-wrap items-center gap-1.5">
                <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                  <i class="fa-solid fa-user-group mr-1"></i>Ada Guru Pendamping (${this.escapeHtml(r.notes.replace("Co-Teaching bersama: ", ""))})
                </span>
              </div>
            ` : `<span class="text-[11px] text-slate-500">Guru Tunggal</span>`}
          </td>

          <!-- Dropdown Pemilihan Guru Ganti -->
          <td class="py-3 px-3">
            ${isBypassed ? `
              <div class="px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <i class="fa-solid fa-check-double"></i> Kelas dikawal oleh Guru Pendamping (Tiada Relief Diperlukan)
              </div>
            ` : `
              <select
                onchange="App.assignReliefTeacherToSlot('${r.id}', this.value)"
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border ${r.relief_teacher_id ? 'border-emerald-400 text-emerald-300 font-bold' : 'border-amber-500/60 text-white'} text-xs focus:outline-none"
              >
                <option value="">-- Pilih Guru Ganti (${rankedCandidates.length} Guru Lapang) --</option>
                ${optionsHtml}
              </select>
            `}
          </td>

          <!-- Tindakan Pantas -->
          <td class="py-3 px-3 text-right space-x-1 whitespace-nowrap">
            ${!isBypassed ? `
              <button
                onclick="App.autoSuggestSingleSlot('${r.id}')"
                class="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-[11px] font-bold transition"
                title="Pilih calon skor tertinggi secara automatik"
              >
                <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Cadang
              </button>
            ` : ""}

            ${isCoTeachSlot ? `
              <button
                onclick="App.toggleCoTeachingBypass('${r.id}')"
                class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[11px] transition"
                title="Togol sama ada mahu menggunakan guru pendamping sahaja atau tetap meletakkan guru ganti"
              >
                ${isBypassed ? "Letak Relief" : "Guna Pendamping"}
              </button>
            ` : ""}
          </td>
        </tr>
      `;
    }).join("");
  },

  // ==========================================================================
  // 7. CETAKAN SLIP & JADUAL GURU GANTI HARIAN (A4) & MESEJ WHATSAPP
  // ==========================================================================
  buildDailyReliefSheetHtml() {
    const school = this.state.schoolSettings || {};
    const schoolName = school.school_name || "SEKOLAH KEBANGSAAN MANTIN";
    const schoolCode = school.school_code || "NBA4031";
    const logoUrl = school.logo_url || "";
    const session = this.state.currentSession;
    const dateStr = this.reliefState.selectedDate;
    const dayName = this.reliefState.detectedDayName;
    const periods = this.getSessionPeriods();

    const sessionLeaves = this.state.teacherLeaves.filter(l => l.session_type === session);
    const sessionReliefs = this.state.reliefAssignments
      .filter(r => r.session_type === session)
      .sort((a, b) => a.period_number - b.period_number);

    return `
      <div style="font-family: Arial, Helvetica, sans-serif; color:#000; background:#fff;">
        <!-- Header Rasmi Slip Jadual Guru Ganti -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2.5px solid #000; padding-bottom:8px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:12px;">
            ${logoUrl
              ? `<img src="${logoUrl}" alt="Logo" style="width:52px; height:52px; object-fit:contain;" />`
              : `<div style="width:46px; height:46px; border:1.5px solid #000; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px;">LOGO</div>`
            }
            <div>
              <div style="font-size:15px; font-weight:900; text-transform:uppercase;">
                ${this.escapeHtml(schoolName)} (${this.escapeHtml(schoolCode)})
              </div>
              <div style="font-size:12px; font-weight:800; color:#1e293b;">
                JADUAL GURU GANTI (RELIEF) HARIAN — SESI ${this.escapeHtml(session.toUpperCase())}
              </div>
            </div>
          </div>

          <div style="text-align:right; font-size:11px; font-weight:700;">
            <div style="font-size:14px; font-weight:900; text-transform:uppercase;">HARI: ${this.escapeHtml(dayName.toUpperCase())}</div>
            <div>TARIKH: ${this.escapeHtml(dateStr)}</div>
          </div>
        </div>

        <!-- Ringkasan Guru Tidak Hadir -->
        <div style="margin-bottom:10px; font-size:10.5px;">
          <strong>SENARAI GURU TIDAK HADIR (${sessionLeaves.length} ORANG):</strong>
          <span>
            ${sessionLeaves.length === 0
              ? "Tiada"
              : sessionLeaves.map((l, idx) => {
                  const t = this.state.teachers.find(x => x.id === l.absent_teacher_id);
                  return `${idx + 1}. ${this.escapeHtml(t?.name || "-")} (${this.escapeHtml(l.reason)})`;
                }).join("  |  ")
            }
          </span>
        </div>

        <!-- Jadual Utama Guru Ganti -->
        <table style="width:100%; border-collapse:collapse; font-size:10.5px;">
          <thead>
            <tr style="background:#e2e8f0;">
              <th style="border:1.5px solid #000; padding:5px; width:36px; text-align:center;">BIL</th>
              <th style="border:1.5px solid #000; padding:5px; width:115px; text-align:center;">WAKTU & MASA</th>
              <th style="border:1.5px solid #000; padding:5px; width:110px; text-align:center;">KELAS</th>
              <th style="border:1.5px solid #000; padding:5px; width:75px; text-align:center;">SUBJEK</th>
              <th style="border:1.5px solid #000; padding:5px; text-align:left;">GURU TIDAK HADIR</th>
              <th style="border:1.5px solid #000; padding:5px; text-align:left;">NAMA GURU GANTI / TINDAKAN</th>
              <th style="border:1.5px solid #000; padding:5px; width:110px; text-align:center;">TANDATANGAN</th>
            </tr>
          </thead>
          <tbody>
            ${sessionReliefs.length === 0
              ? `<tr><td colspan="7" style="border:1.5px solid #000; padding:14px; text-align:center;">Tiada rekod jadual guru ganti bagi tarikh dan sesi ini.</td></tr>`
              : sessionReliefs.map((r, idx) => {
                  const bell = periods.find(p => Number(p.period_number) === Number(r.period_number));
                  const timeStr = bell ? `${(bell.start_time || "").slice(0,5)} - ${(bell.end_time || "").slice(0,5)}` : "";
                  const absentT = this.state.teachers.find(t => t.id === r.absent_teacher_id);
                  const reliefT = this.state.teachers.find(t => t.id === r.relief_teacher_id);

                  const reliefDisplay = reliefT
                    ? `<strong>${this.escapeHtml(reliefT.name)} (${this.escapeHtml(reliefT.short_code)})</strong>`
                    : r.status === "Dikendalikan Guru Pendamping"
                    ? `<em>Dikendalikan Guru Pendamping (${this.escapeHtml((r.notes || "").replace("Co-Teaching bersama: ", ""))})</em>`
                    : `<span style="color:#dc2626; font-weight:bold;">BELUM DITETAPKAN</span>`;

                  return `
                    <tr>
                      <td style="border:1.5px solid #000; padding:5px; text-align:center; font-weight:bold;">${idx + 1}</td>
                      <td style="border:1.5px solid #000; padding:5px; text-align:center;">
                        <strong>Waktu ${r.period_number}</strong><br/>
                        <span style="font-size:9.5px;">${timeStr}</span>
                      </td>
                      <td style="border:1.5px solid #000; padding:5px; text-align:center; font-weight:bold; font-size:11px;">${this.escapeHtml(r.class_names)}</td>
                      <td style="border:1.5px solid #000; padding:5px; text-align:center; font-weight:bold;">${this.escapeHtml(r.subject_code)}</td>
                      <td style="border:1.5px solid #000; padding:5px;">${this.escapeHtml(absentT?.name || "-")}</td>
                      <td style="border:1.5px solid #000; padding:5px;">${reliefDisplay}</td>
                      <td style="border:1.5px solid #000; padding:5px;"></td>
                    </tr>
                  `;
                }).join("")
            }
          </tbody>
        </table>

        <!-- Ruang Pengesahan Pentadbir -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:24px; font-size:10.5px;">
          <div style="width:230px; text-align:center;">
            <div style="border-bottom:1px dotted #000; height:34px; margin-bottom:4px;"></div>
            <div style="font-weight:bold;">DISEDIAKAN OLEH PENYELARAS JADUAL / PK1</div>
          </div>
          <div style="font-size:9px; color:#475569;">
            Cetakan Sistem Pengurusan Guru Ganti Pintar • ${this.escapeHtml(schoolName)}
          </div>
          <div style="width:230px; text-align:center;">
            <div style="border-bottom:1px dotted #000; height:34px; margin-bottom:4px;"></div>
            <div style="font-weight:bold;">DISAHKAN OLEH GURU BESAR / PENTADBIR</div>
          </div>
        </div>
      </div>
    `;
  },

  renderDailyReliefPrintPreview() {
    const box = document.getElementById("relief-print-preview-box");
    if (!box) return;
    box.innerHTML = this.buildDailyReliefSheetHtml();
  },

  printDailyReliefSheet() {
    const printArea = document.getElementById("print-area");
    if (!printArea) return;
    printArea.innerHTML = this.buildDailyReliefSheetHtml();
    window.print();
  },

  openWhatsAppModal() {
    const school = this.state.schoolSettings?.school_name || "SK MANTIN";
    const session = this.state.currentSession;
    const dateStr = this.reliefState.selectedDate;
    const dayName = this.reliefState.detectedDayName;
    const periods = this.getSessionPeriods();

    const sessionReliefs = this.state.reliefAssignments
      .filter(r => r.session_type === session)
      .sort((a, b) => a.period_number - b.period_number);

    const lines = [
      `📢 *MAKLUMAN JADUAL GURU GANTI (RELIEF)*`,
      `🏫 *${school.toUpperCase()}*`,
      `🗓️ *Tarikh:* ${dateStr} (${dayName})`,
      `☀️ *Sesi:* ${session}`,
      `----------------------------------------`
    ];

    if (sessionReliefs.length === 0) {
      lines.push(`Tiada slot guru ganti bagi sesi ini.`);
    } else {
      sessionReliefs.forEach((r, idx) => {
        const bell = periods.find(p => Number(p.period_number) === Number(r.period_number));
        const timeStr = bell ? `${(bell.start_time || "").slice(0,5)}-${(bell.end_time || "").slice(0,5)}` : "";
        const absentT = this.state.teachers.find(t => t.id === r.absent_teacher_id);
        const reliefT = this.state.teachers.find(t => t.id === r.relief_teacher_id);

        const reliefName = reliefT
          ? `*${reliefT.name} (${reliefT.short_code})*`
          : r.status === "Dikendalikan Guru Pendamping"
          ? `_Dikendalikan Guru Pendamping_`
          : `⚠️ *BELUM DIISI*`;

        lines.push(
          `${idx + 1}. *Waktu ${r.period_number}* (${timeStr}) | *${r.class_names}* [${r.subject_code}]`,
          `   👤 Cuti: ${absentT?.short_code || "-"} ➡️ Ganti: ${reliefName}`
        );
      });
    }

    lines.push(`----------------------------------------`, `_Terima kasih atas kerjasama semua guru._ 🙏`);

    document.getElementById("whatsapp-relief-text").value = lines.join("\n");
    const modal = document.getElementById("modal-relief-whatsapp");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  },

  closeWhatsAppModal() {
    const modal = document.getElementById("modal-relief-whatsapp");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  },

  copyWhatsAppText() {
    const textarea = document.getElementById("whatsapp-relief-text");
    textarea.select();
    navigator.clipboard.writeText(textarea.value);
    this.showToast("Mesej jadual ganti berjaya disalin! Sedia untuk ditampal ke WhatsApp / Telegram.", "success");
  }
});

// Pautkan kitar hayat Fasa 3 supaya dikemas kini apabila Sesi Global atau Data bertukar
(function hookPhase3Lifecycle() {
  const prevSessionHook = App.onSessionChangedPhase2
    ? App.onSessionChangedPhase2.bind(App)
    : null;

  App.onSessionChangedPhase2 = function (session) {
    if (prevSessionHook) prevSessionHook(session);
    if (typeof App.renderReliefDashboard === "function") {
      App.renderReliefDashboard();
    }
  };

  const prevRefresh = App.refreshAllData.bind(App);
  let phase3Initialized = false;

  App.refreshAllData = async function () {
    await prevRefresh();
    if (!phase3Initialized) {
      phase3Initialized = true;
      await App.initPhase3();
    } else {
      await App.loadReliefDataForCurrentDate();
      App.renderReliefDashboard();
    }
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(() => {
      if (!phase3Initialized) {
        phase3Initialized = true;
        App.initPhase3();
      }
    }, 250);
  }
})();
