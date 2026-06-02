/* ============================================================
   AstroHealth — Adam Lunar Mission (interactive cockpit journey)
   ============================================================ */

/* ---------------- DOM references ---------------- */
const cockpit = document.getElementById("cockpit");
const cockpitBg = document.querySelector(".cockpit-bg");
const aiPanel = document.getElementById("aiPanel");
const aiToggle = document.getElementById("aiToggle");
const phaseTitleEl = document.getElementById("phaseTitle");
const predictionTitle = document.getElementById("predictionTitle");
const warningLevel = document.getElementById("warningLevel");
const statusDot = document.getElementById("statusDot");
const aiRiskLevel = document.getElementById("aiRiskLevel");
const aiProblem = document.getElementById("aiProblem");
const aiReasoning = document.getElementById("aiReasoning");
const aiAction = document.getElementById("aiAction");
const recommendationText = document.getElementById("recommendationText");
const chatbotTitle = document.getElementById("chatbotTitle");
const chatbotText = document.getElementById("chatbotText");
const chatbotPanel = document.getElementById("chatbot");
const radiationAlert = document.getElementById("radiationAlert");
const telemetryChart = document.getElementById("telemetryChart");
const vitalGrid = document.getElementById("vitalGrid");
const bodyZones = Array.from(document.querySelectorAll(".body-zone"));
const bodySimulation = document.querySelector(".body-simulation");

const distanceLabel = document.getElementById("distanceLabel");
const distanceValue = document.getElementById("distanceValue");
const routeProgress = document.getElementById("routeProgress");
const missionOddsEl = document.getElementById("missionOdds");

const narrativeText = document.getElementById("narrativeText");
const logLabel = document.getElementById("logLabel");
const choiceButtons = document.getElementById("choiceButtons");

const windowBgA = document.getElementById("windowBgA");
const windowBgB = document.getElementById("windowBgB");
const spaceCanvas = document.getElementById("spaceCanvas");

const fxFlash = document.getElementById("fxFlash");
const gameOver = document.getElementById("gameOver");
const goCard = document.getElementById("goCard");
const goEyebrow = document.getElementById("goEyebrow");
const goTitle = document.getElementById("goTitle");
const goText = document.getElementById("goText");
const goStats = document.getElementById("goStats");
const goRestart = document.getElementById("goRestart");
const muteToggle = document.getElementById("muteToggle");
const restartBtn = document.getElementById("restartBtn");

/* ---------------- Helpers ---------------- */
const alertLabels = { normal: "Normal", warning: "Warning", serious: "Serious", emergency: "Emergency" };
const alertClassByColor = { green: "normal", yellow: "temporary-warning", orange: "serious-warning", red: "emergency" };
const colorByAlertClass = { "normal": "#41c27a", "temporary-warning": "#d7b342", "serious-warning": "#d9823b", "emergency": "#d84d57" };

function shouldReduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function clampScore(v) { return Math.max(0, Math.min(100, Math.round(v))); }
function getNumericValue(value) {
    const m = String(value || "").match(/-?[\d.]+/);
    return m ? Number(m[0]) : 0;
}
function getAlertClass(s) { return alertClassByColor[s.color_status] || "normal"; }
function getAlertLabel(s) { return alertLabels[s.alert_level] || "Normal"; }
function getBloodPressureScore(value) {
    const [sys, dia] = String(value || "").split("/").map(Number);
    if (!sys || !dia) return 0;
    return clampScore(((100 - Math.abs(sys - 120) * 2) + (100 - Math.abs(dia - 80) * 3)) / 2);
}
function scoreFromWord(status, map, dflt) {
    const s = String(status || "").toLowerCase();
    for (const k in map) { if (s.includes(k)) return map[k]; }
    return dflt;
}
function getExerciseScore(s) {
    return scoreFromWord(s, { complete: 100, rehab: 100, partial: 60, missed: 30, paused: 30, shelter: 30 }, 70);
}
function getMentalScore(s) {
    return scoreFromWord(s, { calm: 100, relieved: 100, focused: 90, ready: 90, curious: 75, alert: 75, isolated: 40, concerned: 40, low: 40, panic: 20 }, 70);
}
function getMetrics(s) {
    const hr = getNumericValue(s.heart_rate), ox = getNumericValue(s.oxygen_level);
    const rad = getNumericValue(s.radiation_level), sl = getNumericValue(s.sleep_hours), bd = getNumericValue(s.bone_density);
    return [
        { label: "Heart Rate", score: clampScore(100 - Math.abs(hr - 72) * 1.4), rawValue: s.heart_rate },
        { label: "Blood Pressure", score: getBloodPressureScore(s.blood_pressure), rawValue: s.blood_pressure },
        { label: "Oxygen", score: clampScore(ox), rawValue: s.oxygen_level },
        { label: "Radiation", score: clampScore(100 - rad * 30), rawValue: s.radiation_level },
        { label: "Sleep", score: clampScore((sl / 8) * 100), rawValue: s.sleep_hours },
        { label: "Bone Density", score: clampScore(bd), rawValue: s.bone_density },
        { label: "Exercise", score: getExerciseScore(s.exercise_status), rawValue: s.exercise_status },
        { label: "Mental", score: getMentalScore(s.mental_status), rawValue: s.mental_status }
    ];
}

/* ---------------- Render: vitals / body / chart / ecg ---------------- */
function renderState(s) {
    const cls = getAlertClass(s), label = getAlertLabel(s);
    if (phaseTitleEl) phaseTitleEl.textContent = s.phase_title;
    if (predictionTitle) predictionTitle.textContent = s.ai_prediction || "Analyzing";
    warningLevel.textContent = label;
    statusDot.className = `status-dot ${cls}`;
    aiRiskLevel.textContent = label;
    aiRiskLevel.className = `risk-badge ${cls}`;
    aiProblem.textContent = s.ai_prediction || "";
    aiReasoning.textContent = s.ai_reasoning || "";
    aiAction.textContent = s.medical_recommendation || "";
    recommendationText.textContent = s.medical_recommendation || "";
    chatbotTitle.textContent = s.mental ? "Support Channel Open" : "Mission Support";
    chatbotText.textContent = s.chatbot_message || "";

    renderVitals(s, cls, label);
    renderBody(s, cls);
    renderChart(s, cls, label);
    updateEcg(s);
}

function renderVitals(s, cls, label) {
    const vitals = [
        ["Heart Rate", s.heart_rate], ["Blood Pressure", s.blood_pressure],
        ["Oxygen", s.oxygen_level], ["Radiation", s.radiation_level],
        ["Sleep", s.sleep_hours], ["Bone Density", s.bone_density],
        ["Exercise", s.exercise_status], ["Mental", s.mental_status]
    ];
    vitalGrid.innerHTML = "";
    vitals.forEach(([lab, val]) => {
        const card = document.createElement("article");
        card.className = "vital-card";
        card.dataset.risk = cls;
        card.innerHTML = `<h3>${lab}</h3><strong>${val}</strong><p></p><span class="risk-badge ${cls}">${label}</span>`;
        vitalGrid.appendChild(card);
    });
    animateVitalNumbers();
}

function animateVitalNumbers() {
    if (shouldReduceMotion()) return;
    Array.from(vitalGrid.querySelectorAll(".vital-card")).forEach((card, i) => {
        card.style.animationDelay = `${i * 40}ms`;
        card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
        const strong = card.querySelector("strong");
        const finalText = strong.textContent;
        const m = finalText.match(/-?\d+(?:\.\d+)?/);
        if (!m) return;
        const target = Number(m[0]);
        const dec = (m[0].split(".")[1] || "").length;
        const pre = finalText.slice(0, m.index), suf = finalText.slice(m.index + m[0].length);
        const start = performance.now(), dur = 800;
        (function step(now) {
            const p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
            strong.textContent = `${pre}${(target * e).toFixed(dec)}${suf}`;
            if (p < 1) requestAnimationFrame(step); else strong.textContent = finalText;
        })(performance.now());
    });
}

function renderBody(s, cls) {
    const zones = s.highlighted_body_zones || [];
    bodyZones.forEach((z) => {
        const part = z.dataset.part;
        const active = zones.includes(part);
        const isMentalHead = s.mental && part === "head" && active;
        z.classList.toggle("active", active);
        z.classList.toggle("normal-part", active && cls === "normal");
        z.classList.toggle("serious-part", active && cls === "serious-warning" && !isMentalHead);
        z.classList.toggle("emergency-part", active && cls === "emergency");
        z.classList.toggle("mental-part", isMentalHead);
    });
    radiationAlert.classList.toggle("active", !!s.radiation);
    chatbotPanel.classList.toggle("active", !!s.mental);
}

function renderChart(s, cls, label) {
    const metrics = getMetrics(s);
    telemetryChart.innerHTML = "";
    metrics.forEach((metric) => {
        const item = document.createElement("div"); item.className = "chart-item";
        const bar = document.createElement("div"); bar.className = "chart-bar"; bar.dataset.risk = cls;
        bar.title = `${metric.label} ${metric.rawValue} — score ${metric.score}`;
        const value = document.createElement("span"); value.className = "chart-value"; value.textContent = metric.score;
        const lab = document.createElement("span"); lab.className = "chart-label"; lab.textContent = metric.label;
        if (shouldReduceMotion()) { bar.style.height = `${metric.score}%`; }
        else { bar.style.height = "0%"; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.height = `${metric.score}%`; })); }
        item.append(value, bar, lab);
        telemetryChart.appendChild(item);
    });
}

/* ---------------- Starfield (window region) ---------------- */
let spaceCtx = null, stars = [], shootingStars = [], spaceMode = "calm", spaceW = 0, spaceH = 0, lastShoot = 0;

function initStarfield() {
    if (!spaceCanvas) return;
    spaceCtx = spaceCanvas.getContext("2d");
    resizeStarfield();
    window.addEventListener("resize", resizeStarfield);
    if (shouldReduceMotion()) drawStarsStatic(); else requestAnimationFrame(starfieldLoop);
}
function resizeStarfield() {
    if (!spaceCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    spaceW = spaceCanvas.clientWidth || 600;
    spaceH = spaceCanvas.clientHeight || 300;
    spaceCanvas.width = spaceW * dpr; spaceCanvas.height = spaceH * dpr;
    spaceCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((spaceW * spaceH) / 5200);
    stars = [];
    for (let i = 0; i < count; i++) stars.push({ x: Math.random() * spaceW, y: Math.random() * spaceH, z: Math.random() * 0.8 + 0.2, r: Math.random() * 1.4 + 0.3, tw: Math.random() * Math.PI * 2 });
    if (shouldReduceMotion()) drawStarsStatic();
}
function spaceTint() {
    if (spaceMode === "radiation") return [216, 109, 117];
    if (spaceMode === "warp") return [158, 208, 245];
    return [226, 232, 240];
}
function starfieldLoop(t) {
    if (!spaceCtx) return;
    spaceCtx.clearRect(0, 0, spaceW, spaceH);
    const speed = spaceMode === "warp" ? 7 : 0.2, tint = spaceTint();
    for (const s of stars) {
        s.tw += 0.04; const a = 0.35 + (Math.sin(s.tw) * 0.5 + 0.5) * 0.5; s.y += speed * s.z;
        if (spaceMode === "warp") {
            spaceCtx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${a})`; spaceCtx.lineWidth = s.r;
            spaceCtx.beginPath(); spaceCtx.moveTo(s.x, s.y); spaceCtx.lineTo(s.x, s.y + 22 * s.z); spaceCtx.stroke();
        } else {
            spaceCtx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${a})`;
            spaceCtx.beginPath(); spaceCtx.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2); spaceCtx.fill();
        }
        if (s.y > spaceH + 24) { s.y = -24; s.x = Math.random() * spaceW; }
    }
    if (spaceMode !== "warp" && t - lastShoot > 2600 && Math.random() < 0.04) {
        lastShoot = t; shootingStars.push({ x: Math.random() * spaceW * 0.7, y: Math.random() * spaceH * 0.4, len: 0, life: 0 });
    }
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const sh = shootingStars[i]; sh.life++; sh.x += 8; sh.y += 4.5; sh.len = Math.min(150, sh.len + 10);
        const a = Math.max(0, 1 - sh.life / 42);
        const g = spaceCtx.createLinearGradient(sh.x, sh.y, sh.x - sh.len, sh.y - sh.len * 0.56);
        g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, "rgba(255,255,255,0)");
        spaceCtx.strokeStyle = g; spaceCtx.lineWidth = 2;
        spaceCtx.beginPath(); spaceCtx.moveTo(sh.x, sh.y); spaceCtx.lineTo(sh.x - sh.len, sh.y - sh.len * 0.56); spaceCtx.stroke();
        if (sh.life > 42) shootingStars.splice(i, 1);
    }
    requestAnimationFrame(starfieldLoop);
}
function drawStarsStatic() {
    if (!spaceCtx) return;
    spaceCtx.clearRect(0, 0, spaceW, spaceH); const tint = spaceTint();
    for (const s of stars) { spaceCtx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},0.6)`; spaceCtx.beginPath(); spaceCtx.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2); spaceCtx.fill(); }
}
function setSpaceMode(mode, radiation) {
    spaceMode = mode || "calm";
    if (bodySimulation) bodySimulation.classList.toggle("aura-on", !!radiation);
    if (shouldReduceMotion()) drawStarsStatic();
}

/* ---------------- ECG ---------------- */
let ecgCtx = null, ecgW = 0, ecgH = 0, ecgBpmValue = 72, ecgColor = "#41c27a", ecgTime = 0, ecgLastTs = 0;
const ecgCanvas = document.getElementById("ecgCanvas");
const ecgBpmLabel = document.getElementById("ecgBpm");
const ecgHeart = document.getElementById("ecgHeart");
function initEcg() {
    if (!ecgCanvas) return;
    ecgCtx = ecgCanvas.getContext("2d"); resizeEcg(); window.addEventListener("resize", resizeEcg);
    if (shouldReduceMotion()) drawEcgStatic(); else requestAnimationFrame(ecgLoop);
}
function resizeEcg() {
    if (!ecgCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ecgW = ecgCanvas.clientWidth || 280; ecgH = ecgCanvas.clientHeight || 60;
    ecgCanvas.width = ecgW * dpr; ecgCanvas.height = ecgH * dpr; ecgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shouldReduceMotion()) drawEcgStatic();
}
function ecgWave(p) {
    if (p < 0.10) return Math.sin((p / 0.10) * Math.PI) * 0.12;
    if (p < 0.17) return 0; if (p < 0.19) return -0.14; if (p < 0.22) return 1.0; if (p < 0.25) return -0.30;
    if (p < 0.44) return 0; if (p < 0.62) return Math.sin(((p - 0.44) / 0.18) * Math.PI) * 0.22; return 0;
}
function renderEcgTrace() {
    ecgCtx.clearRect(0, 0, ecgW, ecgH);
    const beat = 60 / ecgBpmValue, px = 150, mid = ecgH / 2, amp = ecgH * 0.38;
    ecgCtx.beginPath();
    for (let x = 0; x <= ecgW; x++) {
        const tt = ecgTime - (ecgW - x) / px, p = (((tt % beat) + beat) % beat) / beat;
        const y = mid - ecgWave(p) * amp; if (x === 0) ecgCtx.moveTo(x, y); else ecgCtx.lineTo(x, y);
    }
    ecgCtx.strokeStyle = ecgColor; ecgCtx.lineWidth = 2; ecgCtx.shadowColor = ecgColor; ecgCtx.shadowBlur = 8; ecgCtx.stroke(); ecgCtx.shadowBlur = 0;
}
function ecgLoop(ts) {
    if (!ecgCtx) return;
    if (!ecgLastTs) ecgLastTs = ts;
    ecgTime += Math.min(0.05, (ts - ecgLastTs) / 1000); ecgLastTs = ts;
    renderEcgTrace(); requestAnimationFrame(ecgLoop);
}
function drawEcgStatic() { if (ecgCtx) { ecgTime = 2; renderEcgTrace(); } }
function updateEcg(s) {
    const bpm = getNumericValue(s.heart_rate) || 72;
    ecgBpmValue = bpm; ecgColor = colorByAlertClass[getAlertClass(s)] || "#41c27a";
    if (ecgBpmLabel) ecgBpmLabel.textContent = Math.round(bpm);
    if (ecgHeart) { ecgHeart.style.color = ecgColor; ecgHeart.style.animationDuration = `${(60 / bpm).toFixed(2)}s`; }
    if (shouldReduceMotion()) drawEcgStatic();
}

/* ============================================================
   SOUND ENGINE (Web Audio — generated, no external files)
   ============================================================ */
let audioCtx = null, masterGain = null, muted = false, humOsc = null;
let sfxBuffers = {}, engineSource = null, engineGain = null;
const SFX_FILES = { click: "assets/sfx/click.ogg", beep: "assets/sfx/beep.ogg", alarm: "assets/sfx/alarm.ogg", success: "assets/sfx/success.ogg", engine: "assets/sfx/engine.ogg" };

function ensureAudio() {
    if (audioCtx) { if (audioCtx.state === "suspended") audioCtx.resume(); return; }
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain(); masterGain.gain.value = muted ? 0 : 0.6; masterGain.connect(audioCtx.destination);
        startHum();
        loadSfx();
    } catch (e) { audioCtx = null; }
}
function loadSfx() {
    Object.keys(SFX_FILES).forEach((name) => {
        fetch(SFX_FILES[name]).then((r) => r.arrayBuffer()).then((ab) => audioCtx.decodeAudioData(ab))
            .then((buf) => { sfxBuffers[name] = buf; if (name === "engine") startEngineLoop(); })
            .catch(() => {});
    });
}
function playBuffer(name, gain, rate) {
    if (!audioCtx || !sfxBuffers[name]) return false;
    const src = audioCtx.createBufferSource(); src.buffer = sfxBuffers[name];
    if (rate) src.playbackRate.value = rate;
    const g = audioCtx.createGain(); g.gain.value = gain == null ? 0.5 : gain;
    src.connect(g); g.connect(masterGain); src.start();
    return true;
}
function startEngineLoop() {
    if (!audioCtx || engineSource || !sfxBuffers.engine) return;
    engineSource = audioCtx.createBufferSource(); engineSource.buffer = sfxBuffers.engine; engineSource.loop = true;
    const lp = audioCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    engineGain = audioCtx.createGain(); engineGain.gain.value = 0.07;
    engineSource.connect(lp); lp.connect(engineGain); engineGain.connect(masterGain); engineSource.start();
}
function noiseBuffer(dur) {
    const len = Math.floor(audioCtx.sampleRate * dur), buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
}
function tone(freq, dur, type, gain, slideTo, delay) {
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + (delay || 0);
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(masterGain); o.start(t0); o.stop(t0 + dur + 0.05);
}
function startHum() {
    if (!audioCtx || humOsc) return;
    humOsc = audioCtx.createOscillator(); const g = audioCtx.createGain();
    humOsc.type = "sine"; humOsc.frequency.value = 56; g.gain.value = 0.045;
    const lfo = audioCtx.createOscillator(), lg = audioCtx.createGain();
    lfo.frequency.value = 0.15; lg.gain.value = 0.018; lfo.connect(lg); lg.connect(g.gain);
    humOsc.connect(g); g.connect(masterGain); humOsc.start(); lfo.start();
}
// Briefly boost the engine loop (thrust/burn feel)
function engineSurge(peak, dur) {
    if (!engineGain || !audioCtx) return;
    const t = audioCtx.currentTime;
    engineGain.gain.cancelScheduledValues(t);
    engineGain.gain.setValueAtTime(engineGain.gain.value, t);
    engineGain.gain.linearRampToValueAtTime(peak || 0.32, t + 0.25);
    engineGain.gain.linearRampToValueAtTime(0.07, t + (dur || 1.8));
}
const Sound = {
    click() { if (!playBuffer("click", 0.45)) tone(620, 0.07, "square", 0.12); },
    hover() { tone(880, 0.04, "sine", 0.04); },
    select() { if (!playBuffer("beep", 0.4, 1.4)) { tone(720, 0.08, "triangle", 0.18); tone(1080, 0.10, "sine", 0.12, null, 0.05); } },
    alert() { if (!playBuffer("alarm", 0.5)) { tone(440, 0.16, "sawtooth", 0.16); tone(440, 0.16, "sawtooth", 0.16, null, 0.22); } },
    success() { if (!playBuffer("success", 0.6)) [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, "triangle", 0.18, null, i * 0.12)); },
    thrust() { engineSurge(0.34, 1.8); tone(70, 1.4, "sawtooth", 0.18, 120); },
    approach() { engineSurge(0.22, 3.0); tone(80, 3.0, "sine", 0.2, 190); tone(120, 3.0, "sine", 0.09, 240, 0.1); },
    radiation() {
        if (!audioCtx) return;
        for (let i = 0; i < 14; i++) {
            const d = Math.random() * 1.2;
            const s = audioCtx.createBufferSource(); s.buffer = noiseBuffer(0.03);
            const g = audioCtx.createGain(); g.gain.value = 0.12;
            const hp = audioCtx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 3000;
            s.connect(hp); hp.connect(g); g.connect(masterGain); s.start(audioCtx.currentTime + d);
        }
    },
    explosion() {
        if (!audioCtx) return;
        const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer(1.4);
        const lp = audioCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1800, audioCtx.currentTime);
        lp.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 1.2);
        const g = audioCtx.createGain(); g.gain.setValueAtTime(0.7, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.4);
        src.connect(lp); lp.connect(g); g.connect(masterGain); src.start();
        tone(90, 1.2, "sawtooth", 0.5, 28);
    }
};
function setMuted(m) {
    muted = m;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.6;
    if (muteToggle) { muteToggle.setAttribute("aria-pressed", String(muted)); muteToggle.innerHTML = muted ? "&#128263;" : "&#128266;"; }
}

/* ============================================================
   STORY DATA — Earth -> Moon -> Earth, 20+ branching choices
   ============================================================ */
const BASE = {
    phase_id: "", phase_title: "", alert_level: "normal", color_status: "green",
    heart_rate: "78 bpm", blood_pressure: "120/78", oxygen_level: "98%", radiation_level: "0.10 mSv",
    sleep_hours: "7.0 h", bone_density: "100%", exercise_status: "Complete", mental_status: "Calm",
    highlighted_body_zones: ["chest"], mental: false, radiation: false,
    ai_prediction: "", ai_reasoning: "", medical_recommendation: "", chatbot_message: ""
};
function st(o) { return Object.assign({}, BASE, o); }

/* sound keys: thrust, approach, alert, radiation, select */
const NODES = {
    start: {
        title: "Pre-Launch · Launch Pad", frame: "pad", mode: "calm",
        distLabel: "Distance to Moon", dist: "384,400 km", progress: 0, sound: "select",
        narrative: "Adam is strapped in on the pad, rocket fueled and green across the board. Mission: reach the Moon and return safely. Choose the ascent profile, then ignite.",
        state: st({ phase_title: "Pre-Launch", heart_rate: "82 bpm", mental_status: "Focused", ai_prediction: "All systems nominal", ai_reasoning: "Vitals stable, vehicle integrity 100%. A standard ascent keeps cardiac load low.", medical_recommendation: "Begin controlled-breathing protocol before ignition.", chatbot_message: "Ready when you are, Adam. Breathe steady — we launch on your call." }),
        choices: [
            { label: "Standard guided ascent", odds: 96, ai: "Gradual G-load, safest for the heart.", next: "liftoff" },
            { label: "Max-thrust burn (save time)", odds: 64, ai: "Aggressive G-force; spikes heart rate hard.", next: "liftoff_max" },
            { label: "Abort & rescrub launch", odds: 99, ai: "Perfectly safe — but the mission fails today.", next: "ABORT" }
        ]
    },
    liftoff: {
        title: "Ignition · Liftoff", frame: "pad", mode: "calm", shake: true, sound: "thrust",
        distLabel: "Altitude", dist: "Climbing", progress: 3, sound: "thrust",
        narrative: "IGNITION! The engines roar to life and the whole cockpit shakes violently as the rocket tears off the pad and climbs through Max-Q.",
        state: st({ phase_title: "Liftoff", alert_level: "warning", color_status: "yellow", heart_rate: "118 bpm", blood_pressure: "134/86", oxygen_level: "96%", mental_status: "Alert", highlighted_body_zones: ["chest"], ai_prediction: "Ascent G-load rising", ai_reasoning: "Heart rate climbs with G-force during ascent. This is expected — hold steady through the vibration of Max-Q.", medical_recommendation: "Keep strapped in; steady breathing through peak vibration.", chatbot_message: "Here we go, Adam! Shaking is normal — breathe with the rhythm, we're climbing fast." }),
        choices: [
            { label: "Hold steady through Max-Q", odds: 95, ai: "Ride the vibration; safest climb.", next: "tli" },
            { label: "Punch the throttle to clear faster", odds: 78, ai: "Quicker, but harder on the heart.", next: "tli" }
        ]
    },
    liftoff_max: {
        title: "Maximum Thrust Liftoff", frame: "pad", mode: "calm", shake: true, sound: "thrust",
        distLabel: "Altitude", dist: "Climbing fast", progress: 4, sound: "thrust",
        narrative: "Engines scream at full power off the pad. The cockpit shakes brutally, 5G crushes Adam's chest, heart rate rockets to 152. The frame is groaning.",
        state: st({ phase_title: "Max Thrust", alert_level: "serious", color_status: "orange", heart_rate: "152 bpm", blood_pressure: "158/96", oxygen_level: "94%", mental_status: "Alert", highlighted_body_zones: ["chest", "spine"], ai_prediction: "Acute cardiovascular + structural load", ai_reasoning: "G-force and engine stress are both critical. Holding max thrust risks heart failure AND hull failure.", medical_recommendation: "Throttle back immediately to relieve cardiac and structural strain.", chatbot_message: "Adam, this is too much — ease the throttle, your heart can't take 5G for long." }),
        choices: [
            { label: "Throttle back to nominal", odds: 82, ai: "Relieves cardiac & structural strain.", next: "tli" },
            { label: "Hold max thrust to orbit", odds: 22, ai: "Engine + heart overload very likely.", next: "EXPLODE", fail: "You held maximum thrust too long. The engine bell overheated and the vehicle tore itself apart during ascent." }
        ]
    },
    tli: {
        title: "Trans-Lunar Injection", bg: "earth", mode: "calm",
        distLabel: "Distance to Moon", dist: "380,000 km", progress: 8, sound: "select",
        narrative: "Stable in low orbit. Now the big burn toward the Moon. Which trajectory do you commit to?",
        state: st({ phase_title: "Earth Orbit", heart_rate: "88 bpm", mental_status: "Curious", ai_prediction: "Microgravity adaptation beginning", ai_reasoning: "Fluid shift starting. Trajectory choice now defines fuel margin and abort safety.", medical_recommendation: "Hydrate (fluid shift) and pick a fuel-safe trajectory.", chatbot_message: "Free-return is the cautious play — it brings you home automatically if anything goes wrong." }),
        choices: [
            { label: "Direct Hohmann transfer", odds: 90, ai: "Efficient standard route to the Moon.", next: "transit" },
            { label: "Free-return trajectory", odds: 93, ai: "Safest: auto-returns to Earth if aborted.", next: "transit" },
            { label: "Mars gravity-assist detour", odds: 12, ai: "Wildly off-target. Supplies will run out.", next: "mars_detour" },
            { label: "Slingshot around the Sun", odds: 4, ai: "Lethal heat & radiation. Do NOT attempt.", next: "sun_detour" }
        ]
    },
    transit: {
        title: "Cislunar Transit", bg: "space", mode: "calm",
        distLabel: "Distance to Moon", dist: "210,000 km", progress: 25, sound: "alert",
        narrative: "Coasting through deep space. Sensors detect a solar radiation storm directly ahead.",
        state: st({ phase_title: "Deep Space", alert_level: "warning", color_status: "yellow", heart_rate: "84 bpm", radiation_level: "0.6 mSv", sleep_hours: "6.0 h", bone_density: "99.2%", mental_status: "Alert", highlighted_body_zones: ["chest"], ai_prediction: "Incoming radiation front", ai_reasoning: "Radiation rising. The shielded bay protects vital cells; pushing through risks acute exposure.", medical_recommendation: "Move to the shielded bay before the front arrives.", chatbot_message: "Storm ahead, Adam. Get to the shelter — I'll watch your dose levels." }),
        choices: [
            { label: "Shelter in the shielded bay", odds: 92, ai: "Best protection from the radiation front.", next: "midcourse" },
            { label: "Push straight through the storm", odds: 33, ai: "Severe immune & cellular damage risk.", next: "rad_hit" },
            { label: "Reroute around the storm (burn fuel)", odds: 76, ai: "Safe, but leaves you low on fuel later.", next: "midcourse" }
        ]
    },
    mars_detour: {
        title: "Off-Course · Toward Mars", bg: "mars", mode: "calm",
        distLabel: "Distance to Mars", dist: "54.6M km", progress: 18, sound: "alert",
        narrative: "The ship drifts toward Mars. Comms with Earth fade, supplies are not rated for this distance.",
        state: st({ phase_title: "Lost Course", alert_level: "serious", color_status: "orange", heart_rate: "96 bpm", oxygen_level: "95%", sleep_hours: "5.0 h", mental_status: "Concerned", highlighted_body_zones: ["head", "chest"], ai_prediction: "Trajectory error — fatal drift", ai_reasoning: "This path has no supply margin. One correction burn might salvage it; continuing is fatal.", medical_recommendation: "Execute an emergency correction burn back toward the Moon now.", chatbot_message: "Adam, we're way off. Burn back NOW while we still have a sliver of fuel." }),
        choices: [
            { label: "Emergency correction burn back", odds: 30, ai: "Maybe just enough fuel to limp back.", next: "transit" },
            { label: "Continue toward Mars", odds: 3, ai: "No return possible. Certain death.", next: "EXPLODE", fail: "You pressed on toward Mars. Life support ran out millions of kilometres from home." }
        ]
    },
    sun_detour: {
        title: "Falling Toward the Sun", bg: "the_sun", mode: "radiation",
        distLabel: "Distance to Sun", dist: "closing fast", progress: 10, sound: "radiation",
        narrative: "Hull temperature soars. Radiation alarms max out. The Sun fills the entire window.",
        state: st({ phase_title: "Solar Plunge", alert_level: "emergency", color_status: "red", heart_rate: "172 bpm", blood_pressure: "165/100", oxygen_level: "92%", radiation_level: "9.9 mSv", mental_status: "Panic", radiation: true, highlighted_body_zones: ["head", "chest"], ai_prediction: "Lethal solar exposure", ai_reasoning: "Heat and radiation are already beyond survivable limits. There is no good option here.", medical_recommendation: "This trajectory should never have been chosen.", chatbot_message: "Adam... I'm so sorry. The numbers don't work." }),
        choices: [
            { label: "Full reverse burn — escape!", odds: 8, ai: "Almost certainly too late.", next: "EXPLODE", fail: "The ship was incinerated as it fell toward the Sun." },
            { label: "Hold and hope", odds: 1, ai: "Hope is not a flight plan.", next: "EXPLODE", fail: "Radiation overwhelmed every system and Adam was lost to the Sun." }
        ]
    },
    rad_hit: {
        title: "Radiation Exposure", bg: "space", mode: "radiation",
        distLabel: "Distance to Moon", dist: "180,000 km", progress: 30, sound: "radiation",
        narrative: "Adam took a dangerous dose. Cells are damaged, his immune system is crashing.",
        state: st({ phase_title: "Radiation Hit", alert_level: "emergency", color_status: "red", heart_rate: "122 bpm", oxygen_level: "94%", radiation_level: "3.4 mSv", sleep_hours: "4.5 h", bone_density: "98.6%", mental_status: "Concerned", radiation: true, highlighted_body_zones: ["head", "chest"], ai_prediction: "Acute radiation syndrome risk", ai_reasoning: "Immediate antioxidant meds + rest may stabilize him. Ignoring it is fatal.", medical_recommendation: "Administer emergency meds, rest, then reach shelter.", chatbot_message: "Hang on, Adam. Meds now, then rest. I'll guide your recovery." }),
        choices: [
            { label: "Emergency meds + rest, then shelter", odds: 58, ai: "Might stabilize his cell damage.", next: "midcourse" },
            { label: "Ignore it and continue", odds: 12, ai: "Acute radiation sickness — likely fatal.", next: "DEATH", fail: "Untreated radiation sickness overwhelmed Adam's body before reaching the Moon." }
        ]
    },
    midcourse: {
        title: "Mid-Course Correction", bg: "midjourney", mode: "calm",
        distLabel: "Distance to Moon", dist: "90,000 km", progress: 38, sound: "select",
        narrative: "Time to fine-tune the approach vector before the Moon's gravity takes hold.",
        state: st({ phase_title: "Course Correct", heart_rate: "80 bpm", sleep_hours: "6.4 h", bone_density: "98.4%", mental_status: "Ready", ai_prediction: "Stable, on track for the Moon", ai_reasoning: "A precise correction sets up a clean lunar capture. Skipping it saves fuel but adds drift.", medical_recommendation: "Maintain hydration; bone density is slowly declining — keep up resistance work.", chatbot_message: "Looking good, Adam. A clean correction now makes the Moon approach easy." }),
        choices: [
            { label: "Precise correction burn", odds: 94, ai: "Sets up a clean lunar capture.", next: "moon_approach" },
            { label: "Skip correction (save fuel)", odds: 70, ai: "Adds drift; approach gets trickier.", next: "moon_approach" }
        ]
    },
    moon_approach: {
        title: "Lunar Approach", bg: "moon", mode: "calm", approach: true,
        distLabel: "Distance to Moon", dist: "8,000 km", progress: 45, sound: "approach",
        narrative: "The Moon swells in the window with Earth hanging behind it. Choose how you arrive.",
        state: st({ phase_title: "Moon Approach", heart_rate: "92 bpm", mental_status: "Alert", highlighted_body_zones: ["chest"], ai_prediction: "Lunar capture window open", ai_reasoning: "Orbit insertion is controlled and safe. A direct descent or flyby capture are far riskier.", medical_recommendation: "Brace for insertion burn; watch for orientation vertigo.", chatbot_message: "There she is, Adam — the Moon. Let's slip into orbit nice and easy." }),
        choices: [
            { label: "Standard lunar orbit insertion", odds: 95, ai: "Controlled and safe capture.", next: "lunar_orbit" },
            { label: "Direct powered descent (skip orbit)", odds: 55, ai: "Steep, fast, little margin for error.", next: "descent_risky" },
            { label: "High-speed flyby capture", odds: 38, ai: "Too fast — high crash risk.", next: "EXPLODE", fail: "You came in too hot. The capture failed and the ship smashed into the lunar surface." }
        ]
    },
    lunar_orbit: {
        title: "Lunar Orbit", bg: "moon", mode: "calm",
        distLabel: "Lunar Orbit", dist: "100 km altitude", progress: 50, sound: "select",
        narrative: "Stable orbit achieved around the Moon. The grey surface scrolls beneath you.",
        state: st({ phase_title: "Lunar Orbit", heart_rate: "84 bpm", bone_density: "98.0%", mental_status: "Curious", ai_prediction: "Stable lunar orbit", ai_reasoning: "Descending fulfills the mission. Surveying from orbit is safer but skips the landing.", medical_recommendation: "Pre-landing leg conditioning recommended (low-gravity readiness).", chatbot_message: "We made it to lunar orbit, Adam. Want to make history and land?" }),
        choices: [
            { label: "Descend to the surface", odds: 88, ai: "Fulfills the mission objective.", next: "moon_landing" },
            { label: "Survey from orbit, then head home", odds: 97, ai: "Very safe, but no landing.", next: "tei" }
        ]
    },
    descent_risky: {
        title: "Hard Descent", bg: "moon", mode: "calm",
        distLabel: "Descent", dist: "12 km altitude", progress: 48, sound: "thrust",
        narrative: "Skipping orbit makes the descent steep and fast. Surface rushing up.",
        state: st({ phase_title: "Hard Descent", alert_level: "serious", color_status: "orange", heart_rate: "134 bpm", blood_pressure: "140/90", mental_status: "Alert", highlighted_body_zones: ["spine", "legs"], ai_prediction: "High-velocity descent", ai_reasoning: "Aborting back to orbit is safest. Forcing the landing is risky; full throttle down is near-suicidal.", medical_recommendation: "Brace legs and spine for hard impact loads.", chatbot_message: "Too fast, Adam! Abort to orbit if you can — or feather it down carefully." }),
        choices: [
            { label: "Abort back to orbit", odds: 80, ai: "Resets to a safe approach.", next: "lunar_orbit" },
            { label: "Feather the landing carefully", odds: 45, ai: "Possible, but tight margins.", next: "moon_landing" },
            { label: "Full throttle straight down", odds: 18, ai: "Almost certain crash.", next: "EXPLODE", fail: "Full throttle into the surface — the lander disintegrated on the regolith." }
        ]
    },
    moon_landing: {
        title: "Lunar Surface · DESTINATION", frame: "moon", mode: "calm",
        distLabel: "On the Moon", dist: "Surface", progress: 55, sound: "success",
        narrative: "TOUCHDOWN. Adam steps onto the Moon and plants the flag. Now — the journey home begins.",
        state: st({ phase_title: "On the Moon", heart_rate: "90 bpm", bone_density: "97.6%", exercise_status: "Partial", mental_status: "Relieved", ai_prediction: "Objective achieved — prepare return", ai_reasoning: "Low gravity is unloading the skeleton. Prep ascent efficiently; over-long EVA adds fatigue.", medical_recommendation: "Limit EVA time, then begin ascent prep and rest cycle.", chatbot_message: "You're on the MOON, Adam! Incredible. Let's prep the climb home." }),
        choices: [
            { label: "Plant flag, grab samples, prep ascent", odds: 96, ai: "Efficient and well-rested.", next: "tei" },
            { label: "Extended EVA (more science, more fatigue)", odds: 72, ai: "Great data, but tired and depleted.", next: "tei_tired" }
        ]
    },
    tei: {
        title: "Trans-Earth Injection", bg: "moon", mode: "calm",
        distLabel: "Distance to Earth", dist: "384,000 km", progress: 60, sound: "thrust",
        narrative: "Lifting off the Moon and burning for home. Earth is a tiny blue dot ahead.",
        state: st({ phase_title: "Leaving the Moon", heart_rate: "96 bpm", bone_density: "97.2%", mental_status: "Ready", highlighted_body_zones: ["spine"], ai_prediction: "Homebound burn", ai_reasoning: "A nominal burn is safe. Always confirm fuel before committing — burning blind is fatal.", medical_recommendation: "Secure restraints; expect renewed G-load on the burn.", chatbot_message: "Homeward bound, Adam. Confirm fuel, then we burn for Earth." }),
        choices: [
            { label: "Nominal ascent + burn", odds: 94, ai: "Balanced and safe.", next: "return_transit" },
            { label: "Fast burn (rush home)", odds: 66, ai: "Quicker, but stresses the heart.", next: "return_transit" },
            { label: "Burn before the fuel check", odds: 20, ai: "Could run dry mid-burn.", next: "EXPLODE", fail: "You burned before confirming fuel. The engine cut out mid-burn, stranding the ship in lunar space." }
        ]
    },
    tei_tired: {
        title: "Trans-Earth Injection (Fatigued)", bg: "moon", mode: "calm",
        distLabel: "Distance to Earth", dist: "384,000 km", progress: 60, sound: "thrust",
        narrative: "Exhausted from the long EVA, Adam burns for home. His margins are thinner now.",
        state: st({ phase_title: "Leaving the Moon", alert_level: "warning", color_status: "yellow", heart_rate: "104 bpm", sleep_hours: "4.0 h", bone_density: "97.0%", exercise_status: "Missed", mental_status: "Low drive", highlighted_body_zones: ["spine", "legs"], ai_prediction: "Fatigue-impaired return burn", ai_reasoning: "Tired reflexes raise risk. A careful nominal burn is essential; rushing is dangerous.", medical_recommendation: "Strict rest after burn; rehydrate and refuel calories.", chatbot_message: "You're running on empty, Adam. Slow, careful burn — I've got the numbers." }),
        choices: [
            { label: "Careful nominal burn", odds: 85, ai: "Compensates for fatigue.", next: "return_transit" },
            { label: "Power through fast", odds: 48, ai: "Fatigue + speed is a bad mix.", next: "return_transit" }
        ]
    },
    return_transit: {
        title: "Return Transit", bg: "midjourney", mode: "calm",
        distLabel: "Distance to Earth", dist: "120,000 km", progress: 78, sound: "select",
        narrative: "Coasting back toward the growing blue dot of Earth. Reentry looms.",
        state: st({ phase_title: "Returning Home", heart_rate: "88 bpm", sleep_hours: "6.0 h", bone_density: "96.8%", mental_status: "Ready", ai_prediction: "On course for reentry", ai_reasoning: "Conserving and aligning gives the cleanest reentry setup. Speeding up tightens the corridor.", medical_recommendation: "Begin fluid loading to fight landing blood-pooling.", chatbot_message: "Almost home, Adam. Load up on fluids — reentry hits the body hard." }),
        choices: [
            { label: "Conserve & align for reentry", odds: 95, ai: "Cleanest reentry setup.", next: "reentry" },
            { label: "Speed up the reentry window", odds: 62, ai: "Tighter corridor, less reaction time.", next: "reentry" }
        ]
    },
    reentry: {
        title: "Reentry · Final Decision", bg: "earth", mode: "warp", approach: true,
        distLabel: "Distance to Earth", dist: "Atmosphere", progress: 92, sound: "approach",
        narrative: "The most dangerous moment. The reentry corridor is razor-thin. Choose your angle.",
        state: st({ phase_title: "Reentry", alert_level: "serious", color_status: "orange", heart_rate: "112 bpm", blood_pressure: "138/88", mental_status: "Alert", highlighted_body_zones: ["spine", "legs"], ai_prediction: "Critical reentry window", ai_reasoning: "6.5° is the survivable corridor. Too steep burns up; too shallow skips off into deep space.", medical_recommendation: "Optimal angle only. Brace for peak G-load and blood pooling.", chatbot_message: "This is it, Adam. 6.5 degrees — not a fraction more or less. Trust the numbers." }),
        choices: [
            { label: "Optimal 6.5° corridor", odds: 93, ai: "The survivable angle.", next: "WIN" },
            { label: "Steep 10° (fast & hard)", odds: 16, ai: "The capsule will overheat.", next: "EXPLODE", fail: "Too steep. The capsule overheated and burned up in the atmosphere." },
            { label: "Shallow 3° (gentle)", odds: 22, ai: "You'll skip off the atmosphere.", next: "DEATH", fail: "Too shallow. The capsule skipped off the atmosphere and tumbled into deep space, unrecoverable." }
        ]
    }
};

/* ============================================================
   STORY ENGINE
   ============================================================ */
let currentNodeId = "start";
let missionOdds = 100;
let decisionsTaken = 0;
let activeWin = "A";
let gameEnded = false;

function setWindowScene(bgKey, approach) {
    const incoming = activeWin === "A" ? windowBgB : windowBgA;
    const outgoing = activeWin === "A" ? windowBgA : windowBgB;
    incoming.style.backgroundImage = `url("assets/space/${bgKey}.jpg")`;
    incoming.classList.remove("approach");
    void incoming.offsetWidth;
    incoming.classList.add("show");
    outgoing.classList.remove("show");
    if (approach && !shouldReduceMotion()) {
        incoming.classList.add("approach");
    }
    activeWin = activeWin === "A" ? "B" : "A";
}

const FRAMES = {
    space: "assets/cockpit.png",
    pad: "assets/frame_pad.jpg",
    moon: "assets/frame_moon.jpg"
};

function setCockpitFrame(frameKey) {
    const key = frameKey || "space";
    if (cockpitBg) cockpitBg.style.backgroundImage = `url("${FRAMES[key] || FRAMES.space}")`;
    cockpit.classList.toggle("full-scene", key !== "space");
}

function goToNode(id) {
    const node = NODES[id];
    if (!node) return;
    currentNodeId = id;

    const frame = node.frame || "space";
    setCockpitFrame(frame);
    if (frame === "space") {
        setWindowScene(node.bg, node.approach);
    }

    // launch shake
    cockpit.classList.toggle("launch-shake", !!node.shake && !shouldReduceMotion());

    setSpaceMode(node.mode, node.state.radiation);
    renderState(node.state);

    distanceLabel.textContent = node.distLabel || "Distance";
    distanceValue.textContent = node.dist || "";
    routeProgress.style.width = `${node.progress || 0}%`;
    updateOddsDisplay();

    narrativeText.textContent = node.narrative;
    logLabel.textContent = `Flight Log · Decision ${decisionsTaken + 1}`;
    renderChoices(node);

    if (node.sound && Sound[node.sound]) Sound[node.sound]();
}

function updateOddsDisplay() {
    missionOddsEl.textContent = `${missionOdds}%`;
    missionOddsEl.className = missionOdds >= 75 ? "odds-good" : missionOdds >= 45 ? "odds-mid" : "odds-bad";
}

function renderChoices(node) {
    choiceButtons.innerHTML = "";
    // AI recommends the safest MISSION-ADVANCING choice (not a safe abort/dead end)
    const terminalBad = ["ABORT", "EXPLODE", "DEATH"];
    const advancing = node.choices.filter((c) => !terminalBad.includes(c.next));
    const pool = advancing.length ? advancing : node.choices;
    const best = pool.reduce((a, b) => (b.odds > a.odds ? b : a), pool[0]);
    node.choices.forEach((choice) => {
        const oddsCls = choice.odds >= 75 ? "odds-good" : choice.odds >= 45 ? "odds-mid" : "odds-bad";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice-btn";
        if (choice === best) btn.classList.add("recommended");
        btn.innerHTML = `
            <span class="choice-main">
                <span class="choice-label">${choice.label}${choice === best ? ' <em class="rec-tag">AI PICK</em>' : ""}</span>
                <span class="choice-ai">${choice.ai}</span>
            </span>
            <span class="choice-odds ${oddsCls}">
                <span class="odds-num">${choice.odds}%</span>
                <span class="odds-bar"><i style="width:${choice.odds}%"></i></span>
                <span class="odds-cap">survival</span>
            </span>`;
        btn.addEventListener("mouseenter", () => { ensureAudio(); Sound.hover(); });
        btn.addEventListener("click", () => onChoose(choice));
        choiceButtons.appendChild(btn);
    });
}

function onChoose(choice) {
    if (gameEnded) return;
    ensureAudio();
    Sound.click();
    decisionsTaken++;
    const result = choice.next;

    if (result === "EXPLODE") { endMission("explode", choice.fail); return; }
    if (result === "DEATH") { endMission("death", choice.fail); return; }
    if (result === "ABORT") { endMission("abort", "You aborted the launch. Adam is safe on the ground, but the Moon will have to wait."); return; }
    if (result === "WIN") { endMission("win", "Splashdown! The capsule hits the ocean and the recovery team opens the hatch. Adam walks out on his own two feet."); return; }

    // apply cumulative survival probability
    missionOdds = Math.max(1, Math.round(missionOdds * (choice.odds / 100)));
    goToNode(result);
}

function endMission(type, message) {
    gameEnded = true;
    choiceButtons.innerHTML = "";

    if (type === "explode" || type === "death") {
        ensureAudio();
        if (type === "explode") Sound.explosion(); else Sound.alert();
        triggerExplosionFx(type === "explode");
        setTimeout(() => showGameOver(type, message), type === "explode" ? 1100 : 700);
    } else {
        if (type === "win") Sound.success(); else Sound.alert();
        showGameOver(type, message);
    }
}

function triggerExplosionFx(big) {
    fxFlash.classList.remove("boom", "warn");
    void fxFlash.offsetWidth;
    fxFlash.classList.add(big ? "boom" : "warn");
    if (!shouldReduceMotion()) {
        cockpit.classList.add("shake");
        setTimeout(() => cockpit.classList.remove("shake"), 900);
    }
}

function showGameOver(type, message) {
    const titles = { explode: "Mission Lost", death: "Mission Lost", abort: "Mission Aborted", win: "Mission Complete" };
    const eyebrows = { explode: "Catastrophic Failure", death: "Medical Failure", abort: "Aborted Safely", win: "Splashdown Confirmed" };
    goCard.dataset.type = type;
    goTitle.textContent = titles[type] || "Mission Over";
    goEyebrow.textContent = eyebrows[type] || "Mission Report";
    goText.textContent = message || "";
    goStats.innerHTML = `
        <div><span>Decisions Made</span><strong>${decisionsTaken}</strong></div>
        <div><span>Final Success Odds</span><strong>${type === "win" ? missionOdds + "%" : "0%"}</strong></div>
        <div><span>Outcome</span><strong>${type === "win" ? "Adam survived" : type === "abort" ? "Safe, incomplete" : "Adam lost"}</strong></div>`;
    gameOver.hidden = false;
    requestAnimationFrame(() => gameOver.classList.add("show"));
}

function restartMission() {
    gameEnded = false;
    missionOdds = 100;
    decisionsTaken = 0;
    gameOver.classList.remove("show");
    fxFlash.classList.remove("boom", "warn");
    setTimeout(() => { gameOver.hidden = true; }, 300);
    goToNode("start");
}

/* ============================================================
   EXPLAINER MODE — the original 9 educational mission phases
   ============================================================ */
const decisionConsole = document.getElementById("decisionConsole");
const phaseDeck = document.getElementById("phaseDeck");
const phaseButtons = document.getElementById("phaseButtons");
const modeToggle = document.getElementById("modeToggle");

const EDU = [
    { title: "Earth Baseline", bg: "earth", mode: "calm", state: st({ phase_title: "Earth Baseline", heart_rate: "72 bpm", mental_status: "Calm", ai_prediction: "No active medical concern", ai_reasoning: "On Earth before the trip, the AI records Adam's healthy baseline (pulse, sleep, speech) as a fixed reference to compare against later.", medical_recommendation: "Continue baseline logging, hydration, and pre-mission conditioning.", chatbot_message: "Baseline readings are stable, Adam. Keep following the checklist." }) },
    { title: "Pre-Launch Check", bg: "earth", mode: "calm", state: st({ phase_title: "Pre-Launch Check", alert_level: "warning", color_status: "yellow", heart_rate: "94 bpm", blood_pressure: "128/82", sleep_hours: "6.4 h", mental_status: "Focused", ai_prediction: "Mild pre-launch stress", ai_reasoning: "Suit sensors are verified and the server confirms Adam's heart signal reaches the dashboard before liftoff.", medical_recommendation: "Use controlled breathing; verify every biometric sensor.", chatbot_message: "Pre-launch nerves are normal. Try a 60-second breathing cycle." }) },
    { title: "Launch Stress", bg: "earth", mode: "warp", state: st({ phase_title: "Launch Stress", alert_level: "serious", color_status: "orange", heart_rate: "132 bpm", blood_pressure: "146/92", oxygen_level: "95%", mental_status: "Alert", highlighted_body_zones: ["chest", "spine"], ai_prediction: "Acute cardiovascular load during launch", ai_reasoning: "G-force pushes the pulse to ~130. The AI understands this is normal launch tension and does NOT fire a false cardiac alarm.", medical_recommendation: "Stay strapped in; follow the crew breathing rhythm.", chatbot_message: "High heart rate is from launch stress, Adam — breathe with me." }) },
    { title: "Zero Gravity", bg: "space", mode: "calm", state: st({ phase_title: "Zero Gravity", alert_level: "warning", color_status: "yellow", heart_rate: "86 bpm", radiation_level: "0.32 mSv", bone_density: "99.1%", mental_status: "Curious", highlighted_body_zones: ["head", "chest"], ai_prediction: "Fluid shift in microgravity", ai_reasoning: "Body fluids rush to the head/chest (Fluid Shift), raising eye pressure and dizziness. The AI senses the blood-pressure change via the sensors.", medical_recommendation: "Drink 500 ml of water + salts to rebalance fluid pressure.", chatbot_message: "Your body is adapting to zero-G. Drink water now to balance the fluid shift." }) },
    { title: "Exercise Neglect", bg: "space", mode: "calm", state: st({ phase_title: "Exercise Neglect", alert_level: "serious", color_status: "orange", heart_rate: "78 bpm", bone_density: "96.4%", exercise_status: "Missed", mental_status: "Low drive", highlighted_body_zones: ["pelvis", "legs"], ai_prediction: "Predictive bone-density loss risk", ai_reasoning: "Microgravity dissolves calcium. The prediction algorithm forecasts a ~1% pelvic bone-density drop and fires a red Predictive Alert.", medical_recommendation: "Resume resistance training today; load the legs and pelvis.", chatbot_message: "Your exercise streak dropped, Adam — let's do a short resistance session." }) },
    { title: "Solar Radiation Storm", bg: "the_sun", mode: "radiation", state: st({ phase_title: "Solar Radiation Storm", alert_level: "emergency", color_status: "red", heart_rate: "118 bpm", radiation_level: "2.80 mSv", sleep_hours: "4.9 h", mental_status: "Concerned", radiation: true, highlighted_body_zones: ["head", "chest"], ai_prediction: "Acute radiation exposure", ai_reasoning: "A solar storm threatens cell and immune damage. The AI computes cumulative dose and orders Adam into the storm shelter.", medical_recommendation: "Go to the shelter; follow the antioxidant + vitamin-D/omega-3 plan.", chatbot_message: "Radiation alert — get to the shielded room now and confirm when secured." }) },
    { title: "Mental Health Isolation", bg: "space", mode: "calm", state: st({ phase_title: "Mental Health Isolation", alert_level: "serious", color_status: "orange", heart_rate: "88 bpm", sleep_hours: "4.7 h", mental_status: "Isolated", mental: true, highlighted_body_zones: ["head"], ai_prediction: "Isolation stress & low mood", ai_reasoning: "The offline psychological chatbot reads Adam's written words, detects a depressed tone, and can escalate to NASA if his state worsens.", medical_recommendation: "Open a private support chat; schedule a family call; restore sleep.", chatbot_message: "I'm here with you, Adam. You're not alone. Breathe with me — let's warm the cabin lights and play rain sounds from Earth." }) },
    { title: "Landing Preparation", bg: "earth", mode: "calm", state: st({ phase_title: "Landing Preparation", alert_level: "warning", color_status: "yellow", heart_rate: "102 bpm", blood_pressure: "130/84", bone_density: "95.7%", mental_status: "Ready", highlighted_body_zones: ["spine", "legs"], ai_prediction: "Landing balance & blood-pooling risk", ai_reasoning: "Returning gravity pulls fluids to the legs (Blood Pooling). The AI reviews Adam's whole medical history to predict fracture/fainting risk.", medical_recommendation: "Increase salt + fluids; set the precise capsule seat angle for impact.", chatbot_message: "Landing prep active. Load up on fluids and brace for re-entry G-load." }) },
    { title: "Rehabilitation", bg: "earth", mode: "calm", state: st({ phase_title: "Rehabilitation", heart_rate: "80 bpm", bone_density: "96.8%", exercise_status: "Rehab", mental_status: "Relieved", highlighted_body_zones: ["pelvis", "legs"], ai_prediction: "Post-mission recovery on track", ai_reasoning: "Adam walks out on his own — thanks to early AI interventions he lost only 5% bone instead of 15%. The full medical file exports to Earth's doctors.", medical_recommendation: "Continue physiotherapy; repeat bone-density scans; track mood.", chatbot_message: "Welcome home, Adam. Your recovery is ahead of schedule — let's keep rehab steady." }) }
];

let mode = "journey";
let eduIndex = 0;

function buildPhaseButtons() {
    if (phaseButtons.childElementCount) return;
    EDU.forEach((e, i) => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = e.title;
        b.addEventListener("click", () => { ensureAudio(); Sound.click(); showEduPhase(i); });
        phaseButtons.appendChild(b);
    });
}

function showEduPhase(i) {
    eduIndex = i;
    const e = EDU[i];
    setWindowScene(e.bg, false);
    setSpaceMode(e.mode, e.state.radiation);
    renderState(e.state);
    distanceLabel.textContent = `Phase ${i + 1} / 9`;
    distanceValue.textContent = e.title;
    routeProgress.style.width = `${((i + 1) / 9) * 100}%`;
    missionOddsEl.textContent = "Tutorial";
    missionOddsEl.className = "odds-good";
    Array.from(phaseButtons.children).forEach((b, idx) => b.classList.toggle("active", idx === i));
}

function setMode(m) {
    mode = m;
    if (m === "explain") {
        buildPhaseButtons();
        gameOver.hidden = true; gameOver.classList.remove("show");
        decisionConsole.hidden = true;
        phaseDeck.hidden = false;
        modeToggle.innerHTML = "🚀 Journey";
        modeToggle.classList.add("explainer-active");
        showEduPhase(eduIndex);
    } else {
        phaseDeck.hidden = true;
        decisionConsole.hidden = false;
        modeToggle.innerHTML = "📚 Explainer";
        modeToggle.classList.remove("explainer-active");
        if (gameEnded) { restartMission(); } else { goToNode(currentNodeId); }
    }
}

/* ---------------- Wire controls ---------------- */
goRestart.addEventListener("click", () => { ensureAudio(); Sound.select(); restartMission(); });
restartBtn.addEventListener("click", () => {
    ensureAudio(); Sound.click();
    if (mode === "explain") showEduPhase(0); else restartMission();
});
muteToggle.addEventListener("click", () => { ensureAudio(); setMuted(!muted); if (!muted) Sound.click(); });
modeToggle.addEventListener("click", () => { ensureAudio(); Sound.select(); setMode(mode === "journey" ? "explain" : "journey"); });

let aiVisible = false;
function setAiVisible(v) {
    aiVisible = v;
    aiPanel.hidden = !v;
    aiToggle.classList.toggle("ai-active", v);
    aiToggle.setAttribute("aria-pressed", String(v));
}
aiToggle.addEventListener("click", () => { ensureAudio(); Sound.click(); setAiVisible(!aiVisible); });

document.addEventListener("click", () => ensureAudio(), { once: true });

/* ---------------- Intro screen ---------------- */
const intro = document.getElementById("intro");
const startMissionBtn = document.getElementById("startMissionBtn");
const introVideo = document.getElementById("introVideo");

function beginMission() {
    ensureAudio();
    Sound.select();
    intro.classList.add("hide");
    window.setTimeout(() => {
        intro.style.display = "none";
        if (introVideo) { try { introVideo.pause(); } catch (e) {} }
    }, 760);
    goToNode("start");
}
if (startMissionBtn) startMissionBtn.addEventListener("click", beginMission);

/* ---------------- Boot ---------------- */
initStarfield();
initEcg();
goToNode("start");
