# torlink v1.8.0 — Windows Executable

A standalone Windows executable of [torlink](https://github.com/baairon/torlink) v1.8.0 — a torrent finder and downloader that lives in your terminal.

## Quick Start

1. Download `torlink.exe` from [Releases](https://github.com/Rezerox39/torlink-windows/releases)
2. Double-click it, or run from a terminal:

```
torlink.exe
```

That's it. A terminal window opens and torlink runs.

## What is torlink?

A terminal-native torrent client with zero setup:

- **Search** across curated sources (FitGirl, YTS, The Pirate Bay, 1337x, EZTV, Nyaa, SubsPlease)
- **Download** directly to your `Downloads\torlink\` folder
- **Seed** automatically after download
- **Browse** the curated library with no search query

## How It Works

This `.exe` bundles torlink v1.8.0 with the Node.js 22 runtime into a single file — no Node.js installation required.

**Transport:** Uses TCP, uTP (if available), and DHT for peer connections. WebRTC peers are disabled for maximum compatibility.

## Usage

- Type a search query and press **Enter**
- **↑/↓** arrows to navigate results
- **d** to download, **Shift+d** to choose a different folder
- **?** for full keyboard shortcuts

Headless modes (run from a terminal):

```
torlink.exe search "ubuntu" --category movies
torlink.exe seed ./my-folder
torlink.exe serve
torlink.exe watch ./incoming
```

## Source

Built from [baairon/torlink](https://github.com/baairon/torlink) v1.8.0 using esbuild + @yao-pkg/pkg.
