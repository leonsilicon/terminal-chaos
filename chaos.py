#!/usr/bin/env python3
"""A wall of real tmux panes streaming synthetic agent activity."""

import argparse
from collections import deque
import math
import os
from pathlib import Path
import random
import re
import shlex
import shutil
import signal
import subprocess
import sys
import time


SOCKET = "terminal-chaos"
RESET = "\033[0m"
COLORS = {
    "muted": "\033[38;5;103m",
    "white": "\033[38;5;252m",
    "green": "\033[38;5;114m",
    "cyan": "\033[38;5;80m",
    "orange": "\033[38;5;215m",
    "red": "\033[38;5;203m",
    "purple": "\033[38;5;183m",
    "add": "\033[48;5;22m\033[38;5;157m",
    "remove": "\033[48;5;52m\033[38;5;217m",
}
NAMES = ("astra", "fable", "forge", "ember", "nova", "orbit", "flux", "echo")
ROLES = ("orchestrator", "backend", "frontend", "tests", "database", "infra", "compiler", "review")
FILES = (
    "src/api/router.ts", "src/auth/session.ts", "src/components/Grid.tsx",
    "src/engine/physics.ts", "src/cache/ttl.ts", "prisma/schema.prisma",
    "src/workers/queue.ts", "src/render/scene.ts", "tests/integration.test.ts",
    "src/hooks/useStream.ts", "src/server/index.ts", "src/lib/match.ts",
)
TASKS = (
    "reconcile worker state", "fix cache invalidation", "tighten request validation",
    "patch collision response", "stream incremental updates", "batch database writes",
    "remove redundant renders", "resolve dependency graph", "optimize query planner",
    "wire up websocket events", "stabilize integration suite", "merge route changes",
)
CODE = (
    ("const ttl = 30_000;", "const ttl = Infinity;"),
    ("await run(task);", "await Promise.all(batch.map(run));"),
    ("return state.value;", "return cache.get(key) ?? state.value;"),
    ("const damping = 0.98;", "const damping = 0.35;"),
    ("if (queue.length) flush();", "if (queue.length >= batchSize) flush();"),
    ("const retries = 1;", "const retries = 5;"),
)


def positive_float(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise argparse.ArgumentTypeError("must be a finite number greater than zero")
    return number


def pane_count(value):
    number = int(value)
    if not 1 <= number <= 256:
        raise argparse.ArgumentTypeError("must be between 1 and 256")
    return number


def session_name(value):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", value):
        raise argparse.ArgumentTypeError("use 1–40 letters, digits, underscores, or hyphens")
    return value


def agent_name(index):
    return "astra / orchestrator" if index == 0 else f"{NAMES[index % len(NAMES)]}-{index:02d} / {ROLES[index % len(ROLES)]}"


def activity(rng, index, count):
    """Return colored output lines; none of the displayed commands are executed."""
    path = rng.choice(FILES)
    task = rng.choice(TASKS)
    kind = rng.randrange(7)
    if index == 0:
        worker = rng.randrange(1, max(2, count))
        return [
            ("cyan", f"◆ dispatch → {NAMES[worker % len(NAMES)]}-{worker:02d}"),
            ("white", f"  {task}"),
            ("green", f"● {rng.randrange(3, 28)} tasks landed · {count} agents online"),
            ("muted", f"  queue {rng.randrange(5, 80)} · context {rng.randrange(25, 95)}%"),
            ("orange", rng.choice(("✻ Orchestrating…", "✻ Reconciling patches…", "✻ Reviewing results…"))),
        ]
    if kind == 0:
        old, new = rng.choice(CODE)
        line = rng.randrange(10, 240)
        return [
            ("green", f"● Edit({path})"),
            ("remove", f"{line:3} - {old}"),
            ("add", f"{line:3} + {new}"),
            ("muted", f"    +{rng.randrange(1, 80)} −{rng.randrange(1, 20)} lines"),
        ]
    if kind == 1:
        passed = rng.randrange(12, 480)
        return [
            ("white", "● Bash(npm test -- --run)"),
            ("green", f"  ✓ {path} ({rng.randrange(2, 16)} tests)"),
            ("green", f"  {passed} passed · 0 failed"),
            ("muted", f"  duration {rng.uniform(0.1, 4.8):.2f}s"),
        ]
    if kind == 2:
        return [
            ("white", f"● Read({path})"),
            ("muted", f"  └ Read {rng.randrange(40, 800)} lines"),
            ("purple", f"  Plan: {task}"),
            ("orange", f"✻ Thinking… (↓ {rng.uniform(1, 180):.1f}k tokens)"),
        ]
    if kind == 3:
        return [
            ("cyan", f"→ compiling {path}"),
            ("white", f"  transform {rng.randrange(100, 3000)} modules"),
            ("green", f"  ✓ built in {rng.randrange(30, 900)}ms"),
            ("muted", f"  bundle {rng.uniform(10, 280):.2f} kB · gzip {rng.uniform(3, 70):.2f} kB"),
        ]
    if kind == 4:
        return [
            ("white", "● Bash(git diff --stat)"),
            ("cyan", f"  {path} | +{rng.randrange(1, 70)} −{rng.randrange(1, 20)}"),
            ("green", f"  ✓ patch {rng.getrandbits(28):07x} ready"),
            ("orange", f"✻ {task.capitalize()}…"),
        ]
    if kind == 5:
        route = rng.choice(("/api/events", "/health", "/api/agents", "/api/stream", "/api/tasks"))
        return [
            ("muted", f"[{time.strftime('%H:%M:%S')}] worker:{index:02d} live"),
            ("green", f"  GET {route} 200 {rng.randrange(1, 70)}ms"),
            ("cyan", f"  websocket → {rng.randrange(20, 900)} events/s"),
            ("white", f"  queue drained · {rng.randrange(2, 80)} jobs"),
        ]
    return [
        ("orange", "● Checking types…"),
        ("red", f"  retry: worker-{rng.randrange(1, max(2, count)):02d} busy"),
        ("muted", f"  backoff {rng.randrange(5, 90)}ms → recovered"),
        ("green", "  ✓ typecheck clean · 0 errors"),
        ("purple", f"  next → {task}"),
    ]


def stream(args):
    index = args.stream
    rng = random.Random(args.seed + index if args.seed is not None else None)
    pending = deque()
    started = time.monotonic()
    lines = 0
    name = agent_name(index)
    print(f"\033]2;{name}\007\033[?25l", end="", flush=True)

    def shutdown(_signum, _frame):
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, shutdown)
    try:
        while args.duration is None or time.monotonic() - started < args.duration:
            if not pending:
                pending.extend(activity(rng, index, args.panes))
                pending.append(("muted", ""))
            color, line = pending.popleft()
            # Clip to the live PTY width so resizing never creates wrapped log storms.
            width = max(1, shutil.get_terminal_size((80, 24)).columns - 1)
            print(f"{COLORS[color]}{line[:width]}{RESET}", flush=True)
            lines += 1
            if lines % 40 == 0:
                elapsed = int(time.monotonic() - started)
                print(f"\033]2;{name} · {elapsed // 60}m {elapsed % 60:02d}s\007", end="", flush=True)
            time.sleep(rng.uniform(0.025, 0.14) / args.speed)
    except (KeyboardInterrupt, BrokenPipeError):
        pass
    finally:
        try:
            print(f"{RESET}\033[?25h", end="", flush=True)
        except BrokenPipeError:
            pass


def tmux(*arguments, check=True):
    return subprocess.run(
        ["tmux", "-L", SOCKET, "-f", "/dev/null", *map(str, arguments)],
        text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=check,
    )


def attach(session):
    command = ["tmux", "-L", SOCKET, "attach-session", "-t", f"={session}"]
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        print("Attach from an interactive terminal:\n  " + shlex.join(command))
        return
    env = os.environ.copy()
    env.pop("TMUX", None)
    subprocess.run(command, env=env, check=True)


def launch(args):
    if not shutil.which("tmux"):
        raise SystemExit("tmux is required. Install it with: brew install tmux")
    target = f"={args.session}"
    exists = tmux("has-session", "-t", target, check=False).returncode == 0
    if args.stop:
        if exists:
            tmux("kill-session", "-t", target)
            print(f"Stopped {args.session} and all its panes.")
        else:
            print(f"No demo session named {args.session} is running.")
        return
    if args.attach:
        if not exists:
            raise SystemExit(f"No demo session named {args.session}. Run ./run.sh first.")
        attach(args.session)
        return
    if exists:
        raise SystemExit(f"Session {args.session!r} already exists. Use --attach, --stop, or --session another-name.")

    script = str(Path(__file__).resolve())

    def worker(index):
        command = [sys.executable, script, "--stream", str(index), "--panes", str(args.panes), "--speed", str(args.speed)]
        if args.seed is not None:
            command += ["--seed", str(args.seed)]
        if args.duration is not None:
            command += ["--duration", str(args.duration)]
        return "exec " + shlex.join(command)

    columns = math.ceil(math.sqrt(args.panes * 1.5))
    rows = math.ceil(args.panes / columns)
    size = shutil.get_terminal_size((240, 72))
    width, height = max(size.columns, columns * 30, 160), max(size.lines, rows * 8, 48)
    created = False
    try:
        session_id, window, first = tmux(
            "new-session", "-d", "-P", "-F", "#{session_id} #{window_id} #{pane_id}",
            "-s", args.session, "-n", "agents", "-x", width, "-y", height, worker(0),
        ).stdout.split()
        created = True
        for key, value in (
            ("status", "on"), ("status-position", "bottom"),
            ("status-style", "bg=#252536,fg=#b6b6cc"),
            ("status-left", "#[fg=#7de1cc,bold] TERMINAL CHAOS #[default]│ SIMULATED "),
            ("status-left-length", "50"),
            ("status-right", f" {args.panes} PANES · {args.speed:g}×  │ q quit · C-b z zoom · C-b d detach "),
            ("status-right-length", "100"),
            ("status-interval", "1"), ("default-shell", "/bin/sh"), ("history-limit", "1000"),
        ):
            tmux("set-option", "-t", session_id, key, value)
        for key, value in (
            ("pane-border-status", "top"),
            ("pane-border-format", " #{pane_title} "),
            ("pane-border-style", "fg=#55516b"),
            ("pane-active-border-style", "fg=#7de1cc"),
            ("window-style", "bg=#181820,fg=#d0d0db"),
            ("window-active-style", "bg=#181820,fg=#d0d0db"),
            ("automatic-rename", "off"), ("remain-on-exit", "off"),
        ):
            tmux("set-window-option", "-t", window, key, value)
        # This server has a separate socket and no user config. q only kills its current demo session.
        tmux("bind-key", "-n", "q", "kill-session")
        tmux("set-option", "-g", "exit-empty", "on")
        for index in range(1, args.panes):
            panes = tmux("list-panes", "-t", window, "-F", "#{pane_id} #{pane_width} #{pane_height}").stdout.splitlines()
            largest = max((p.split() for p in panes), key=lambda p: int(p[1]) * int(p[2]))
            direction = "-h" if int(largest[1]) / max(1, int(largest[2])) > 2.4 else "-v"
            tmux("split-window", "-d", direction, "-t", largest[0], worker(index))
            tmux("select-layout", "-t", window, "tiled")
        tmux("select-pane", "-t", first)
    except BaseException:
        if created:
            tmux("kill-session", "-t", target, check=False)
        raise
    print(f"Started {args.panes} real tmux panes in {args.session!r} at {args.speed:g}× speed.")
    if args.detach:
        print(f"Attach: ./run.sh --attach --session {args.session}\nStop:   ./run.sh --stop --session {args.session}")
    else:
        attach(args.session)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--panes", "-n", type=pane_count, default=24, help="real panes, 1–256 (default: 24)")
    parser.add_argument("--speed", "-s", type=positive_float, default=1.0, help="output speed multiplier (default: 1)")
    parser.add_argument("--session", type=session_name, default="chaos", help="demo session name (default: chaos)")
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument("--detach", action="store_true", help="start in the background")
    actions.add_argument("--attach", action="store_true", help="attach to a running demo")
    actions.add_argument("--stop", action="store_true", help="stop a demo and every worker in it")
    parser.add_argument("--duration", type=positive_float, help="automatically end each worker after N seconds")
    parser.add_argument("--seed", type=int, help="repeatable synthetic output")
    parser.add_argument("--stream", type=int, metavar="ID", help="run just one output stream, useful in other multiplexers")
    args = parser.parse_args()
    if args.stream is not None:
        if args.stream < 0:
            parser.error("--stream must be nonnegative")
        stream(args)
    else:
        try:
            launch(args)
        except subprocess.CalledProcessError as error:
            detail = (error.stderr or str(error)).strip()
            raise SystemExit(f"{shlex.join(error.cmd)}\n{detail}") from error


if __name__ == "__main__":
    main()
