# Microscopic Thermodynamics Laboratory

A curated collection of static WebGL teaching experiments for kinetic theory, statistical mechanics, phase change, and molecular energy distributions. The project uses HTML, CSS, JavaScript, Three.js, and WebXR, and deploys directly to GitHub Pages without a build step.

## Live site

After GitHub Pages is enabled for this repository, the main entrance is:

```text
https://felix160558.github.io/particle-collision-model/
```

The home page is the public learning path. Experimental and superseded files may remain in the repository for reference, but they are intentionally absent from the main navigation.

## Featured laboratory

### Maxwell–Boltzmann Distribution Visualizer

The flagship experience makes the complete statistical chain visible:

```text
particle motion → velocity → kinetic energy → counted bins → smooth curve
```

The distribution is not inserted as a pre-drawn theoretical graphic. The histogram is accumulated from 10,000 particle samples, and its counted bin tops are then interpolated into the displayed curve.

- Homepage preview: `./maxwell-boltzmann/desktop.html?embed=1`
- Full desktop laboratory: `./maxwell-boltzmann/desktop.html`
- Meta Quest / WebXR laboratory: `./maxwell-boltzmann/vr.html`
- Desktop / VR selector: `./maxwell-boltzmann/index.html`

The desktop and VR pages use relative local paths. Three.js is pinned to version `0.161.0` on jsDelivr, so deployment under the repository subdirectory works without path rewriting.

## Core learning path

The public collection keeps four older models whose teaching roles do not overlap:

1. **Single-Particle Pressure** — momentum transfer and the microscopic origin of pressure.
2. **Two-Box Microstates** — multiplicity, macrostates, and the emergence of equilibrium.
3. **High-Dimensional Energy Sphere** — total-energy constraints and statistical energy sharing.
4. **Solid · Liquid · Gas** — particle arrangement and motion during a simplified phase-change demonstration.

The v16 phase model is the sole public phase-change version. The earlier v14 page, the deep-ice lattice study, and the particle condense/diffuse study remain archived in `models/` but are no longer promoted as separate core lessons.

## Local preview

ES modules should be served through a local static server rather than opened with a `file://` URL.

From the repository root:

```bash
python3 -m http.server 4174
```

Then open:

```text
http://127.0.0.1:4174/
```

An internet connection is required on first load because Three.js and its WebXR addons are delivered by jsDelivr.

## GitHub Pages deployment

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the default branch and the repository root (`/`).
5. Save and open the published HTTPS URL after deployment completes.

GitHub Pages supplies the secure context required by immersive WebXR. Open the published URL in Meta Quest Browser, choose **Meta Quest VR**, and then use **ENTER VR** when WebXR support is detected.

## Compatibility

- Desktop laboratory: modern WebGL browser; mouse, trackpad, or touch.
- Mobile: compact desktop layout with a short device note on the home page.
- Immersive VR: Meta Quest Browser, HTTPS, and WebXR support.
- No WebXR: the VR page provides a friendly status message and remains available as a non-immersive spatial preview.
- No JavaScript: navigation remains readable, but the scientific simulations cannot run.

## Project structure

```text
.
├── index.html                         Curated laboratory home page
├── maxwell-boltzmann/
│   ├── desktop.html                   Full desktop laboratory
│   ├── vr.html                        Meta Quest / WebXR laboratory
│   ├── index.html                     Desktop / VR selector
│   └── *.js, *.css                    Self-contained simulation assets
├── models/                            Core and archived experiment pages
├── src/
│   ├── core/                          Shared Three.js and interaction helpers
│   ├── modules/                       Modular experiment implementations
│   └── styles/                        Shared model and landing-page styles
├── CONTRIBUTING.md
└── docs/codex-guide.md
```

## Scientific boundaries

- A visual teaching model is not described as a full molecular-dynamics calculation unless it actually implements that physics.
- The Maxwell–Boltzmann curve is derived from counted simulated energies, preserving the principle: **the curve is counted, not drawn**.
- The phase-change page is a qualitative visualization of arrangement and motion, not a universal material phase diagram.
- Formula symbols and units must keep a stable meaning within each experiment.

For contribution and maintenance rules, read [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`docs/codex-guide.md`](./docs/codex-guide.md).
