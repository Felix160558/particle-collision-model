import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";

const PARTICLE_COUNT = 500;
const BOX_SIZE = 1.55;
const HALF_BOX = BOX_SIZE / 2;
const PARTICLE_RADIUS = 0.011;
const THERMAL_SCALE = 1.05;
const REFERENCE_TEMPERATURE = 300;
const ENERGY_MAX = 20;
const BIN_COUNT = 40;
const BIN_WIDTH = ENERGY_MAX / BIN_COUNT;
const SAMPLE_TARGET = 10000;
const BATCH_SIZE = 1000;

const stage = document.querySelector("#vrStage");
const loading = document.querySelector("#vrLoading");
const xrState = document.querySelector("#xrState");
const desktopTemperature = document.querySelector("#desktopTemperature");
const desktopSample = document.querySelector("#desktopSample");
const desktopButtons = [...document.querySelectorAll("[data-action]")];
const webxrNote = document.querySelector("#webxrNote");

let renderer;
let scene;
let camera;
let orbitControls;
let particleMesh;
let shellMesh;
let panelTexture;
let panelCanvas;
let panelContext;
let temperature = REFERENCE_TEMPERATURE;
let running = true;
let shellsVisible = false;
let lastTime = performance.now();
let statsTimer = 0;
let meanEnergy = 0;
let maximumEnergy = 0;
let histogramCounts = new Uint32Array(BIN_COUNT);
let sampleCount = 0;
let overflowCount = 0;
let collecting = false;
let collectionBatch = 0;
let collectionNextTime = 0;
let firstBatchCounts = null;
let revealBin = 0;
let distributionReady = false;
let curveMode = false;
let curveAnimating = false;
let curveStartTime = 0;
let curveProgress = 0;
let panelDirty = true;
let lastPanelDrawTime = 0;

const positions = new Float32Array(PARTICLE_COUNT * 3);
const velocities = new Float32Array(PARTICLE_COUNT * 3);
const matrix = new THREE.Matrix4();
const interactiveMeshes = [];
const buttonMeshes = new Map();
const controllers = [];
const raycaster = new THREE.Raycaster();
const controllerRotation = new THREE.Matrix4();
const clock = new THREE.Clock();

function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function randomVelocity(target, offset, targetTemperature = temperature) {
  const thermal = THERMAL_SCALE * Math.sqrt(targetTemperature / REFERENCE_TEMPERATURE);
  target[offset] = gaussianRandom() * thermal;
  target[offset + 1] = gaussianRandom() * thermal;
  target[offset + 2] = gaussianRandom() * thermal;
}

function speedAt(index) {
  const offset = index * 3;
  return Math.hypot(velocities[offset], velocities[offset + 1], velocities[offset + 2]);
}

function makeTextPlane(text, width, height, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = options.canvasWidth ?? 1024;
  canvas.height = Math.round(canvas.width * height / width);
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.userData.canvas = canvas;
  mesh.userData.context = context;
  mesh.userData.texture = texture;
  drawTextPlane(mesh, text, options);
  return mesh;
}

function drawTextPlane(mesh, text, options = {}) {
  const { canvas, context, texture } = mesh.userData;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = options.background ?? "rgba(7,7,7,.94)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = options.border ?? "rgba(255,255,255,.28)";
  context.lineWidth = 3;
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  context.fillStyle = options.color ?? "#d8d8d8";
  context.font = `${options.weight ?? 600} ${options.fontSize ?? Math.round(canvas.height * .25)}px ui-monospace, monospace`;
  context.textAlign = options.align ?? "center";
  context.textBaseline = "middle";
  context.fillText(text, options.align === "left" ? 30 : canvas.width / 2, canvas.height / 2);
  texture.needsUpdate = true;
}

function createEnvironment() {
  const grid = new THREE.GridHelper(12, 24, 0x454545, 0x181818);
  grid.position.y = 0;
  scene.add(grid);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.35, .045, 64),
    new THREE.MeshBasicMaterial({ color: 0x090909, transparent: true, opacity: .95 }),
  );
  platform.position.set(0, .025, -2.25);
  scene.add(platform);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.18, 1.2, 64),
    new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: .35, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, .051, -2.25);
  scene.add(ring);

  const labLabel = makeTextPlane("THE CURVE IS COUNTED · NOT DRAWN", 1.52, .12, {
    background: "rgba(5,5,5,.72)", border: "rgba(255,255,255,.16)", color: "#9a9a9a", fontSize: 40,
  });
  labLabel.position.set(0, 2.53, -2.25);
  scene.add(labLabel);
}

function createParticleBox() {
  const group = new THREE.Group();
  group.position.set(0, 1.42, -2.25);
  scene.add(group);

  const volume = new THREE.Mesh(
    new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .012, side: THREE.DoubleSide, depthWrite: false }),
  );
  group.add(volume);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .68 }),
  );
  group.add(edges);

  const glowEdges = edges.clone();
  glowEdges.material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .1, blending: THREE.AdditiveBlending });
  glowEdges.scale.setScalar(1.01);
  group.add(glowEdges);

  const geometry = new THREE.IcosahedronGeometry(PARTICLE_RADIUS, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  particleMesh = new THREE.InstancedMesh(geometry, material, PARTICLE_COUNT);
  particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particleMesh.frustumCulled = false;
  group.add(particleMesh);

  const shellGeometry = new THREE.SphereGeometry(1, 10, 7);
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: .055, wireframe: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  shellMesh = new THREE.InstancedMesh(shellGeometry, shellMaterial, PARTICLE_COUNT);
  shellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shellMesh.frustumCulled = false;
  shellMesh.visible = false;
  group.add(shellMesh);

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const offset = index * 3;
    positions[offset] = THREE.MathUtils.randFloatSpread(BOX_SIZE - PARTICLE_RADIUS * 2);
    positions[offset + 1] = THREE.MathUtils.randFloatSpread(BOX_SIZE - PARTICLE_RADIUS * 2);
    positions[offset + 2] = THREE.MathUtils.randFloatSpread(BOX_SIZE - PARTICLE_RADIUS * 2);
    randomVelocity(velocities, offset);
  }
  updateParticleMatrices();

  const boxLabel = makeTextPlane("500 EQUAL-VOLUME MOLECULES", 1.05, .09, {
    background: "rgba(5,5,5,.78)", border: "rgba(255,255,255,.13)", color: "#8c8c8c", fontSize: 34,
  });
  boxLabel.position.set(0, .88, .78);
  group.add(boxLabel);
}

function updateParticleMatrices() {
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const offset = index * 3;
    matrix.makeTranslation(positions[offset], positions[offset + 1], positions[offset + 2]);
    particleMesh.setMatrixAt(index, matrix);

    if (shellsVisible) {
      const radius = Math.max(speedAt(index) * .025, .006);
      matrix.makeScale(radius, radius, radius);
      matrix.setPosition(positions[offset], positions[offset + 1], positions[offset + 2]);
      shellMesh.setMatrixAt(index, matrix);
    }
  }
  particleMesh.instanceMatrix.needsUpdate = true;
  if (shellsVisible) shellMesh.instanceMatrix.needsUpdate = true;
}

function updateParticles(deltaTime) {
  if (!running) return;
  const bound = HALF_BOX - PARTICLE_RADIUS;
  const motionScale = .18;
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const offset = index * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      const component = offset + axis;
      positions[component] += velocities[component] * deltaTime * motionScale;
      if (positions[component] > bound) {
        positions[component] = 2 * bound - positions[component];
        velocities[component] *= -1;
      } else if (positions[component] < -bound) {
        positions[component] = -2 * bound - positions[component];
        velocities[component] *= -1;
      }
    }
  }
  updateParticleMatrices();
}

function createControlConsole() {
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(-1.32, 1.55, -2.12);
  consoleGroup.rotation.y = .2;
  scene.add(consoleGroup);

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(.82, 1.42),
    new THREE.MeshBasicMaterial({ color: 0x070707, transparent: true, opacity: .92, side: THREE.DoubleSide }),
  );
  consoleGroup.add(back);
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(.82, 1.42)),
    new THREE.LineBasicMaterial({ color: 0x777777, transparent: true, opacity: .45 }),
  );
  frame.position.z = .002;
  consoleGroup.add(frame);

  const title = makeTextPlane("VR CONTROL CONSOLE", .7, .1, { background: "#090909", border: "rgba(255,255,255,.14)", color: "#888", fontSize: 36 });
  title.position.set(0, .61, .012);
  consoleGroup.add(title);

  const temperatureLabel = makeTextPlane("TEMPERATURE · 300 K", .7, .1, { background: "#090909", border: "rgba(255,255,255,.14)", color: "#fff", fontSize: 37 });
  temperatureLabel.position.set(0, .48, .012);
  temperatureLabel.userData.role = "temperature";
  consoleGroup.add(temperatureLabel);

  const definitions = [
    ["toggle-run", "PAUSE", .32],
    ["temperature-down", "− 100 K", .16],
    ["temperature-up", "+ 100 K", 0],
    ["count", "COUNT 10,000", -.16],
    ["curve", "FORM CURVE", -.32],
    ["shells", "VELOCITY SHELLS · OFF", -.48],
  ];

  definitions.forEach(([action, label, y]) => {
    const button = makeTextPlane(label, .7, .12, { background: "#0b0b0b", border: "rgba(255,255,255,.28)", color: "#c8c8c8", fontSize: 38 });
    button.position.set(0, y, .018);
    button.userData.action = action;
    button.userData.enabled = action !== "curve";
    interactiveMeshes.push(button);
    buttonMeshes.set(action, button);
    consoleGroup.add(button);
  });

  consoleGroup.userData.temperatureLabel = temperatureLabel;
}

function createStatisticsPanel() {
  panelCanvas = document.createElement("canvas");
  panelCanvas.width = 1024;
  panelCanvas.height = 1024;
  panelContext = panelCanvas.getContext("2d");
  panelTexture = new THREE.CanvasTexture(panelCanvas);
  panelTexture.colorSpace = THREE.SRGBColorSpace;
  panelTexture.minFilter = THREE.LinearFilter;

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.18, 1.18),
    new THREE.MeshBasicMaterial({ map: panelTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  panel.position.set(1.35, 1.53, -2.13);
  panel.rotation.y = -.2;
  scene.add(panel);
  drawStatisticsPanel();
}

function drawStatisticsPanel() {
  const context = panelContext;
  const width = panelCanvas.width;
  const height = panelCanvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(7,7,7,.95)";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(255,255,255,.3)";
  context.lineWidth = 3;
  context.strokeRect(2, 2, width - 4, height - 4);

  context.fillStyle = "#777";
  context.font = "700 25px ui-monospace, monospace";
  context.fillText("ENERGY STATISTICS / IMMERSIVE", 54, 64);
  context.fillStyle = "#f2f2f2";
  context.font = "500 43px Inter, sans-serif";
  context.fillText("Maxwell–Boltzmann Distribution", 54, 118);

  context.strokeStyle = "rgba(255,255,255,.13)";
  context.beginPath();
  context.moveTo(54, 151);
  context.lineTo(970, 151);
  context.stroke();

  context.fillStyle = "#666";
  context.font = "600 23px ui-monospace, monospace";
  context.fillText("TEMPERATURE", 54, 198);
  context.fillText("MEAN ENERGY", 365, 198);
  context.fillText("MAX ENERGY", 680, 198);
  context.fillStyle = "#fff";
  context.font = "500 38px ui-monospace, monospace";
  context.fillText(`${temperature} K`, 54, 242);
  context.fillText(meanEnergy.toFixed(3), 365, 242);
  context.fillText(maximumEnergy.toFixed(3), 680, 242);

  context.fillStyle = "#666";
  context.font = "600 22px ui-monospace, monospace";
  context.fillText(`COUNTED ${sampleCount.toLocaleString()} / ${SAMPLE_TARGET.toLocaleString()}`, 54, 300);
  context.textAlign = "right";
  context.fillText(`E > ${ENERGY_MAX}: ${overflowCount.toLocaleString()}`, 970, 300);
  context.textAlign = "left";

  const chartX = 74;
  const chartY = 350;
  const chartWidth = 880;
  const chartHeight = 520;
  context.strokeStyle = "rgba(255,255,255,.09)";
  context.lineWidth = 2;
  for (let row = 0; row <= 4; row += 1) {
    const y = chartY + chartHeight * row / 4;
    context.beginPath(); context.moveTo(chartX, y); context.lineTo(chartX + chartWidth, y); context.stroke();
  }
  for (let column = 0; column <= 8; column += 1) {
    const x = chartX + chartWidth * column / 8;
    context.beginPath(); context.moveTo(x, chartY); context.lineTo(x, chartY + chartHeight); context.stroke();
  }

  const maximumCount = Math.max(...histogramCounts, 1) * 1.08;
  const gap = 3;
  const barWidth = chartWidth / BIN_COUNT;
  const barAlpha = curveMode ? Math.max(1 - curveProgress, 0) : 1;
  context.globalAlpha = barAlpha;
  for (let index = 0; index < BIN_COUNT; index += 1) {
    const barHeight = histogramCounts[index] / maximumCount * chartHeight;
    context.fillStyle = "rgba(255,255,255,.18)";
    context.strokeStyle = "rgba(255,255,255,.62)";
    context.lineWidth = 2;
    context.fillRect(chartX + index * barWidth + gap / 2, chartY + chartHeight - barHeight, barWidth - gap, barHeight);
    context.strokeRect(chartX + index * barWidth + gap / 2, chartY + chartHeight - barHeight, barWidth - gap, barHeight);
  }
  context.globalAlpha = 1;

  if (curveMode && sampleCount === SAMPLE_TARGET) {
    const points = Array.from(histogramCounts, (count, index) => ({
      x: chartX + (index + .5) * barWidth,
      y: chartY + chartHeight - count / maximumCount * chartHeight,
    }));
    const visiblePointCount = Math.max(2, Math.ceil(points.length * curveProgress));
    context.beginPath();
    context.moveTo(chartX, chartY + chartHeight);
    context.lineTo(points[0].x, points[0].y);
    for (let index = 0; index < visiblePointCount - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const middleX = (current.x + next.x) / 2;
      const middleY = (current.y + next.y) / 2;
      context.quadraticCurveTo(current.x, current.y, middleX, middleY);
    }
    if (visiblePointCount === points.length) {
      const last = points[points.length - 1];
      context.quadraticCurveTo(last.x, last.y, chartX + chartWidth, chartY + chartHeight);
    }
    context.strokeStyle = "#ffffff";
    context.lineWidth = 5;
    context.shadowColor = "rgba(255,255,255,.55)";
    context.shadowBlur = 14;
    context.stroke();
    context.shadowBlur = 0;
  }

  context.fillStyle = "#5f5f5f";
  context.font = "600 21px ui-monospace, monospace";
  context.fillText("0", chartX, 912);
  context.textAlign = "right";
  context.fillText(`${ENERGY_MAX} KINETIC ENERGY →`, chartX + chartWidth, 912);
  context.textAlign = "left";
  context.fillStyle = distributionReady ? "#d6d6d6" : "#666";
  context.fillText(collecting ? `COUNTING ENSEMBLE ${Math.min(collectionBatch + 1, 10)} / 10` : distributionReady ? curveMode ? "CONTINUOUS CURVE FROM COUNTED BINS" : "HISTOGRAM COMPLETE · CURVE READY" : "COUNT MICROSCOPIC ENERGIES TO BEGIN", 54, 970);

  panelTexture.needsUpdate = true;
  panelDirty = false;
}

function calculateLiveStatistics() {
  let total = 0;
  let maximum = 0;
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const speed = speedAt(index);
    const energy = .5 * speed * speed;
    total += energy;
    maximum = Math.max(maximum, energy);
  }
  meanEnergy = total / PARTICLE_COUNT;
  maximumEnergy = maximum;
  panelDirty = true;
}

function createStatisticalBatch() {
  const counts = new Uint32Array(BIN_COUNT);
  let overflow = 0;
  const velocity = new Float32Array(3);
  for (let sample = 0; sample < BATCH_SIZE; sample += 1) {
    randomVelocity(velocity, 0);
    const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
    const energy = .5 * speed * speed;
    if (energy >= ENERGY_MAX) overflow += 1;
    else counts[Math.floor(energy / BIN_WIDTH)] += 1;
  }
  return { counts, overflow };
}

function addBatch(batch) {
  batch.counts.forEach((count, index) => { histogramCounts[index] += count; });
  overflowCount += batch.overflow;
  sampleCount += BATCH_SIZE;
  panelDirty = true;
  updateUI();
}

function beginCollection() {
  if (collecting) return;
  histogramCounts = new Uint32Array(BIN_COUNT);
  sampleCount = 0;
  overflowCount = 0;
  collecting = true;
  collectionBatch = 0;
  revealBin = 0;
  firstBatchCounts = createStatisticalBatch();
  collectionNextTime = performance.now() + 80;
  distributionReady = false;
  curveMode = false;
  curveAnimating = false;
  curveProgress = 0;
  panelDirty = true;
  updateUI();
}

function updateCollection(now) {
  if (!collecting || now < collectionNextTime) return;
  if (collectionBatch === 0) {
    histogramCounts[revealBin] += firstBatchCounts.counts[revealBin];
    revealBin += 1;
    panelDirty = true;
    collectionNextTime = now + 35;
    if (revealBin >= BIN_COUNT) {
      overflowCount += firstBatchCounts.overflow;
      sampleCount = BATCH_SIZE;
      collectionBatch = 1;
      collectionNextTime = now + 180;
      updateUI();
    }
    return;
  }

  addBatch(createStatisticalBatch());
  collectionBatch += 1;
  collectionNextTime = now + 180;
  if (collectionBatch >= SAMPLE_TARGET / BATCH_SIZE) {
    collecting = false;
    distributionReady = true;
    panelDirty = true;
    updateUI();
  }
}

function beginCurve() {
  if (!distributionReady || curveAnimating) return;
  curveMode = true;
  curveAnimating = true;
  curveStartTime = performance.now();
  curveProgress = 0;
  panelDirty = true;
  updateUI();
}

function updateCurve(now) {
  if (!curveAnimating) return;
  curveProgress = Math.min((now - curveStartTime) / 2600, 1);
  panelDirty = true;
  if (curveProgress >= 1) {
    curveAnimating = false;
    updateUI();
  }
}

function setTemperature(nextTemperature) {
  const clamped = THREE.MathUtils.clamp(nextTemperature, 100, 900);
  if (clamped === temperature) return;
  const scale = Math.sqrt(clamped / temperature);
  velocities.forEach((value, index) => { velocities[index] = value * scale; });
  temperature = clamped;
  histogramCounts = new Uint32Array(BIN_COUNT);
  sampleCount = 0;
  overflowCount = 0;
  collecting = false;
  distributionReady = false;
  curveMode = false;
  curveAnimating = false;
  curveProgress = 0;
  calculateLiveStatistics();
  updateControlLabels();
  updateUI();
}

function updateControlLabels() {
  const runButton = buttonMeshes.get("toggle-run");
  const curveButton = buttonMeshes.get("curve");
  const shellButton = buttonMeshes.get("shells");
  if (runButton) drawTextPlane(runButton, running ? "PAUSE" : "PLAY", { background: "#0b0b0b", border: "rgba(255,255,255,.28)", color: "#d8d8d8", fontSize: 38 });
  if (curveButton) {
    curveButton.userData.enabled = distributionReady && !curveAnimating;
    drawTextPlane(curveButton, curveAnimating ? "FORMING CURVE…" : curveMode ? "REPLAY CURVE" : "FORM CURVE", {
      background: "#0b0b0b", border: curveButton.userData.enabled ? "rgba(255,255,255,.42)" : "rgba(255,255,255,.1)",
      color: curveButton.userData.enabled ? "#ffffff" : "#4b4b4b", fontSize: 38,
    });
  }
  if (shellButton) drawTextPlane(shellButton, `VELOCITY SHELLS · ${shellsVisible ? "ON" : "OFF"}`, { background: "#0b0b0b", border: "rgba(255,255,255,.28)", color: shellsVisible ? "#fff" : "#a0a0a0", fontSize: 34 });

  scene.traverse((object) => {
    if (object.userData.role === "temperature") drawTextPlane(object, `TEMPERATURE · ${temperature} K`, { background: "#090909", border: "rgba(255,255,255,.14)", color: "#fff", fontSize: 37 });
  });
}

function updateUI() {
  desktopTemperature.textContent = `${temperature} K`;
  desktopSample.textContent = `${sampleCount.toLocaleString()} / ${SAMPLE_TARGET.toLocaleString()}`;
  desktopButtons.forEach((button) => {
    const action = button.dataset.action;
    if (action === "toggle-run") button.textContent = running ? "PAUSE" : "PLAY";
    if (action === "curve") {
      button.disabled = !distributionReady || curveAnimating;
      button.textContent = curveAnimating ? "FORMING…" : curveMode ? "REPLAY CURVE" : "FORM CURVE";
    }
    if (action === "count") button.disabled = collecting;
    if (action === "shells") {
      button.setAttribute("aria-pressed", String(shellsVisible));
      button.textContent = `VELOCITY SHELLS · ${shellsVisible ? "ON" : "OFF"}`;
    }
  });
  updateControlLabels();
  panelDirty = true;
}

function performAction(action) {
  if (action === "toggle-run") running = !running;
  if (action === "temperature-down") setTemperature(temperature - 100);
  if (action === "temperature-up") setTemperature(temperature + 100);
  if (action === "count") beginCollection();
  if (action === "curve") beginCurve();
  if (action === "shells") {
    shellsVisible = !shellsVisible;
    shellMesh.visible = shellsVisible;
    if (shellsVisible) updateParticleMatrices();
  }
  updateUI();
}

function createXRControllers() {
  const controllerFactory = new XRControllerModelFactory();
  const handFactory = new XRHandModelFactory();
  const rayGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);

  for (let index = 0; index < 2; index += 1) {
    const controller = renderer.xr.getController(index);
    controller.addEventListener("selectstart", () => selectFromController(controller));
    const line = new THREE.Line(rayGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5 }));
    line.scale.z = 4;
    controller.add(line);
    scene.add(controller);
    controllers.push(controller);

    const grip = renderer.xr.getControllerGrip(index);
    grip.add(controllerFactory.createControllerModel(grip));
    scene.add(grip);

    const hand = renderer.xr.getHand(index);
    try { hand.add(handFactory.createHandModel(hand, "mesh")); } catch (error) { console.info("Hand model unavailable", error); }
    scene.add(hand);
  }
}

async function updateWebXRSupportMessage() {
  const heading = webxrNote.querySelector("strong");
  const detail = webxrNote.querySelector("span");
  webxrNote.classList.remove("supported", "unsupported");

  if (!window.isSecureContext) {
    webxrNote.classList.add("unsupported");
    heading.textContent = "HTTPS REQUIRED FOR IMMERSIVE VR";
    detail.textContent = "The desktop preview still works. Publish with GitHub Pages, then open its HTTPS address in Meta Quest Browser.";
    return;
  }

  if (!navigator.xr) {
    webxrNote.classList.add("unsupported");
    heading.textContent = "WEBXR NOT AVAILABLE HERE";
    detail.textContent = "Use the desktop mirror controls, or open the deployed HTTPS page in Meta Quest Browser.";
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-vr");
    webxrNote.classList.add(supported ? "supported" : "unsupported");
    heading.textContent = supported ? "IMMERSIVE HEADSET READY" : "NO IMMERSIVE HEADSET DETECTED";
    detail.textContent = supported
      ? "Select ENTER VR, then aim with either controller and press the trigger."
      : "The spatial scene remains available as a desktop preview.";
  } catch {
    webxrNote.classList.add("unsupported");
    heading.textContent = "WEBXR STATUS UNAVAILABLE";
    detail.textContent = "The desktop preview remains available; Meta Quest Browser can retry after deployment over HTTPS.";
  }
}

function intersectionsForController(controller) {
  controllerRotation.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(controllerRotation);
  return raycaster.intersectObjects(interactiveMeshes, false);
}

function selectFromController(controller) {
  const hit = intersectionsForController(controller).find((intersection) => intersection.object.userData.enabled !== false);
  if (!hit) return;
  const object = hit.object;
  object.scale.setScalar(.96);
  window.setTimeout(() => object.scale.setScalar(1), 110);
  performAction(object.userData.action);
}

function updateControllerHover() {
  interactiveMeshes.forEach((mesh) => { mesh.material.opacity = mesh.userData.enabled === false ? .55 : .9; });
  controllers.forEach((controller) => {
    const hit = intersectionsForController(controller).find((intersection) => intersection.object.userData.enabled !== false);
    if (hit) hit.object.material.opacity = 1;
  });
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030303);
  scene.fog = new THREE.FogExp2(0x030303, .075);

  camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, .01, 60);
  camera.position.set(0, 1.6, .65);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");
  stage.prepend(renderer.domElement);

  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.target.set(0, 1.43, -2.2);
  orbitControls.enableDamping = true;
  orbitControls.minDistance = 1.6;
  orbitControls.maxDistance = 5.5;

  const vrButton = VRButton.createButton(renderer, { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"] });
  document.body.appendChild(vrButton);
  updateWebXRSupportMessage();

  renderer.xr.addEventListener("sessionstart", () => {
    xrState.classList.add("immersive");
    xrState.querySelector("span").textContent = "IMMERSIVE SESSION";
    orbitControls.enabled = false;
  });
  renderer.xr.addEventListener("sessionend", () => {
    xrState.classList.remove("immersive");
    xrState.querySelector("span").textContent = "DESKTOP PREVIEW";
    orbitControls.enabled = true;
  });

  createEnvironment();
  createParticleBox();
  createControlConsole();
  createStatisticsPanel();
  createXRControllers();
  calculateLiveStatistics();
  updateUI();

  desktopButtons.forEach((button) => button.addEventListener("click", () => performAction(button.dataset.action)));
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.setTimeout(() => loading.classList.add("hidden"), 550);
  renderer.setAnimationLoop(animate);
}

function animate(now) {
  const deltaTime = Math.min((now - lastTime) / 1000, .033);
  lastTime = now;
  updateParticles(deltaTime);
  updateCollection(now);
  updateCurve(now);
  updateControllerHover();

  statsTimer += deltaTime;
  if (statsTimer >= .18) {
    statsTimer = 0;
    calculateLiveStatistics();
  }
  if (panelDirty && now - lastPanelDrawTime >= 40) {
    lastPanelDrawTime = now;
    drawStatisticsPanel();
  }
  if (!renderer.xr.isPresenting) orbitControls.update();
  renderer.render(scene, camera);
}

try {
  init();
} catch (error) {
  loading.querySelector("p").textContent = "IMMERSIVE LABORATORY UNAVAILABLE";
  console.error(error);
}
