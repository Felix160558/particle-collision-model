export function createSceneKit(THREE, mount) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020308, 0.04);

  const camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.position.set(0, 0.08, 6.15);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  mount.appendChild(renderer.domElement);

  const clock = new THREE.Clock();
  const root = new THREE.Group();
  scene.add(root);
  scene.add(new THREE.AmbientLight(0xffffff, 0.48));

  const lightA = new THREE.PointLight(0xffffff, 2.9, 15);
  lightA.position.set(2.8, 2.4, 3.8);
  scene.add(lightA);

  const lightB = new THREE.PointLight(0xffffff, 1.4, 12);
  lightB.position.set(-3.2, -2, 2.9);
  scene.add(lightB);

  const kit = {
    scene,
    camera,
    renderer,
    clock,
    root,
    targetZoom: 0.48,
    zoom: 0.48,
    clearRoot() {
      while (root.children.length) root.remove(root.children[0]);
    },
    updateCamera(dt, zoomIntent) {
      if (zoomIntent === "in") kit.targetZoom = 0.08;
      if (zoomIntent === "out") kit.targetZoom = 0.86;
      kit.zoom += (kit.targetZoom - kit.zoom) * (1 - Math.pow(0.0015, dt));
      const targetZ = THREE.MathUtils.lerp(4.55, 7.25, kit.zoom);
      camera.position.z += (targetZ - camera.position.z) * 0.055;
      camera.position.y += (THREE.MathUtils.lerp(0.03, 0.14, kit.zoom) - camera.position.y) * 0.035;
      camera.lookAt(0, 0, 0);
    },
    render() {
      renderer.render(scene, camera);
    },
    resize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }
  };

  window.addEventListener("resize", kit.resize);
  return kit;
}
