import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { createFormulaLayer } from "./core/formulas.js";
import { createGestureController } from "./core/gestures.js";
import { createSceneKit } from "./core/scene.js";
import { modules } from "./modules/registry.js";

const mount = document.getElementById("threeMount");
const video = document.getElementById("webcam");
const startButton = document.getElementById("startBtn");
const formulaToggle = document.getElementById("formulaToggle");
const moduleNav = document.getElementById("moduleNav");
const moduleTitle = document.getElementById("moduleTitle");
const gestureState = document.getElementById("gestureState");
const primaryValue = document.getElementById("primaryValue");

const sceneKit = createSceneKit(THREE, mount);
const formulaLayer = createFormulaLayer(document.getElementById("formulaOverlay"));
const gestureController = createGestureController({
  THREE,
  video,
  startButton,
  onStatus: (text) => {
    gestureState.textContent = text;
  }
});

const ui = { primaryValue, gestureState };
let activeModule = null;
let activeRuntime = null;
const requestedModuleId = document.body.dataset.moduleId || new URLSearchParams(window.location.search).get("module") || modules[0].id;
const modelPagePrefix = document.body.dataset.moduleId ? "./" : "./models/";

function activateModule(module) {
  activeRuntime?.dispose?.();
  sceneKit.clearRoot();
  sceneKit.root.rotation.set(0, 0, 0);

  activeModule = module;
  activeRuntime = module.create({ THREE, sceneKit, formulaLayer, ui });
  moduleTitle.textContent = module.title;
  formulaLayer.render(module.title, module.formulas);

  for (const link of moduleNav.querySelectorAll("a")) {
    link.classList.toggle("active", link.dataset.moduleId === module.id);
  }
}

for (const module of modules) {
  const link = document.createElement("a");
  link.dataset.moduleId = module.id;
  link.href = modelPagePrefix + module.id + ".html";
  link.textContent = module.title;
  link.title = module.description;
  moduleNav.append(link);
}

formulaToggle.addEventListener("click", () => {
  formulaLayer.setVisible(!formulaLayer.visible);
  formulaToggle.setAttribute("aria-pressed", String(formulaLayer.visible));
});

activateModule(modules.find((module) => module.id === requestedModuleId) || modules[0]);

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(sceneKit.clock.getDelta(), 0.027);
  const time = sceneKit.clock.elapsedTime;
  const gesture = gestureController.update();

  sceneKit.updateCamera(dt, gesture.zoomIntent);
  activeRuntime?.update?.({ dt, time, gesture });
  sceneKit.render();
}

animate();
