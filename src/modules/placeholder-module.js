import { createGlassCube } from "../core/particles.js";

export function createPlaceholderModule({ id, title, description, formulas, particleCount = 96 }) {
  return {
    id,
    title,
    description,
    formulas,
    create({ THREE, sceneKit, ui }) {
      const group = new THREE.Group();
      sceneKit.root.add(group);

      const cube = createGlassCube(THREE, 2.65);
      group.add(cube.group);

      const positions = new Float32Array(particleCount * 3);
      const seeds = new Float32Array(particleCount);
      for (let i = 0; i < particleCount; i++) seeds[i] = Math.random() * 1000;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.025,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      group.add(new THREE.Points(geometry, material));

      function update({ time, gesture }) {
        const open = gesture.openAmount;
        const spread = THREE.MathUtils.lerp(0.42, 1.1, open);
        for (let i = 0; i < particleCount; i++) {
          const a = seeds[i] + i * 0.618;
          const ix = i * 3;
          positions[ix] = Math.sin(time * 0.42 + a) * spread;
          positions[ix + 1] = Math.cos(time * 0.36 + a * 1.7) * spread * 0.78;
          positions[ix + 2] = Math.sin(time * 0.31 + a * 0.9) * spread;
        }
        geometry.attributes.position.needsUpdate = true;
        group.rotation.y += 0.004;
        sceneKit.root.rotation.y += ((open - 0.5) * 0.42 - sceneKit.root.rotation.y) * 0.035;
        ui.primaryValue.textContent = `control = ${open.toFixed(2)}`;
      }

      return {
        update,
        dispose() {
          sceneKit.root.remove(group);
        }
      };
    }
  };
}
