export function createGlassCube(THREE, size) {
  const group = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.045,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.48,
      thickness: 0.52,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );

  const edgeMain = makeEdges(THREE, size, 0.66, 1);
  const edgeGlowOuter = makeEdges(THREE, size, 0.18, 1.045);
  const edgeGlowInner = makeEdges(THREE, size, 0.1, 0.955);
  const rods = makeRigidEdgeRods(THREE, size, 0.0068, 0.28);
  const glowRods = makeRigidEdgeRods(THREE, size * 1.004, 0.0125, 0.075);

  group.add(glass, edgeMain, edgeGlowOuter, edgeGlowInner, glowRods, rods);
  return { group, glass, edgeMain, edgeGlowOuter, edgeGlowInner, rods, glowRods };
}

function makeEdges(THREE, size, opacity, scale) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  edges.scale.setScalar(scale);
  return edges;
}

function makeRigidEdgeRods(THREE, size, radius, opacity) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const h = size / 2;
  const rodGeo = new THREE.CylinderGeometry(radius, radius, size, 10, 1, true);
  const addRod = (pos, rot) => {
    const rod = new THREE.Mesh(rodGeo, mat.clone());
    rod.position.set(pos[0], pos[1], pos[2]);
    rod.rotation.set(rot[0], rot[1], rot[2]);
    group.add(rod);
  };

  for (const y of [-h, h]) for (const z of [-h, h]) addRod([0, y, z], [0, 0, Math.PI / 2]);
  for (const x of [-h, h]) for (const z of [-h, h]) addRod([x, 0, z], [0, 0, 0]);
  for (const x of [-h, h]) for (const y of [-h, h]) addRod([x, y, 0], [Math.PI / 2, 0, 0]);

  return group;
}
