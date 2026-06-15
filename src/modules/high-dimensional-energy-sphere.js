import { createGlassCube } from "../core/particles.js";
import { applyCubeBoundary, rand, randomInsideCube, randomUnitVector, resolveElasticSphereCollisions } from "../core/physics.js";

export const highDimensionalEnergySphere = {
  id: "high_dimensional_energy_sphere",
  title: "高维能量球",
  description: "总能量 U 决定 3N 维速度空间中可达球面的半径。",
  formulas: [
    { formula: "U = 1/2 m Σ(v_ix² + v_iy² + v_iz²)", note: "总能量是所有粒子速度分量平方的和。" },
    { formula: "Σ(v_ix² + v_iy² + v_iz²) = 2U / m", note: "固定 U 时，速度空间里的点落在一个高维球面上。" },
    { formula: "D = 3N,  R = √(2U / m)", note: "N 个粒子对应 3N 个速度自由度。" },
    { formula: "Ω(U) ∝ R³ᴺ ∝ U^(3N/2)", note: "能量升高时，可达微观态数量急剧增长。" },
    { formula: "dS/dU = 1/T", note: "温度连接能量和微观态数量增长速度。" }
  ],
  create({ THREE, sceneKit, ui }) {
    const cubeGroup = new THREE.Group();
    sceneKit.root.add(cubeGroup);

    const cubeSize = 3.25;
    const boundary = cubeSize * 0.5 * 0.9;
    const cube = createGlassCube(THREE, cubeSize);
    cubeGroup.add(cube.group);

    const shellSphere = new THREE.Mesh(
      new THREE.SphereGeometry(boundary * 0.82, 96, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.028,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    cubeGroup.add(shellSphere);

    const BODY_COUNT = 512;
    const ARROW_COUNT = 160;
    const COMPONENT_COUNT = 110;
    const GHOST_COUNT = 4096;
    const ENERGY_MIN = 0.12;
    const ENERGY_MAX = 1;
    const MEAN_V2_MIN = 0.16;
    const MEAN_V2_MAX = 2.3;

    const bodies = [];
    for (let i = 0; i < BODY_COUNT; i++) {
      bodies.push({
        pos: randomInsideCube(THREE, boundary * 0.92),
        vel: randomUnitVector(THREE).multiplyScalar(rand(0.28, 0.78)),
        radius: 0.045,
        phase: rand(0, Math.PI * 2)
      });
    }

    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.115,
      wireframe: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sphereInstances = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), sphereMat, BODY_COUNT);
    sphereInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cubeGroup.add(sphereInstances);

    const corePositions = new Float32Array(BODY_COUNT * 3);
    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute("position", new THREE.BufferAttribute(corePositions, 3));
    const coreMat = new THREE.PointsMaterial({
      size: 0.012,
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    cubeGroup.add(new THREE.Points(coreGeo, coreMat));

    const ghostPositions = new Float32Array(GHOST_COUNT * 3);
    const ghostVelocities = new Float32Array(GHOST_COUNT * 3);
    const ghostSeeds = new Float32Array(GHOST_COUNT);
    for (let i = 0; i < GHOST_COUNT; i++) {
      const p = randomInsideCube(THREE, boundary * 0.98);
      const v = randomUnitVector(THREE).multiplyScalar(rand(0.05, 0.22));
      const ix = i * 3;
      ghostPositions[ix] = p.x;
      ghostPositions[ix + 1] = p.y;
      ghostPositions[ix + 2] = p.z;
      ghostVelocities[ix] = v.x;
      ghostVelocities[ix + 1] = v.y;
      ghostVelocities[ix + 2] = v.z;
      ghostSeeds[i] = rand(0, 1000);
    }
    const ghostGeo = new THREE.BufferGeometry();
    ghostGeo.setAttribute("position", new THREE.BufferAttribute(ghostPositions, 3));
    const ghostMat = new THREE.PointsMaterial({
      size: 0.0068,
      color: 0xffffff,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    cubeGroup.add(new THREE.Points(ghostGeo, ghostMat));

    const arrowPositions = new Float32Array(ARROW_COUNT * 2 * 3);
    const arrowGeo = new THREE.BufferGeometry();
    arrowGeo.setAttribute("position", new THREE.BufferAttribute(arrowPositions, 3));
    const arrowMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    cubeGroup.add(new THREE.LineSegments(arrowGeo, arrowMat));

    const componentPositions = new Float32Array(COMPONENT_COUNT * 6 * 3);
    const componentGeo = new THREE.BufferGeometry();
    componentGeo.setAttribute("position", new THREE.BufferAttribute(componentPositions, 3));
    const componentMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.135,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    cubeGroup.add(new THREE.LineSegments(componentGeo, componentMat));

    const controls = { targetEnergy: 0.68, energy: 0.68, targetRotX: 0.1, targetRotY: -0.18 };
    const dummy = new THREE.Object3D();

    function update({ dt, time, gesture }) {
      controls.targetEnergy = gesture.openAmount;
      controls.targetRotY = gesture.leftHand ? (0.5 - gesture.leftHand[0].x) * 0.72 : (controls.targetEnergy - 0.5) * 0.45;
      controls.targetRotX = gesture.leftHand ? (gesture.leftHand[0].y - 0.5) * 0.3 + 0.08 : 0.08;

      updateBodyMotion(THREE, bodies, controls, dt, time, boundary);
      updateGhosts(THREE, controls, ghostPositions, ghostVelocities, ghostSeeds, ghostGeo, ghostMat, dt, time, boundary);
      updateInstancesAndVectors(THREE, bodies, controls, time);

      sceneKit.root.rotation.x += (controls.targetRotX - sceneKit.root.rotation.x) * 0.03;
      sceneKit.root.rotation.y += (controls.targetRotY - sceneKit.root.rotation.y) * 0.03;
      sceneKit.root.rotation.z = Math.sin(time * 0.16) * 0.01;
      cubeGroup.rotation.y += dt * 0.018;

      ui.primaryValue.textContent = `U = ${controls.energy.toFixed(2)} · R ∝ √U`;
    }

    function updateInstancesAndVectors(THREE, bodies, controls, time) {
      for (let i = 0; i < BODY_COUNT; i++) {
        const b = bodies[i];
        const r = speedRadius(THREE, b.vel.length());
        dummy.position.copy(b.pos);
        dummy.rotation.set(time * 0.27 + b.phase, time * 0.35 + b.phase * 0.7, time * 0.23 + b.phase * 1.1);
        dummy.scale.setScalar(r);
        dummy.updateMatrix();
        sphereInstances.setMatrixAt(i, dummy.matrix);
        corePositions[i * 3] = b.pos.x;
        corePositions[i * 3 + 1] = b.pos.y;
        corePositions[i * 3 + 2] = b.pos.z;
      }
      sphereInstances.instanceMatrix.needsUpdate = true;
      coreGeo.attributes.position.needsUpdate = true;

      for (let i = 0; i < ARROW_COUNT; i++) {
        const b = bodies[i];
        const dir = b.vel.clone().normalize();
        const len = b.radius * 1.95;
        const a = i * 6;
        arrowPositions[a] = b.pos.x;
        arrowPositions[a + 1] = b.pos.y;
        arrowPositions[a + 2] = b.pos.z;
        arrowPositions[a + 3] = b.pos.x + dir.x * len;
        arrowPositions[a + 4] = b.pos.y + dir.y * len;
        arrowPositions[a + 5] = b.pos.z + dir.z * len;
      }
      arrowGeo.attributes.position.needsUpdate = true;

      for (let i = 0; i < COMPONENT_COUNT; i++) {
        const b = bodies[i + ARROW_COUNT];
        const maxComponent = Math.sqrt(MEAN_V2_MAX);
        const componentScale = 0.24;
        const vx = THREE.MathUtils.clamp(b.vel.x / maxComponent, -1, 1) * componentScale;
        const vy = THREE.MathUtils.clamp(b.vel.y / maxComponent, -1, 1) * componentScale;
        const vz = THREE.MathUtils.clamp(b.vel.z / maxComponent, -1, 1) * componentScale;
        const base = i * 18;
        componentPositions.set([b.pos.x, b.pos.y, b.pos.z, b.pos.x + vx, b.pos.y, b.pos.z], base);
        componentPositions.set([b.pos.x, b.pos.y, b.pos.z, b.pos.x, b.pos.y + vy, b.pos.z], base + 6);
        componentPositions.set([b.pos.x, b.pos.y, b.pos.z, b.pos.x, b.pos.y, b.pos.z + vz], base + 12);
      }
      componentGeo.attributes.position.needsUpdate = true;

      const U = THREE.MathUtils.lerp(ENERGY_MIN, ENERGY_MAX, controls.energy);
      const projectedEnergyRadius = Math.sqrt(U / ENERGY_MAX);
      shellSphere.scale.setScalar(THREE.MathUtils.lerp(0.46, 1.1, projectedEnergyRadius));
      shellSphere.material.opacity = 0.018 + controls.energy * 0.038;

      cube.glass.material.opacity = 0.022 + controls.energy * 0.04;
      cube.edgeMain.material.opacity = 0.3 + controls.energy * 0.5;
      cube.edgeGlowOuter.material.opacity = 0.07 + controls.energy * 0.2;
      cube.edgeGlowInner.material.opacity = 0.045 + controls.energy * 0.16;
      sphereMat.opacity = 0.075 + controls.energy * 0.075;
      arrowMat.opacity = 0.28 + controls.energy * 0.24;
      componentMat.opacity = 0.075 + controls.energy * 0.095;
      coreMat.size = 0.008 + controls.energy * 0.008;
      coreMat.opacity = 0.58 + controls.energy * 0.34;
    }

    return {
      update,
      dispose() {
        sceneKit.root.remove(cubeGroup);
      }
    };
  }
};

function speedRadius(THREE, speed) {
  return THREE.MathUtils.clamp(0.026 + speed * 0.085, 0.034, 0.118);
}

function updateBodyMotion(THREE, bodies, controls, dt, time, boundary) {
  controls.energy += (controls.targetEnergy - controls.energy) * (1 - Math.pow(0.0012, dt));
  const U = THREE.MathUtils.lerp(0.12, 1, controls.energy);
  const targetMeanV2 = THREE.MathUtils.lerp(0.16, 2.3, U);
  let currentMeanV2 = 0;
  for (const b of bodies) currentMeanV2 += b.vel.lengthSq();
  currentMeanV2 = Math.max(currentMeanV2 / bodies.length, 0.0001);
  const gentleScale = THREE.MathUtils.lerp(1, Math.sqrt(targetMeanV2 / currentMeanV2), 0.02);
  const centerPull = THREE.MathUtils.lerp(0.2, 0.026, controls.energy);

  for (const b of bodies) {
    b.vel.multiplyScalar(gentleScale);
    b.vel.addScaledVector(b.pos, -centerPull * dt);
    b.vel.x += Math.sin(time * 0.7 + b.phase) * dt * 0.018;
    b.vel.y += Math.cos(time * 0.6 + b.phase * 1.4) * dt * 0.018;
    b.vel.z += Math.sin(time * 0.5 + b.phase * 0.9) * dt * 0.018;
    b.pos.addScaledVector(b.vel, dt);
    b.radius = speedRadius(THREE, b.vel.length());
    applyCubeBoundary(b, boundary);
  }

  resolveElasticSphereCollisions(THREE, bodies, boundary);
}

function updateGhosts(THREE, controls, positions, velocities, seeds, geometry, material, dt, time, boundary) {
  const speedScale = THREE.MathUtils.lerp(0.55, 1.55, controls.energy);
  const centerPull = THREE.MathUtils.lerp(0.2, 0.018, controls.energy);
  for (let i = 0; i < seeds.length; i++) {
    const ix = i * 3;
    const seed = seeds[i];
    velocities[ix] += Math.sin(time * 0.61 + seed) * dt * 0.01;
    velocities[ix + 1] += Math.cos(time * 0.53 + seed * 1.7) * dt * 0.01;
    velocities[ix + 2] += Math.sin(time * 0.47 + seed * 0.9) * dt * 0.01;
    velocities[ix] -= positions[ix] * centerPull * dt;
    velocities[ix + 1] -= positions[ix + 1] * centerPull * dt;
    velocities[ix + 2] -= positions[ix + 2] * centerPull * dt;

    const sp = Math.hypot(velocities[ix], velocities[ix + 1], velocities[ix + 2]) || 0.0001;
    const maxSpeed = 0.3 * speedScale;
    if (sp > maxSpeed) {
      velocities[ix] = velocities[ix] / sp * maxSpeed;
      velocities[ix + 1] = velocities[ix + 1] / sp * maxSpeed;
      velocities[ix + 2] = velocities[ix + 2] / sp * maxSpeed;
    }

    for (let axis = 0; axis < 3; axis++) {
      positions[ix + axis] += velocities[ix + axis] * dt;
      if (positions[ix + axis] > boundary) {
        positions[ix + axis] = boundary;
        velocities[ix + axis] *= -1;
      } else if (positions[ix + axis] < -boundary) {
        positions[ix + axis] = -boundary;
        velocities[ix + axis] *= -1;
      }
    }
  }
  geometry.attributes.position.needsUpdate = true;
  material.opacity = 0.18 + controls.energy * 0.22;
  material.size = 0.0058 + controls.energy * 0.0042;
}
