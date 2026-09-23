import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

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

const stations = [
  {
    id: 'prompt', code: 'ST-01', title: 'Prompt Console',
    angle: -Math.PI / 2,
    description: 'Compose and submit operator prompts.',
    body: () => `
      <p>Ta stacja będzie docelowo miejscem do uruchamiania realnych testów promptów.</p>
      <div class="panel-card"><strong>Current mode</strong><small>Manual prompt composition / local simulation</small></div>
      <div class="panel-card"><strong>Next iteration</strong><small>Prompt editor, run button, runtime trace and output history.</small></div>
    `,
  },
  {
    id: 'memory', code: 'ST-02', title: 'Memory',
    angle: -Math.PI / 6,
    description: 'Inspect and modify local memory records.',
    body: () => `
      <p>Pamięć operatora i kontekst długoterminowy.</p>
      <div class="panel-card"><strong>Operator preference</strong><small>Concise answers, explicit action lists.</small></div>
      <div class="panel-card"><strong>Deployment window</strong><small>Runtime changes allowed 02:00–04:00 UTC.</small></div>
      <div class="panel-card"><strong>Safety rule</strong><small>Two flags trigger human review.</small></div>
    `,
  },
  {
    id: 'tools', code: 'ST-03', title: 'Tools',
    angle: Math.PI / 6,
    description: 'Enable and inspect model capabilities.',
    body: () => `
      <p>Warstwa narzędzi — docelowo realne integracje i statusy.</p>
      <div class="panel-card"><strong>web.search</strong><small>enabled</small></div>
      <div class="panel-card"><strong>db.query</strong><small>enabled</small></div>
      <div class="panel-card"><strong>math.eval</strong><small>enabled</small></div>
      <div class="panel-card"><strong>files.read</strong><small>disabled</small></div>
      <div class="panel-card"><strong>mail.send</strong><small>disabled</small></div>
    `,
  },
  {
    id: 'runtime', code: 'ST-04', title: 'Runtime',
    angle: Math.PI / 2,
    description: 'Observe active runs and inference state.',
    body: () => `
      <p>Monitor przebiegu modelu i jego etapów.</p>
      <div class="panel-card"><strong>State</strong><small>READY</small></div>
      <div class="panel-card"><strong>Latency</strong><small>simulation only</small></div>
      <div class="panel-card"><strong>Context window</strong><small>not connected</small></div>
    `,
  },
  {
    id: 'events', code: 'ST-05', title: 'Events',
    angle: 5 * Math.PI / 6,
    description: 'Inspect runtime logs and events.',
    body: () => `
      <p>Rejestr zdarzeń środowiska.</p>
      <div class="panel-card"><strong>BOOT</strong><small>3D environment initialized.</small></div>
      <div class="panel-card"><strong>SESSION</strong><small>Operator 123 authenticated.</small></div>
      <div class="panel-card"><strong>STATUS</strong><small>No active model run.</small></div>
    `,
  },
  {
    id: 'world', code: 'ST-06', title: 'World Context',
    angle: 7 * Math.PI / 6,
    description: 'Set the active operational world state.',
    body: () => `
      <p>Warstwa kontekstu świata i aktualnych ograniczeń.</p>
      <div class="panel-card"><strong>Location</strong><small>Node 04 / Warsaw</small></div>
      <div class="panel-card"><strong>Objective</strong><small>Explore spatial LLM runtime concepts.</small></div>
      <div class="panel-card"><strong>Constraints</strong><small>Prototype / no production actions.</small></div>
    `,
  },
];

let renderer, scene, camera, controls, animationFrame;
let raycaster, pointer;
const clickableScreens = [];
const movingSignals = [];
const coreGroup = new THREE.Group();

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
  closeStation();
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
closePanel.addEventListener('click', closeStation);

function openStation(id) {
  const station = stations.find((item) => item.id === id);
  if (!station) return;
  panelCode.textContent = station.code;
  panelTitle.textContent = station.title;
  panelContent.innerHTML = station.body();
  stationPanel.classList.remove('is-hidden');
  selectionReadout.textContent = `${station.code} / ${station.title.toUpperCase()}`;
  guideTitle.textContent = station.title;
  guideCopy.textContent = station.description;
}

function closeStation() {
  stationPanel.classList.add('is-hidden');
  selectionReadout.textContent = 'NO STATION SELECTED';
  guideTitle.textContent = 'Central Runtime';
  guideCopy.textContent = 'Przeciągnij myszą, aby obracać kamerę. Kliknij terminal w przestrzeni, aby otworzyć jego panel roboczy.';
}

function makeLabelSprite(text, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(3,10,14,.86)';
  ctx.strokeStyle = 'rgba(99,213,232,.58)';
  ctx.lineWidth = 2;
  ctx.fillRect(2, 2, 508, 156);
  ctx.strokeRect(2, 2, 508, 156);
  ctx.fillStyle = '#dfecef';
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.fillText(text, 28, 64);
  ctx.fillStyle = '#6d8792';
  ctx.font = '600 18px ui-monospace, monospace';
  ctx.fillText(subtitle, 28, 105);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.3, .72, 1);
  return sprite;
}

function init3D() {
  if (renderer) {
    resizeRenderer();
    animate();
    return;
  }

  const canvas = $('#worldCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x020405, 1);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020405, 0.042);

  camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 6.6, 12.4);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.045;
  controls.target.set(0, 1.25, 0);
  controls.minDistance = 6.4;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.enablePan = false;

  scene.add(new THREE.AmbientLight(0x88aeb9, 0.28));
  const key = new THREE.PointLight(0x63d5e8, 24, 28, 2);
  key.position.set(0, 5.5, 0);
  scene.add(key);
  const rim = new THREE.PointLight(0x5f7eff, 9, 20, 2);
  rim.position.set(-5, 2.5, -3);
  scene.add(rim);

  const grid = new THREE.GridHelper(40, 40, 0x24566a, 0x101f27);
  grid.material.opacity = 0.42;
  grid.material.transparent = true;
  scene.add(grid);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(5.15, 5.75, 0.42, 96),
    new THREE.MeshStandardMaterial({ color: 0x081016, metalness: .68, roughness: .38 })
  );
  platform.position.y = .18;
  scene.add(platform);

  const platformRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.88, .035, 8, 120),
    new THREE.MeshBasicMaterial({ color: 0x4fb7ca })
  );
  platformRing.rotation.x = Math.PI / 2;
  platformRing.position.y = .41;
  scene.add(platformRing);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.05, .018, 8, 100),
    new THREE.MeshBasicMaterial({ color: 0x274b55 })
  );
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = .42;
  scene.add(innerRing);

  coreGroup.position.set(0, 2.2, 0);
  scene.add(coreGroup);

  const coreWire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.05, 2),
    new THREE.MeshStandardMaterial({
      color: 0x0f4453,
      emissive: 0x11788f,
      emissiveIntensity: 1.5,
      wireframe: true,
      transparent: true,
      opacity: .9,
    })
  );
  const coreGlow = new THREE.Mesh(
    new THREE.SphereGeometry(.62, 36, 24),
    new THREE.MeshBasicMaterial({ color: 0x63d5e8, transparent: true, opacity: .12 })
  );
  coreGlow.userData.glow = true;
  coreGroup.add(coreWire, coreGlow);

  for (let i = 0; i < 26; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(.028, 6, 6),
      new THREE.MeshBasicMaterial({ color: i % 5 === 0 ? 0x63d6a2 : 0xb9edf4 })
    );
    const a = (i / 26) * Math.PI * 2;
    const r = 1.35 + (i % 4) * .12;
    particle.position.set(Math.cos(a) * r, ((i % 7) - 3) * .13, Math.sin(a) * r);
    coreGroup.add(particle);
  }

  const centerLabel = makeLabelSprite('INFERENCE CORE', 'LIVE / READY');
  centerLabel.position.set(0, 4.1, 0);
  scene.add(centerLabel);

  stations.forEach((station, index) => {
    const radius = 4.05;
    const x = Math.cos(station.angle) * radius;
    const z = Math.sin(station.angle) * radius;

    const group = new THREE.Group();
    group.position.set(x, .62, z);
    group.lookAt(0, .62, 0);
    scene.add(group);

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, .32, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x0b1217, metalness: .52, roughness: .42 })
    );
    group.add(plinth);

    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(.11, .78, .11),
      new THREE.MeshStandardMaterial({ color: 0x16242b, metalness: .65, roughness: .35 })
    );
    stand.position.set(0, .54, .18);
    group.add(stand);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, .82),
      new THREE.MeshBasicMaterial({ color: 0x0a2731, transparent: true, opacity: .92, side: THREE.DoubleSide })
    );
    screen.position.set(0, .98, .2);
    screen.rotation.x = -.18;
    screen.userData.stationId = station.id;
    group.add(screen);
    clickableScreens.push(screen);

    const screenFrame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.62, .88)),
      new THREE.LineBasicMaterial({ color: index === 0 ? 0x63d5e8 : 0x376f7c })
    );
    screenFrame.position.copy(screen.position);
    screenFrame.rotation.copy(screen.rotation);
    group.add(screenFrame);

    const label = makeLabelSprite(station.title.toUpperCase(), station.code);
    label.position.set(x, 2.25, z);
    scene.add(label);

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 2.15, 0),
      new THREE.Vector3(x * .55, 3.55 + (index % 2) * .3, z * .55),
      new THREE.Vector3(x, 1.35, z)
    );
    const points = curve.getPoints(44);
    const path = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x204a55, transparent: true, opacity: .62 })
    );
    scene.add(path);

    const signal = new THREE.Mesh(
      new THREE.SphereGeometry(.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? 0x63d6a2 : 0x63d5e8 })
    );
    scene.add(signal);
    movingSignals.push({ curve, signal, offset: index / stations.length });
  });

  const outerPylons = 12;
  for (let i = 0; i < outerPylons; i++) {
    const a = (i / outerPylons) * Math.PI * 2;
    const r = 7.4;
    const h = 1.8 + (i % 4) * .55;
    const pylon = new THREE.Mesh(
      new THREE.BoxGeometry(.12, h, .12),
      new THREE.MeshBasicMaterial({ color: 0x17343e, transparent: true, opacity: .6 })
    );
    pylon.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    scene.add(pylon);
  }

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('pointermove', handleHover);
  window.addEventListener('resize', resizeRenderer);

  resizeRenderer();
  animate();
}

function handleCanvasClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickableScreens, false)[0];
  if (hit?.object?.userData?.stationId) openStation(hit.object.userData.stationId);
}

function handleHover(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickableScreens, false)[0];
  renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
}

function resizeRenderer() {
  if (!renderer || !camera) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const clock = new THREE.Clock();
function animate() {
  animationFrame = requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;
  const t = clock.getElapsedTime();
  controls.update();
  coreGroup.rotation.x = t * .11;
  coreGroup.rotation.y = t * .18;
  const glow = coreGroup.children.find((child) => child.userData.glow);
  if (glow) glow.scale.setScalar(1 + Math.sin(t * 2.1) * .12);
  movingSignals.forEach(({ curve, signal, offset }) => {
    signal.position.copy(curve.getPoint((t * .075 + offset) % 1));
  });
  renderer.render(scene, camera);
}

if (sessionStorage.getItem(AUTH_KEY) === '1') {
  authenticate();
}
