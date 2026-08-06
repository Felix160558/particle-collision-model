import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

const EMBED_MODE = new URLSearchParams(window.location.search).get("embed") === "1";

const BOX_SIZE = 10;
const HALF_BOX = BOX_SIZE / 2;
const PARTICLE_RADIUS = 0.026;
const THERMAL_SCALE = 1.05;
const REFERENCE_TEMPERATURE = 300;
const VELOCITY_RADIUS_SCALE = 0.105;
const MAX_VISIBLE_VECTORS = 160;

const viewport = document.querySelector("#threeViewport");
const startCurtain = document.querySelector("#startCurtain");
const startButton = document.querySelector("#startButton");
const playButton = document.querySelector("#playButton");
const pauseButton = document.querySelector("#pauseButton");
const resetButton = document.querySelector("#resetButton");
const generateButton = document.querySelector("#generateButton");
const curveButton = document.querySelector("#curveButton");
const temperatureSlider = document.querySelector("#temperatureSlider");
const temperatureReadout = document.querySelector("#temperatureReadout");
const velocityToggle = document.querySelector("#velocityToggle");
const compareToggle = document.querySelector("#compareToggle");
const compareModeHint = document.querySelector("#compareModeHint");
const velocityModeHint = document.querySelector("#velocityModeHint");
const averageSpeedReadout = document.querySelector("#averageSpeed");
const maximumSpeedReadout = document.querySelector("#maximumSpeed");
const averageEnergyReadout = document.querySelector("#averageEnergy");
const maximumEnergyReadout = document.querySelector("#maximumEnergy");
const sampleSpeedReadouts = [0, 1, 2].map((index) => document.querySelector(`#sampleSpeed${index}`));
const sampleEnergyReadouts = [0, 1, 2].map((index) => document.querySelector(`#sampleEnergy${index}`));
const histogramBars = document.querySelector("#histogramBars");
const histogramStatus = document.querySelector("#histogramStatus");
const histogramRange = document.querySelector("#histogramRange");
const histogramAxisMax = document.querySelector("#histogramAxisMax");
const histogramPipelineState = document.querySelector("#histogramPipelineState");
const curvePipelineState = document.querySelector("#curvePipelineState");
const histogramChart = document.querySelector("#histogramChart");
const histogramCurve = document.querySelector("#histogramCurve");
const histogramCurvePath = document.querySelector("#histogramCurvePath");
const histogramCurvePoints = document.querySelector("#histogramCurvePoints");
const histogramReference = document.querySelector("#histogramReference");
const histogramReferencePath = document.querySelector("#histogramReferencePath");
const curveLegend = document.querySelector("#curveLegend");
const referenceTemperature = document.querySelector("#referenceTemperature");
const currentCurveTemperature = document.querySelector("#currentCurveTemperature");
const histogramProgress = document.querySelector("#histogramProgress");
const overflowReadout = document.querySelector("#overflowReadout");
const yScaleReadout = document.querySelector("#yScaleReadout");
const ensembleIndicator = document.querySelector("#ensembleIndicator");
const ensembleBatchReadout = document.querySelector("#ensembleBatchReadout");
const countButtons = [...document.querySelectorAll(".count-button")];
const particleReadout = document.querySelector("#particleReadout");
const liveState = document.querySelector("#liveState");
const stateLabel = document.querySelector("#stateLabel");
const performanceLabel = document.querySelector("#performanceLabel");
const webglMessage = document.querySelector("#webglMessage");

let renderer;
let scene;
let camera;
let particleMesh;
let velocityLines;
let velocityLinePositions = new Float32Array(0);
let velocityShells;
let velocitySampleIndices = [];
let positions = new Float32Array(0);
let velocities = new Float32Array(0);
let particleCount = 100;
let hasStarted = false;
let isRunning = false;
let lastFrameTime = performance.now();
let yaw = -0.66;
let pitch = 0.43;
let cameraDistance = 14.2;
let isDragging = false;
let dragX = 0;
let dragY = 0;
let dragMoved = false;
let showVelocityVectors = false;
let histogramTimers = [];
let curveTimer = null;
let currentTemperature = REFERENCE_TEMPERATURE;
let compareEnabled = false;
let comparisonReference = null;
let collectionRunId = 0;
let isCollecting = false;
let collectionPaused = false;
let collectionResume = null;
let accumulatedCounts = new Uint32Array(40);
let accumulatedOverflow = 0;
let accumulatedSampleCount = 0;
let statisticalEnergies = new Float32Array(10000);

const HISTOGRAM_BIN_COUNT = 40;
const HISTOGRAM_ENERGY_MAX = 20;
const HISTOGRAM_BIN_WIDTH = HISTOGRAM_ENERGY_MAX / HISTOGRAM_BIN_COUNT;
const ENSEMBLE_BATCH_SIZE = 1000;
const ENSEMBLE_BATCH_COUNT = 10;
const STATISTICAL_SAMPLE_TARGET = ENSEMBLE_BATCH_SIZE * ENSEMBLE_BATCH_COUNT;

const matrix = new THREE.Matrix4();
const color = new THREE.Color();

function gaussianRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function createVelocity(target, offset) {
  const temperatureScale = Math.sqrt(currentTemperature / REFERENCE_TEMPERATURE);
  target[offset] = gaussianRandom() * THERMAL_SCALE * temperatureScale;
  target[offset + 1] = gaussianRandom() * THERMAL_SCALE * temperatureScale;
  target[offset + 2] = gaussianRandom() * THERMAL_SCALE * temperatureScale;
}

function speedAt(index) {
  const i = index * 3;
  return Math.hypot(velocities[i], velocities[i + 1], velocities[i + 2]);
}

function particleColor(speed) {
  color.setHex(0xe2e2e2);
  return color;
}

function initThree() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (error) {
    webglMessage.hidden = false;
    console.error(error);
    return false;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.025);

  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  updateCamera();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 1.5));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(6, 9, 8);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0xffffff, 18, 25, 2);
  fillLight.position.set(-5, -2, 4);
  scene.add(fillLight);

  createContainer();
  createParticles(particleCount);
  attachPointerControls();

  const resizeObserver = new ResizeObserver(resizeRenderer);
  resizeObserver.observe(viewport);
  resizeRenderer();
  requestAnimationFrame(animate);
  return true;
}

function createContainer() {
  const volumeGeometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
  const volumeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.025,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.28,
    thickness: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(volumeGeometry, volumeMaterial));

  function addEdgeLayer(scale, opacity, colorValue) {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE));
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: colorValue,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(edges, edgeMaterial);
    lines.scale.setScalar(scale);
    scene.add(lines);
  }

  addEdgeLayer(1, 0.68, 0xffffff);
  addEdgeLayer(1.012, 0.12, 0xffffff);
  addEdgeLayer(0.988, 0.08, 0xffffff);

  const rodMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const rodGeometry = new THREE.CylinderGeometry(0.018, 0.018, BOX_SIZE, 8, 1, true);
  const h = HALF_BOX;
  const addRod = (x, y, z, rotationX, rotationZ) => {
    const rod = new THREE.Mesh(rodGeometry, rodMaterial);
    rod.position.set(x, y, z);
    rod.rotation.set(rotationX, 0, rotationZ);
    scene.add(rod);
  };
  for (const y of [-h, h]) for (const z of [-h, h]) addRod(0, y, z, 0, Math.PI / 2);
  for (const x of [-h, h]) for (const z of [-h, h]) addRod(x, 0, z, 0, 0);
  for (const x of [-h, h]) for (const y of [-h, h]) addRod(x, y, 0, Math.PI / 2, 0);

  const innerGeometry = new THREE.BoxGeometry(BOX_SIZE - 0.12, BOX_SIZE - 0.12, BOX_SIZE - 0.12, 5, 5, 5);
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x777777,
    transparent: true,
    opacity: 0.027,
    wireframe: true,
    depthWrite: false,
  });
  scene.add(new THREE.Mesh(innerGeometry, wireMaterial));

  const baseGrid = new THREE.GridHelper(BOX_SIZE, 10, 0x777777, 0x343434);
  baseGrid.position.y = -HALF_BOX;
  baseGrid.material.transparent = true;
  baseGrid.material.opacity = 0.16;
  scene.add(baseGrid);
}

function createParticles(count) {
  if (particleMesh) {
    scene.remove(particleMesh);
    particleMesh.geometry.dispose();
    particleMesh.material.dispose();
  }
  if (velocityLines) {
    scene.remove(velocityLines);
    velocityLines.geometry.dispose();
    velocityLines.material.dispose();
  }
  if (velocityShells) {
    scene.remove(velocityShells);
    velocityShells.geometry.dispose();
    velocityShells.material.dispose();
  }

  particleCount = count;
  positions = new Float32Array(count * 3);
  velocities = new Float32Array(count * 3);

  const geometry = new THREE.IcosahedronGeometry(PARTICLE_RADIUS, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
  });
  material.userData.baseOpacity = 1;

  particleMesh = new THREE.InstancedMesh(geometry, material, count);
  particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particleMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  particleMesh.frustumCulled = false;

  const bound = HALF_BOX - PARTICLE_RADIUS;
  for (let index = 0; index < count; index += 1) {
    const i = index * 3;
    positions[i] = THREE.MathUtils.randFloatSpread(bound * 2);
    positions[i + 1] = THREE.MathUtils.randFloatSpread(bound * 2);
    positions[i + 2] = THREE.MathUtils.randFloatSpread(bound * 2);
    createVelocity(velocities, i);
    matrix.makeTranslation(positions[i], positions[i + 1], positions[i + 2]);
    particleMesh.setMatrixAt(index, matrix);
    particleMesh.setColorAt(index, particleColor(speedAt(index)));
  }

  particleMesh.instanceMatrix.needsUpdate = true;
  particleMesh.instanceColor.needsUpdate = true;
  scene.add(particleMesh);
  velocitySampleIndices = createVelocitySampleIndices(count);
  createVelocityVectors();
  createVelocityShells(count);
  velocityModeHint.textContent = "RADIUS ∝ |v| · ALL PARTICLES";
  updateStatisticsReadout();
  particleReadout.textContent = count.toLocaleString();
  performanceLabel.textContent = hasStarted ? `${count.toLocaleString()} PARTICLES` : "STANDBY";
}

function setEnsembleOpacity(opacity) {
  if (particleMesh?.material) particleMesh.material.opacity = opacity;
  if (velocityLines?.material) {
    velocityLines.material.opacity = (velocityLines.material.userData.baseOpacity ?? 0.24) * opacity;
  }
  if (velocityShells?.material) {
    velocityShells.material.opacity = (velocityShells.material.userData.baseOpacity ?? 0.035) * opacity;
  }
}

function fadeEnsemble(targetOpacity, duration, runId) {
  const startOpacity = particleMesh?.material?.opacity ?? 1;
  const startTime = performance.now();

  return new Promise((resolve) => {
    function step(now) {
      if (runId !== collectionRunId) {
        resolve(false);
        return;
      }
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = progress * progress * (3 - 2 * progress);
      setEnsembleOpacity(THREE.MathUtils.lerp(startOpacity, targetOpacity, eased));
      if (progress < 1) requestAnimationFrame(step);
      else resolve(true);
    }
    requestAnimationFrame(step);
  });
}

function updateStatisticsReadout() {
  if (particleCount === 0) return;
  let speedSum = 0;
  let maximumSpeed = 0;
  let energySum = 0;
  let maximumEnergy = 0;

  for (let index = 0; index < particleCount; index += 1) {
    const speed = speedAt(index);
    const kineticEnergy = 0.5 * speed * speed;
    speedSum += speed;
    maximumSpeed = Math.max(maximumSpeed, speed);
    energySum += kineticEnergy;
    maximumEnergy = Math.max(maximumEnergy, kineticEnergy);
  }

  averageSpeedReadout.textContent = (speedSum / particleCount).toFixed(3);
  maximumSpeedReadout.textContent = maximumSpeed.toFixed(3);
  averageEnergyReadout.textContent = (energySum / particleCount).toFixed(3);
  maximumEnergyReadout.textContent = maximumEnergy.toFixed(3);

  sampleSpeedReadouts.forEach((readout, index) => {
    const sampleIndex = Math.min(index, particleCount - 1);
    const speed = speedAt(sampleIndex);
    readout.textContent = speed.toFixed(3);
    sampleEnergyReadouts[index].textContent = (0.5 * speed * speed).toFixed(3);
  });
}

function createVelocitySampleIndices(count) {
  const sampleCount = Math.min(count, MAX_VISIBLE_VECTORS);
  const indices = new Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    indices[index] = Math.floor(index * count / sampleCount);
  }
  return indices;
}

function createVelocityVectors() {
  velocityLinePositions = new Float32Array(velocitySampleIndices.length * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(velocityLinePositions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  material.userData.baseOpacity = 0.24;
  velocityLines = new THREE.LineSegments(geometry, material);
  velocityLines.frustumCulled = false;
  velocityLines.visible = showVelocityVectors;
  scene.add(velocityLines);
  updateVelocityVectors();
}

function createVelocityShells(count) {
  const geometry = new THREE.SphereGeometry(1, 14, 10);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: count >= 1000 ? 0.035 : count >= 500 ? 0.06 : 0.11,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  material.userData.baseOpacity = material.opacity;
  velocityShells = new THREE.InstancedMesh(geometry, material, count);
  velocityShells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  velocityShells.frustumCulled = false;
  velocityShells.visible = showVelocityVectors;
  scene.add(velocityShells);
  updateVelocityShells();
}

function updateVelocityVectors() {
  if (!velocityLines) return;

  for (let sampleIndex = 0; sampleIndex < velocitySampleIndices.length; sampleIndex += 1) {
    const particleIndex = velocitySampleIndices[sampleIndex];
    const particleOffset = particleIndex * 3;
    const lineOffset = sampleIndex * 6;
    const x = positions[particleOffset];
    const y = positions[particleOffset + 1];
    const z = positions[particleOffset + 2];

    velocityLinePositions[lineOffset] = x;
    velocityLinePositions[lineOffset + 1] = y;
    velocityLinePositions[lineOffset + 2] = z;
    velocityLinePositions[lineOffset + 3] = x + velocities[particleOffset] * VELOCITY_RADIUS_SCALE;
    velocityLinePositions[lineOffset + 4] = y + velocities[particleOffset + 1] * VELOCITY_RADIUS_SCALE;
    velocityLinePositions[lineOffset + 5] = z + velocities[particleOffset + 2] * VELOCITY_RADIUS_SCALE;
  }

  velocityLines.geometry.attributes.position.needsUpdate = true;
}

function updateVelocityShells() {
  if (!velocityShells) return;

  for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
    const particleOffset = particleIndex * 3;
    const centerX = positions[particleOffset];
    const centerY = positions[particleOffset + 1];
    const centerZ = positions[particleOffset + 2];
    const radius = speedAt(particleIndex) * VELOCITY_RADIUS_SCALE;
    matrix.makeScale(radius, radius, radius);
    matrix.setPosition(centerX, centerY, centerZ);
    velocityShells.setMatrixAt(particleIndex, matrix);
  }
  velocityShells.instanceMatrix.needsUpdate = true;
}

function updateParticles(deltaTime) {
  const bound = HALF_BOX - PARTICLE_RADIUS;

  for (let index = 0; index < particleCount; index += 1) {
    const i = index * 3;

    for (let axis = 0; axis < 3; axis += 1) {
      const component = i + axis;
      positions[component] += velocities[component] * deltaTime;

      if (positions[component] > bound) {
        positions[component] = 2 * bound - positions[component];
        velocities[component] *= -1;
      } else if (positions[component] < -bound) {
        positions[component] = -2 * bound - positions[component];
        velocities[component] *= -1;
      }
    }

    matrix.makeTranslation(positions[i], positions[i + 1], positions[i + 2]);
    particleMesh.setMatrixAt(index, matrix);
  }

  particleMesh.instanceMatrix.needsUpdate = true;
  if (showVelocityVectors) {
    updateVelocityVectors();
    updateVelocityShells();
  }
  updateStatisticsReadout();
}

function resizeRenderer() {
  if (!renderer || !camera) return;
  const width = Math.max(viewport.clientWidth, 1);
  const height = Math.max(viewport.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function updateCamera() {
  if (!camera) return;
  const targetX = viewport.clientWidth > 900 ? -1.15 : 0;
  const cosPitch = Math.cos(pitch);
  camera.position.set(
    targetX + Math.sin(yaw) * cosPitch * cameraDistance,
    Math.sin(pitch) * cameraDistance,
    Math.cos(yaw) * cosPitch * cameraDistance,
  );
  camera.lookAt(targetX, 0, 0);
}

function attachPointerControls() {
  viewport.addEventListener("pointerdown", (event) => {
    isDragging = true;
    dragMoved = false;
    dragX = event.clientX;
    dragY = event.clientY;
    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    const dx = event.clientX - dragX;
    const dy = event.clientY - dragY;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragMoved = true;
    yaw -= dx * 0.006;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.005, -1.08, 1.08);
    dragX = event.clientX;
    dragY = event.clientY;
    updateCamera();
  });

  const endDrag = (event) => {
    isDragging = false;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.008, 10.2, 22);
    updateCamera();
  }, { passive: false });
}

function setRunning(nextRunning) {
  isRunning = nextRunning;
  liveState.classList.toggle("running", isRunning);
  liveState.classList.toggle("paused", hasStarted && !isRunning);
  stateLabel.textContent = isRunning ? "LIVE" : hasStarted ? "PAUSED" : "READY";
  playButton.classList.toggle("active", isRunning);
  pauseButton.classList.toggle("active", hasStarted && !isRunning);
  playButton.setAttribute("aria-pressed", String(isRunning));
  pauseButton.setAttribute("aria-pressed", String(hasStarted && !isRunning));
  performanceLabel.textContent = hasStarted
    ? isRunning ? `${particleCount.toLocaleString()} PARTICLES · RUNNING` : "SIMULATION PAUSED"
    : "STANDBY";
}

function startSimulation() {
  hasStarted = true;
  startCurtain.classList.add("hidden");
  setRunning(true);
}

function resetSimulation() {
  hasStarted = false;
  setRunning(false);
  createParticles(particleCount);
  startCurtain.classList.remove("hidden");
  yaw = -0.66;
  pitch = 0.43;
  cameraDistance = 14.2;
  updateCamera();
  invalidateHistogram("ENERGY DATA RESET");
}

function setParticleCount(count) {
  const wasRunning = isRunning;
  createParticles(count);
  countButtons.forEach((button) => {
    const isActive = Number(button.dataset.count) === count;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  if (hasStarted) setRunning(wasRunning);
  invalidateHistogram("PARTICLE DATA CHANGED");
}

function setTemperature(nextTemperature) {
  if (nextTemperature === currentTemperature) return;
  if (compareEnabled) captureCurrentCurveAsReference();
  const velocityScale = Math.sqrt(nextTemperature / currentTemperature);

  for (let index = 0; index < velocities.length; index += 1) {
    velocities[index] *= velocityScale;
  }

  currentTemperature = nextTemperature;
  temperatureReadout.value = `${nextTemperature} K`;
  const progress = ((nextTemperature - Number(temperatureSlider.min)) /
    (Number(temperatureSlider.max) - Number(temperatureSlider.min))) * 100;
  temperatureSlider.style.setProperty("--temperature-progress", `${progress}%`);
  updateStatisticsReadout();

  if (showVelocityVectors) {
    updateVelocityVectors();
    updateVelocityShells();
  }

  invalidateHistogram("TEMPERATURE CHANGED", { preserveComparison: true });
  renderComparisonReference();
  histogramStatus.querySelector("span").textContent = "Recount energies at the new temperature";
}

function clearHistogramTimers() {
  histogramTimers.forEach((timer) => window.clearTimeout(timer));
  histogramTimers = [];
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function setCollectionControlsLocked(locked) {
  countButtons.forEach((button) => { button.disabled = locked; });
  temperatureSlider.disabled = locked;
  generateButton.disabled = locked;
}

function resumeCollection() {
  collectionPaused = false;
  ensembleIndicator.classList.remove("paused");
  if (collectionResume) {
    collectionResume();
    collectionResume = null;
  }
}

function cancelCollection() {
  collectionRunId += 1;
  isCollecting = false;
  resumeCollection();
  ensembleIndicator.hidden = true;
  setEnsembleOpacity(1);
  setCollectionControlsLocked(false);
}

async function waitForCollectionResume(runId) {
  while (collectionPaused && runId === collectionRunId) {
    await new Promise((resolve) => { collectionResume = resolve; });
  }
  return runId === collectionRunId;
}

function resetCurve({ locked = true } = {}) {
  if (curveTimer) window.clearTimeout(curveTimer);
  curveTimer = null;
  histogramChart.classList.remove("curve-mode");
  histogramCurve.classList.remove("visible", "complete");
  histogramCurvePath.removeAttribute("d");
  histogramCurvePath.style.strokeDasharray = "";
  histogramCurvePath.style.strokeDashoffset = "";
  histogramCurvePath.style.transition = "";
  histogramCurvePoints.replaceChildren();
  curveButton.disabled = locked;
  curveButton.textContent = "FORM SMOOTH CURVE";
  curvePipelineState.textContent = locked ? "LOCKED" : "READY";
  curvePipelineState.closest("li")?.classList.toggle("active", !locked);
}

function renderComparisonReference() {
  const shouldShow = compareEnabled
    && comparisonReference
    && comparisonReference.temperature !== currentTemperature;

  histogramReference.classList.toggle("visible", Boolean(shouldShow));
  curveLegend.hidden = !shouldShow;

  if (!shouldShow) return;
  const geometry = distributionGeometryFromCounts(comparisonReference.counts, getSharedCountMax());
  histogramReference.setAttribute("viewBox", geometry?.viewBox ?? comparisonReference.viewBox);
  histogramReferencePath.setAttribute("d", geometry?.path ?? comparisonReference.path);
  referenceTemperature.textContent = `${comparisonReference.temperature} K`;
  currentCurveTemperature.textContent = `${currentTemperature} K`;
}

function clearComparisonReference() {
  comparisonReference = null;
  histogramReference.classList.remove("visible");
  histogramReferencePath.removeAttribute("d");
  curveLegend.hidden = true;
  compareModeHint.textContent = "KEEP PREVIOUS TEMPERATURE";
}

function captureCurrentCurveAsReference() {
  const path = histogramCurvePath.getAttribute("d");
  const viewBox = histogramCurve.getAttribute("viewBox");
  if (!path || !viewBox || !histogramCurve.classList.contains("complete")) return false;

  comparisonReference = {
    path,
    viewBox,
    temperature: currentTemperature,
    counts: Array.from(accumulatedCounts),
  };
  compareModeHint.textContent = `BASELINE ${currentTemperature} K`;
  renderComparisonReference();
  return true;
}

function setCompareMode(nextEnabled) {
  compareEnabled = nextEnabled;
  compareToggle.setAttribute("aria-checked", String(nextEnabled));
  compareToggle.setAttribute("aria-label", nextEnabled
    ? "Disable temperature curve comparison"
    : "Compare with previous temperature curve");

  if (nextEnabled) captureCurrentCurveAsReference();
  else clearComparisonReference();
  renderComparisonReference();
}

function invalidateHistogram(message = "ENERGY DATA READY", { preserveComparison = false } = {}) {
  cancelCollection();
  clearHistogramTimers();
  resetCurve();
  if (!preserveComparison) clearComparisonReference();
  accumulatedCounts = new Uint32Array(HISTOGRAM_BIN_COUNT);
  accumulatedOverflow = 0;
  accumulatedSampleCount = 0;
  statisticalEnergies = new Float32Array(STATISTICAL_SAMPLE_TARGET);
  histogramBars.replaceChildren();
  histogramStatus.classList.remove("hidden", "counting");
  histogramStatus.querySelector("strong").textContent = message;
  histogramStatus.querySelector("span").textContent = "Count ten visible ensembles to build the distribution";
  histogramRange.textContent = "RANGE 0—20 · ΔE 0.5";
  histogramAxisMax.textContent = HISTOGRAM_ENERGY_MAX.toFixed(0);
  histogramProgress.textContent = `0 / ${STATISTICAL_SAMPLE_TARGET.toLocaleString()} SAMPLES`;
  overflowReadout.textContent = `E > ${HISTOGRAM_ENERGY_MAX}: 0`;
  yScaleReadout.textContent = "SHARED Y SCALE";
  histogramPipelineState.textContent = "READY";
  generateButton.disabled = false;
  generateButton.textContent = "COUNT 10,000 PARTICLES";
}

function countCurrentEnsemble(batchIndex) {
  const counts = new Uint32Array(HISTOGRAM_BIN_COUNT);
  let overflow = 0;
  const sampleOffset = batchIndex * ENSEMBLE_BATCH_SIZE;

  for (let index = 0; index < ENSEMBLE_BATCH_SIZE; index += 1) {
    const speed = speedAt(index);
    const energy = 0.5 * speed * speed;
    statisticalEnergies[sampleOffset + index] = energy;
    if (energy >= HISTOGRAM_ENERGY_MAX) overflow += 1;
    else counts[Math.floor(energy / HISTOGRAM_BIN_WIDTH)] += 1;
  }

  return { counts, overflow };
}

function accumulateEnsemble({ counts, overflow }) {
  counts.forEach((count, index) => { accumulatedCounts[index] += count; });
  accumulatedOverflow += overflow;
  accumulatedSampleCount += ENSEMBLE_BATCH_SIZE;
}

function createHistogramBars() {
  histogramBars.replaceChildren();
  for (let index = 0; index < HISTOGRAM_BIN_COUNT; index += 1) {
    const lowerBound = index * HISTOGRAM_BIN_WIDTH;
    const upperBound = lowerBound + HISTOGRAM_BIN_WIDTH;
    const bar = document.createElement("div");
    bar.className = "histogram-bar";
    bar.dataset.binIndex = String(index);
    bar.setAttribute("aria-label", `${lowerBound.toFixed(1)}–${upperBound.toFixed(1)}: 0 particles`);
    const value = document.createElement("span");
    value.className = "histogram-bar-value";
    value.textContent = "0";
    bar.appendChild(value);
    histogramBars.appendChild(bar);
  }
}

function getSharedCountMax() {
  const currentMaximum = Math.max(...accumulatedCounts, 1);
  const referenceMaximum = compareEnabled && comparisonReference?.counts
    ? Math.max(...comparisonReference.counts, 1)
    : 1;
  return Math.ceil(Math.max(currentMaximum, referenceMaximum) * 1.08);
}

function distributionGeometryFromCounts(counts, scaleMaximum) {
  const bars = [...histogramBars.querySelectorAll(".histogram-bar")];
  if (bars.length !== HISTOGRAM_BIN_COUNT) return null;

  const chartRect = histogramChart.getBoundingClientRect();
  const barsRect = histogramBars.getBoundingClientRect();
  const plotTop = barsRect.top - chartRect.top;
  const baselineY = barsRect.bottom - chartRect.top;
  const plotHeight = baselineY - plotTop;
  const points = [{ x: barsRect.left - chartRect.left, y: baselineY }];

  bars.forEach((bar, index) => {
    const rect = bar.getBoundingClientRect();
    points.push({
      x: rect.left + rect.width / 2 - chartRect.left,
      y: baselineY - Math.min(counts[index] / scaleMaximum, 1) * plotHeight,
    });
  });
  points.push({ x: barsRect.right - chartRect.left, y: baselineY });

  return {
    points,
    path: catmullRomPath(points),
    viewBox: `0 0 ${chartRect.width} ${chartRect.height}`,
  };
}

function updateHistogramBars() {
  const scaleMaximum = getSharedCountMax();
  const bars = [...histogramBars.querySelectorAll(".histogram-bar")];
  bars.forEach((bar, index) => {
    const count = accumulatedCounts[index];
    const lowerBound = index * HISTOGRAM_BIN_WIDTH;
    const upperBound = lowerBound + HISTOGRAM_BIN_WIDTH;
    bar.style.setProperty("--bar-height", `${count === 0 ? 0 : Math.max(Math.min((count / scaleMaximum) * 100, 100), 1)}%`);
    bar.title = `${lowerBound.toFixed(1)}–${upperBound.toFixed(1)}: ${count.toLocaleString()} particles`;
    bar.setAttribute("aria-label", bar.title);
    bar.querySelector(".histogram-bar-value").textContent = count.toLocaleString();
  });
  yScaleReadout.textContent = `SHARED Y MAX ${scaleMaximum.toLocaleString()}`;
  renderComparisonReference();
}

function updateCollectionReadouts(batchNumber) {
  ensembleIndicator.hidden = false;
  ensembleBatchReadout.textContent = `${String(batchNumber).padStart(2, "0")} / ${ENSEMBLE_BATCH_COUNT}`;
  ensembleIndicator.style.setProperty("--batch-progress", `${batchNumber * 10}%`);
  histogramProgress.textContent = `${accumulatedSampleCount.toLocaleString()} / ${STATISTICAL_SAMPLE_TARGET.toLocaleString()} SAMPLES`;
  overflowReadout.textContent = `E > ${HISTOGRAM_ENERGY_MAX}: ${accumulatedOverflow.toLocaleString()}`;
  performanceLabel.textContent = `ENSEMBLE ${String(batchNumber).padStart(2, "0")} / ${ENSEMBLE_BATCH_COUNT}`;
}

async function revealHistogramBars(runId) {
  const bars = [...histogramBars.querySelectorAll(".histogram-bar")];
  for (const bar of bars) {
    if (!(await waitForCollectionResume(runId))) return false;
    const previous = histogramBars.querySelector(".current");
    previous?.classList.remove("current");
    bar.classList.add("revealed", "current");
    await delay(65);
    if (runId !== collectionRunId) return false;
  }
  histogramBars.querySelector(".current")?.classList.remove("current");
  return true;
}

async function transitionToFreshEnsemble(runId) {
  if (!(await fadeEnsemble(0, 180, runId))) return false;
  if (runId !== collectionRunId) return false;
  createParticles(ENSEMBLE_BATCH_SIZE);
  setEnsembleOpacity(0);
  return fadeEnsemble(1, 220, runId);
}

function selectVisibleParticleCount(count) {
  countButtons.forEach((button) => {
    const isActive = Number(button.dataset.count) === count;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

async function generateHistogram() {
  if (!hasStarted) startSimulation();
  cancelCollection();
  const runId = collectionRunId;
  isCollecting = true;
  collectionPaused = false;
  accumulatedCounts = new Uint32Array(HISTOGRAM_BIN_COUNT);
  accumulatedOverflow = 0;
  accumulatedSampleCount = 0;
  statisticalEnergies = new Float32Array(STATISTICAL_SAMPLE_TARGET);
  clearHistogramTimers();
  resetCurve();
  createHistogramBars();
  renderComparisonReference();
  selectVisibleParticleCount(ENSEMBLE_BATCH_SIZE);
  setCollectionControlsLocked(true);
  histogramStatus.classList.add("hidden");
  histogramStatus.classList.remove("counting");
  histogramPipelineState.textContent = "COUNTING";
  histogramRange.textContent = `RANGE 0—${HISTOGRAM_ENERGY_MAX} · ΔE ${HISTOGRAM_BIN_WIDTH.toFixed(1)}`;
  histogramAxisMax.textContent = HISTOGRAM_ENERGY_MAX.toFixed(0);
  generateButton.textContent = "COUNTING ENSEMBLES…";

  for (let batchIndex = 0; batchIndex < ENSEMBLE_BATCH_COUNT; batchIndex += 1) {
    if (!(await waitForCollectionResume(runId))) return;
    updateCollectionReadouts(batchIndex + 1);
    if (!(await transitionToFreshEnsemble(runId))) return;

    accumulateEnsemble(countCurrentEnsemble(batchIndex));
    updateCollectionReadouts(batchIndex + 1);
    updateHistogramBars();

    if (batchIndex === 0) {
      if (!(await revealHistogramBars(runId))) return;
    } else {
      await delay(120);
      if (runId !== collectionRunId) return;
    }
  }

  isCollecting = false;
  ensembleIndicator.hidden = true;
  setCollectionControlsLocked(false);
  histogramPipelineState.textContent = "COMPLETE";
  performanceLabel.textContent = `${STATISTICAL_SAMPLE_TARGET.toLocaleString()} SAMPLES · COMPLETE`;
  generateButton.textContent = "RECOUNT 10,000 PARTICLES";
  resetCurve({ locked: false });
}

function catmullRomPath(points) {
  if (points.length < 2) return "";
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

function formSmoothCurve() {
  const bars = [...histogramBars.querySelectorAll(".histogram-bar")];
  if (bars.length < 2 || accumulatedSampleCount !== STATISTICAL_SAMPLE_TARGET) return;

  resetCurve({ locked: false });
  const geometry = distributionGeometryFromCounts(accumulatedCounts, getSharedCountMax());
  if (!geometry) return;
  const { points, path, viewBox } = geometry;

  histogramCurve.setAttribute("viewBox", viewBox);
  histogramCurvePath.setAttribute("d", path);
  histogramCurve.classList.add("visible");
  renderComparisonReference();

  points.slice(1, -1).forEach((point, index) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", "1.7");
    circle.style.animationDelay = `${index * 55}ms`;
    histogramCurvePoints.appendChild(circle);
  });

  const pathLength = histogramCurvePath.getTotalLength();
  histogramCurvePath.style.strokeDasharray = `${pathLength}`;
  histogramCurvePath.style.strokeDashoffset = `${pathLength}`;
  histogramCurvePath.getBoundingClientRect();
  histogramCurvePath.style.transition = "stroke-dashoffset 2.6s cubic-bezier(.32,.02,.2,1)";
  histogramCurvePath.style.strokeDashoffset = "0";

  histogramChart.classList.add("curve-mode");
  histogramStatus.classList.add("hidden");
  histogramStatus.classList.remove("counting");
  curvePipelineState.textContent = "FORMING";
  curveButton.disabled = true;

  curveTimer = window.setTimeout(() => {
    histogramCurve.classList.add("complete");
    curvePipelineState.textContent = "COMPLETE";
    curveButton.disabled = false;
    curveButton.textContent = "REPLAY CURVE FORMATION";
  }, 2800);
}

function setVelocityVectors(nextVisible) {
  showVelocityVectors = nextVisible;
  velocityToggle.setAttribute("aria-checked", String(nextVisible));
  velocityToggle.setAttribute("aria-label", nextVisible ? "Hide velocity shells" : "Show velocity shells");
  if (velocityLines) {
    velocityLines.visible = nextVisible;
    if (nextVisible) updateVelocityVectors();
  }
  if (velocityShells) {
    velocityShells.visible = nextVisible;
    if (nextVisible) updateVelocityShells();
  }
}

function animate(now) {
  const deltaTime = Math.min((now - lastFrameTime) / 1000, 0.033);
  lastFrameTime = now;

  if (isRunning) updateParticles(deltaTime);
  if (!isDragging && !dragMoved) {
    yaw -= deltaTime * 0.018;
    updateCamera();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

startButton.addEventListener("click", startSimulation);
playButton.addEventListener("click", () => {
  if (!hasStarted) startSimulation();
  else {
    if (isCollecting) resumeCollection();
    setRunning(true);
  }
});
pauseButton.addEventListener("click", () => {
  if (hasStarted) {
    if (isCollecting) {
      collectionPaused = true;
      ensembleIndicator.classList.add("paused");
    }
    setRunning(false);
  }
});
resetButton.addEventListener("click", resetSimulation);
generateButton.addEventListener("click", generateHistogram);
curveButton.addEventListener("click", formSmoothCurve);
temperatureSlider.addEventListener("input", () => setTemperature(Number(temperatureSlider.value)));
velocityToggle.addEventListener("click", () => setVelocityVectors(!showVelocityVectors));
compareToggle.addEventListener("click", () => setCompareMode(!compareEnabled));
countButtons.forEach((button) => {
  button.addEventListener("click", () => setParticleCount(Number(button.dataset.count)));
});

invalidateHistogram();
temperatureSlider.style.setProperty("--temperature-progress", "25%");
initThree();

if (EMBED_MODE) {
  window.requestAnimationFrame(() => {
    startSimulation();
    window.setTimeout(async () => {
      await generateHistogram();
      formSmoothCurve();
    }, 650);
  });
}
