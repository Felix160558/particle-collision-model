import { createPlaceholderModule } from "./placeholder-module.js";

export const entropyLogOmega = createPlaceholderModule({
  id: "entropy_log_omega",
  title: "熵与 lnΩ",
  description: "把微观态数量的乘法变成熵的加法。",
  formulas: [
    { formula: "Ω_total = Ω_A Ω_B", note: "独立系统合并时微观态数量相乘。" },
    { formula: "ln(Ω_A Ω_B) = lnΩ_A + lnΩ_B", note: "对数把乘法变加法。" },
    { formula: "S = k_B lnΩ", note: "熵从微观态数量定义。" }
  ],
  particleCount: 180
});
