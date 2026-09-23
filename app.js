import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (selector) => document.querySelector(selector);

const loginView = $('#loginView');
const runtimeView = $('#runtimeView');
const loginForm = $('#loginForm');
const loginInput = $('#loginInput');
const passwordInput = $('#passwordInput');
const loginError = $('#loginError');
const logoutButton = $('#logoutButton');
const stationPanel = $('#stationPanel');
const panelTitle = $('#panelTitle');
const panelCode = $('#panelCode');
const panelContent = $('#panelContent');
const closePanel = $('#closePanel');
const selectionReadout = $('#selectionReadout');
const guideTitle = $('#guideTitle');
const guideCopy = $('#guideCopy');

const AUTH_KEY = 'runtime-demo-auth';

const nodes = [
  { id: 'brain', code: 'CORE-00', title: 'Shared LLM Brain', description: 'Jeden wspólny model językowy obsługujący wielu agentów.', body: () => `
    <p>To jest wspólny „mózg” systemu. Agent 01 i Agent 02 nie mają osobnych modeli — oba korzystają z tego samego rdzenia LLM.</p>
    <div class="panel-card"><strong>MODEL</strong><small>Shared inference core / one set of model weights</small></div>
    <div class="panel-card"><strong>ROUTING</strong><small>Requests from both agents are routed into the same brain.</small></div>
    <div class="panel-card"><strong>SEPARATION</strong><small>Agents may have different goals, tools and scratch state while sharing the same model.</small></div>` },
  { id: 'agent-01', code: 'AG-01', title: 'Agent 01', description: 'Pierwszy autonomiczny wykonawca korzystający ze wspólnego LLM.', body: () => `
    <p>Agent 01 to warstwa wykonawcza: cel, stan zadania, narzędzia i własny przebieg pracy. Rozumowanie językowe deleguje do wspólnego Brain.</p>
    <div class="panel-card"><strong>STATE</strong><small>STANDBY / connected to CORE-00</small></div>
    <div class="panel-card"><strong>ROLE</strong><small>Research + planning</small></div>
    <div class="panel-card"><strong>BRAIN LINK</strong><small>Shared LLM Brain / bidirectional</small></div>` },
  { id: 'agent-02', code: 'AG-02', title: 'Agent 02', description: 'Drugi autonomiczny wykonawca korzystający z tego samego LLM.', body: () => `
    <p>Agent 02 ma własny cel i stan wykonania, lecz nie drugi model. To drugi proces agentowy podłączony do tego samego rdzenia językowego.</p>
    <div class="panel-card"><strong>STATE</strong><small>STANDBY / connected to CORE-00</small></div>
    <div class="panel-card"><strong>ROLE</strong><small>Execution + verification</small></div>
    <div class="panel-card"><strong>BRAIN LINK</strong><small>Shared LLM Brain / bidirectional</small></div>` },
];

const stations = [
  { id: 'prompt', code: 'ST-01', title: 'Prompt Console', angle: -Math.PI / 2, description: 'Compose and submit operator prompts.', body: () => `<p>Operator input trafia do agenta, a następnie do wspólnego Brain.</p><div class="panel-card"><strong>INPUT ROUTE</strong><small>Operator → Agent → Shared Brain</small></div><div class="panel-card"><strong>NEXT</strong><small>Real prompt editor, task assignment and streamed output.</small></div>` },
  { id: 'memory', code: 'ST-02', title: 'Memory', angle: -Math.PI / 6, description: 'Inspect shared and agent-scoped memory.', body: () => `<p>Pamięć może być wspólna dla środowiska albo przypisana do konkretnego agenta.</p><div class="panel-card"><strong>SHARED MEMORY</strong><small>Knowledge available to Agent 01 and Agent 02.</small></div><div class="panel-card"><strong>AGENT SCRATCH</strong><small>Short-lived working state can remain agent-specific.</small></div>` },
  { id: 'tools', code: 'ST-03', title: 'Tools', angle: Math.PI / 6, description: 'Capabilities available to agents.', body: () => `<p>Narzędzia są przypisywane agentom, nie samemu modelowi.</p><div class="panel-card"><strong>Agent 01</strong><small>web.search · files.read · planner</small></div><div class="panel-card"><strong>Agent 02</strong><small>db.query · verifier · executor</small></div>` },
  { id: 'runtime', code: 'ST-04', title: 'Runtime', angle: Math.PI / 2, description: 'Observe shared inference and concurrent agent activity.', body: () => `<p>Runtime rozdziela „kto wykonuje zadanie” od „jaki model wykonuje inference”.</p><div class="panel-card"><strong>BRAIN</strong><small>1 shared inference core</small></div><div class="panel-card"><strong>AGENTS</strong><small>2 independent execution loops</small></div>` },
  { id: 'events', code: 'ST-05', title: 'Events', angle: 5 * Math.PI / 6, description: 'Inspect system, agent and tool events.', body: () => `<p>Event stream rozdziela zdarzenia modelu, agentów i narzędzi.</p><div class="panel-card"><strong>CORE</strong><small>Inference request accepted.</small></div><div class="panel-card"><strong>AG-01</strong><small>Waiting for task.</small></div><div class="panel-card"><strong>AG-02</strong><small>Waiting for task.</small></div>` },
  { id: 'world', code: 'ST-06', title: 'World Context', angle: 7 * Math.PI / 6, description: 'Shared operational context visible to both agents.', body: () => `<p>Wspólny stan świata może być obserwowany przez oba procesy agentowe.</p><div class="panel-card"><strong>LOCATION</strong><small>Node 04 / Warsaw</small></div><div class="panel-card"><strong>OBJECTIVE</strong><small>Explore a spatial multi-agent LLM runtime.</small></div><div class="panel-card"><strong>CONSTRAINT</strong><small>Prototype / no production actions.</small></div>` },
];

const targetMeta = new Map([...nodes, ...stations].map((item) => [item.id, item]));

let renderer, scene, camera, controls, animationFrame, raycaster, pointer, pointerDown = null, hoveredTarget = null;
const clickTargets = [];
const movingSignals = [];
const rotatingObjects = [];
const floatingObjects = [];
const pulseObjects = [];

function authenticate() {
  sessionStorage.setItem(AUTH_KEY, '1');
  loginView.classList.add('is-hidden');
  runtimeView.classList.remove('is-hidden');
  init3D();
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  if (animationFrame) cancelAnimationFrame(animationFrame);
  runtimeView.classList.add('is-hidden');
  loginView.classList.remove('is-hidden');
  loginInput.value = '';
  passwordInput.value = '';
  loginError.textContent = '';
  closeTarget();
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const login = loginInput.value.trim();
  const password = passwordInput.value;
  if (login === '123' && password === '123') {
    loginError.textContent = '';
    authenticate();
  } else {
    loginError.textContent = 'Nieprawidłowy login lub hasło.';
    passwordInput.value = '';
    passwordInput.focus();
  }
});

logoutButton.addEventListener('click', logout);
closePanel.addEventListener('click', closeTarget);

function openTarget(id) {
  const target = targetMeta.get(id);
  if (!target) return;
  panelCode.textContent = target.code;
  panelTitle.textContent = target.title;
  panelContent.innerHTML = target.body();
  stationPanel.classList.remove('is-hidden');
  selectionReadout.textContent = `${target.code} / ${target.title.toUpperCase()}`;
  guideTitle.textContent = target.title;
  guideCopy.textContent = target.description;
}

function closeTarget() {
  stationPanel.classList.add('is-hidden');
  selectionReadout.textContent = 'NO OBJECT SELECTED';
  guideTitle.textContent = 'Shared Brain / Multi-Agent Runtime';
  guideCopy.textContent = 'Jeden LLM Brain obsługuje dwa niezależne procesy agentowe. Kliknij Brain, Agent 01, Agent 02 albo jedną ze stacji.';
}

function makeLabelSprite(text, subtitle, accent = '#63d5e8') {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 180;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(3,10,14,.9)';
  ctx.strokeStyle = accent; ctx.lineWidth = 2;
  ctx.fillRect(3, 3, 634, 174); ctx.strokeRect(3, 3, 634, 174);
  ctx.fillStyle = '#e8f5f7'; ctx.font = '600 30px system-ui, sans-serif'; ctx.fillText(text, 30, 72);
  ctx.fillStyle = '#76929d'; ctx.font = '600 19px ui-monospace, monospace'; ctx.fillText(subtitle, 30, 118);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(2.8, .79, 1);
  return sprite;
}

function addHitbox(parent, size, position, targetId) {
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ transparent: true, opacity: .001, depthWrite: false }));
  hitbox.position.copy(position); hitbox.userData.targetId = targetId; parent.add(hitbox); clickTargets.push(hitbox);
}

function addDataLink(from, to, color, offset = 0, height = 3.6) {
  const midpoint = from.clone().lerp(to, .5); midpoint.y = Math.max(from.y, to.y) + height;
  const curve = new THREE.QuadraticBezierCurve3(from.clone(), midpoint, to.clone());
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .58 })));
  for (let i = 0; i < 2; i += 1) {
    const signal = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 10), new THREE.MeshBasicMaterial({ color }));
    scene.add(signal); movingSignals.push({ curve, signal, offset: (offset + i * .42) % 1, speed: .07 + i * .012 });
  }
}

function createBrain() {
  const group = new THREE.Group(); group.position.set(0, 2.65, 0); scene.add(group);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(.24, .52, 4.8, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x2ab7d0, transparent: true, opacity: .055, side: THREE.DoubleSide, depthWrite: false }));
  column.position.y = -.65; group.add(column);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(.73, 48, 32), new THREE.MeshStandardMaterial({ color: 0x071319, emissive: 0x20b8d4, emissiveIntensity: 2.2, metalness: .62, roughness: .22, transparent: true, opacity: .94 }));
  group.add(inner); pulseObjects.push({ object: inner, base: 1, amount: .045, speed: 2.4 });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.28, 2), new THREE.MeshStandardMaterial({ color: 0x123b47, emissive: 0x0d7a90, emissiveIntensity: 1.2, wireframe: true, transparent: true, opacity: .9 }));
  group.add(shell); rotatingObjects.push({ object: shell, x: .09, y: .16, z: .025 });
  const shell2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.64, 1), new THREE.MeshBasicMaterial({ color: 0x286979, wireframe: true, transparent: true, opacity: .24 }));
  group.add(shell2); rotatingObjects.push({ object: shell2, x: -.045, y: -.075, z: .018 });
  [
    { r: 1.78, tube: .025, color: 0x63d5e8, rot: [Math.PI / 2, 0, 0], speed: .13 },
    { r: 2.05, tube: .018, color: 0x345dff, rot: [.75, .35, 0], speed: -.095 },
    { r: 2.28, tube: .014, color: 0x63d6a2, rot: [1.2, -.42, .4], speed: .065 },
  ].forEach((d) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(d.r, d.tube, 10, 160), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: .8 }));
    ring.rotation.set(...d.rot); group.add(ring); rotatingObjects.push({ object: ring, x: d.speed * .2, y: d.speed, z: d.speed * .13 });
  });
  const neuralGeometry = new THREE.BufferGeometry(); const positions = [];
  for (let i = 0; i < 120; i += 1) {
    const phi = Math.acos(2 * Math.random() - 1), theta = Math.random() * Math.PI * 2, radius = 1.4 + Math.random() * 1.15;
    positions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
  }
  neuralGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const neuralPoints = new THREE.Points(neuralGeometry, new THREE.PointsMaterial({ color: 0xb9f4ff, size: .035, transparent: true, opacity: .72 }));
  group.add(neuralPoints); rotatingObjects.push({ object: neuralPoints, x: .012, y: -.028, z: .008 });
  addHitbox(group, new THREE.Vector3(4.3, 4.5, 4.3), new THREE.Vector3(0, 0, 0), 'brain');
  const label = makeLabelSprite('SHARED LLM BRAIN', 'CORE-00 / ONE MODEL'); label.position.set(0, 5.35, 0); scene.add(label);
}

function createAgent(id, code, labelText, position, accent) {
  const group = new THREE.Group(); group.position.copy(position); scene.add(group);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.42, .34, 8), new THREE.MeshStandardMaterial({ color: 0x091117, metalness: .82, roughness: .3 }));
  base.position.y = .18; group.add(base);
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(1.03, .035, 10, 80), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .9 }));
  baseRing.rotation.x = Math.PI / 2; baseRing.position.y = .39; group.add(baseRing); rotatingObjects.push({ object: baseRing, x: 0, y: 0, z: .12 });
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(.16, .24, 1.35, 8), new THREE.MeshStandardMaterial({ color: 0x17252c, emissive: accent, emissiveIntensity: .16, metalness: .72, roughness: .25 }));
  spine.position.y = 1.02; group.add(spine);
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(.66, 1), new THREE.MeshStandardMaterial({ color: 0x0a1a21, emissive: accent, emissiveIntensity: 1.15, metalness: .52, roughness: .2, transparent: true, opacity: .95 }));
  body.position.y = 1.78; group.add(body); rotatingObjects.push({ object: body, x: .07, y: .23, z: .04 }); pulseObjects.push({ object: body, base: 1, amount: .055, speed: id === 'agent-01' ? 2.1 : 1.8 });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(.92, .025, 10, 96), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .86 }));
  halo.position.y = 1.78; halo.rotation.x = Math.PI / 2; group.add(halo); rotatingObjects.push({ object: halo, x: .03, y: -.15, z: .08 });
  const crown = new THREE.Mesh(new THREE.ConeGeometry(.44, .72, 6, 1, true), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .18, side: THREE.DoubleSide }));
  crown.position.y = 2.55; group.add(crown);
  const hologram = new THREE.Mesh(new THREE.PlaneGeometry(1.55, .62), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .13, side: THREE.DoubleSide, depthWrite: false }));
  hologram.position.set(0, 1.45, .86); hologram.rotation.x = -.12; group.add(hologram);
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.62, .68)), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: .8 }));
  frame.position.copy(hologram.position); frame.rotation.copy(hologram.rotation); group.add(frame);
  addHitbox(group, new THREE.Vector3(2.8, 3.4, 2.8), new THREE.Vector3(0, 1.45, 0), id);
  const label = makeLabelSprite(labelText, `${code} / SHARED BRAIN LINK`, `#${accent.toString(16).padStart(6, '0')}`); label.position.copy(position).add(new THREE.Vector3(0, 3.55, 0)); scene.add(label);
  floatingObjects.push({ object: group, baseY: position.y, amount: .07, speed: id === 'agent-01' ? 1.3 : 1.15, phase: id === 'agent-01' ? 0 : Math.PI });
}

function createStation(station, index) {
  const radius = 5.55, x = Math.cos(station.angle) * radius, z = Math.sin(station.angle) * radius;
  const group = new THREE.Group(); group.position.set(x, .48, z); group.lookAt(0, .9, 0); scene.add(group);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.38, .42, 6), new THREE.MeshStandardMaterial({ color: 0x081116, metalness: .78, roughness: .33 })); group.add(plinth);
  const lowerRing = new THREE.Mesh(new THREE.TorusGeometry(.92, .025, 8, 70), new THREE.MeshBasicMaterial({ color: index === 0 ? 0x63d5e8 : 0x315e69, transparent: true, opacity: .9 })); lowerRing.rotation.x = Math.PI / 2; lowerRing.position.y = .24; group.add(lowerRing);
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x17272e, metalness: .7, roughness: .25 });
  const left = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.2, .1), strutMat); left.position.set(-.58, .85, .08); left.rotation.z = -.15; group.add(left);
  const right = left.clone(); right.position.x = .58; right.rotation.z = .15; group.add(right);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.72, .92), new THREE.MeshBasicMaterial({ color: 0x0c3340, transparent: true, opacity: .62, side: THREE.DoubleSide })); screen.position.set(0, 1.22, .22); screen.rotation.x = -.14; group.add(screen);
  const screenFrame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.82, 1.02)), new THREE.LineBasicMaterial({ color: index === 0 ? 0x63d5e8 : 0x4b7b87, transparent: true, opacity: .9 })); screenFrame.position.copy(screen.position); screenFrame.rotation.copy(screen.rotation); group.add(screenFrame);
  const emitter = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .5, 8), new THREE.MeshBasicMaterial({ color: index % 2 ? 0x63d6a2 : 0x63d5e8, transparent: true, opacity: .82 })); emitter.position.set(0, 1.95, -.05); group.add(emitter);
  const holoRing = new THREE.Mesh(new THREE.TorusGeometry(.48, .015, 8, 60), new THREE.MeshBasicMaterial({ color: index % 2 ? 0x63d6a2 : 0x63d5e8, transparent: true, opacity: .65 })); holoRing.position.set(0, 1.92, -.05); holoRing.rotation.x = Math.PI / 2; group.add(holoRing); rotatingObjects.push({ object: holoRing, x: 0, y: 0, z: index % 2 ? -.2 : .2 });
  addHitbox(group, new THREE.Vector3(2.7, 3.1, 2.3), new THREE.Vector3(0, 1.25, 0), station.id);
  const label = makeLabelSprite(station.title.toUpperCase(), station.code); label.position.set(x, 2.7, z); scene.add(label);
  addDataLink(new THREE.Vector3(0, 2.65, 0), new THREE.Vector3(x, 1.48, z), index % 2 ? 0x2f7280 : 0x315f6b, index / stations.length, 2.25);
}

function init3D() {
  if (renderer) { resizeRenderer(); animate(); return; }
  const canvas = $('#worldCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x020405, 1);
  scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x020405, .034);
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, .1, 120); camera.position.set(0, 7.6, 15.2);
  controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = .045; controls.target.set(0, 1.7, 0); controls.minDistance = 7; controls.maxDistance = 22; controls.maxPolarAngle = Math.PI * .49; controls.minPolarAngle = Math.PI * .16; controls.enablePan = false;
  scene.add(new THREE.AmbientLight(0x92b8c4, .24));
  const brainLight = new THREE.PointLight(0x63d5e8, 34, 32, 2); brainLight.position.set(0, 4.6, 0); scene.add(brainLight);
  const blueRim = new THREE.PointLight(0x446dff, 14, 24, 2); blueRim.position.set(-6, 3.5, -2); scene.add(blueRim);
  const greenRim = new THREE.PointLight(0x4ee29e, 11, 22, 2); greenRim.position.set(6, 2.7, 2); scene.add(greenRim);
  const grid = new THREE.GridHelper(46, 46, 0x24566a, 0x0d2028); grid.material.opacity = .38; grid.material.transparent = true; scene.add(grid);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(6.65, 7.25, .48, 12), new THREE.MeshStandardMaterial({ color: 0x071016, metalness: .82, roughness: .34 })); platform.position.y = .2; scene.add(platform);
  const platformTop = new THREE.Mesh(new THREE.CylinderGeometry(6.35, 6.35, .05, 12), new THREE.MeshStandardMaterial({ color: 0x0b171d, metalness: .65, roughness: .28 })); platformTop.position.y = .46; scene.add(platformTop);
  [6, 4.1, 2.7].forEach((radius, i) => { const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, i === 0 ? .038 : .018, 8, 150), new THREE.MeshBasicMaterial({ color: i === 1 ? 0x244b56 : 0x4fb7ca, transparent: true, opacity: i === 1 ? .48 : .75 })); ring.rotation.x = Math.PI / 2; ring.position.y = .5 + i * .008; scene.add(ring); });
  createBrain();
  const agent01Pos = new THREE.Vector3(-3.15, .48, 1.55), agent02Pos = new THREE.Vector3(3.15, .48, 1.55);
  createAgent('agent-01', 'AG-01', 'AGENT 01', agent01Pos, 0x63d5e8); createAgent('agent-02', 'AG-02', 'AGENT 02', agent02Pos, 0x63d6a2);
  addDataLink(new THREE.Vector3(-3.15, 2.25, 1.55), new THREE.Vector3(-.55, 2.95, .15), 0x63d5e8, .08, 1.45);
  addDataLink(new THREE.Vector3(3.15, 2.25, 1.55), new THREE.Vector3(.55, 2.95, .15), 0x63d6a2, .48, 1.45);
  stations.forEach(createStation);
  for (let i = 0; i < 16; i += 1) { const a = (i / 16) * Math.PI * 2, radius = 8.4, height = 1.5 + (i % 5) * .5; const pylon = new THREE.Mesh(new THREE.BoxGeometry(.11, height, .11), new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? 0x285f6e : 0x142d35, transparent: true, opacity: .58 })); pylon.position.set(Math.cos(a) * radius, height / 2, Math.sin(a) * radius); scene.add(pylon); }
  raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2();
  canvas.addEventListener('pointerdown', handlePointerDown); canvas.addEventListener('pointerup', handlePointerUp); canvas.addEventListener('pointermove', handlePointerMove); canvas.addEventListener('pointerleave', () => { pointerDown = null; renderer.domElement.style.cursor = 'grab'; }); window.addEventListener('resize', resizeRenderer);
  closeTarget(); resizeRenderer(); animate();
}

function setPointerFromEvent(event) { const rect = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; }
function getTargetAtPointer(event) { setPointerFromEvent(event); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(clickTargets, false)[0]; return hit?.object?.userData?.targetId || null; }
function handlePointerDown(event) { pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() }; }
function handlePointerUp(event) { if (!pointerDown) return; const dx = event.clientX - pointerDown.x, dy = event.clientY - pointerDown.y, distance = Math.hypot(dx, dy), duration = performance.now() - pointerDown.time; pointerDown = null; if (distance > 9 || duration > 700) return; const targetId = getTargetAtPointer(event); if (targetId) openTarget(targetId); }
function handlePointerMove(event) { if (pointerDown) { const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y); if (moved > 9) renderer.domElement.style.cursor = 'grabbing'; return; } const targetId = getTargetAtPointer(event); if (targetId !== hoveredTarget) hoveredTarget = targetId; renderer.domElement.style.cursor = targetId ? 'pointer' : 'grab'; }
function resizeRenderer() { if (!renderer || !camera) return; const width = window.innerWidth, height = window.innerHeight; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }

const clock = new THREE.Clock();
function animate() {
  animationFrame = requestAnimationFrame(animate); if (!renderer || !scene || !camera) return; const t = clock.getElapsedTime(); controls.update();
  rotatingObjects.forEach(({ object, x, y, z }) => { object.rotation.x += x * .01; object.rotation.y += y * .01; object.rotation.z += z * .01; });
  pulseObjects.forEach(({ object, base, amount, speed }) => { const scale = base + Math.sin(t * speed) * amount; object.scale.setScalar(scale); });
  floatingObjects.forEach(({ object, baseY, amount, speed, phase }) => { object.position.y = baseY + Math.sin(t * speed + phase) * amount; });
  movingSignals.forEach(({ curve, signal, offset, speed }) => { signal.position.copy(curve.getPoint((t * speed + offset) % 1)); });
  renderer.render(scene, camera);
}

if (sessionStorage.getItem(AUTH_KEY) === '1') authenticate();
