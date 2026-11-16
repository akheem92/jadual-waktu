/**
 * ============================================================================
 * SISTEM PENGURUSAN JADUAL WAKTU & GURU GANTI PINTAR (GAYA aSc TIMETABLES)
 * Fail: app.js (GABUNGAN PENUH FASA 1 + FASA 2 + FASA 3)
 * ============================================================================
 */

const DEFAULT_SUPABASE_URL = "[https://gnfkkuqlopkwzlerizqv.supabase.co](https://gnfkkuqlopkwzlerizqv.supabase.co)";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_wDU1YZM_RD1GAilOZHlBMw_v_zw5MyT";

window.App = {
  supabase: null,
  state: {
    currentSession: "Pagi",
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

  boardState: {
    viewMode: "classes",
    filterDay: "ALL",
    selectedEntityId: "ALL",
    dragSourceSlotIds: null,
    selectedSlotIdsForMove: null,
    printMode: "teacher",
    printTargetId: "ALL",
    printColorMode: "soft"
  },

  reliefState: {
    selectedDate: new Date().toISOString().slice(0, 10),
    detectedDayName: "Isnin",
    weeklyReliefCounts: {}
  },

  // ==========================================================================
  // 1. INISIALISASI UTAMA & SAMBUNGAN SUPABASE
  // ==========================================================================
  async init() {
    this.updateDetectedDayFromDate(this.reliefState.selectedDate);
    this.injectTab4UI();
    this.injectTab5UI();
    this.injectTab6UI();
    this.bindAssignmentSplitChange();
    this.initSupabaseClient();
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

    if (!window.supabase) {
      if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
      if (text) text.textContent = "CDN Gagal";
      this.showToast("Pustaka Supabase CDN tidak dapat dimuatkan. Semak sambungan internet.", "error");
      return;
    }

    if (!url || !key || url.includes("MASUKKAN_PROJECT_ID")) {
      if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
      if (text) text.textContent = "Tiada Kunci DB";
      return;
    }

    try {
      this.supabase = window.supabase.createClient(url, key);
      if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
      if (text) text.textContent = "Supabase Aktif";
    } catch (err) {
      if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
      if (text) text.textContent = "Ralat Sambungan";
      this.showToast("Gagal memulakan klien Supabase: " + err.message, "error");
    }
  },

  openConfigModal() {
    const { url, key } = this.getSupabaseCredentials();
    document.getElementById("config-supabase-url").value = url;
    document.getElementById("config-supabase-key").value = key;
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
      return this.showToast("Sila lengkapkan kedua-dua URL dan Anon Key.", "error");
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
    document.getElementById("config-supabase-url").value = DEFAULT_SUPABASE_URL;
    document.getElementById("config-supabase-key").value = DEFAULT_SUPABASE_ANON_KEY;
    this.showToast("Tetapan localStorage dipadam dan kembali kepada kunci lalai.", "info");
  },

  // ==========================================================================
  // 2. MUAT TURUN SEMUA DATA DARI SUPABASE
  // ==========================================================================
  async refreshAllData() {
    if (!this.supabase) {
      this.renderAll();
      return;
    }

    try {
      const [
        settingsRes,
        bellsRes,
        teachersRes,
        classesRes,
        subjectsRes,
        assignRes,
        slotsRes
      ] = await Promise.all([
        this.supabase.from("school_settings").select("*").limit(1),
        this.supabase.from("bell_schedules").select("*").order("period_number", { ascending: true }),
        this.supabase.from("teachers").select("*").order("name", { ascending: true }),
        this.supabase.from("classes").select("*").order("year_level", { ascending: true }).order("class_name", { ascending: true }),
        this.supabase.from("subjects").select("*").order("subject_code", { ascending: true }),
        this.supabase.from("teaching_assignments").select("*").order("created_at", { ascending: false }),
        this.supabase.from("timetable_slots").select("*").order("period_number", { ascending: true })
      ]);

      const firstError =
        settingsRes.error ||
        bellsRes.error ||
        teachersRes.error ||
        classesRes.error ||
        subjectsRes.error ||
        assignRes.error ||
        slotsRes.error;

      if (firstError) throw firstError;

      this.state.schoolSettings = settingsRes.data?.[0] || null;
      this.state.bellSchedules = bellsRes.data || [];
      this.state.teachers = teachersRes.data || [];
      this.state.classes = classesRes.data || [];
      this.state.subjects = subjectsRes.data || [];
      this.state.teachingAssignments = assignRes.data || [];
      this.state.timetableSlots = slotsRes.data || [];

      await this.loadReliefDataForCurrentDate();
      this.renderAll();
    } catch (err) {
      console.error("Ralat Supabase:", err);
      this.showToast("Perhatian DB: " + (err.message || "Semak kunci API / jadual Supabase anda."), "warning");
      this.renderAll();
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
    this.renderTimetableBoard();
    this.renderReliefDashboard();
    this.renderPrintStudioControls();
    this.renderAscPrintPreview();
  },

  // ==========================================================================
  // 3. KAWALAN NAVIGASI TAB & SESI GLOBAL ('Pagi' / 'Petang')
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

    const bellBadge = document.getElementById("bell-session-badge");
    const tab2Ind = document.getElementById("tab2-session-indicator");
    const assignBadge = document.getElementById("assign-session-badge");
    if (bellBadge) bellBadge.textContent = `Sesi ${session}`;
    if (tab2Ind) tab2Ind.textContent = session;
    if (assignBadge) assignBadge.textContent = `Sesi ${session}`;

    this.boardState.selectedSlotIdsForMove = null;
    this.renderAll();
  },

  switchTab(tabId) {
    this.state.activeTab = tabId;
    document.querySelectorAll(".tab-panel").forEach(el => el.classList.add("hidden"));
    const targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.remove("hidden");

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
      document.getElementById(id)?.classList.add("hidden");
    });
    document.getElementById(subId)?.classList.remove("hidden");

    const mapBtn = {
      "sub-teachers": "btn-sub-teachers",
      "sub-classes": "btn-sub-classes",
      "sub-subjects": "btn-sub-subjects"
    };
    Object.entries(mapBtn).forEach(([key, btnId]) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      if (key === subId) {
        btn.className = "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-400 text-slate-950 shadow-neon-cyan transition";
      } else {
        btn.className = "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300 hover:text-white transition";
      }
    });
  },

  // ==========================================================================
  // 4. TAB 1: PROFIL SEKOLAH & WAKTU LOCENG
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
      return this.showToast("Saiz fail imej melebihi 1.5MB. Sila pilih logo yang lebih kecil.", "warning");
    }
    const reader = new FileReader();
    reader.onload = e => {
      const base64 = e.target.result;
      document.getElementById("input-logo-url").value = base64;
      this.updateLogoPreview(base64);
      this.showToast("Logo ditukar kepada Base64. Klik Simpan Profil Sekolah.", "info");
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
      const res = this.state.schoolSettings?.id
        ? await this.supabase.from("school_settings").update(payload).eq("id", this.state.schoolSettings.id).select()
        : await this.supabase.from("school_settings").insert([payload]).select();
      if (res.error) throw res.error;
      this.state.schoolSettings = res.data[0];
      this.renderAll();
      this.showToast("Profil sekolah berjaya disimpan!", "success");
    } catch (err) {
      this.showToast("Gagal menyimpan profil: " + err.message, "error");
    }
  },

  renderBellSchedules() {
    const tbody = document.getElementById("tbody-bell-schedules");
    if (!tbody) return;
    const list = this.getSessionPeriods();

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-slate-500 text-xs">
            Tiada waktu loceng bagi <strong>Sesi ${this.state.currentSession}</strong>. Klik butang <em>"Jana Waktu Piawai (1-12)"</em> di atas.
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
          <button onclick="App.editBellPeriod('${item.id}')" class="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-500/20 text-cyan-400 text-xs"><i class="fa-solid fa-pen"></i></button>
          <button onclick="App.deleteBellPeriod('${item.id}')" class="px-2 py-1 rounded bg-slate-800 hover:bg-rose-500/20 text-rose-400 text-xs"><i class="fa-solid fa-trash"></i></button>
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
      const res = id
        ? await this.supabase.from("bell_schedules").update(payload).eq("id", id)
        : await this.supabase.from("bell_schedules").upsert([payload], { onConflict: "session_type,period_number" });
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
    document.getElementById("form-bell-schedule")?.reset();
    document.getElementById("bell-id").value = "";
    document.getElementById("bell-submit-text").textContent = "Simpan";
  },

  async deleteBellPeriod(id) {
    if (!confirm("Padam waktu loceng ini?")) return;
    const { error } = await this.supabase.from("bell_schedules").delete().eq("id", id);
    if (error) return this.showToast("Gagal memadam waktu loceng: " + error.message, "error");
    await this.refreshAllData();
    this.showToast("Waktu loceng dipadam.", "info");
  },

  async generateStandardBellSchedule() {
    if (!this.supabase) return;
    const s = this.state.currentSession;
    if (!confirm(`Jana waktu loceng piawai untuk Sesi ${s}?`)) return;

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

    const rows = (s === "Pagi" ? templatePagi : templatePetang).map(r => ({ ...r, session_type: s }));
    const { error } = await this.supabase.from("bell_schedules").upsert(rows, { onConflict: "session_type,period_number" });
    if (error) return this.showToast("Ralat menjana waktu loceng: " + error.message, "error");

    await this.refreshAllData();
    this.showToast(`Waktu loceng piawai Sesi ${s} berjaya dijana!`, "success");
  },

  // ==========================================================================
  // 5. TAB 2: GURU, KELAS & MATA PELAJARAN
  // ==========================================================================
  calculateTeacherWorkload(teacherId) {
    return this.state.teachingAssignments
      .filter(a => Array.isArray(a.teacher_ids) && a.teacher_ids.includes(teacherId))
      .reduce((sum, a) => sum + (Number(a.periods_per_week) || 0), 0);
  },

  renderTeachers() {
    const container = document.getElementById("grid-teachers");
    if (!container) return;
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
              <button onclick="App.editTeacher('${t.id}')" class="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-500/20 text-cyan-400 text-xs"><i class="fa-solid fa-pen"></i></button>
              <button onclick="App.deleteTeacher('${t.id}')" class="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-rose-400 text-xs"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
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
    document.getElementById("form-teacher")?.reset();
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

  renderClasses() {
    const homeroomSelect = document.getElementById("class-homeroom");
    if (!homeroomSelect) return;
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
    document.getElementById("form-class")?.reset();
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

  renderSubjects() {
    document.getElementById("count-subjects").textContent = this.state.subjects.length;
    const grid = document.getElementById("grid-subjects");
    if (!grid) return;

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
    document.getElementById("form-subject")?.reset();
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
  // 6. TAB 3: AGIHAN TUGAS & KEKANGAN GAYA aSc TIMETABLES
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
    const subSelect = document.getElementById("assign-subject");
    if (!subSelect) return;
    subSelect.innerHTML = `<option value="">-- Pilih Mata Pelajaran --</option>` +
      this.state.subjects.map(s => `<option value="${s.id}">[${this.escapeHtml(s.subject_code)}] ${this.escapeHtml(s.subject_name)}</option>`).join("");

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

    const classesBox = document.getElementById("assign-classes-box");
    const sessionClasses = this.state.classes.filter(c => c.session_type === this.state.currentSession);
    classesBox.innerHTML = sessionClasses.map(c => `
      <label class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-900 cursor-pointer text-xs">
        <input type="checkbox" name="assign-class-chk" value="${c.id}" class="rounded accent-amber-400" />
        <span class="font-bold text-white">${this.escapeHtml(c.class_name)}</span>
      </label>
    `).join("");

    const filterClass = document.getElementById("filter-assign-class");
    if (filterClass) {
      const currentVal = filterClass.value;
      filterClass.innerHTML = `<option value="">Semua Kelas (${this.state.currentSession})</option>` +
        sessionClasses.map(c => `<option value="${c.id}">${this.escapeHtml(c.class_name)}</option>`).join("");
      filterClass.value = currentVal;
    }
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
    if (!container) return;
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
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <div class="flex items-center gap-1 text-emerald-300">
                <i class="fa-solid fa-chalkboard-user"></i>
                <span>${teachers.map(t => this.escapeHtml(t.short_code)).join(" + ") || "Tiada Guru"}</span>
              </div>
              <span class="text-slate-600">•</span>
              <div class="flex items-center gap-1 text-amber-300 font-semibold">
                <i class="fa-solid fa-door-open"></i>
                <span>${classes.map(c => this.escapeHtml(c.class_name)).join(" + ") || "Tiada Kelas"}</span>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
              ${teachers.length > 1 ? `<span class="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">CO-TEACHING (${teachers.length} Guru)</span>` : ''}
              ${classes.length > 1 ? `<span class="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">KELAS GABUNG (${classes.length} Kelas)</span>` : ''}
              ${a.concurrent_group_tag ? `<span class="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/40 text-[10px] font-mono font-bold">BLOK SERENTAK: ${this.escapeHtml(a.concurrent_group_tag)}</span>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="App.editAssignment('${a.id}')" class="p-2 rounded-lg bg-slate-900 hover:bg-cyan-500/20 text-cyan-400 text-xs"><i class="fa-solid fa-pen"></i></button>
            <button onclick="App.deleteAssignment('${a.id}')" class="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-rose-400 text-xs"><i class="fa-solid fa-trash"></i></button>
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
    document.getElementById("form-assignment")?.reset();
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
  // 7. TAB 4: PAPAN JADUAL INTERAKTIF & ENJIN AUTO-GENERATE CSP aSc
  // ==========================================================================
  getDaysOfWeek() {
    const raw = this.state.schoolSettings?.days_of_week;
    return Array.isArray(raw) && raw.length > 0 ? raw : ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat"];
  },

  getSessionPeriods() {
    return this.state.bellSchedules
      .filter(b => b.session_type === this.state.currentSession)
      .sort((a, b) => a.period_number - b.period_number);
  },

  injectTab4UI() {
    const container = document.getElementById("timetable-board-container");
    if (!container) return;

    container.className = "space-y-4 text-left";
    container.innerHTML = `
      <div class="bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button id="btn-board-view-classes" onclick="App.setBoardViewMode('classes')" class="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-cyan-400 text-slate-950 shadow-neon-cyan transition flex items-center gap-1.5">
              <i class="fa-solid fa-door-open"></i> Matriks Kelas
            </button>
            <button id="btn-board-view-teachers" onclick="App.setBoardViewMode('teachers')" class="px-3 py-1.5 rounded-lg text-xs font-bold uppercase text-slate-400 hover:text-white transition flex items-center gap-1.5">
              <i class="fa-solid fa-chalkboard-user"></i> Matriks Guru
            </button>
          </div>
          <select id="board-filter-day" onchange="App.setBoardDayFilter(this.value)" class="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-cyan-300 focus:outline-none">
            <option value="ALL">Semua Hari</option>
          </select>
          <div id="board-stats-badges" class="flex flex-wrap items-center gap-2 text-xs font-mono"></div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="App.openManualSlotModal()" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 text-xs font-bold transition flex items-center gap-1.5">
            <i class="fa-solid fa-plus"></i> Slot Manual
          </button>
          <button onclick="App.runAutoGenerateSessionTimetable()" class="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-extrabold uppercase tracking-wider shadow-neon-emerald transition flex items-center gap-2">
            <i class="fa-solid fa-bolt"></i> Jana Jadual Automatik (CSP aSc)
          </button>
          <button onclick="App.clearUnlockedSessionSlots()" class="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold transition flex items-center gap-1.5">
            <i class="fa-solid fa-eraser"></i> Kosongkan Tidak Dikunci
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div class="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div class="flex flex-wrap items-center gap-4 text-slate-300">
            <span><i class="fa-solid fa-hand-pointer text-cyan-400 mr-1"></i><strong>Drag &amp; Drop</strong> atau <strong>Klik Slot &rarr; Klik Sel Kosong</strong></span>
            <span><i class="fa-solid fa-lock text-amber-400 mr-1"></i>Klik mangga untuk <strong>Freeze/Unfreeze</strong></span>
          </div>
          <div id="board-active-selection-banner" class="hidden items-center gap-2 px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-mono text-[11px]"></div>
        </div>
        <div id="board-clash-summary" class="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs"></div>
      </div>

      <div class="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div class="overflow-x-auto max-h-[700px]">
          <table id="timetable-matrix-table" class="w-full border-collapse text-left"></table>
        </div>
      </div>

      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-amber-400">
          <i class="fa-solid fa-clipboard-check mr-1"></i> Status Agihan Waktu Mengikut Kontrak Pengajaran (<span id="unscheduled-session-label">Sesi Pagi</span>)
        </h3>
        <div id="assignment-fulfillment-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1"></div>
      </div>

      <div id="modal-manual-slot" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm hidden items-center justify-center p-4">
        <div class="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-md w-full p-5 shadow-neon-cyan space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 class="text-sm font-bold text-cyan-400">Letak Slot Pengajaran Manual</h3>
            <button onclick="App.closeManualSlotModal()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="App.saveManualSlot(event)" class="space-y-3 text-xs">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Pilih Kontrak Pengajaran</label>
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
                <label class="block text-slate-300 font-semibold mb-1">Bilangan Waktu</label>
                <select id="manual-slot-duration" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 font-mono">
                  <option value="1">1 Waktu (Single)</option>
                  <option value="2">2 Waktu (Double)</option>
                </select>
              </div>
              <div class="flex items-end pb-2">
                <label class="flex items-center gap-2 text-amber-300 cursor-pointer font-semibold">
                  <input type="checkbox" id="manual-slot-lock" checked class="w-4 h-4 accent-amber-400 rounded" /> Kunci (Freeze)
                </label>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" onclick="App.closeManualSlotModal()" class="px-3 py-2 rounded-xl bg-slate-800 text-slate-300">Batal</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-cyan-400 text-slate-950 font-bold">Simpan Slot</button>
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

  detectSessionClashes(slotsInput = null) {
    const slots = (slotsInput || this.state.timetableSlots).filter(s => s.session_type === this.state.currentSession);
    const periods = this.getSessionPeriods();
    const recessPeriods = new Set(periods.filter(p => p.is_recess).map(p => p.period_number));

    const clashes = [];
    const slotClashMap = new Map();
    const markClash = (slotId, msg) => {
      if (!slotClashMap.has(slotId)) slotClashMap.set(slotId, []);
      if (!slotClashMap.get(slotId).includes(msg)) slotClashMap.get(slotId).push(msg);
    };

    const byDayPeriod = new Map();
    for (const s of slots) {
      if (recessPeriods.has(s.period_number)) {
        const msg = `Slot pada Waktu Rehat (${s.day_name} W${s.period_number})`;
        clashes.push(msg);
        markClash(s.id, msg);
      }
      const key = `${s.day_name}__${s.period_number}`;
      if (!byDayPeriod.has(key)) byDayPeriod.set(key, []);
      byDayPeriod.get(key).push(s);
    }

    for (const [key, cellSlots] of byDayPeriod.entries()) {
      const [dayName, periodStr] = key.split("__");
      for (let i = 0; i < cellSlots.length; i++) {
        for (let j = i + 1; j < cellSlots.length; j++) {
          const a = cellSlots[i];
          const b = cellSlots[j];

          const sharedTeachers = (a.teacher_ids || []).filter(tid => (b.teacher_ids || []).includes(tid));
          if (sharedTeachers.length > 0) {
            const tCodes = sharedTeachers.map(tid => this.state.teachers.find(t => t.id === tid)?.short_code || "Guru").join(", ");
            const msg = `Pertindihan Guru [${tCodes}] pada ${dayName} W${periodStr}`;
            clashes.push(msg);
            markClash(a.id, msg);
            markClash(b.id, msg);
          }

          const sharedClasses = (a.class_ids || []).filter(cid => (b.class_ids || []).includes(cid));
          if (sharedClasses.length > 0) {
            const sameConcurrentTag = a.concurrent_group_tag && b.concurrent_group_tag && a.concurrent_group_tag === b.concurrent_group_tag;
            if (!sameConcurrentTag) {
              const cNames = sharedClasses.map(cid => this.state.classes.find(c => c.id === cid)?.class_name || "Kelas").join(", ");
              const msg = `Pertindihan Kelas [${cNames}] pada ${dayName} W${periodStr}`;
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
      for (const tid of existing.teacher_ids || []) {
        if (movingTeachers.has(tid)) {
          const t = this.state.teachers.find(x => x.id === tid);
          return { ok: false, reason: `Pertindihan Guru: ${t?.short_code || "Guru"} sudah mengajar pada ${targetDay} W${targetPeriod}.` };
        }
      }
      for (const cid of existing.class_ids || []) {
        if (movingClasses.has(cid)) {
          const movingTag = slotsToMove[0]?.concurrent_group_tag;
          const sameConcurrent = movingTag && existing.concurrent_group_tag === movingTag;
          if (!sameConcurrent) {
            const c = this.state.classes.find(x => x.id === cid);
            return { ok: false, reason: `Pertindihan Kelas: ${c?.class_name || "Kelas"} sudah ada subjek lain pada ${targetDay} W${targetPeriod}.` };
          }
        }
      }
    }
    return { ok: true };
  },

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

    const days = this.boardState.filterDay === "ALL" ? allDays : allDays.filter(d => d === this.boardState.filterDay);
    const periods = this.getSessionPeriods();

    if (periods.length === 0) {
      table.innerHTML = `<tbody><tr><td class="p-10 text-center text-slate-400 text-xs">Sila jana Waktu Loceng bagi <strong>Sesi ${this.state.currentSession}</strong> di Tab 1 terlebih dahulu.</td></tr></tbody>`;
      return;
    }

    const sessionSlots = this.state.timetableSlots.filter(s => s.session_type === this.state.currentSession);
    const { clashes, slotClashMap } = this.detectSessionClashes(sessionSlots);

    const lockedCount = sessionSlots.filter(s => s.is_locked).length;
    const statsEl = document.getElementById("board-stats-badges");
    if (statsEl) {
      statsEl.innerHTML = `
        <span class="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-cyan-300">Slot: <strong>${sessionSlots.length}</strong></span>
        <span class="px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-300"><i class="fa-solid fa-lock mr-1"></i>Dikunci: <strong>${lockedCount}</strong></span>
      `;
    }

    const clashEl = document.getElementById("board-clash-summary");
    if (clashEl) {
      clashEl.innerHTML = clashes.length === 0
        ? `<span class="text-emerald-400 font-bold"><i class="fa-solid fa-shield-check mr-1"></i> 0 Pertindihan (Bebas Konflik)</span>`
        : `<span class="text-rose-400 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> ${clashes.length} Konflik Dikesan!</span>`;
    }

    const selBanner = document.getElementById("board-active-selection-banner");
    if (selBanner) {
      if (this.boardState.selectedSlotIdsForMove?.length) {
        selBanner.classList.remove("hidden");
        selBanner.classList.add("flex");
        selBanner.innerHTML = `
          <span>${this.boardState.selectedSlotIdsForMove.length} slot dipilih. Klik sel sasaran.</span>
          <button onclick="App.cancelSlotSelection()" class="text-rose-400 hover:text-white ml-1"><i class="fa-solid fa-xmark"></i></button>
        `;
      } else {
        selBanner.classList.add("hidden");
        selBanner.classList.remove("flex");
      }
    }

    const rows = this.boardState.viewMode === "classes"
      ? this.state.classes.filter(c => c.session_type === this.state.currentSession).map(c => ({ id: c.id, title: c.class_name, subtitle: `Tahun ${c.year_level}`, type: "class" }))
      : this.state.teachers.filter(t => t.session_type === "Kedua-dua" || t.session_type === this.state.currentSession).map(t => ({ id: t.id, title: t.short_code, subtitle: t.name, type: "teacher" }));

    const theadHtml = `
      <thead class="sticky top-0 z-20 bg-slate-950 shadow-md">
        <tr class="border-b border-slate-800">
          <th rowspan="2" class="sticky left-0 z-30 bg-slate-950 px-3 py-2 border-r border-slate-800 min-w-[130px] text-xs font-extrabold uppercase text-cyan-400">
            ${this.boardState.viewMode === "classes" ? "KELAS" : "GURU"} \\ HARI
          </th>
          ${days.map(day => `<th colspan="${periods.length}" class="px-2 py-1.5 text-center text-xs font-extrabold uppercase text-white border-r border-slate-700 bg-slate-900">${this.escapeHtml(day)}</th>`).join("")}
        </tr>
        <tr class="border-b border-slate-700">
          ${days.map(() => periods.map(p => `
            <th class="px-1 py-1 text-center border-r border-slate-800/80 min-w-[66px] ${p.is_recess ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-950 text-slate-300'}">
              <div class="text-[10px] font-mono font-bold">${this.escapeHtml(p.label)}</div>
              <div class="text-[9px] font-mono text-slate-500">${(p.start_time || "").slice(0,5)}</div>
            </th>
          `).join("")).join("")}
        </tr>
      </thead>
    `;

    const tbodyHtml = rows.map(row => `
      <tr class="border-b border-slate-800/80 hover:bg-slate-900/40 transition">
        <td class="sticky left-0 z-10 bg-slate-950 px-3 py-2 border-r border-slate-800">
          <div class="font-bold text-xs text-white">${this.escapeHtml(row.title)}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[120px]">${this.escapeHtml(row.subtitle)}</div>
        </td>
        ${days.map(day => periods.map(p => {
          if (p.is_recess) {
            return `<td class="bg-amber-500/5 border-r border-slate-800/60 text-center align-middle"><span class="text-[9px] font-mono text-amber-500/60 uppercase">Rehat</span></td>`;
          }
          const matchingSlots = sessionSlots.filter(s => {
            if (s.day_name !== day || s.period_number !== p.period_number) return false;
            return row.type === "class" ? (s.class_ids || []).includes(row.id) : (s.teacher_ids || []).includes(row.id);
          });
          return `
            <td
              class="p-1 border-r border-slate-800/60 align-top min-w-[66px] h-16 transition hover:bg-cyan-500/10 cursor-pointer"
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
    `).join("");

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
    const encodedGroupIds = this.getLinkedConcurrentSlotIds(slot).join(",");

    return `
      <div
        draggable="${!slot.is_locked}"
        ondragstart="App.handleSlotDragStart(event, '${encodedGroupIds}')"
        onclick="event.stopPropagation(); App.handleSlotCardClick('${encodedGroupIds}')"
        class="relative rounded-lg p-1 text-[10px] leading-tight select-none border transition shadow-sm ${
          hasClash ? 'bg-rose-950/90 border-rose-500 ring-2 ring-rose-500' : isSelected ? 'bg-cyan-950 border-cyan-300 ring-2 ring-cyan-400' : 'bg-slate-900/95 border-slate-700/80 hover:border-cyan-400'
        }"
        style="border-left: 4px solid ${color}"
      >
        <div class="flex items-center justify-between gap-1">
          <span class="font-mono font-extrabold text-white truncate">${this.escapeHtml(sub?.subject_code || "SUB")}</span>
          <div class="flex items-center gap-0.5 shrink-0">
            <button type="button" onclick="event.stopPropagation(); App.toggleSlotLock('${encodedGroupIds}', ${!slot.is_locked})" class="${slot.is_locked ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'} text-[9px] px-0.5">
              <i class="fa-solid ${slot.is_locked ? 'fa-lock' : 'fa-lock-open'}"></i>
            </button>
            <button type="button" onclick="event.stopPropagation(); App.deleteSlotGroup('${encodedGroupIds}')" class="text-slate-600 hover:text-rose-400 text-[9px] px-0.5">
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
      .filter(s => s.session_type === slot.session_type && s.day_name === slot.day_name && s.period_number === slot.period_number && s.concurrent_group_tag === slot.concurrent_group_tag)
      .map(s => s.id);
  },

  renderAssignmentFulfillmentGrid(sessionSlots) {
    const grid = document.getElementById("assignment-fulfillment-grid");
    const label = document.getElementById("unscheduled-session-label");
    if (label) label.textContent = `Sesi ${this.state.currentSession}`;
    if (!grid) return;

    const contracts = this.state.teachingAssignments.filter(a => a.session_type === this.state.currentSession);
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
            <div class="text-[10px] text-slate-400 font-mono truncate">${this.escapeHtml(tCodes)}</div>
          </div>
          <span class="px-2 py-0.5 rounded font-mono font-bold text-[11px] ${done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">${placed}/${target}W</span>
        </div>
      `;
    }).join("");
  },

  async toggleSlotLock(encodedIds, lockState) {
    const ids = encodedIds.split(",").filter(Boolean);
    if (!ids.length || !this.supabase) return;
    const { error } = await this.supabase.from("timetable_slots").update({ is_locked: lockState }).in("id", ids);
    if (error) return this.showToast("Gagal menukar kunci slot: " + error.message, "error");
    this.state.timetableSlots.forEach(s => { if (ids.includes(s.id)) s.is_locked = lockState; });
    this.renderTimetableBoard();
  },

  async deleteSlotGroup(encodedIds) {
    const ids = encodedIds.split(",").filter(Boolean);
    const targetSlots = this.state.timetableSlots.filter(s => ids.includes(s.id));
    if (targetSlots.some(s => s.is_locked)) return this.showToast("Slot dikunci (Freeze). Buka kunci dahulu.", "warning");
    const { error } = await this.supabase.from("timetable_slots").delete().in("id", ids);
    if (error) return this.showToast("Gagal memadam slot: " + error.message, "error");
    this.state.timetableSlots = this.state.timetableSlots.filter(s => !ids.includes(s.id));
    this.renderTimetableBoard();
    this.renderAscPrintPreview();
  },

  handleSlotDragStart(event, encodedIds) {
    const ids = encodedIds.split(",").filter(Boolean);
    this.boardState.dragSourceSlotIds = ids;
    event.dataTransfer.setData("text/plain", encodedIds);
  },

  handleSlotCardClick(encodedIds) {
    this.boardState.selectedSlotIdsForMove = encodedIds.split(",").filter(Boolean);
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
    if (ids.length > 0) await this.moveSlotGroupTo(ids, targetDay, Number(targetPeriod));
  },

  async handleEmptyOrTargetCellClick(targetDay, targetPeriod) {
    if (!this.boardState.selectedSlotIdsForMove?.length) return;
    const ids = [...this.boardState.selectedSlotIdsForMove];
    this.boardState.selectedSlotIdsForMove = null;
    await this.moveSlotGroupTo(ids, targetDay, Number(targetPeriod));
  },

  async moveSlotGroupTo(slotIds, targetDay, targetPeriod) {
    const sessionSlots = this.state.timetableSlots.filter(s => s.session_type === this.state.currentSession);
    const slotsToMove = sessionSlots.filter(s => slotIds.includes(s.id));
    if (!slotsToMove.length) return;

    const check = this.canPlaceSlotGroupAt(slotsToMove, targetDay, targetPeriod, sessionSlots);
    if (!check.ok) return this.showToast(check.reason, "error");

    const { error } = await this.supabase.from("timetable_slots").update({ day_name: targetDay, period_number: targetPeriod }).in("id", slotIds);
    if (error) return this.showToast("Gagal mengalihkan slot: " + error.message, "error");

    slotsToMove.forEach(s => { s.day_name = targetDay; s.period_number = targetPeriod; });
    this.renderTimetableBoard();
    this.renderAscPrintPreview();
    this.showToast(`Slot dialihkan ke ${targetDay} (W${targetPeriod}).`, "success");
  },

  openManualSlotModal() {
    const modal = document.getElementById("modal-manual-slot");
    const assignSelect = document.getElementById("manual-slot-assignment");
    const daySelect = document.getElementById("manual-slot-day");
    const periodSelect = document.getElementById("manual-slot-period");

    const contracts = this.state.teachingAssignments.filter(a => a.session_type === this.state.currentSession);
    assignSelect.innerHTML = contracts.map(a => {
      const sub = this.state.subjects.find(s => s.id === a.subject_id);
      const tCodes = (a.teacher_ids || []).map(id => this.state.teachers.find(t => t.id === id)?.short_code || "").join("+");
      const cNames = (a.class_ids || []).map(id => this.state.classes.find(c => c.id === id)?.class_name || "").join("+");
      return `<option value="${a.id}">[${this.escapeHtml(sub?.subject_code || "")}] ${this.escapeHtml(cNames)} — ${this.escapeHtml(tCodes)}</option>`;
    }).join("");

    daySelect.innerHTML = this.getDaysOfWeek().map(d => `<option value="${this.escapeHtml(d)}">${this.escapeHtml(d)}</option>`).join("");
    periodSelect.innerHTML = this.getSessionPeriods().filter(p => !p.is_recess).map(p => `<option value="${p.period_number}">Waktu ${p.period_number} (${this.escapeHtml(p.label)})</option>`).join("");

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

    const sessionSlots = this.state.timetableSlots.filter(s => s.session_type === this.state.currentSession);
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
      if (!check.ok) return this.showToast(check.reason, "error");
      const { id, ...cleanRow } = virtualSlot;
      rowsToInsert.push(cleanRow);
    }

    const { data, error } = await this.supabase.from("timetable_slots").insert(rowsToInsert).select();
    if (error) return this.showToast("Gagal menambah slot manual: " + error.message, "error");

    this.state.timetableSlots.push(...(data || []));
    this.closeManualSlotModal();
    this.renderTimetableBoard();
    this.renderAscPrintPreview();
    this.showToast("Slot manual berjaya diletakkan!", "success");
  },

  async clearUnlockedSessionSlots() {
    if (!confirm(`Kosongkan semua slot yang TIDAK dikunci bagi Sesi ${this.state.currentSession}?`)) return;
    const { error } = await this.supabase.from("timetable_slots").delete().eq("session_type", this.state.currentSession).eq("is_locked", false);
    if (error) return this.showToast("Gagal mengosongkan slot: " + error.message, "error");
    await this.refreshAllData();
    this.showToast("Semua slot tidak dikunci telah dikosongkan.", "info");
  },

  async runAutoGenerateSessionTimetable() {
    if (!this.supabase) return;
    const session = this.state.currentSession;
    const days = this.getDaysOfWeek();
    const teachingPeriods = this.getSessionPeriods().filter(p => !p.is_recess).map(p => p.period_number);

    if (teachingPeriods.length === 0) return this.showToast(`Sila jana Waktu Loceng Sesi ${session} di Tab 1 dahulu.`, "warning");
    const contracts = this.state.teachingAssignments.filter(a => a.session_type === session);
    if (contracts.length === 0) return this.showToast(`Tiada Kontrak Pengajaran bagi Sesi ${session} di Tab 3.`, "warning");

    const lockedSlots = this.state.timetableSlots.filter(s => s.session_type === session && s.is_locked);
    const workingSlots = lockedSlots.map(s => ({ ...s }));

    const isSlotFreeForGroup = (contractsGroup, day, startPeriod, duration) => {
      const neededPeriods = [];
      for (let i = 0; i < duration; i++) {
        const p = startPeriod + i;
        if (!teachingPeriods.includes(p)) return false;
        neededPeriods.push(p);
      }
      const groupTeachers = new Set();
      const groupClasses = new Set();
      for (const c of contractsGroup) {
        for (const tid of c.teacher_ids || []) {
          if (groupTeachers.has(tid) && contractsGroup.length > 1) return false;
          groupTeachers.add(tid);
        }
        (c.class_ids || []).forEach(cid => groupClasses.add(cid));
      }
      for (const p of neededPeriods) {
        const existingAtCell = workingSlots.filter(s => s.day_name === day && s.period_number === p);
        for (const ex of existingAtCell) {
          if ((ex.teacher_ids || []).some(tid => groupTeachers.has(tid))) return false;
          if ((ex.class_ids || []).some(cid => groupClasses.has(cid))) return false;
        }
      }
      return true;
    };

    const parseSplitCards = (splitStr, totalPeriods, lockedCount) => {
      let rawCards = String(splitStr || "").split("+").map(n => parseInt(n.trim(), 10)).filter(n => n > 0);
      if (rawCards.reduce((a, b) => a + b, 0) !== totalPeriods) {
        rawCards = [];
        let rem = totalPeriods;
        while (rem >= 2) { rawCards.push(2); rem -= 2; }
        if (rem === 1) rawCards.push(1);
      }
      let toDeduct = lockedCount;
      const remainingCards = [];
      for (const card of rawCards) {
        if (toDeduct <= 0) remainingCards.push(card);
        else if (toDeduct >= card) toDeduct -= card;
        else { remainingCards.push(card - toDeduct); toDeduct = 0; }
      }
      return remainingCards.sort((a, b) => b - a);
    };

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

    for (const [tag, groupContracts] of concurrentGroupsMap.entries()) {
      const primary = groupContracts[0];
      const lockedForTag = lockedSlots.filter(s => s.concurrent_group_tag === tag && s.assignment_id === primary.id).length;
      const cards = parseSplitCards(primary.period_split, Number(primary.periods_per_week) || 1, lockedForTag);

      for (const cardDuration of cards) {
        let placed = false;
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
        if (!placed) unplacedCardsCount++;
      }
    }

    standaloneContracts.sort((a, b) => {
      const wA = ((a.teacher_ids?.length || 1) * 3) + ((a.class_ids?.length || 1) * 3) + (Number(a.periods_per_week) || 0);
      const wB = ((b.teacher_ids?.length || 1) * 3) + ((b.class_ids?.length || 1) * 3) + (Number(b.periods_per_week) || 0);
      return wB - wA;
    });

    for (const contract of standaloneContracts) {
      const lockedForContract = lockedSlots.filter(s => s.assignment_id === contract.id).length;
      const cards = parseSplitCards(contract.period_split, Number(contract.periods_per_week) || 1, lockedForContract);

      for (const cardDuration of cards) {
        const sortedDays = [...days].sort((dA, dB) => {
          const sameA = workingSlots.filter(s => s.day_name === dA && s.assignment_id === contract.id).length;
          const sameB = workingSlots.filter(s => s.day_name === dB && s.assignment_id === contract.id).length;
          return sameA - sameB;
        });

        let placed = false;
        for (const day of sortedDays) {
          for (const startP of teachingPeriods) {
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

    try {
      await this.supabase.from("timetable_slots").delete().eq("session_type", session).eq("is_locked", false);
      const newlyGenerated = workingSlots.filter(s => !s.is_locked).map(({ id, created_at, ...clean }) => clean);
      if (newlyGenerated.length > 0) {
        const { error: insErr } = await this.supabase.from("timetable_slots").insert(newlyGenerated);
        if (insErr) throw insErr;
      }
      await this.refreshAllData();
      this.showToast(unplacedCardsCount === 0 ? `Jadual Sesi ${session} selesai dijana 100%!` : `Jadual dijana (${unplacedCardsCount} kad tidak muat).`, unplacedCardsCount === 0 ? "success" : "warning");
    } catch (err) {
      this.showToast("Ralat menyimpan jadual: " + err.message, "error");
    }
  },

  // ==========================================================================
  // 8. TAB 5: SISTEM PENGURUSAN GURU GANTI (RELIEF) PINTAR
  // ==========================================================================
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
    const day = dt.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(dt);
    monday.setDate(dt.getDate() + diffToMon);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { start: fmt(monday), end: fmt(friday) };
  },

  injectTab5UI() {
    const container = document.getElementById("relief-management-container");
    if (!container) return;

    container.className = "space-y-6 text-left";
    container.innerHTML = `
      <div class="bg-slate-900/95 border border-emerald-500/40 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-4">
          <div>
            <label class="block text-[10px] font-mono uppercase text-slate-400 mb-1">Tarikh Guru Ganti</label>
            <input type="date" id="relief-date-input" value="${this.reliefState.selectedDate}" onchange="App.handleReliefDateChange(this.value)" class="px-3.5 py-2 rounded-xl bg-slate-950 border border-emerald-400/50 text-sm font-mono font-bold text-emerald-300" />
          </div>
          <div class="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800">
            <div class="text-[10px] font-mono uppercase text-slate-400">Hari &amp; Sesi Aktif</div>
            <div class="text-sm font-extrabold text-white flex items-center gap-2 mt-0.5">
              <span id="relief-day-badge" class="text-cyan-400">${this.reliefState.detectedDayName}</span>
              <span class="text-slate-600">•</span>
              <span id="relief-session-badge" class="text-emerald-400">Sesi ${this.state.currentSession}</span>
            </div>
          </div>
          <div id="relief-summary-pills" class="flex flex-wrap items-center gap-2 text-xs font-mono"></div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="App.autoAssignAllPendingReliefs()" class="px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs uppercase shadow-neon-emerald transition flex items-center gap-2">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Cadang &amp; Isi Semua Automatik
          </button>
          <button onclick="App.openWhatsAppModal()" class="px-3.5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 font-bold text-xs transition flex items-center gap-2">
            <i class="fa-brands fa-whatsapp"></i> Mesej WhatsApp/Telegram
          </button>
          <button onclick="App.printDailyReliefSheet()" class="px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs uppercase shadow-neon-pink transition flex items-center gap-2">
            <i class="fa-solid fa-print"></i> Cetak Jadual Ganti (A4)
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-4 space-y-5">
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 class="text-sm font-bold text-amber-400 uppercase"><i class="fa-solid fa-user-minus mr-1"></i> 1. Daftar Guru Tidak Hadir</h3>
            <form id="form-teacher-leave" onsubmit="App.saveTeacherLeave(event)" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-slate-300 mb-1">Pilih Guru Tidak Hadir</label>
                <select id="leave-teacher-select" required class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"></select>
              </div>
              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="block font-semibold text-slate-300 mb-1">Sebab</label>
                  <select id="leave-reason-select" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-semibold">
                    <option value="CRK">CRK</option>
                    <option value="MC">Cuti Sakit (MC)</option>
                    <option value="KURSUS">Kursus / Bengkel</option>
                    <option value="TUGAS RASMI">Tugas Rasmi Luar</option>
                  </select>
                </div>
                <div>
                  <label class="block font-semibold text-slate-300 mb-1">Catatan</label>
                  <input type="text" id="leave-notes-input" placeholder="Pilihan..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                </div>
              </div>
              <button type="submit" class="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs uppercase shadow-neon-amber">
                Tandakan Tidak Hadir &amp; Tarik Slot
              </button>
            </form>
          </div>

          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 class="text-xs font-bold uppercase text-white">Senarai Tidak Hadir (<span id="count-absent-teachers">0</span>)</h3>
            <div id="absent-teachers-list" class="space-y-2.5 max-h-[360px] overflow-y-auto pr-1"></div>
          </div>
        </div>

        <div class="lg:col-span-8 space-y-5">
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 class="text-sm font-bold text-cyan-400 uppercase">2. Slot PdP Terjejas &amp; Cadangan Guru Ganti</h3>
              <button onclick="App.syncAffectedSlotsFromTimetable()" class="px-3 py-1.5 rounded-xl bg-slate-800 text-cyan-300 text-xs font-semibold"><i class="fa-solid fa-rotate mr-1"></i>Segarkan Slot</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-slate-800 bg-slate-950/80 font-mono uppercase text-[11px] text-slate-400">
                    <th class="py-3 px-3">Waktu</th>
                    <th class="py-3 px-3">Kelas &amp; Subjek</th>
                    <th class="py-3 px-3">Guru Cuti</th>
                    <th class="py-3 px-3 min-w-[280px]">Pemilihan Guru Ganti</th>
                    <th class="py-3 px-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody id="tbody-relief-slots" class="divide-y divide-slate-800/70"></tbody>
              </table>
            </div>
          </div>

          <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 class="text-xs font-bold uppercase text-pink-400">Pratonton Cetakan Jadual Guru Ganti Harian (A4)</h3>
            <div id="relief-print-preview-box" class="bg-white text-black rounded-xl p-6 shadow-xl overflow-x-auto"></div>
          </div>
        </div>
      </div>

      <div id="modal-relief-whatsapp" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm hidden items-center justify-center p-4">
        <div class="bg-slate-900 border border-cyan-500/50 rounded-2xl max-w-lg w-full p-5 shadow-neon-cyan space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 class="text-sm font-bold text-cyan-400">Mesej Makluman WhatsApp / Telegram</h3>
            <button onclick="App.closeWhatsAppModal()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <textarea id="whatsapp-relief-text" rows="11" readonly class="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200"></textarea>
          <div class="flex justify-end gap-2">
            <button onclick="App.closeWhatsAppModal()" class="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs">Tutup</button>
            <button onclick="App.copyWhatsAppText()" class="px-4 py-2 rounded-xl bg-emerald-400 text-slate-950 font-bold text-xs">Salin Teks</button>
          </div>
        </div>
      </div>
    `;
  },

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
      const [leavesRes, reliefsRes, weekReliefsRes] = await Promise.all([
        this.supabase.from("teacher_leaves").select("*").eq("leave_date", dateStr),
        this.supabase.from("relief_assignments").select("*").eq("leave_date", dateStr).order("period_number", { ascending: true }),
        this.supabase.from("relief_assignments").select("relief_teacher_id, leave_date, status").gte("leave_date", weekRange.start).lte("leave_date", weekRange.end)
      ]);

      this.state.teacherLeaves = leavesRes.data || [];
      this.state.reliefAssignments = reliefsRes.data || [];

      const counts = {};
      (weekReliefsRes.data || []).forEach(r => {
        if (r.relief_teacher_id && r.status !== "Dibatalkan") {
          counts[r.relief_teacher_id] = (counts[r.relief_teacher_id] || 0) + 1;
        }
      });
      this.reliefState.weeklyReliefCounts = counts;
    } catch (err) {
      console.error("Ralat memuatkan relief:", err);
    }
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
      const { data: leaveRows, error: leaveErr } = await this.supabase
        .from("teacher_leaves")
        .upsert([{ leave_date: dateStr, session_type: session, absent_teacher_id: teacherId, reason, notes }], { onConflict: "leave_date,session_type,absent_teacher_id" })
        .select();

      if (leaveErr) throw leaveErr;
      await this.generateReliefSlotsForLeave(leaveRows?.[0]);
      document.getElementById("leave-notes-input").value = "";
      await this.loadReliefDataForCurrentDate();
      this.renderReliefDashboard();
      this.showToast("Guru ditandakan tidak hadir & slot jadual ditarik!", "success");
    } catch (err) {
      this.showToast("Gagal mendaftarkan cuti: " + err.message, "error");
    }
  },

  async generateReliefSlotsForLeave(leaveRecord) {
    if (!leaveRecord || !this.supabase) return;
    const dayName = this.reliefState.detectedDayName;
    const session = leaveRecord.session_type;
    const absentTeacherId = leaveRecord.absent_teacher_id;

    const affectedSlots = this.state.timetableSlots.filter(
      s => s.session_type === session && s.day_name === dayName && Array.isArray(s.teacher_ids) && s.teacher_ids.includes(absentTeacherId)
    );
    if (affectedSlots.length === 0) return;

    const { data: existingReliefs } = await this.supabase.from("relief_assignments").select("period_number, class_names").eq("leave_id", leaveRecord.id);
    const existingKeys = new Set((existingReliefs || []).map(r => `${r.period_number}__${r.class_names}`));

    const rowsToInsert = [];
    for (const slot of affectedSlots) {
      const sub = this.state.subjects.find(x => x.id === slot.subject_id);
      const classNames = (slot.class_ids || []).map(cid => this.state.classes.find(c => c.id === cid)?.class_name || "").filter(Boolean).join(" + ");
      const key = `${slot.period_number}__${classNames}`;
      if (existingKeys.has(key)) continue;

      const coTeachers = (slot.teacher_ids || []).filter(tid => tid !== absentTeacherId);
      const hasCoTeacher = coTeachers.length > 0;
      const coTeacherCodes = coTeachers.map(tid => this.state.teachers.find(t => t.id === tid)?.short_code || "").filter(Boolean).join(", ");

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
      await this.supabase.from("relief_assignments").insert(rowsToInsert);
    }
  },

  async syncAffectedSlotsFromTimetable() {
    const sessionLeaves = this.state.teacherLeaves.filter(l => l.session_type === this.state.currentSession);
    for (const leave of sessionLeaves) await this.generateReliefSlotsForLeave(leave);
    await this.loadReliefDataForCurrentDate();
    this.renderReliefDashboard();
    this.showToast("Slot terjejas telah diselaraskan semula.", "info");
  },

  async deleteTeacherLeave(leaveId) {
    if (!confirm("Padam rekod ketidakhadiran guru ini?")) return;
    await this.supabase.from("teacher_leaves").delete().eq("id", leaveId);
    await this.loadReliefDataForCurrentDate();
    this.renderReliefDashboard();
  },

  getRankedReliefCandidatesForSlot(reliefSlot) {
    const session = reliefSlot.session_type;
    const dayName = reliefSlot.day_name;
    const periodNumber = Number(reliefSlot.period_number);
    const absentTeacherIds = new Set(this.state.teacherLeaves.map(l => l.absent_teacher_id));

    const sessionCandidates = this.state.teachers.filter(t => {
      return (t.session_type === session || t.session_type === "Kedua-dua") && !t.is_relief_exempt && !absentTeacherIds.has(t.id);
    });

    const busyTeacherIds = new Set();
    this.state.timetableSlots.forEach(s => {
      if (s.day_name === dayName && s.session_type === session && Number(s.period_number) === periodNumber) {
        (s.teacher_ids || []).forEach(tid => busyTeacherIds.add(tid));
      }
    });
    this.state.reliefAssignments.forEach(r => {
      if (r.id !== reliefSlot.id && r.relief_teacher_id && r.session_type === session && Number(r.period_number) === periodNumber) {
        busyTeacherIds.add(r.relief_teacher_id);
      }
    });

    const scoredCandidates = [];
    for (const teacher of sessionCandidates) {
      if (busyTeacherIds.has(teacher.id)) continue;

      const teachingTodayCount = this.state.timetableSlots.filter(
        s => s.day_name === dayName && s.session_type === session && (s.teacher_ids || []).includes(teacher.id)
      ).length;
      const reliefTodayCount = this.state.reliefAssignments.filter(
        r => r.id !== reliefSlot.id && r.relief_teacher_id === teacher.id
      ).length;
      const baseWeeklyCount = this.reliefState.weeklyReliefCounts[teacher.id] || 0;
      const maxRelief = Number(teacher.max_relief_per_week) || 5;

      let score = 100 - baseWeeklyCount * 18 - reliefTodayCount * 25 - teachingTodayCount * 4;
      scoredCandidates.push({
        teacher,
        score,
        teachingTodayCount,
        reliefTodayCount,
        weeklyReliefCount: baseWeeklyCount,
        maxRelief
      });
    }

    return scoredCandidates.sort((a, b) => b.score - a.score);
  },

  async assignReliefTeacherToSlot(reliefId, reliefTeacherId) {
    if (!this.supabase) return;
    await this.supabase.from("relief_assignments").update({
      relief_teacher_id: reliefTeacherId || null,
      status: reliefTeacherId ? "Telah Diisi" : "Belum Diisi"
    }).eq("id", reliefId);
    await this.loadReliefDataForCurrentDate();
    this.renderReliefDashboard();
  },

  async autoSuggestSingleSlot(reliefId) {
    const slot = this.state.reliefAssignments.find(r => r.id === reliefId);
    if (!slot) return;
    const candidates = this.getRankedReliefCandidatesForSlot(slot);
    if (candidates.length === 0) return this.showToast("Tiada guru lapang pada waktu ini.", "warning");
    await this.assignReliefTeacherToSlot(reliefId, candidates[0].teacher.id);
  },

  async autoAssignAllPendingReliefs() {
    const session = this.state.currentSession;
    const pendingSlots = this.state.reliefAssignments.filter(r => r.session_type === session && !r.relief_teacher_id);
    if (pendingSlots.length === 0) return this.showToast("Semua slot telah diisi.", "info");

    for (const slot of pendingSlots) {
      const candidates = this.getRankedReliefCandidatesForSlot(slot);
      if (candidates.length > 0) {
        const chosen = candidates[0].teacher;
        await this.supabase.from("relief_assignments").update({ relief_teacher_id: chosen.id, status: "Telah Diisi" }).eq("id", slot.id);
        slot.relief_teacher_id = chosen.id;
      }
    }
    await this.loadReliefDataForCurrentDate();
    this.renderReliefDashboard();
    this.showToast("Semua slot guru ganti berjaya diisi secara automatik!", "success");
  },

  renderReliefDashboard() {
    const dayBadge = document.getElementById("relief-day-badge");
    const sesBadge = document.getElementById("relief-session-badge");
    if (!dayBadge || !sesBadge) return;

    const session = this.state.currentSession;
    dayBadge.textContent = `Hari ${this.reliefState.detectedDayName}`;
    sesBadge.textContent = `Sesi ${session}`;

    const eligibleTeachers = this.state.teachers.filter(t => t.session_type === session || t.session_type === "Kedua-dua");
    const leaveSelect = document.getElementById("leave-teacher-select");
    if (leaveSelect) {
      leaveSelect.innerHTML = `<option value="">-- Pilih Guru Sesi ${session} (${eligibleTeachers.length}) --</option>` +
        eligibleTeachers.map(t => `<option value="${t.id}">${this.escapeHtml(t.name)} (${this.escapeHtml(t.short_code)})</option>`).join("");
    }

    const sessionLeaves = this.state.teacherLeaves.filter(l => l.session_type === session);
    document.getElementById("count-absent-teachers").textContent = sessionLeaves.length;
    const absentListEl = document.getElementById("absent-teachers-list");

    absentListEl.innerHTML = sessionLeaves.length === 0
      ? `<div class="py-6 text-center text-slate-500 text-xs">Tiada guru tidak hadir.</div>`
      : sessionLeaves.map(l => {
          const t = this.state.teachers.find(x => x.id === l.absent_teacher_id);
          return `
            <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div class="font-bold text-xs text-white">${this.escapeHtml(t?.name || "-")} (${this.escapeHtml(t?.short_code || "")})</div>
                <div class="text-[11px] text-pink-400">${this.escapeHtml(l.reason)}</div>
              </div>
              <button onclick="App.deleteTeacherLeave('${l.id}')" class="p-2 text-rose-400 text-xs"><i class="fa-solid fa-trash"></i></button>
            </div>
          `;
        }).join("");

    const tbody = document.getElementById("tbody-relief-slots");
    const sessionReliefs = this.state.reliefAssignments.filter(r => r.session_type === session).sort((a, b) => a.period_number - b.period_number);

    if (sessionReliefs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-slate-500 text-xs">Tiada slot terjejas.</td></tr>`;
    } else {
      tbody.innerHTML = sessionReliefs.map(r => {
        const absentTeacher = this.state.teachers.find(t => t.id === r.absent_teacher_id);
        const candidates = this.getRankedReliefCandidatesForSlot(r);
        const optionsHtml = candidates.map(c => `
          <option value="${c.teacher.id}" ${r.relief_teacher_id === c.teacher.id ? "selected" : ""}>
            ${this.escapeHtml(c.teacher.name)} (${this.escapeHtml(c.teacher.short_code)}) — [Waktu Hari Ini: ${c.teachingTodayCount + c.reliefTodayCount} | Relief Minggu: ${c.weeklyReliefCount}/${c.maxRelief}]
          </option>
        `).join("");

        return `
          <tr>
            <td class="py-2.5 px-3 font-mono font-bold text-cyan-300">W#${r.period_number}</td>
            <td class="py-2.5 px-3 font-bold text-white">${this.escapeHtml(r.class_names)} <span class="text-pink-400 font-mono">[${this.escapeHtml(r.subject_code)}]</span></td>
            <td class="py-2.5 px-3 text-amber-300">${this.escapeHtml(absentTeacher?.short_code || "-")}</td>
            <td class="py-2.5 px-3">
              <select onchange="App.assignReliefTeacherToSlot('${r.id}', this.value)" class="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white">
                <option value="">-- Pilih Guru Ganti (${candidates.length} Lapang) --</option>
                ${optionsHtml}
              </select>
            </td>
            <td class="py-2.5 px-3 text-right">
              <button onclick="App.autoSuggestSingleSlot('${r.id}')" class="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-bold">Cadang</button>
            </td>
          </tr>
        `;
      }).join("");
    }

    this.renderDailyReliefPrintPreview();
  },

  buildDailyReliefSheetHtml() {
    const school = this.state.schoolSettings || {};
    const schoolName = school.school_name || "SEKOLAH KEBANGSAAN MANTIN";
    const session = this.state.currentSession;
    const sessionReliefs = this.state.reliefAssignments.filter(r => r.session_type === session).sort((a, b) => a.period_number - b.period_number);

    return `
      <div style="font-family: Arial, sans-serif; color:#000; background:#fff;">
        <h2 style="font-size:16px; font-weight:900; margin-bottom:4px;">${this.escapeHtml(schoolName)} — JADUAL GURU GANTI (${this.escapeHtml(session.toUpperCase())})</h2>
        <p style="font-size:11px; margin-bottom:10px;">Tarikh: <strong>${this.escapeHtml(this.reliefState.selectedDate)} (${this.escapeHtml(this.reliefState.detectedDayName)})</strong></p>
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead>
            <tr style="background:#e2e8f0;">
              <th style="border:1px solid #000; padding:4px;">WAKTU</th>
              <th style="border:1px solid #000; padding:4px;">KELAS</th>
              <th style="border:1px solid #000; padding:4px;">SUBJEK</th>
              <th style="border:1px solid #000; padding:4px;">GURU TIDAK HADIR</th>
              <th style="border:1px solid #000; padding:4px;">GURU GANTI</th>
            </tr>
          </thead>
          <tbody>
            ${sessionReliefs.map(r => {
              const absentT = this.state.teachers.find(t => t.id === r.absent_teacher_id);
              const reliefT = this.state.teachers.find(t => t.id === r.relief_teacher_id);
              return `
                <tr>
                  <td style="border:1px solid #000; padding:4px; text-align:center;">W${r.period_number}</td>
                  <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold;">${this.escapeHtml(r.class_names)}</td>
                  <td style="border:1px solid #000; padding:4px; text-align:center;">${this.escapeHtml(r.subject_code)}</td>
                  <td style="border:1px solid #000; padding:4px;">${this.escapeHtml(absentT?.name || "-")}</td>
                  <td style="border:1px solid #000; padding:4px; font-weight:bold;">${this.escapeHtml(reliefT?.name || "BELUM DIISI")}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  },

  renderDailyReliefPrintPreview() {
    const box = document.getElementById("relief-print-preview-box");
    if (box) box.innerHTML = this.buildDailyReliefSheetHtml();
  },

  printDailyReliefSheet() {
    const printArea = document.getElementById("print-area");
    if (!printArea) return;
    printArea.innerHTML = this.buildDailyReliefSheetHtml();
    window.print();
  },

  openWhatsAppModal() {
    const session = this.state.currentSession;
    const sessionReliefs = this.state.reliefAssignments.filter(r => r.session_type === session).sort((a, b) => a.period_number - b.period_number);
    const lines = [
      `*JADUAL GURU GANTI (${this.reliefState.selectedDate} - ${this.reliefState.detectedDayName} / Sesi ${session})*`,
      `----------------------------------------`
    ];
    sessionReliefs.forEach((r, i) => {
      const absentT = this.state.teachers.find(t => t.id === r.absent_teacher_id);
      const reliefT = this.state.teachers.find(t => t.id === r.relief_teacher_id);
      lines.push(`${i + 1}. W${r.period_number} | *${r.class_names}* [${r.subject_code}] — Cuti: ${absentT?.short_code || "-"} ➡️ Ganti: *${reliefT?.name || "BELUM DIISI"}*`);
    });
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
    this.showToast("Mesej disalin ke papan keratan!", "success");
  },

  // ==========================================================================
  // 9. TAB 6: STUDIO PREVIEW & CETAKAN GAYA DEFAULT aSc TIMETABLES
  // ==========================================================================
  injectTab6UI() {
    const container = document.getElementById("asc-print-studio-container");
    if (!container) return;

    container.className = "space-y-6 text-left";
    container.innerHTML = `
      <div class="bg-slate-900/95 border border-pink-500/40 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-base font-bold text-pink-400"><i class="fa-solid fa-print mr-1"></i> Studio Cetakan Rasmi Gaya Default aSc Timetables</h2>
          <p class="text-xs text-slate-400">Pilih cetakan mengikut Guru atau Kelas (Individu atau Cetak Semua Sekaligus).</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button id="btn-print-mode-teacher" onclick="App.setPrintMode('teacher')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase bg-pink-500 text-white">Jadual Guru</button>
            <button id="btn-print-mode-class" onclick="App.setPrintMode('class')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase text-slate-400">Jadual Kelas</button>
          </div>
          <select id="select-print-target" onchange="App.setPrintTarget(this.value)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-cyan-300 min-w-[220px]"></select>
          <button onclick="App.triggerOfficialPrint()" class="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-xs uppercase shadow-neon-cyan">
            <i class="fa-solid fa-file-pdf mr-1"></i> Cetak / Simpan PDF (A4)
          </button>
        </div>
      </div>
      <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 md:p-8 overflow-x-auto">
        <div id="asc-screen-preview-wrapper" class="space-y-8 mx-auto max-w-[1120px]"></div>
      </div>
    `;
  },

  setPrintMode(mode) {
    this.boardState.printMode = mode;
    this.boardState.printTargetId = "ALL";
    this.renderPrintStudioControls();
    this.renderAscPrintPreview();
  },

  setPrintTarget(targetId) {
    this.boardState.printTargetId = targetId;
    this.renderAscPrintPreview();
  },

  renderPrintStudioControls() {
    const select = document.getElementById("select-print-target");
    if (!select) return;
    const s = this.state.currentSession;
    if (this.boardState.printMode === "teacher") {
      const teachers = this.state.teachers.filter(t => t.session_type === "Kedua-dua" || t.session_type === s);
      select.innerHTML = `<option value="ALL">Cetak Semua Guru (${teachers.length})</option>` +
        teachers.map(t => `<option value="${t.id}">Guru: ${this.escapeHtml(t.name)} (${this.escapeHtml(t.short_code)})</option>`).join("");
    } else {
      const classes = this.state.classes.filter(c => c.session_type === s);
      select.innerHTML = `<option value="ALL">Cetak Semua Kelas (${classes.length})</option>` +
        classes.map(c => `<option value="${c.id}">Kelas: ${this.escapeHtml(c.class_name)}</option>`).join("");
    }
    select.value = this.boardState.printTargetId;
  },

  renderAscPrintPreview() {
    const previewWrapper = document.getElementById("asc-screen-preview-wrapper");
    const printArea = document.getElementById("print-area");
    if (!previewWrapper || !printArea) return;

    const s = this.state.currentSession;
    const mode = this.boardState.printMode;
    const targetId = this.boardState.printTargetId;

    const list = mode === "teacher"
      ? this.state.teachers.filter(t => t.session_type === "Kedua-dua" || t.session_type === s)
      : this.state.classes.filter(c => c.session_type === s);

    const entities = targetId === "ALL" ? list : list.filter(x => x.id === targetId);
    if (entities.length === 0) {
      previewWrapper.innerHTML = `<div class="bg-white text-black p-8 rounded-xl text-center">Tiada data untuk dicetak bagi Sesi ${s}.</div>`;
      return;
    }

    const sheets = entities.map((ent, i) => {
      const html = this.buildSingleAscSheetHtml(ent, mode);
      return `<div class="${i === entities.length - 1 ? '' : 'page-break'} bg-white text-black p-6 rounded-xl shadow mb-6">${html}</div>`;
    }).join("");

    previewWrapper.innerHTML = sheets;
    printArea.innerHTML = sheets;
  },

  buildSingleAscSheetHtml(entity, mode) {
    const school = this.state.schoolSettings || {};
    const schoolName = school.school_name || "SEKOLAH KEBANGSAAN MANTIN";
    const session = this.state.currentSession;
    const days = this.getDaysOfWeek();
    const periods = this.getSessionPeriods();
    const sessionSlots = this.state.timetableSlots.filter(s => s.session_type === session);

    const titleRight = mode === "teacher" ? `${entity.name} (${entity.short_code})` : `KELAS ${entity.class_name}`;

    const rowsHtml = days.map(day => {
      const cells = periods.map(p => {
        if (p.is_recess) return `<td style="border:1.5px solid #000; background:#f1f5f9; text-align:center; font-size:10px; font-weight:bold;">REHAT</td>`;
        const matches = sessionSlots.filter(s => s.day_name === day && s.period_number === p.period_number && (mode === "teacher" ? (s.teacher_ids || []).includes(entity.id) : (s.class_ids || []).includes(entity.id)));
        if (matches.length === 0) return `<td style="border:1.5px solid #000; height:48px;"></td>`;
        return `<td style="border:1.5px solid #000; padding:3px; height:48px;">` + matches.map(m => {
          const sub = this.state.subjects.find(x => x.id === m.subject_id);
          const tCodes = (m.teacher_ids || []).map(id => this.state.teachers.find(t => t.id === id)?.short_code || "").join("+");
          const cNames = (m.class_ids || []).map(id => this.state.classes.find(c => c.id === id)?.class_name || "").join("+");
          return `<div style="text-align:center; font-weight:900; font-size:12px;">${this.escapeHtml(sub?.subject_code || "SUB")}</div><div style="display:flex; justify-content:space-between; font-size:9px; font-weight:bold;"><span>${this.escapeHtml(cNames)}</span><span>${this.escapeHtml(tCodes)}</span></div>`;
        }).join("") + `</td>`;
      }).join("");
      return `<tr><td style="border:1.5px solid #000; font-weight:bold; text-align:center; padding:4px; font-size:11px;">${this.escapeHtml(day)}</td>${cells}</tr>`;
    }).join("");

    return `
      <div style="font-family: Arial, sans-serif; color:#000;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #000; padding-bottom:6px; margin-bottom:10px;">
          <div>
            <div style="font-size:14px; font-weight:900;">${this.escapeHtml(schoolName)}</div>
            <div style="font-size:11px;">JADUAL WAKTU RASMI — SESI ${this.escapeHtml(session.toUpperCase())}</div>
          </div>
          <div style="font-size:18px; font-weight:900;">${this.escapeHtml(titleRight)}</div>
        </div>
        <table class="asc-table" style="width:100%; border-collapse:collapse; table-layout:fixed;">
          <thead>
            <tr style="background:#e2e8f0;">
              <th style="border:1.5px solid #000; width:75px; font-size:10px;">HARI / WAKTU</th>
              ${periods.map(p => `<th style="border:1.5px solid #000; font-size:10px; padding:2px;">${this.escapeHtml(p.label)}<br/><span style="font-size:8px; font-weight:normal;">${(p.start_time || "").slice(0,5)}</span></th>`).join("")}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  },

  triggerOfficialPrint() {
    this.renderAscPrintPreview();
    window.print();
  },

  // ==========================================================================
  // 10. UTILITI TOAST & KESELAMATAN HTML
  // ==========================================================================
  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const styles = {
      success: "bg-slate-900 border-emerald-400 text-emerald-300",
      error: "bg-slate-900 border-rose-500 text-rose-300",
      warning: "bg-slate-900 border-amber-400 text-amber-300",
      info: "bg-slate-900 border-cyan-400 text-cyan-300"
    };
    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl border text-xs font-medium shadow-lg ${styles[type] || styles.info}`;
    toast.innerHTML = `<div class="flex-1">${this.escapeHtml(message)}</div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  },

  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};

window.addEventListener("DOMContentLoaded", () => window.App.init());
