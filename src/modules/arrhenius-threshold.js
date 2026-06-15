import { createPlaceholderModule } from "./placeholder-module.js";

export const arrheniusThreshold = createPlaceholderModule({
  id: "arrhenius_threshold",
  title: "Arrhenius 阈值",
  description: "活化能阈值切出高能尾部中真正能反应的比例。",
  formulas: [
    { formula: "reactive fraction ∝ exp[-E_a/(k_BT)]", note: "越过阈值的粒子比例决定反应机会。" },
    { formula: "k = A exp[-E_a/(RT)]", note: "Arrhenius 公式连接温度和速率常数。" }
  ],
  particleCount: 260
});
