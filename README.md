# Obsidian Geometry Plugin

Bring your math notes to life with interactive geometry graphs inside Obsidian! Draw points, lines, segments, rays, angles, circles, and more—right in your vault.

# Features

Draw points, lines, segments, rays, midpoints, and bisectors

Construct angles and circles with precise measurements

Interactive canvas: drag points and see your shapes update in real time

# Fully Markdown-friendly: embed geometry graphs in your notes

# Installation
Using Obsidian Community Plugins

Open Obsidian → Settings → Community Plugins → Browse

Search for Obsidian Geometry Plugin

Click Install, then Enable

Manual Installation

Download the latest release from the Releases
 page

Move the files into your vault under .obsidian/plugins/geometry-plugin

Enable the plugin in Settings → Community Plugins

Usage

Insert a code block with your geometric objects:

```geometry
point A 100 100
point B 300 100
line AB
segment AB
circle A 50
angle ABC
```

The plugin will render an interactive canvas showing your geometry

Drag points to dynamically update the shapes

Configuration
Option	Description	Default
showLabels	Toggle labels for points and objects	true
snapToGrid	Snap points to a grid for precision	false
Development
# Clone the repo
git clone https://github.com/UniqueWay-001/obsidian-geometry-plugin.git

# Install dependencies
npm install

# Build the plugin
npm run build

# Start dev mode with auto-reload
npm run dev

Folder Structure
obsidian-geometry-plugin/
├── main.ts          # Plugin logic and canvas rendering
├── manifest.json    # Plugin metadata
├── styles.css       # Canvas and plugin styling
├── README.md        # This file
└── ...

Contributing

Pull requests welcome! Open an issue to discuss ideas or features before contributing.
