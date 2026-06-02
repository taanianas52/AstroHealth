const phases = {
    launch_stress: {
        title: "Launch Stress",
        level: "Serious",
        theme: "launch",
        zones: ["chest", "spine"],
        bodyHint: "Chest and spine load detected",
        warning: "Acute cardiovascular load during launch.",
        reasoning: "Heart rate and blood pressure are elevated while the cabin is under launch vibration.",
        recommendation: "Keep Adam seated and secured. Coach slow breathing: inhale four seconds, exhale six seconds.",
        vitals: {
            "Heart Rate": "132 bpm",
            "Blood Pressure": "146/92",
            "Oxygen": "95%",
            "Radiation": "0.14 mSv",
            "Sleep": "5.8 h",
            "Bone Density": "99.8%"
        }
    },
    zero_gravity: {
        title: "Zero Gravity",
        level: "Warning",
        theme: "zero-g",
        zones: ["spine", "legs"],
        bodyHint: "Fluid shift and skeletal unloading",
        warning: "Microgravity adaptation in progress.",
        reasoning: "Early skeletal unloading and sleep drift are visible in the medical telemetry.",
        recommendation: "Start resistance exercise, hydrate, and monitor balance, nausea, and spinal comfort.",
        vitals: {
            "Heart Rate": "86 bpm",
            "Blood Pressure": "112/70",
            "Oxygen": "97%",
            "Radiation": "0.32 mSv",
            "Sleep": "6.1 h",
            "Bone Density": "99.1%"
        }
    },
    exercise_neglect: {
        title: "Exercise Neglect",
        level: "Serious",
        theme: "bone",
        zones: ["pelvis", "legs"],
        bodyHint: "Pelvis and legs at risk",
        warning: "Bone-density loss risk in pelvis and legs.",
        reasoning: "Exercise countermeasures were missed while bone density is trending down.",
        recommendation: "Resume lower-body resistance training and schedule a bone-density trend review.",
        vitals: {
            "Heart Rate": "78 bpm",
            "Blood Pressure": "116/74",
            "Oxygen": "97%",
            "Radiation": "0.36 mSv",
            "Sleep": "6.8 h",
            "Bone Density": "96.4%"
        }
    },
    solar_radiation_storm: {
        title: "Solar Radiation Storm",
        level: "Emergency",
        theme: "emergency",
        zones: ["head", "chest"],
        bodyHint: "Radiation exposure risk",
        warning: "Acute radiation exposure risk.",
        reasoning: "Radiation has exceeded the emergency threshold and stress markers are rising.",
        recommendation: "Move to the shielded area now. Pause nonessential tasks and monitor nausea, headache, and fatigue.",
        vitals: {
            "Heart Rate": "118 bpm",
            "Blood Pressure": "136/86",
            "Oxygen": "96%",
            "Radiation": "2.80 mSv",
            "Sleep": "4.9 h",
            "Bone Density": "96.2%"
        }
    },
    mental_health_isolation: {
        title: "Mental Health Isolation",
        level: "Serious",
        theme: "isolation",
        zones: ["head"],
        bodyHint: "Psychological support active",
        warning: "Isolation stress with poor sleep.",
        reasoning: "Mental status, sleep loss, and motivation markers suggest psychological fatigue.",
        recommendation: "Open a private support channel, schedule a family message window, and reduce noncritical workload.",
        vitals: {
            "Heart Rate": "88 bpm",
            "Blood Pressure": "124/80",
            "Oxygen": "97%",
            "Radiation": "0.42 mSv",
            "Sleep": "4.7 h",
            "Mental": "Isolated"
        }
    },
    landing_preparation: {
        title: "Landing Preparation",
        level: "Warning",
        theme: "landing",
        zones: ["spine", "legs"],
        bodyHint: "Spine and legs under re-entry load",
        warning: "Landing-related balance and lower-body weakness risk.",
        reasoning: "Reduced bone density and re-entry loading increase spinal and lower-body risk.",
        recommendation: "Continue lower-body conditioning, monitor hydration, and prepare assisted standing after return.",
        vitals: {
            "Heart Rate": "102 bpm",
            "Blood Pressure": "130/84",
            "Oxygen": "97%",
            "Radiation": "0.30 mSv",
            "Sleep": "6.0 h",
            "Bone Density": "95.7%"
        }
    }
};

const canvas = document.getElementById("spaceScene");
const context = canvas.getContext("2d");
const threeContainer = document.getElementById("threeScene");
const demo = document.getElementById("helmetDemo");
const phaseButtons = document.getElementById("phaseButtons");
const phaseTitle = document.getElementById("phaseTitle");
const phaseLevel = document.getElementById("phaseLevel");
const vitals = document.getElementById("vitals");
const aiWarning = document.getElementById("aiWarning");
const aiReasoning = document.getElementById("aiReasoning");
const recommendation = document.getElementById("recommendation");
const bodyHint = document.getElementById("bodyHint");
const safeModeToggle = document.getElementById("safeModeToggle");
const bodyZones = Array.from(document.querySelectorAll(".body-zone"));

let activePhaseId = "launch_stress";
let stars = [];
let particles = [];
let frame = 0;
let safeMode = false;
let threeRuntime = null;

const threeCdnUrl = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
const phaseThemeClasses = ["launch", "zero-g", "bone", "emergency", "isolation", "landing"];

function resizeCanvas() {
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * scale);
    canvas.height = Math.floor(window.innerHeight * scale);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    buildStars();
    resizeThreeScene();
}

function loadThreeJs() {
    if (window.THREE) {
        return Promise.resolve(window.THREE);
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = threeCdnUrl;
        script.async = true;
        script.onload = () => resolve(window.THREE);
        script.onerror = () => reject(new Error("Three.js could not be loaded."));
        document.head.appendChild(script);
    });
}

function initThreeScene(THREE) {
    if (threeRuntime || !THREE || safeMode) {
        return;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02060d, 0.028);

    const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 1200);
    camera.position.set(0, 0.55, 8.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    threeContainer.appendChild(renderer.domElement);

    const cockpit = new THREE.Group();
    scene.add(cockpit);

    const panelMaterial = new THREE.MeshBasicMaterial({
        color: 0x07101b,
        transparent: true,
        opacity: 0.86,
        side: THREE.DoubleSide
    });
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x3f6f91, transparent: true, opacity: 0.62 });

    addPanel(THREE, cockpit, [-6.2, -0.35, 1.05], [0, Math.PI / 2.75, 0.05], [5.7, 5.8], panelMaterial, edgeMaterial);
    addPanel(THREE, cockpit, [6.2, -0.35, 1.05], [0, -Math.PI / 2.75, -0.05], [5.7, 5.8], panelMaterial, edgeMaterial);
    addPanel(THREE, cockpit, [0, -2.55, 1.55], [Math.PI / 2.4, 0, 0], [10.8, 4.1], panelMaterial, edgeMaterial);

    const frameMaterial = new THREE.MeshBasicMaterial({ color: 0x0b1724, transparent: true, opacity: 0.92 });
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x6aa6d9, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
    const windowGlow = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 3.85), glowMaterial);
    windowGlow.position.set(0, 1.42, -3.35);
    cockpit.add(windowGlow);

    addFrameBar(THREE, cockpit, [0, 3.45, -3.22], [9.5, 0.18, 0.22], frameMaterial);
    addFrameBar(THREE, cockpit, [0, -0.62, -3.22], [9.5, 0.18, 0.22], frameMaterial);
    addFrameBar(THREE, cockpit, [-4.82, 1.36, -3.22], [0.18, 4.2, 0.22], frameMaterial);
    addFrameBar(THREE, cockpit, [4.82, 1.36, -3.22], [0.18, 4.2, 0.22], frameMaterial);
    addFrameBar(THREE, cockpit, [0, 1.36, -3.18], [0.14, 4.2, 0.2], frameMaterial);

    const instrumentMaterial = new THREE.MeshBasicMaterial({ color: 0x102235, transparent: true, opacity: 0.94 });
    const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x123a55, transparent: true, opacity: 0.42 });
    addConsoleBlock(THREE, cockpit, [-2.25, -1.42, 2.15], [1.65, 0.24, 0.86], [-0.5, 0.1, 0.05], instrumentMaterial, screenMaterial);
    addConsoleBlock(THREE, cockpit, [0, -1.36, 2.35], [1.95, 0.28, 1.02], [-0.46, 0, 0], instrumentMaterial, screenMaterial);
    addConsoleBlock(THREE, cockpit, [2.25, -1.42, 2.15], [1.65, 0.24, 0.86], [-0.5, -0.1, -0.05], instrumentMaterial, screenMaterial);

    for (let i = 0; i < 8; i += 1) {
        const knob = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.08, 0.12),
            new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0x6aa6d9 : 0x51677a, transparent: true, opacity: 0.85 })
        );
        knob.position.set(-1.4 + i * 0.4, -1.07, 2.95);
        knob.rotation.x = -0.48;
        cockpit.add(knob);
    }

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 900; i += 1) {
        starPositions.push(
            (Math.random() - 0.5) * 90,
            (Math.random() - 0.25) * 54,
            -Math.random() * 95 - 8
        );
    }
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
        color: 0xe8f6ff,
        size: 0.08,
        transparent: true,
        opacity: 0.84,
        sizeAttenuation: true
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    threeRuntime = {
        THREE,
        scene,
        camera,
        renderer,
        cockpit,
        starField,
        glowMaterial,
        starMaterial
    };

    demo.classList.add("three-ready");
    updateThreeTheme();
}

function addPanel(THREE, group, position, rotation, size, material, edgeMaterial) {
    const geometry = new THREE.PlaneGeometry(size[0], size[1]);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    group.add(mesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial);
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    group.add(edges);
}

function addFrameBar(THREE, group, position, scale, material) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    bar.position.set(...position);
    bar.scale.set(...scale);
    group.add(bar);
}

function addConsoleBlock(THREE, group, position, scale, rotation, material, screenMaterial) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    block.position.set(...position);
    block.scale.set(...scale);
    block.rotation.set(...rotation);
    group.add(block);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.34), screenMaterial);
    screen.position.set(position[0], position[1] + 0.16, position[2] + 0.45);
    screen.rotation.set(rotation[0] - 0.08, rotation[1], rotation[2]);
    group.add(screen);
}

function resizeThreeScene() {
    if (!threeRuntime) {
        return;
    }

    threeRuntime.camera.aspect = window.innerWidth / window.innerHeight;
    threeRuntime.camera.updateProjectionMatrix();
    threeRuntime.renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateThreeTheme() {
    if (!threeRuntime) {
        return;
    }

    const phase = phases[activePhaseId];
    const colors = {
        launch: 0xe6535d,
        emergency: 0xe6535d,
        "zero-g": 0x6aa6d9,
        isolation: 0x38475d,
        landing: 0xdf8c4e,
        bone: 0xdf8c4e
    };
    const color = colors[phase.theme] || 0x6aa6d9;

    threeRuntime.glowMaterial.color.setHex(color);
    threeRuntime.glowMaterial.opacity = phase.theme === "isolation" ? 0.12 : 0.24;
    threeRuntime.starMaterial.opacity = phase.theme === "isolation" ? 0.46 : 0.84;
}

function renderThreeScene(phase) {
    if (!threeRuntime || safeMode) {
        return;
    }

    const time = frame * 0.016;
    const shake = getShake(phase);

    threeRuntime.camera.position.x = Math.sin(time * 0.48) * 0.055 + shake.x * 0.018;
    threeRuntime.camera.position.y = 0.55 + Math.cos(time * 0.52) * 0.065 + shake.y * 0.016;
    threeRuntime.camera.rotation.x = Math.sin(time * 0.5) * 0.006;
    threeRuntime.camera.rotation.z = Math.sin(time * 0.34) * 0.006;
    threeRuntime.starField.rotation.y += phase.theme === "landing" ? 0.0009 : 0.00035;
    threeRuntime.cockpit.rotation.x = Math.sin(time * 0.6) * 0.006;
    threeRuntime.cockpit.rotation.y = Math.sin(time * 0.42) * 0.01;
    threeRuntime.cockpit.position.y = Math.sin(time * 0.52) * 0.025;

    threeRuntime.renderer.render(threeRuntime.scene, threeRuntime.camera);
}

function buildStars() {
    stars = Array.from({ length: 190 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight * 0.72,
        r: Math.random() * 1.4 + 0.2,
        speed: Math.random() * 0.28 + 0.05
    }));
}

function buildParticles() {
    const phase = phases[activePhaseId];
    const count = phase.theme === "emergency" ? 90 : phase.theme === "zero-g" ? 55 : 28;
    particles = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 2.2 + 0.5,
        vx: (Math.random() - 0.5) * 0.4,
        vy: Math.random() * -0.5 - 0.08,
        alpha: Math.random() * 0.5 + 0.2
    }));
}

function drawBackground(width, height, phase) {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    const topColor = phase.theme === "zero-g" ? "#071a2a" : phase.theme === "isolation" ? "#03050a" : "#040812";
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(0.55, "#050914");
    gradient.addColorStop(1, "#010205");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
}

function roundedRectPath(x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);

    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
}

function drawStars(width, height, phase) {
    const speedBoost = phase.theme === "landing" || phase.theme === "launch" ? 2.4 : 1;
    context.save();
    context.beginPath();
    roundedRectPath(width * 0.16, height * 0.09, width * 0.68, height * 0.47, 32);
    context.clip();

    stars.forEach((star) => {
        star.y += star.speed * speedBoost;
        if (star.y > height * 0.56) {
            star.y = height * 0.12;
            star.x = width * 0.24 + Math.random() * width * 0.52;
        }
        context.fillStyle = `rgba(230, 246, 255, ${phase.theme === "isolation" ? 0.48 : 0.8})`;
        context.beginPath();
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context.fill();
    });
    context.restore();
}

function drawCockpit(width, height, phase) {
    const shake = getShake(phase);
    context.save();
    context.translate(shake.x, shake.y);

    context.fillStyle = "rgba(3, 7, 13, 0.92)";
    context.beginPath();
    context.moveTo(0, height);
    context.lineTo(width * 0.12, height * 0.52);
    context.lineTo(width * 0.88, height * 0.52);
    context.lineTo(width, height);
    context.closePath();
    context.fill();

    context.strokeStyle = "rgba(135, 169, 199, 0.22)";
    context.lineWidth = 2;
    context.stroke();

    context.strokeStyle = "rgba(135, 169, 199, 0.18)";
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(width * 0.12, height * 0.52);
    context.lineTo(width * 0.04, height * 0.92);
    context.moveTo(width * 0.88, height * 0.52);
    context.lineTo(width * 0.96, height * 0.92);
    context.moveTo(width * 0.32, height * 0.59);
    context.lineTo(width * 0.22, height * 0.96);
    context.moveTo(width * 0.68, height * 0.59);
    context.lineTo(width * 0.78, height * 0.96);
    context.stroke();

    const windowGlow = phase.theme === "emergency" ? "rgba(230,83,93,0.34)" : phase.theme === "zero-g" ? "rgba(106,166,217,0.3)" : "rgba(135,169,199,0.18)";
    context.fillStyle = "rgba(7, 13, 22, 0.48)";
    context.strokeStyle = windowGlow;
    context.lineWidth = 3;
    context.beginPath();
    roundedRectPath(width * 0.16, height * 0.09, width * 0.68, height * 0.47, 32);
    context.fill();
    context.stroke();

    context.strokeStyle = "rgba(150, 190, 220, 0.2)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(width * 0.5, height * 0.1);
    context.lineTo(width * 0.5, height * 0.55);
    context.moveTo(width * 0.18, height * 0.34);
    context.lineTo(width * 0.82, height * 0.34);
    context.stroke();

    context.fillStyle = "rgba(2, 5, 9, 0.82)";
    context.fillRect(0, height * 0.78, width, height * 0.22);

    const deckGradient = context.createLinearGradient(0, height * 0.64, 0, height);
    deckGradient.addColorStop(0, "rgba(16, 35, 54, 0.88)");
    deckGradient.addColorStop(1, "rgba(1, 3, 7, 0.98)");
    context.fillStyle = deckGradient;
    context.beginPath();
    context.moveTo(width * 0.22, height * 0.62);
    context.lineTo(width * 0.78, height * 0.62);
    context.lineTo(width * 0.92, height * 0.92);
    context.lineTo(width * 0.08, height * 0.92);
    context.closePath();
    context.fill();

    context.strokeStyle = "rgba(135, 169, 199, 0.2)";
    context.stroke();

    drawCanvasInstrument(width * 0.34, height * 0.72, width * 0.12, height * 0.07);
    drawCanvasInstrument(width * 0.52, height * 0.71, width * 0.13, height * 0.08);
    drawCanvasInstrument(width * 0.68, height * 0.72, width * 0.12, height * 0.07);

    context.fillStyle = "rgba(3, 7, 12, 0.86)";
    context.beginPath();
    context.ellipse(width * 0.22, height * 0.96, width * 0.18, height * 0.09, -0.18, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(width * 0.78, height * 0.96, width * 0.18, height * 0.09, 0.18, 0, Math.PI * 2);
    context.fill();

    for (let i = 0; i < 8; i += 1) {
        const x = width * 0.3 + i * width * 0.06;
        context.fillStyle = i % 3 === 0 ? "rgba(106,166,217,0.38)" : "rgba(120,150,180,0.18)";
        context.fillRect(x, height * 0.84, width * 0.035, 5);
    }

    context.restore();
}

function drawCanvasInstrument(x, y, width, height) {
    context.fillStyle = "rgba(7, 19, 30, 0.92)";
    context.strokeStyle = "rgba(106, 166, 217, 0.22)";
    context.lineWidth = 1;
    context.beginPath();
    roundedRectPath(x - width / 2, y - height / 2, width, height, 8);
    context.fill();
    context.stroke();

    context.fillStyle = "rgba(106, 166, 217, 0.22)";
    context.fillRect(x - width * 0.32, y - height * 0.16, width * 0.64, 2);
    context.fillRect(x - width * 0.22, y + height * 0.08, width * 0.44, 2);
}

function drawParticles(width, height, phase) {
    const isRadiation = phase.theme === "emergency";
    const isZeroG = phase.theme === "zero-g";

    particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.y < -20 || particle.x < -20 || particle.x > width + 20) {
            particle.x = Math.random() * width;
            particle.y = height + Math.random() * 40;
        }

        const color = isRadiation ? `rgba(230,83,93,${particle.alpha})` : isZeroG ? `rgba(130,190,235,${particle.alpha})` : `rgba(170,200,230,${particle.alpha * 0.45})`;
        context.fillStyle = color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        context.fill();
    });
}

function getShake(phase) {
    if (phase.theme !== "launch" && phase.theme !== "landing") {
        return { x: 0, y: 0 };
    }

    const strength = phase.theme === "launch" ? 2.8 : 1.8;
    return {
        x: Math.sin(frame * 0.8) * strength,
        y: Math.cos(frame * 0.55) * strength
    };
}

function animate() {
    frame += 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const phase = phases[activePhaseId];

    drawBackground(width, height, phase);
    drawStars(width, height, phase);
    drawParticles(width, height, phase);
    drawCockpit(width, height, phase);
    renderThreeScene(phase);

    requestAnimationFrame(animate);
}

function renderPhaseButtons() {
    phaseButtons.innerHTML = "";

    Object.entries(phases).forEach(([phaseId, phase]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = phase.title;
        button.title = `Show ${phase.title}`;
        button.classList.toggle("active", phaseId === activePhaseId);
        button.addEventListener("click", () => setPhase(phaseId));
        phaseButtons.appendChild(button);
    });
}

function renderVitals(phase) {
    vitals.innerHTML = "";

    Object.entries(phase.vitals).forEach(([label, value]) => {
        const row = document.createElement("div");
        row.className = "vital-row";
        row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
        vitals.appendChild(row);
    });
}

function renderBodyZones(phase) {
    bodyZones.forEach((zone) => {
        zone.classList.toggle("active", phase.zones.includes(zone.dataset.zone));
    });
    bodyHint.textContent = phase.bodyHint;
}

function setPhase(phaseId) {
    activePhaseId = phaseId;
    const phase = phases[phaseId];

    phaseThemeClasses.forEach((theme) => demo.classList.remove(theme));
    demo.classList.add(phase.theme);
    demo.classList.add("phase-shift");
    window.setTimeout(() => demo.classList.remove("phase-shift"), 220);

    phaseTitle.textContent = phase.title;
    phaseLevel.textContent = phase.level;
    aiWarning.textContent = phase.warning;
    aiReasoning.textContent = phase.reasoning;
    recommendation.textContent = phase.recommendation;

    renderPhaseButtons();
    renderVitals(phase);
    renderBodyZones(phase);
    buildParticles();
    updateThreeTheme();
}

window.addEventListener("resize", resizeCanvas);
safeModeToggle.addEventListener("change", () => {
    safeMode = safeModeToggle.checked;
    demo.classList.toggle("safe-mode", safeMode);
});

resizeCanvas();
setPhase(activePhaseId);
animate();

loadThreeJs()
    .then(initThreeScene)
    .catch(() => {
        demo.classList.add("safe-mode");
        safeModeToggle.checked = true;
        safeMode = true;
        safeModeToggle.title = "Three.js was not available, so the demo is using the built-in safe renderer.";
    });
