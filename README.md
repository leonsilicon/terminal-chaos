# Terminal Chaos

A wall of **real tmux panes** streaming simulated agent activity: colored code diffs, test results, build logs, requests, and chatter. The first pane is the orchestrator. Written in TypeScript; runs directly with Node.js or Bun, with no build step or Python dependency.

The activity is simulated. Displayed commands never execute, no API calls are made, and no project files are read or changed. A separate tmux socket named `terminal-chaos` keeps demos separate from your normal tmux server and configuration.

## Setup

Use macOS, Linux, or WSL with **tmux** and either **Node.js 22.18+** (24+ recommended) or **Bun 1.3+**.

Install tmux with your system package manager:

```sh
brew install tmux             # macOS
# Or, on Debian/Ubuntu/WSL:
sudo apt install tmux
```

Clone the project and install its development dependencies with npm:

```sh
git clone https://github.com/leonsilicon/terminal-chaos.git
cd terminal-chaos
npm install
npm start                    # 24 panes, arranged as 4 rows × 6 columns
```

Alternatively, use Bun:

```sh
bun install
bun run --bun start          # runs the package script with Bun instead of Node
```

Both runtimes can also run the entry point directly:

```sh
node src/cli.ts --rows 3 --cols 4
bun src/cli.ts --rows 3 --cols 4
```

`./run.sh` chooses Node if installed, otherwise Bun, and forwards all arguments. On macOS, double-click **Start Chaos.command** to start 24 panes at 2× speed. Make sure Node or Bun and tmux are on your `PATH`.

## Customize rows and columns

Set **both** `--rows` and `--cols` for an exact grid. The pane count is their product:

```sh
npm start -- --rows 2 --cols 3              # 6 panes
npm start -- --rows 4 --cols 8 --speed 3    # 32 panes, 3× speed
bun src/cli.ts --rows 3 --cols 5 --speed 2  # 15 panes, using Bun
```

Set only one dimension to arrange a total pane count (24 by default):

```sh
npm start -- --panes 48 --cols 8           # 6 rows × 8 columns
npm start -- --panes 12 --rows 3           # 3 rows × 4 columns
npm start -- --cols 4                     # default 24 panes: 6 rows × 4 columns
npm start -- --panes 10 --cols 4           # rows of 4, 4, and 2 panes
```

With only `--rows`, panes are distributed evenly across that many rows; earlier rows get any extra panes. With only `--cols`, each row fills up to that many columns, and the last row may be shorter. Without either option, the grid is chosen automatically. If you supply `--panes` alongside both dimensions, it must equal `rows × cols`.

These options control **pane counts**, not terminal character dimensions. Between 1 and 256 panes are supported. Maximize your terminal and reduce its font size for large grids. tmux fits the grid to the attached terminal, but its minimum pane size may make very large grids extend beyond the visible area. A 24–64 pane wall is usually more readable.

To change an existing demo's grid, stop it and start it again with new dimensions:

```sh
npm start -- --stop
npm start -- --rows 3 --cols 6
```

## Controls

| Key | Action |
| --- | --- |
| `q` | Stop the current demo and every pane in it |
| `Ctrl-b`, then `z` | Zoom or unzoom the focused pane |
| `Ctrl-b`, then an arrow key | Focus a neighboring pane |
| `Ctrl-b`, then `d` | Detach while the demo keeps running |

Release `Ctrl-b` before pressing the next key. `q` works directly. The terminal emulator supplies the font; the app supplies colors and pane borders.

## Manage demos

```sh
npm start -- --detach --rows 4 --cols 6 --speed 3
npm start -- --attach
npm start -- --stop

# Run another independent wall:
npm start -- --session more-chaos --rows 4 --cols 8 --speed 2
npm start -- --stop --session more-chaos

# Automatically end each worker after a minute:
npm start -- --duration 60

# Output one agent stream without tmux:
npm start -- --stream 3 --speed 4

# Repeatable generated activity (timestamps still reflect the current time):
npm start -- --seed 42

# Show every option:
npm start -- --help
```

The same options work with `bun src/cli.ts` and `./run.sh`. Detaching keeps workers running until you stop the demo or their duration expires. Scrollback is bounded to limit memory usage.

## Development

```sh
npm run typecheck
npm test
```

With Bun, use `bun run typecheck` and `bun test`. Tests cover CLI validation and grid calculation; tmux is only required for launching the full wall.
