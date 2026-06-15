# Particle Collision Model

这是一个面向热学与统计物理教学的静态网页项目。项目用 HTML、CSS、JavaScript 和 Three.js 构建交互模型，适合直接发布到 GitHub Pages。

## 如何运行

发布到 GitHub Pages 后，打开仓库对应的 Pages 地址即可访问首页。

本地预览时，在项目根目录使用任意静态文件服务打开入口页：

```text
./index.html
```

项目中的页面、样式和脚本都使用相对路径，方便部署在 GitHub Pages 的仓库子路径下。

## 第一版模型

### 单粒子碰撞模型

入口：`./models/single_ball_pressure.html`

这个模型展示单个粒子在容器中运动并与壁面碰撞的过程。它强调压强来自粒子碰撞时的动量交换，而不是来自某个抽象的静态量。

### 微观态计数模型

入口：`./models/position_microstates_two_boxes.html`

这个模型展示粒子分布在两个盒子中时，不同宏观分布对应的微观排列数。它用计数方式解释为什么接近均匀分布的宏观态最常见。

### 高维能量球模型

入口：`./models/high_dimensional_energy_sphere.html`

这个模型把总能量约束表示为高维空间中的几何结构，用投影帮助理解单个粒子的能量为何会呈现统计分布。

## 项目结构

```text
.
├── index.html
├── README.md
├── CONTRIBUTING.md
├── docs/
│   └── codex-guide.md
├── models/
│   ├── single_ball_pressure.html
│   ├── position_microstates_two_boxes.html
│   └── high_dimensional_energy_sphere.html
└── src/
    ├── core/
    ├── modules/
    └── styles/
```

`models/` 中还保留了其他实验模型页面，第一版首页只开放上面三个入口。

## 修改项目

如果你要让 AI 或其他贡献者修改项目，请先阅读：

- `./CONTRIBUTING.md`
- `./docs/codex-guide.md`
