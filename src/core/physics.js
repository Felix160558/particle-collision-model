export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function randomUnitVector(THREE) {
  const z = rand(-1, 1);
  const t = rand(0, Math.PI * 2);
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(r * Math.cos(t), r * Math.sin(t), z);
}

export function randomInsideCube(THREE, limit) {
  return new THREE.Vector3(
    rand(-limit, limit),
    rand(-limit, limit),
    rand(-limit, limit)
  );
}

export function applyCubeBoundary(body, boundary) {
  const r = body.radius;
  for (const axis of ["x", "y", "z"]) {
    if (body.pos[axis] > boundary - r) {
      body.pos[axis] = boundary - r;
      body.vel[axis] *= -1;
    } else if (body.pos[axis] < -boundary + r) {
      body.pos[axis] = -boundary + r;
      body.vel[axis] *= -1;
    }
  }
}

export function resolveElasticSphereCollisions(THREE, bodies, boundary, cellSize = 0.27) {
  const grid = new Map();
  const key = (ix, iy, iz) => `${ix},${iy},${iz}`;
  const cellIndex = (v) => Math.floor((v + boundary) / cellSize);

  for (let i = 0; i < bodies.length; i++) {
    const p = bodies[i].pos;
    const k = key(cellIndex(p.x), cellIndex(p.y), cellIndex(p.z));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }

  const checked = new Set();
  for (const [k, indices] of grid) {
    const [ix, iy, iz] = k.split(",").map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const neighbor = grid.get(key(ix + dx, iy + dy, iz + dz));
          if (!neighbor) continue;

          for (const i of indices) {
            for (const j of neighbor) {
              if (j <= i) continue;
              const pairKey = `${i}:${j}`;
              if (checked.has(pairKey)) continue;
              checked.add(pairKey);

              const a = bodies[i];
              const b = bodies[j];
              const delta = b.pos.clone().sub(a.pos);
              const distance = delta.length();
              const minDistance = a.radius + b.radius;

              if (distance > 0.0001 && distance < minDistance) {
                const n = delta.multiplyScalar(1 / distance);
                const overlap = minDistance - distance;
                a.pos.addScaledVector(n, -overlap * 0.5);
                b.pos.addScaledVector(n, overlap * 0.5);

                const rel = a.vel.clone().sub(b.vel);
                const relNormal = rel.dot(n);
                if (relNormal > 0) {
                  const impulse = n.clone().multiplyScalar(relNormal);
                  a.vel.sub(impulse);
                  b.vel.add(impulse);
                }
              }
            }
          }
        }
      }
    }
  }
}
