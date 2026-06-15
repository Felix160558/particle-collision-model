import { createPlaceholderModule } from "./placeholder-module.js";

export const singleBallPressure = createPlaceholderModule({
  id: "single_ball_pressure",
  title: "单粒子压强",
  description: "从一个粒子撞墙推出压强和温度。",
  formulas: [
    { formula: "Δp_x = 2mv_x", note: "粒子反弹时 x 方向动量变化。" },
    { formula: "F = Δp / Δt = mv_x² / L", note: "碰撞频率把动量变化转成平均力。" },
    { formula: "PV = 1/3 Nm v²", note: "从单粒子推广到 N 个粒子。" }
  ],
  particleCount: 1
});
