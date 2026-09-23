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
const engineMetric = $('#engineMetric');

const AUTH_KEY = 'runtime-demo-auth';

let engine = null;
let scene = null;
let camera = null;
let engineMode = '';
let renderStarted = false;
let pointerDown = null;
let pointerMoved = false;
let hoveredMesh = null;
let time = 0;

const animated = {
  rotating: [],
  pulsing: [],
  floating: [],
  signals: []
};

const nodes = [
  {
    id: 'brain',
    code: 'CORE-00',
    title: 'Shared LLM Brain',
    description: 'Jeden wspólny model językowy obsługujący oba procesy agentowe.',
    body: () => `
      <p>To jest wspólny mózg systemu. Agent 01 i Agent 02 nie posiadają osobnych modeli — oba kierują inference do tego samego LLM.</p>
      <div class="panel-card"><strong>MODEL</strong><small>1 shared inference core / shared weights</small></div>
      <div class="panel-card"><strong>REQUESTS</strong><small>Agent 01 ↔ Brain ↔ Agent 02</small></div>
      <div class="panel-card"><strong>SEPARATION</strong><small>Role, tools, memory scope and task state remain agent-specific.</small></div>`
  },
  {
    id: 'agent-01',
    code: 'AG-01',
    title: 'Agent 01',
    description: 'Agent badawczy korzystający ze wspólnego LLM Brain.',
    body: () => `
      <p>Agent 01 zarządza własnym celem, pamięcią roboczą i narzędziami. Warstwę językową deleguje do CORE-00.</p>
      <div class="panel-card"><strong>ROLE</strong><small>Research + planning</small></div>
      <div class="panel-card"><strong>STATE</strong><small>ONLINE / idle loop</small></div>
      <div class="panel-card"><strong>BRAIN LINK</strong><small>CORE-00 / bidirectional</small></div>`
  },
  {
    id: 'agent-02',
    code: 'AG-02',
    title: 'Agent 02',
    description: 'Agent wykonawczy korzystający z tego samego LLM Brain.',
    body: () => `
      <p>Agent 02 ma odrębny stan wykonania i zestaw narzędzi, ale używa dokładnie tego samego rdzenia językowego.</p>
      <div class="panel-card"><strong>ROLE</strong><small>Execution + verification</small></div>
      <div class="panel-card"><strong>STATE</strong><small>ONLINE / idle loop</small></div>
      <div class="panel-card"><strong>BRAIN LINK</strong><small>CORE-00 / bidirectional</small></div>`
  }
];

const stations = [
  {
    id: 'prompt',
    code: 'ST-01',
    title: 'Prompt Console',
    angle: -Math.PI / 2,
    description: 'Operator input and task assignment.',
    body: () => `
      <p>Operator może kierować zadanie do konkretnego agenta, który następnie używa wspólnego Brain.</p>
      <div class="panel-card"><strong>ROUTE A</strong><small>Operator → Agent 01 → CORE-00</small></div>
      <div class="panel-card"><strong>ROUTE B</strong><small>Operator → Agent 02 → CORE-00</small></div>`
  },
  {
    id: 'memory',
    code: 'ST-02',
    title: 'Memory',
    angle: -Math.PI / 6,
    description: 'Shared memory and agent-scoped scratch state.',
    body: () => `
      <p>Warstwa pamięci rozróżnia dane współdzielone od pamięci roboczej konkretnego procesu.</p>
      <div class="panel-card"><strong>SHARED</strong><small>World knowledge available to both agents.</small></div>
      <div class="panel-card"><strong>SCOPED</strong><small>Agent-specific scratch and task state.</small></div>`
  },
  {
    id: 'tools',
    code: 'ST-03',
    title: 'Tools',
    angle: Math.PI / 6,
    description: 'Capabilities assigned to execution loops.',
    body: () => `
      <p>Narzędzia należą do agentów. Brain jest wspólnym silnikiem językowym, nie właścicielem tooli.</p>
      <div class="panel-card"><strong>AG-01</strong><small>search · files · planner</small></div>
      <div class="panel-card"><strong>AG-02</strong><small>query · verifier · executor</small></div>`
  },
  {
    id: 'runtime',
    code: 'ST-04',
    title: 'Runtime',
    angle: Math.PI / 2,
    description: 'Engine state, inference routing and render backend.',
    body: () => `
      <p>Runtime rozdziela procesy agentowe od wspólnego inference core.</p>
      <div class="panel-card"><strong>ENGINE</strong><small>${engineMode || 'initializing'}</small></div>
      <div class="panel-card"><strong>BRAIN</strong><small>1 shared LLM</small></div>
      <div class="panel-card"><strong>AGENTS</strong><small>2 independent execution loops</small></div>`
  },
  {
    id: 'events',
    code: 'ST-05',
    title: 'Events',
    angle: 5 * Math.PI / 6,
    description: 'System, agent and inference events.',
    body: () => `
      <p>Warstwa zdarzeń pokazuje przepływ między agentami, Brain i narzędziami.</p>
      <div class="panel-card"><strong>CORE</strong><small>Inference service ready.</small></div>
      <div class="panel-card"><strong>AG-01</strong><small>Connected to CORE-00.</small></div>
      <div class="panel-card"><strong>AG-02</strong><small>Connected to CORE-00.</small></div>`
  },
  {
    id: 'world',
    code: 'ST-06',
    title: 'World Context',
    angle: 7 * Math.PI / 6,
    description: 'Shared operational state visible to both agents.',
    body: () => `
      <p>Wspólny kontekst świata jest dostępny dla obu agentów, ale każdy może z niego korzystać inaczej.</p>
      <div class="panel-card"><strong>LOCATION</strong><small>Node 04 / Warsaw</small></div>
      <div class="panel-card"><strong>OBJECTIVE</strong><small>Explore a spatial multi-agent runtime.</small></div>
      <div class="panel-card"><strong>CONSTRAINT</strong><small>Prototype / no production actions.</small></div>`
  }
];

const targetMeta = new Map([...nodes, ...stations].map((item) => [item.id, item]));

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

async function authenticate() {
  sessionStorage.setItem(AUTH_KEY, '1');
  loginView.classList.add('is-hidden');
  runtimeView.classList.remove('is-hidden');
  await initRuntime();
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  runtimeView.classList.add('is-hidden');
  loginView.classList.remove('is-hidden');
  loginInput.value = '';
  passwordInput.value = '';
  loginError.textContent = '';
  closeTarget();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const login = loginInput.value.trim();
  const password = passwordInput.value;
  if (login === '123' && password === '123') {
    loginError.textContent = '';
    await authenticate();
  } else {
    loginError.textContent = 'Nieprawidłowy login lub hasło.';
    passwordInput.value = '';
    passwordInput.focus();
  }
});

logoutButton.addEventListener('click', logout);
closePanel.addEventListener('click', closeTarget);

function color(hex) {
  return BABYLON.Color3.FromHexString(hex);
}

function emissiveMaterial(name, sceneRef, hex, intensity = 1) {
  const mat = new BABYLON.PBRMaterial(name, sceneRef);
  mat.albedoColor = color('#061015');
  mat.metallic = 0.72;
  mat.roughness = 0.28;
  mat.emissiveColor = color(hex).scale(intensity);
  return mat;
}

function darkMetal(name, sceneRef, tint = '#0b151b') {
  const mat = new BABYLON.PBRMaterial(name, sceneRef);
  mat.albedoColor = color(tint);
  mat.metallic = 0.9;
  mat.roughness = 0.26;
  return mat;
}

function makeHitbox(name, parent, targetId, size, position) {
  const box = BABYLON.MeshBuilder.CreateBox(name, {
    width: size.x,
    height: size.y,
    depth: size.z
  }, scene);
  box.parent = parent;
  box.position.copyFrom(position);
  box.visibility = 0.001;
  box.isPickable = true;
  box.metadata = { targetId, hitbox: true };
  return box;
}

function makeRing(name, radius, tube, hex, parent, rotation, alpha = 1) {
  const ring = BABYLON.MeshBuilder.CreateTorus(name, {
    diameter: radius * 2,
    thickness: tube,
    tessellation: 96
  }, scene);
  if (parent) ring.parent = parent;
  ring.rotation.copyFrom(rotation);
  const mat = new BABYLON.StandardMaterial(`${name}-mat`, scene);
  mat.diffuseColor = BABYLON.Color3.Black();
  mat.emissiveColor = color(hex);
  mat.alpha = alpha;
  ring.material = mat;
  ring.isPickable = false;
  return ring;
}

function makeDataLink(name, from, to, hex, offset = 0) {
  const mid = BABYLON.Vector3.Lerp(from, to, 0.5);
  mid.y += 3.2;
  const curve = BABYLON.Curve3.CreateQuadraticBezier(from, mid, to, 72);
  const points = curve.getPoints();

  const tube = BABYLON.MeshBuilder.CreateTube(`${name}-tube`, {
    path: points,
    radius: 0.018,
    tessellation: 12,
    cap: BABYLON.Mesh.NO_CAP
  }, scene);
  const tubeMat = new BABYLON.StandardMaterial(`${name}-tube-mat`, scene);
  tubeMat.diffuseColor = BABYLON.Color3.Black();
  tubeMat.emissiveColor = color(hex).scale(0.75);
  tubeMat.alpha = 0.42;
  tube.material = tubeMat;
  tube.isPickable = false;

  for (let i = 0; i < 3; i += 1) {
    const orb = BABYLON.MeshBuilder.CreateSphere(`${name}-signal-${i}`, {
      diameter: i === 0 ? 0.13 : 0.09,
      segments: 12
    }, scene);
    const orbMat = new BABYLON.StandardMaterial(`${name}-signal-mat-${i}`, scene);
    orbMat.diffuseColor = BABYLON.Color3.Black();
    orbMat.emissiveColor = color(hex).scale(1.5);
    orb.material = orbMat;
    orb.isPickable = false;
    animated.signals.push({
      mesh: orb,
      points,
      offset: (offset + i * 0.29) % 1,
      speed: 0.06 + i * 0.012
    });
  }
}

function createBrain() {
  const root = new BABYLON.TransformNode('brain-root', scene);
  root.position.set(0, 3.0, 0);

  const inner = BABYLON.MeshBuilder.CreateIcoSphere('brain-inner', {
    radius: 0.82,
    subdivisions: 4
  }, scene);
  inner.parent = root;
  inner.material = emissiveMaterial('brain-inner-mat', scene, '#42d9f5', 0.55);
  inner.isPickable = false;
  animated.pulsing.push({ mesh: inner, base: 1, amount: 0.07, speed: 2.3, phase: 0 });

  const shell = BABYLON.MeshBuilder.CreateIcoSphere('brain-shell', {
    radius: 1.42,
    subdivisions: 2,
    flat: true
  }, scene);
  shell.parent = root;
  const shellMat = new BABYLON.StandardMaterial('brain-shell-mat', scene);
  shellMat.wireframe = true;
  shellMat.emissiveColor = color('#31a9c3');
  shellMat.alpha = 0.82;
  shell.material = shellMat;
  shell.isPickable = false;
  animated.rotating.push({ node: shell, x: 0.09, y: 0.17, z: 0.035 });

  const outer = BABYLON.MeshBuilder.CreateIcoSphere('brain-outer-shell', {
    radius: 1.78,
    subdivisions: 1,
    flat: true
  }, scene);
  outer.parent = root;
  const outerMat = new BABYLON.StandardMaterial('brain-outer-mat', scene);
  outerMat.wireframe = true;
  outerMat.emissiveColor = color('#234f63');
  outerMat.alpha = 0.36;
  outer.material = outerMat;
  outer.isPickable = false;
  animated.rotating.push({ node: outer, x: -0.04, y: -0.08, z: 0.02 });

  const ring1 = makeRing('brain-ring-1', 2.0, 0.045, '#63d5e8', root, new BABYLON.Vector3(Math.PI / 2, 0, 0), 0.92);
  const ring2 = makeRing('brain-ring-2', 2.3, 0.034, '#5573ff', root, new BABYLON.Vector3(0.8, 0.35, 0.2), 0.78);
  const ring3 = makeRing('brain-ring-3', 2.58, 0.026, '#63d6a2', root, new BABYLON.Vector3(1.18, -0.42, 0.4), 0.64);
  animated.rotating.push(
    { node: ring1, x: 0.02, y: 0.14, z: 0.03 },
    { node: ring2, x: -0.05, y: -0.095, z: 0.025 },
    { node: ring3, x: 0.065, y: 0.05, z: -0.04 }
  );

  const halo = BABYLON.MeshBuilder.CreateCylinder('brain-halo', {
    diameterTop: 0.52,
    diameterBottom: 1.5,
    height: 5.5,
    tessellation: 48
  }, scene);
  halo.parent = root;
  halo.position.y = -0.65;
  const haloMat = new BABYLON.StandardMaterial('brain-halo-mat', scene);
  haloMat.emissiveColor = color('#1ebbd3');
  haloMat.alpha = 0.055;
  haloMat.backFaceCulling = false;
  halo.material = haloMat;
  halo.isPickable = false;

  for (let i = 0; i < 54; i += 1) {
    const node = BABYLON.MeshBuilder.CreateSphere(`neural-${i}`, {
      diameter: i % 7 === 0 ? 0.095 : 0.055,
      segments: 6
    }, scene);
    node.parent = root;
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = 1.62 + Math.random() * 1.18;
    node.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
    const mat = new BABYLON.StandardMaterial(`neural-mat-${i}`, scene);
    mat.emissiveColor = i % 8 === 0 ? color('#63d6a2') : color('#a4efff');
    node.material = mat;
    node.isPickable = false;
    animated.floating.push({
      mesh: node,
      baseY: node.position.y,
      amount: 0.04 + Math.random() * 0.08,
      speed: 0.7 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2
    });
  }

  makeHitbox(
    'brain-hitbox',
    root,
    'brain',
    new BABYLON.Vector3(4.9, 5.0, 4.9),
    BABYLON.Vector3.Zero()
  );

  return root;
}

function createAgent(id, position, accentHex) {
  const root = new BABYLON.TransformNode(`${id}-root`, scene);
  root.position.copyFrom(position);

  const base = BABYLON.MeshBuilder.CreateCylinder(`${id}-base`, {
    diameterTop: 2.2,
    diameterBottom: 2.75,
    height: 0.38,
    tessellation: 8
  }, scene);
  base.parent = root;
  base.position.y = 0.18;
  base.material = darkMetal(`${id}-base-mat`, scene);
  base.isPickable = false;

  const baseRing = makeRing(
    `${id}-base-ring`,
    1.08,
    0.055,
    accentHex,
    root,
    new BABYLON.Vector3(Math.PI / 2, 0, 0),
    0.95
  );
  baseRing.position.y = 0.41;

  const spine = BABYLON.MeshBuilder.CreateCylinder(`${id}-spine`, {
    diameterTop: 0.30,
    diameterBottom: 0.48,
    height: 1.55,
    tessellation: 10
  }, scene);
  spine.parent = root;
  spine.position.y = 1.08;
  spine.material = emissiveMaterial(`${id}-spine-mat`, scene, accentHex, 0.13);
  spine.isPickable = false;

  const chamber = BABYLON.MeshBuilder.CreateCapsule(`${id}-chamber`, {
    radius: 0.54,
    height: 1.5,
    tessellation: 20,
    subdivisions: 3
  }, scene);
  chamber.parent = root;
  chamber.position.y = 2.08;
  chamber.material = emissiveMaterial(`${id}-chamber-mat`, scene, accentHex, 0.34);
  chamber.isPickable = false;
  animated.pulsing.push({
    mesh: chamber,
    base: 1,
    amount: 0.035,
    speed: 1.7,
    phase: id === 'agent-01' ? 0 : Math.PI
  });

  const crown = makeRing(
    `${id}-crown`,
    0.74,
    0.032,
    accentHex,
    root,
    new BABYLON.Vector3(Math.PI / 2, 0, 0),
    0.82
  );
  crown.position.y = 2.9;
  animated.rotating.push({ node: crown, x: 0, y: 0.9, z: 0 });

  for (let i = 0; i < 4; i += 1) {
    const fin = BABYLON.MeshBuilder.CreateBox(`${id}-fin-${i}`, {
      width: 0.09,
      height: 1.18,
      depth: 0.42
    }, scene);
    fin.parent = root;
    const a = (i / 4) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 0.84, 1.82, Math.sin(a) * 0.84);
    fin.rotation.y = -a;
    fin.material = darkMetal(`${id}-fin-mat-${i}`, scene, '#102028');
    fin.isPickable = false;
  }

  makeHitbox(
    `${id}-hitbox`,
    root,
    id,
    new BABYLON.Vector3(3.2, 4.4, 3.2),
    new BABYLON.Vector3(0, 1.5, 0)
  );

  return root;
}

function createStation(station, index) {
  const radius = 5.7;
  const root = new BABYLON.TransformNode(`${station.id}-root`, scene);
  root.position.set(Math.cos(station.angle) * radius, 0, Math.sin(station.angle) * radius);
  root.rotation.y = -station.angle + Math.PI / 2;

  const base = BABYLON.MeshBuilder.CreateCylinder(`${station.id}-base`, {
    diameterTop: 1.65,
    diameterBottom: 2.0,
    height: 0.3,
    tessellation: 6
  }, scene);
  base.parent = root;
  base.position.y = 0.15;
  base.material = darkMetal(`${station.id}-base-mat`, scene);
  base.isPickable = false;

  const neck = BABYLON.MeshBuilder.CreateCylinder(`${station.id}-neck`, {
    diameterTop: 0.22,
    diameterBottom: 0.42,
    height: 1.42,
    tessellation: 8
  }, scene);
  neck.parent = root;
  neck.position.y = 0.96;
  neck.material = darkMetal(`${station.id}-neck-mat`, scene, '#13242b');
  neck.isPickable = false;

  const frame = BABYLON.MeshBuilder.CreateBox(`${station.id}-frame`, {
    width: 1.95,
    height: 1.2,
    depth: 0.16
  }, scene);
  frame.parent = root;
  frame.position.set(0, 1.82, 0.09);
  frame.rotation.x = -0.16;
  frame.material = darkMetal(`${station.id}-frame-mat`, scene, '#0e1a20');
  frame.isPickable = false;

  const screen = BABYLON.MeshBuilder.CreatePlane(`${station.id}-screen`, {
    width: 1.72,
    height: 0.95
  }, scene);
  screen.parent = root;
  screen.position.set(0, 1.82, 0.185);
  screen.rotation.x = -0.16;
  const screenMat = new BABYLON.StandardMaterial(`${station.id}-screen-mat`, scene);
  screenMat.diffuseColor = BABYLON.Color3.Black();
  screenMat.emissiveColor = index % 2 ? color('#173f4c') : color('#1b5260');
  screenMat.alpha = 0.94;
  screen.material = screenMat;
  screen.isPickable = false;

  const emitter = makeRing(
    `${station.id}-emitter`,
    0.62,
    0.025,
    index % 2 ? '#63d5e8' : '#63d6a2',
    root,
    new BABYLON.Vector3(Math.PI / 2, 0, 0),
    0.78
  );
  emitter.position.set(0, 2.62, 0);
  animated.rotating.push({ node: emitter, x: 0, y: 0.5 + index * 0.04, z: 0 });

  makeHitbox(
    `${station.id}-hitbox`,
    root,
    station.id,
    new BABYLON.Vector3(2.8, 3.2, 2.2),
    new BABYLON.Vector3(0, 1.45, 0)
  );

  return root;
}

function createArchitecture() {
  const floor = BABYLON.MeshBuilder.CreateCylinder('platform', {
    diameterTop: 12.8,
    diameterBottom: 14.1,
    height: 0.55,
    tessellation: 96
  }, scene);
  floor.position.y = 0.2;
  floor.material = darkMetal('platform-mat', scene, '#071015');
  floor.isPickable = false;

  const floorRing = makeRing(
    'platform-ring',
    6.15,
    0.045,
    '#3a94a8',
    null,
    new BABYLON.Vector3(Math.PI / 2, 0, 0),
    0.7
  );
  floorRing.position.y = 0.48;

  const innerRing = makeRing(
    'platform-inner-ring',
    3.0,
    0.025,
    '#183f49',
    null,
    new BABYLON.Vector3(Math.PI / 2, 0, 0),
    0.7
  );
  innerRing.position.y = 0.49;

  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * Math.PI * 2;
    const height = 2.2 + (i % 5) * 0.44;
    const pylon = BABYLON.MeshBuilder.CreateBox(`outer-pylon-${i}`, {
      width: 0.12,
      height,
      depth: 0.12
    }, scene);
    pylon.position.set(Math.cos(a) * 8.3, height / 2, Math.sin(a) * 8.3);
    const pylonMat = new BABYLON.StandardMaterial(`outer-pylon-mat-${i}`, scene);
    pylonMat.emissiveColor = i % 3 === 0 ? color('#2a7889') : color('#173541');
    pylonMat.alpha = 0.58;
    pylon.material = pylonMat;
    pylon.isPickable = false;
  }
}

function configurePicking(canvas) {
  scene.onPointerObservable.add((pointerInfo) => {
    const e = pointerInfo.event;
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
      pointerDown = { x: e.clientX, y: e.clientY };
      pointerMoved = false;
    }

    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE && pointerDown) {
      const dx = e.clientX - pointerDown.x;
      const dy = e.clientY - pointerDown.y;
      if (Math.hypot(dx, dy) > 7) pointerMoved = true;
    }

    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
      const pick = scene.pick(scene.pointerX, scene.pointerY, (mesh) => Boolean(mesh?.metadata?.targetId));
      const nextHovered = pick?.hit ? pick.pickedMesh : null;
      if (nextHovered !== hoveredMesh) {
        hoveredMesh = nextHovered;
        canvas.style.cursor = hoveredMesh ? 'pointer' : 'grab';
      }
    }

    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
      if (!pointerMoved) {
        const pick = scene.pick(scene.pointerX, scene.pointerY, (mesh) => Boolean(mesh?.metadata?.targetId));
        const targetId = pick?.pickedMesh?.metadata?.targetId;
        if (targetId) openTarget(targetId);
      }
      pointerDown = null;
      pointerMoved = false;
    }
  });
}

function createParticles() {
  const ps = new BABYLON.ParticleSystem('ambient-particles', 900, scene);
  ps.particleTexture = new BABYLON.Texture(
    'https://playground.babylonjs.com/textures/flare.png',
    scene,
    true,
    false
  );
  ps.emitter = new BABYLON.Vector3(0, 3.0, 0);
  ps.minEmitBox = new BABYLON.Vector3(-7, -0.8, -7);
  ps.maxEmitBox = new BABYLON.Vector3(7, 5.5, 7);
  ps.color1 = new BABYLON.Color4(0.25, 0.78, 0.95, 0.28);
  ps.color2 = new BABYLON.Color4(0.38, 0.9, 0.67, 0.18);
  ps.colorDead = new BABYLON.Color4(0.02, 0.08, 0.11, 0);
  ps.minSize = 0.018;
  ps.maxSize = 0.07;
  ps.minLifeTime = 3;
  ps.maxLifeTime = 7;
  ps.emitRate = 44;
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  ps.gravity = BABYLON.Vector3.Zero();
  ps.direction1 = new BABYLON.Vector3(-0.03, 0.05, -0.03);
  ps.direction2 = new BABYLON.Vector3(0.03, 0.14, 0.03);
  ps.minAngularSpeed = 0;
  ps.maxAngularSpeed = Math.PI;
  ps.minEmitPower = 0.02;
  ps.maxEmitPower = 0.06;
  ps.updateSpeed = 0.016;
  ps.start();
}

function updateAnimations() {
  const dt = engine.getDeltaTime() / 1000;
  time += dt;

  for (const item of animated.rotating) {
    item.node.rotation.x += item.x * dt;
    item.node.rotation.y += item.y * dt;
    item.node.rotation.z += item.z * dt;
  }

  for (const item of animated.pulsing) {
    const s = item.base + Math.sin(time * item.speed + item.phase) * item.amount;
    item.mesh.scaling.setAll(s);
  }

  for (const item of animated.floating) {
    item.mesh.position.y = item.baseY + Math.sin(time * item.speed + item.phase) * item.amount;
  }

  for (const signal of animated.signals) {
    const normalized = (time * signal.speed + signal.offset) % 1;
    const idx = Math.min(signal.points.length - 1, Math.floor(normalized * (signal.points.length - 1)));
    signal.mesh.position.copyFrom(signal.points[idx]);
  }
}

async function createEngine(canvas) {
  if (navigator.gpu && BABYLON.WebGPUEngine) {
    try {
      const webgpu = new BABYLON.WebGPUEngine(canvas, {
        antialias: true,
        adaptToDeviceRatio: true
      });
      await webgpu.initAsync();
      engineMode = 'WEBGPU';
      return webgpu;
    } catch (error) {
      console.warn('WebGPU init failed; falling back to WebGL.', error);
    }
  }

  engineMode = 'WEBGL2';
  return new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    disableWebGL2Support: false
  }, true);
}

async function buildScene(canvas) {
  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.008, 0.015, 0.02, 1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogColor = color('#020608');
  scene.fogDensity = 0.025;

  camera = new BABYLON.ArcRotateCamera(
    'camera',
    -Math.PI / 2,
    1.08,
    15.8,
    new BABYLON.Vector3(0, 2.0, 0),
    scene
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 7.6;
  camera.upperRadiusLimit = 22;
  camera.lowerBetaLimit = 0.32;
  camera.upperBetaLimit = 1.45;
  camera.wheelDeltaPercentage = 0.012;
  camera.panningSensibility = 0;
  camera.inertia = 0.84;

  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.32;
  hemi.diffuse = color('#9bdde8');
  hemi.groundColor = color('#05080b');

  const brainLight = new BABYLON.PointLight('brain-light', new BABYLON.Vector3(0, 4.2, 0), scene);
  brainLight.diffuse = color('#63d5e8');
  brainLight.intensity = 14;
  brainLight.range = 18;

  const sideLightA = new BABYLON.PointLight('side-a', new BABYLON.Vector3(-6, 3.8, 0), scene);
  sideLightA.diffuse = color('#63d6a2');
  sideLightA.intensity = 5.5;
  sideLightA.range = 12;

  const sideLightB = new BABYLON.PointLight('side-b', new BABYLON.Vector3(6, 3.8, 0), scene);
  sideLightB.diffuse = color('#6d7dff');
  sideLightB.intensity = 5.5;
  sideLightB.range = 12;

  const glow = new BABYLON.GlowLayer('glow', scene, {
    mainTextureFixedSize: 1024,
    blurKernelSize: 64
  });
  glow.intensity = 0.75;

  const pipeline = new BABYLON.DefaultRenderingPipeline('pipeline', true, scene, [camera]);
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.72;
  pipeline.bloomWeight = 0.22;
  pipeline.bloomKernel = 56;
  pipeline.fxaaEnabled = true;

  createArchitecture();
  createBrain();

  const agent1Pos = new BABYLON.Vector3(-4.0, 0.5, 0.25);
  const agent2Pos = new BABYLON.Vector3(4.0, 0.5, 0.25);
  createAgent('agent-01', agent1Pos, '#63d6a2');
  createAgent('agent-02', agent2Pos, '#6d7dff');

  makeDataLink(
    'brain-to-agent-01',
    new BABYLON.Vector3(-1.2, 3.1, 0),
    agent1Pos.add(new BABYLON.Vector3(0, 2.2, 0)),
    '#63d6a2',
    0.1
  );
  makeDataLink(
    'brain-to-agent-02',
    new BABYLON.Vector3(1.2, 3.1, 0),
    agent2Pos.add(new BABYLON.Vector3(0, 2.2, 0)),
    '#6d7dff',
    0.52
  );

  stations.forEach((station, index) => {
    const root = createStation(station, index);
    const stationWorld = root.position.add(new BABYLON.Vector3(0, 1.7, 0));
    makeDataLink(
      `brain-to-${station.id}`,
      new BABYLON.Vector3(0, 2.6, 0),
      stationWorld,
      index % 2 ? '#2f7381' : '#376b72',
      index / stations.length
    );
  });

  createParticles();
  configurePicking(canvas);
  scene.registerBeforeRender(updateAnimations);
  return scene;
}

async function initRuntime() {
  if (renderStarted) {
    engine?.resize();
    return;
  }

  if (!window.BABYLON) {
    loginError.textContent = 'Nie udało się załadować silnika 3D.';
    return;
  }

  const canvas = $('#worldCanvas');
  engineMetric.textContent = 'BOOT';

  try {
    engine = await createEngine(canvas);
    engineMetric.textContent = engineMode;
    await buildScene(canvas);

    engine.runRenderLoop(() => {
      scene?.render();
    });

    window.addEventListener('resize', () => engine?.resize());
    renderStarted = true;
  } catch (error) {
    console.error(error);
    engineMetric.textContent = 'ERROR';
    guideTitle.textContent = 'Renderer error';
    guideCopy.textContent = 'Silnik 3D nie uruchomił się. Otwórz konsolę przeglądarki, aby zobaczyć szczegóły.';
  }
}

if (sessionStorage.getItem(AUTH_KEY) === '1') {
  authenticate();
}