# VOXEL — Immersive Minecraft Web Experience

A high-performance, multi-page interactive web experience inspired by Minecraft. Built with WebGL, Web Audio API, and custom CSS-driven UI.

## ✨ Features

- **Portal Room Hub**: Central navigation with 10 animated portal frames.
- **WebGL Voxel Engine**: 65,536 particles simulated on the GPU across 6 distinct biomes.
- **Dynamic HUD**: Health, hunger, experience bar, and interactive 9-slot hotbar.
- **Synthesized Audio**: Procedural C418-style ambient music and interactive SFX (synthesized via Web Audio API, no external files required).
- **Dynmap**: Procedurally generated pixel world map with zoom and biome tooltips.
- **Crafting Table**: Fully functional 3x3 crafting grid with real game recipes.
- **Enchanting Room**: Galactic alphabet text and floating rune particles.
- **Loot Chests**: Daily reward chest with random drops and flying item particles.
- **Jukebox**: Integrated music player with spinning disc and bar visualizer.
- **Achievement System**: Persistent board with 11 unique unlockable achievements.

## 🚀 Getting Started

1. Clone this repository.
2. Run a local web server (e.g., `python -m http.server 8000`).
3. Open `index.html` in your browser.

## 🛠 Tech Stack

- **Graphics**: Three.js (WebGL), GSAP
- **Audio**: Web Audio API (Synthesized SFX & BGM)
- **UI**: Vanilla HTML5, CSS3 (Flexbox/Grid), JavaScript (ES6)
- **Fonts**: Press Start 2P, VT323 (via Google Fonts)

## 🎮 Navigation

- **Scroll**: Move through the Overworld biomes.
- **1-9 / Mouse Wheel**: Navigate the hotbar.
- **F3**: Toggle debug information.
- **Portals**: Jump between different dimensions/pages.

---
*Inspired by the world of Minecraft.*
