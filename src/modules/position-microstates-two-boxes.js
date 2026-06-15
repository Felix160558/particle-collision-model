import { createPlaceholderModule } from "./placeholder-module.js";

export const positionMicrostatesTwoBoxes = createPlaceholderModule({
  id: "position_microstates_two_boxes",
  title: "双盒微观态",
  description: "两个粒子在 A/B 两盒中的宏观态和微观态数量。",
  formulas: [
    { formula: "(A,A), (A,B), (B,A), (B,B)", note: "微观态逐个计数。" },
    { formula: "A:1 B:1 → 2 个微观态", note: "平均分布更常见，因为对应方式更多。" },
    { formula: "Ω = N! / (n₁! n₂! ... n_m!)", note: "位置分布的组合计数。" }
  ],
  particleCount: 2
});
