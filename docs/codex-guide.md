# Codex Guide

This guide protects the scientific logic, visual hierarchy, and static GitHub Pages deployment of the Microscopic Thermodynamics Laboratory.

## Public information architecture

The homepage is intentionally curated. Its hierarchy is:

1. One large Maxwell–Boltzmann flagship experience.
2. One visible scientific pipeline: motion → velocity → kinetic energy → counting → distribution.
3. Four core, non-repeating older experiments:
   - single-particle pressure;
   - two-box microstates;
   - high-dimensional energy sphere;
   - solid/liquid/gas v16.

Do not restore the v14 phase model, deep-ice lattice model, particle condense/diffuse model, or placeholder distribution modules to the public homepage without a new teaching reason. Archived source files may remain in `models/` for reference.

## Maxwell–Boltzmann rules

- Keep the flagship files self-contained under `maxwell-boltzmann/`.
- `desktop.html?embed=1` is the homepage composition of the real desktop experiment, not a decorative imitation.
- The embedded mode may hide controls and auto-run the experiment, but it must use the same sampled energies and histogram logic as the full laboratory.
- Never replace the counted histogram with a precomputed Maxwell–Boltzmann curve.
- The smooth curve must continue to originate from the counted bin values.
- Preserve both the full desktop and Meta Quest VR routes.

## Deployment rules

- Keep the project static and build-free.
- Use relative paths for all repository pages and local assets.
- Model pages live in `models/`; shared code lives in `src/`.
- Never write local machine paths or preview ports into production links.
- Pin CDN module versions. The desktop and VR versions of Three.js must remain compatible.
- Test from a local HTTP server, not by double-clicking HTML files.

## Scientific rules

- Do not describe an illustrative animation as a rigorous numerical simulation unless the implemented physics supports that claim.
- Pressure lessons should distinguish an individual momentum-transfer event from the time-averaged macroscopic pressure.
- Microstate lessons should distinguish microstates, macrostates, multiplicity, and probability.
- High-dimensional energy geometry should be presented as intuition for constrained velocity space and marginal distributions.
- The phase model should describe particle arrangement and motion qualitatively; it is not a universal substance-specific phase diagram.
- Keep variables, units, and proportionalities consistent within each experiment.

## Visual rules

- Use a restrained black, white, and neutral-gray scientific laboratory palette.
- The interactive phenomenon is always the first visual focus.
- The homepage should not return to a flat grid of equally weighted cards.
- The Maxwell–Boltzmann flagship should occupy approximately half or more of the main desktop composition.
- Controls, metrics, and formulas must not cover the core simulation area.
- English is the primary interface language. Short Chinese support text may be added only where it improves teaching clarity.
- Narrow screens must keep titles, links, controls, and compatibility notes readable.

## Change checklist

- Does the home page still expose one flagship plus exactly four core older models?
- Does the flagship still show that the curve emerges from counted energy bins?
- Do all internal links work under a GitHub Pages repository subdirectory?
- Do desktop, mobile, and WebXR-unavailable states remain understandable?
- Are scientific simplifications described honestly?
- Is the site still usable with no build command or backend?
