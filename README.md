# torlink — Windows Executable

A standalone Windows executable of [torlink](https://github.com/baairon/torlink) v1.8.0 — a torrent finder and downloader that lives in your terminal.

## Quick Start

1. Download `torlink.exe` from [Releases](https://github.com/Rezerox39/torlink-windows/releases)
2. Double-click it, or run from a terminal:

```
torlink.exe
```

No Node.js installation required. Everything is bundled.

## What is torlink?

A terminal-native torrent client with zero setup:

- **Search** across curated sources (FitGirl, YTS, The Pirate Bay, 1337x, EZTV, Nyaa, SubsPlease)
- **Download** directly to your `Downloads\torlink\` folder
- **Seed** automatically after download
- **Browse** the curated library with no search query

## Keyboard Shortcuts

- Type a query + **Enter** to search
- **↑/↓** to navigate results
- **d** to download, **Shift+d** to choose a different folder
- **?** for full keyboard shortcuts

## Headless Modes

```
torlink.exe search "query" --category movies
torlink.exe seed ./my-folder
torlink.exe serve
torlink.exe watch ./incoming
```

## Building

### Option 1: GitHub Actions (Recommended)

1. Fork this repo
2. Go to **Actions** → **Build Windows EXE** → **Run workflow**
3. Check "Create release" and set the tag
4. Download the exe from **Releases** when done

### Option 2: Native Windows Build

Requires: Node.js 22+, Git, Visual Studio Build Tools (C++ workload)

```powershell
git clone https://github.com/baairon/torlink.git
cd torlink
git checkout v1.8.0
npm install
npm run build
npm install -g pkg
pkg -t node22-win-x64 dist/cli.cjs -o torlink.exe
.\torlink.exe
```

## How It Works

Built on GitHub Actions using `windows-latest` runners with Visual Studio Build Tools pre-installed. All native modules (yoga-layout, node-datachannel, utp-native) are compiled natively for Windows x64.

Source: [baairon/torlink](https://github.com/baairon/torlink) v1.8.0
