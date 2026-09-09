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

The observation camera stays still until dragged or zoomed. Box edges use a single antialiased screen-space stroke of constant pixel width, replacing overlapping wireframe layers. Rendering follows the browser's animation-frame scheduling; there is no artificial low frame-rate cap. Energy readouts update on temperature or ensemble changes, since elastic wall reflections preserve speed and energy.

## Gesture presentation and live curve

Double-click the central desktop particle model to enter the clean presentation. Double-click the model again or press Esc to return. The model remains large, velocity shells are enabled, and a live energy curve appears beside the temperature. No button is added to the main interface.

Allow camera access on GitHub Pages (HTTPS) or localhost. Hold one hand clearly for about 0.35 seconds: open palm heats (36 K/s), fist cools, OK moves closer, and V moves farther away. Temperature is bounded at 100–900 K. Zoom only moves the viewer; temperature rescales molecular velocity by the square root of the temperature ratio. Leaving the view restores the previous camera, shell setting, and play/pause state, while retaining the new temperature.

Every 100 ms, the curve recounts the actual energies of all currently displayed particles in 0.125 a.u. bins. A data-driven, boundary-corrected kernel smoother fits those counts into a nonnegative continuous density. It is an empirical estimate, not an analytical Maxwell–Boltzmann curve. The fit includes particles beyond the displayed 0–20 energy axis; their count is shown separately. The vertical scale is chosen once on entry to accommodate the same system at 100 K, then held fixed throughout heating and cooling. A brief interpolation between successive fits smooths visual motion.

Repeated frames do not add new independent samples: the readout stays at the actual 100, 500, or 1,000 molecules. Smoothing carries estimation bias and finite-sample uncertainty. Wall reflections alone preserve individual energies; changes in the energy distribution here come from the temperature control. The main page's existing ensemble-counting workflow remains separate.

MediaPipe 0.10.14 and the hand model are bundled in `vendor/vision/` and loaded only on entering this view. Camera frames are processed locally, never uploaded or saved. Exiting, hiding, or leaving the page stops the camera. If access is denied or unavailable, an explanatory status and retry link appear. Test physical hand recognition in a browser with camera access; lighting and hand visibility affect recognition.

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
- High-contrast, fog-independent spatial labels, a 2048-pixel statistics texture, and 1.25× XR framebuffer scale (subject to headset limits)
- **ENTER PARTICLE VIEW** moves the viewpoint to a molecule inside the box; **RETURN TO LAB VIEW** restores the external view
- **FOLLOW PARTICLE** follows that molecule's position without forcing camera rotation. Headset entry defaults to stationary observation; following is opt-in. Desktop entry enables following by default.

Particle view changes only the viewer transform and hides the observed molecule's own geometry. It does not change particle velocities, energies, counts, or the statistical model. The spatial control console travels with the viewer in immersive particle mode, keeping the return button accessible. Headset movement and looking around remain controlled by WebXR.

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
