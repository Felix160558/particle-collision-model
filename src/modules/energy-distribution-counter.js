import { createPlaceholderModule } from "./placeholder-module.js";

export const energyDistributionCounter = createPlaceholderModule({
  id: "energy_distribution_counter",
  title: "能级分布计数",
  description: "固定粒子数和总能量时，比较不同能级占据数。",
  formulas: [
    { formula: "n₀ + n₁ + ... + n_i = N", note: "粒子数守恒。" },
    { formula: "n₀E₀ + n₁E₁ + ... + n_iE_i = U", note: "总能量守恒。" },
    { formula: "Ω = N! / (n₀! n₁! ... n_i!)", note: "先不展开同能级内部简并。" }
  ],
  particleCount: 120
});
