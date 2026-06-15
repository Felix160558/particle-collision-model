import { arrheniusThreshold } from "./arrhenius-threshold.js";
import { energyDistributionCounter } from "./energy-distribution-counter.js";
import { entropyLogOmega } from "./entropy-log-omega.js";
import { highDimensionalEnergySphere } from "./high-dimensional-energy-sphere.js";
import { maxwellBoltzmannSpeedDistribution } from "./maxwell-boltzmann-speed-distribution.js";
import { positionMicrostatesTwoBoxes } from "./position-microstates-two-boxes.js";
import { singleBallPressure } from "./single-ball-pressure.js";

export const modules = [
  highDimensionalEnergySphere,
  singleBallPressure,
  positionMicrostatesTwoBoxes,
  energyDistributionCounter,
  entropyLogOmega,
  maxwellBoltzmannSpeedDistribution,
  arrheniusThreshold
];
