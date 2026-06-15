import { createPlaceholderModule } from "./placeholder-module.js";

export const maxwellBoltzmannSpeedDistribution = createPlaceholderModule({
  id: "maxwell_boltzmann_speed_distribution",
  title: "Maxwell-Boltzmann 分布",
  description: "速度空间壳层和能量惩罚共同塑造速度分布峰值。",
  formulas: [
    { formula: "g(v) ∝ 4πv²", note: "同一速率的方向状态数随 v² 增大。" },
    { formula: "E = 1/2 mv²", note: "速率越大，能量越高。" },
    { formula: "f(v) ∝ 4πv² exp[-mv²/(2k_BT)]", note: "状态数增加与玻尔兹曼因子竞争。" }
  ],
  particleCount: 260
});
