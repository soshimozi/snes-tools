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
