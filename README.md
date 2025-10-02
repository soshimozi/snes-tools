# NES Sprite & CHR Editor

A modern web-based tool for creating and editing NES CHR files, palettes, tiles, and meta sprites.  
Built in **TypeScript + React (with TailwindCSS)**, inspired by classic NES tools such as [nesdoug’s SPEZ](https://github.com/nesdoug).

---

## ✨ Features

### 🎨 Palette Editor
- Supports **multiple palettes** that the user can select and edit.
- Palette colors stored in `RGB555` format with automatic conversion to/from hex (`#rrggbb`).
- Built-in helpers:
  - `getRGB(index)` → returns `[r, g, b]`.
  - `getRGBString(index)` → returns `"#rrggbb"`.

### 🧱 Tile Sheets
- Supports **2 tile sheets** simultaneously.
- Tiles are editable at the pixel level (16×16 grid, 4bpp).
- Editing tools:
  - Single-pixel draw/erase.
  - **Flood fill** support.
  - Horizontal/vertical flip.
  - Left/right rotation.
  - Shift operations with wrap-around (not white-fill).

### 🖼️ Meta Sprites
- Create and manage up to **100 meta sprites**.
- Each meta sprite can reference tiles across both sheets.
- Multi-line labeling and drag/drop support.
- Assign palettes per sprite.

### 🗂️ File I/O
- Load/save CHR files (`.chr`) via drag & drop.
- Export/import JSON metadata.
- Export tile/palette data as `.png` for previews.
- Pure binary palette export for direct use with **ca65** assembler via `.incbin`.

### 🖥️ User Interface
- Built with **React + TailwindCSS** for a clean, modern look.
- Grid-based tile and sprite editors with mouse interaction.
- Color picker input with automatic normalization (bit 15 cleared for NES compatibility).
- Keyboard shortcuts for fast editing (planned).

---
## 🛠️ Build & Run

### Prerequisites
- **Node.js 20+** (LTS)
- Package manager: **pnpm** (recommended), or yarn / npm
- Git

### 1. Clone & Install
```bash
git clone https://github.com/soshimozi/snes-tools
cd snes-tools
cp .env.example .env.local   # if applicable
pnpm install                 # or: npm install / yarn install
```

---

## ⚡ Quick Start with Podman
If you just want to run the editor in a container:

```bash
git clone https://github.com/soshimozi/snes-tools
cd snes-tools
podman build -t nes-chr-editor:latest .
podman run --rm -p 3000:3000 --name nes-chr-editor nes-chr-editor:latest
```

---

## 🚀 Deployment

### Option A: Vercel (recommended for Next.js with SSR/APIs)
1. Push your repo to GitHub/GitLab/Bitbucket.
2. Go to **vercel.com → New Project → Import** your repo.
3. Framework preset: **Next.js** (auto-detected).
4. Set any required env vars under **Settings → Environment Variables**.
5. Deploy.

> Vercel automatically handles build (`next build`) and runs the production server.
> If you use Edge/APIs/SSR, this is the simplest option.

---

### Option B: Netlify (Static Export)
Use this if your app can be **fully static** (no SSR/API routes).

1. In `next.config.(js|ts)`:
   ```ts
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     output: 'export',
     images: { unoptimized: true }
   };
   export default nextConfig;
  
---

## ⚡ Roadmap
- Add undo/redo stack (per tile + per meta sprite).
- Sprite preview window with live animation.
- Support for name tables and OAM editing.
- Improved palette management UI.

---

## 🙏 Attribution
This project was **heavily influenced by [nesdoug’s SPEZ](https://github.com/nesdoug)**, which laid much of the groundwork for NES sprite and CHR editing.  
Special thanks to the NESdev community for continued documentation and inspiration.

---

## 📜 License
MIT License. Free to use and modify.
