# Terminal Chaos

A wall of **real tmux panes**, styled after the busy agent terminals in the reference image. Each pane runs an independent Python process generating colored code diffs, test results, build logs, requests, and agent chatter. Pane zero is the orchestrator.

The activity is simulated: displayed commands never execute, no API calls are made, and no project files are read or changed. The launcher uses a separate tmux socket named `terminal-chaos`, so your normal tmux server and configuration stay separate.

## Run

Requires Python 3 and tmux (`brew install tmux` on macOS).

```sh
cd /Users/leonsilicon/Developer/github/leonsilicon/terminal-chaos
./run.sh                         # 24 real panes
./run.sh --panes 48 --speed 3     # more panes, faster text
./run.sh --panes 64 --speed 5     # maximum visual chaos
```

On macOS, you can also double-click **Start Chaos.command**. It starts 24 panes at 2× speed.

Maximize your terminal and reduce its font size for large grids. tmux fits the grid to the attached terminal; at very high counts, its minimum pane size can make the virtual window larger than the visible area. Up to 256 panes are supported, subject to terminal size and machine resources. A fast 24–64 pane wall is usually more readable.

## Controls

| Key | Action |
| --- | --- |
| `q` | Stop the current demo and every pane in it |
| `Ctrl-b`, then `z` | Zoom or unzoom the focused pane |
| `Ctrl-b`, then an arrow key | Focus a neighboring pane |
| `Ctrl-b`, then `d` | Detach while the demo keeps running |

`Ctrl-b` is tmux's prefix: release it before pressing the next key. `q` works directly.

## Manage demos

```sh
./run.sh --detach --panes 48 --speed 3
./run.sh --attach
./run.sh --stop

# Run another independent wall:
./run.sh --session more-chaos --panes 32 --speed 2
./run.sh --stop --session more-chaos

# Automatically end each pane after a minute:
./run.sh --duration 60

# Output a single agent stream inside any terminal/multiplexer:
./run.sh --stream 3 --speed 4
```

Use `./run.sh --help` for all options. The terminal emulator supplies the font; the script supplies colors and pane borders. Scrollback is bounded to keep memory usage predictable. Detaching keeps the worker processes running until you stop the demo or their optional duration expires.
