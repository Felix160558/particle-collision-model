# Maxwell–Boltzmann Distribution Visualizer

A static scientific teaching experience built with HTML, CSS, JavaScript, Three.js, and WebXR. It is designed for direct deployment to GitHub Pages with no package installation, build command, server API, or database.

> **The curve is not drawn. The curve is counted.**

Particle motion → velocity magnitude → kinetic energy → fixed energy bins → histogram → interpolated curve.

## Choose an edition

The project root is now a mode selector:

| Route | Edition | Intended use |
| --- | --- | --- |
| [`index.html`](./index.html) | Laboratory selector | Choose desktop or immersive mode |
| [`desktop.html`](./desktop.html) | Desktop simulation | Classroom projection, teaching videos, laptops, tablets, and phones |
| [`vr.html`](./vr.html) | Meta Quest VR laboratory | Immersive WebXR demonstration with controller input |

The desktop and VR editions are independent pages. A failure or unsupported feature in the VR edition does not affect the desktop simulation.

## Scientific model

- Equal-mass, equal-volume particles
- Independent Gaussian random velocity components
- Speed calculated from `|v| = √(vx² + vy² + vz²)`
- Kinetic energy calculated from `E = ½m|v|²`, with `m = 1`
- Elastic reflection at container walls
- No particle–particle collision model in this version
- Fixed energy axis from 0–20 a.u., divided into forty 0.5 a.u. bins
- Ten statistical batches producing 10,000 counted energy observations
- A separate `E > 20` overflow count
- The smooth curve is interpolated from completed histogram data, not drawn from a theoretical Maxwell–Boltzmann formula

Changing temperature rescales velocity by `√(T₂/T₁)`, so kinetic energy scales with temperature. Previous statistics are invalidated and must be counted again.

## Desktop edition

- 100, 500, or 1,000 visible particles
- Equal particle size at every speed
- Optional speed-proportional wireframe velocity shells
- Live speed and energy statistics
- Sequential histogram construction
- 10,000-sample accumulated distribution
- Animated histogram-to-curve transition
- Optional two-temperature curve comparison
- Mouse, trackpad, touch, play, pause, and reset controls

## VR edition

- 500 equal-volume particles in a spatial gas container
- Floating energy-statistics and histogram display
- Ten batches and 10,000 counted samples
- Curve formation only after histogram completion
- Temperature adjustment from 100 K to 900 K
- Play/pause and velocity-shell controls
- Meta Quest controller-ray selection
- Optional WebXR hand-tracking feature request when supported
- Desktop mirror controls when immersive WebXR is unavailable

The VR page provides a friendly status message when the browser lacks WebXR, no headset is connected, or the page is not served from a secure context.

## Local preview

Do not open the files by double-clicking them with a `file://` address. ES modules and browser security rules can prevent Three.js from loading correctly.

From the project directory, run any static file server. For example:

```bash
python3 -m http.server 4174 --bind 127.0.0.1
```

Then open:

- Selector: `http://127.0.0.1:4174/`
- Desktop: `http://127.0.0.1:4174/desktop.html`
- VR desktop preview: `http://127.0.0.1:4174/vr.html`

`127.0.0.1` is local to the device opening it. A Quest headset cannot use the computer’s `127.0.0.1` address. Use the deployed GitHub Pages HTTPS URL for headset testing.

## Deploy to GitHub Pages

1. Create or open a GitHub repository.
2. Place all files from this project directory at the repository root.
3. Commit and push the files to the default branch, usually `main`.
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, select **Deploy from a branch**.
6. Select the `main` branch and the `/ (root)` folder, then save.
7. Wait for GitHub Pages to publish the site.

The resulting project URL normally has this form:

```text
https://USERNAME.github.io/REPOSITORY-NAME/
```

Open that exact HTTPS URL in Meta Quest Browser and choose **Meta Quest VR Laboratory**. GitHub Pages supplies the secure context required by immersive WebXR.

## Subdirectory deployment compatibility

The project is safe to publish below a repository path such as `/REPOSITORY-NAME/`:

- Internal pages use relative links such as `./desktop.html` and `./vr.html`
- Local CSS and JavaScript use `./` relative paths
- No link assumes deployment at the domain root
- The desktop page loads its pinned Three.js `0.161.0` runtime from `./vendor/`
- The VR import map pins both `three` and `three/addons/` to version `0.161.0`

The desktop laboratory and homepage preview no longer require a third-party CDN. The VR edition still needs internet access to retrieve its pinned WebXR addons from jsDelivr.

## Mobile and compatibility behavior

- The selector stacks both modes vertically on narrow screens.
- The desktop laboratory uses its existing compact mobile layout.
- The VR page keeps desktop mirror controls available on phones and unsupported browsers.
- Immersive VR requires a WebXR-capable headset browser and HTTPS.
- If WebGL is unavailable, the desktop page displays a clear fallback message.
- If WebXR is unavailable, the VR page remains usable as a non-immersive 3D preview.

## Project files

```text
index.html       Mode selector and GitHub Pages entry point
launcher.css     Selector styling
launcher.js      Lightweight WebXR capability message
desktop.html     Existing desktop laboratory
styles.css       Desktop laboratory styling
app.js           Desktop Three.js simulation and statistics
vr.html          WebXR laboratory
vr.css           VR page and fallback interface styling
vr.js            VR Three.js scene, controls, and statistics
vendor/          Pinned desktop Three.js runtime and MIT license
README.md        Preview, deployment, and compatibility guide
```

## Troubleshooting

### The page is blank

Use a local static server or GitHub Pages instead of a `file://` URL. The desktop page displays a recovery panel if its local 3D module or WebGL renderer cannot start.

### The VR button says “VR NOT SUPPORTED”

This is expected on many desktop and mobile browsers. Use Meta Quest Browser and the deployed HTTPS GitHub Pages URL. The desktop spatial preview remains available.

### The local preview stops working later

The local static server is temporary and stops when its terminal or development session ends. Restart the local preview command. GitHub Pages does not depend on this local process.
