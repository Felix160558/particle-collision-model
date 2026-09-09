// Count actual molecules first, then estimate a continuous probability density.
// No analytical Maxwell–Boltzmann distribution or artificial sample accumulation.
const BIN_WIDTH = 0.125;
export const ENERGY_LIMIT = 20;
export const CURVE_POINTS = 481;

function erf(x) {
  const t = 1 / (1 + .3275911 * x);
  return 1 - (((((1.061405429*t - 1.453152027)*t + 1.421413741)*t - .284496736)*t + .254829592)*t)*Math.exp(-x*x);
}

export function countAndFit(energies) {
  const counts = new Map();
  let sum = 0, sumSquares = 0, n = 0, overflow = 0;
  for (const energy of energies) {
    if (!Number.isFinite(energy) || energy < 0) continue;
    const bin = Math.floor(energy / BIN_WIDTH);
    counts.set(bin, (counts.get(bin) || 0) + 1);
    sum += energy; sumSquares += energy * energy; n++;
    if (energy > ENERGY_LIMIT) overflow++;
  }
  const values = new Float64Array(CURVE_POINTS);
  if (!n) return { values, counts, n, overflow, mean: 0 };
  const mean = sum / n;
  const sigma = Math.sqrt(Math.max(0, sumSquares/n - mean*mean));
  // Data-driven bandwidth; enough support to suppress bin-to-bin sampling noise.
  const h = Math.max(BIN_WIDTH, 1.15*sigma*Math.pow(n, -.2));
  const normalizer = n*h*Math.sqrt(2*Math.PI);
  for (const [bin, count] of counts) {
    const center = (bin + .5)*BIN_WIDTH;
    const weight = count / Math.max(erf(center/(h*Math.SQRT2)), 1e-12);
    for (let i = 1; i < CURVE_POINTS; i++) {
      const x = i*ENERGY_LIMIT/(CURVE_POINTS-1);
      const z = (x-center)/h;
      if (Math.abs(z) > 8) continue;
      // Positive boundary-corrected Gaussian kernel, normalized over E >= 0.
      values[i] += weight*Math.exp(-.5*z*z)*-Math.expm1(-2*x*center/(h*h))/normalizer;
    }
  }
  return { values, counts, n, overflow, mean };
}

const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
export function classifyHand(hand) {
  if (!hand || hand.length !== 21) return 'none';
  const scale = Math.max(distance(hand[0],hand[9]),.0001);
  const extended = (tip,pip,mcp) => distance(hand[tip],hand[0]) > distance(hand[pip],hand[0])*1.1
    && distance(hand[tip],hand[mcp]) > distance(hand[pip],hand[mcp])*1.4;
  const folded = (tip,pip,mcp) => distance(hand[tip],hand[0]) < distance(hand[pip],hand[0])*1.05
    && distance(hand[tip],hand[mcp]) < scale*.85;
  const fingers = [[8,6,5],[12,10,9],[16,14,13],[20,18,17]];
  const open = fingers.map(f=>extended(...f)), closed = fingers.map(f=>folded(...f));
  const pinch = distance(hand[4],hand[8])/scale;
  if (pinch < .3 && open[1] && open[2] && open[3]) return 'ok';
  if (pinch > .44 && open[0] && open[1] && closed[2] && closed[3]) return 'v';
  if (open.every(Boolean) && pinch > .44) return 'palm';
  if (closed.every(Boolean)) return 'fist';
  return 'none';
}

export function createGestureGate() {
  let candidate = 'none', since = 0;
  return {
    update(gesture,now) {
      if (gesture !== candidate) { candidate=gesture; since=now; }
      return gesture !== 'none' && now-since >= 350 ? gesture : 'none';
    },
    reset() { candidate='none'; since=0; },
  };
}
