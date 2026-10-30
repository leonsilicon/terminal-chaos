import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stream } from './activity.ts';
import { HELP, parseOptions } from './options.ts';
import type { Options } from './options.ts';

const SOCKET = 'terminal-chaos';
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

function tmux(args: string[], check = true): string {
  const result = spawnSync('tmux', ['-L', SOCKET, '-f', '/dev/null', ...args], { encoding: 'utf8' });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('tmux is required. Install it with: brew install tmux (macOS) or sudo apt install tmux (Debian/Ubuntu).');
    }
    throw result.error;
  }
  if (check && result.status !== 0) throw new Error(result.stderr.trim() || `tmux ${args[0]} failed.`);
  return result.status === 0 ? result.stdout.trim() : '';
}

function attach(session: string): void {
  const args = ['-L', SOCKET, 'attach-session', '-t', `=${session}`];
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(`Attach from an interactive terminal:\n  tmux ${args.map(quote).join(' ')}`);
    return;
  }
  const env = { ...process.env };
  delete env.TMUX;
  const result = spawnSync('tmux', args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Could not attach to the tmux session.');
}

function launch(options: Options): void {
  const target = `=${options.session}`;
  const exists = tmux(['has-session', '-t', target, ';', 'display-message', '-p', 'exists'], false) === 'exists';
  if (options.stop) {
    if (exists) tmux(['kill-session', '-t', target]);
    console.log(exists ? `Stopped ${options.session} and all its panes.` : `No demo session named ${options.session} is running.`);
    return;
  }
  if (options.attach) {
    if (!exists) throw new Error(`No demo session named ${options.session}. Run npm start first.`);
    attach(options.session);
    return;
  }
  if (exists) throw new Error(`Session '${options.session}' already exists. Use --attach, --stop, or --session another-name.`);

  const worker = (index: number) => {
    const args = [process.execPath, fileURLToPath(import.meta.url), '--stream', String(index), '--panes', String(options.panes), '--speed', String(options.speed)];
    if (options.seed !== undefined) args.push(`--seed=${options.seed}`);
    if (options.duration !== undefined) args.push('--duration', String(options.duration));
    return `exec ${args.map(quote).join(' ')}`;
  };
  const width = Math.max(process.stdout.columns || 240, options.cols * 30, 160);
  const height = Math.max(process.stdout.rows || 72, options.rows * 8 + 1, 48);
  let created = false;
  try {
    // Keep panes alive during construction so short durations start after layout is complete.
    const [session, window, first] = tmux([
      'new-session', '-d', '-P', '-F', '#{session_id} #{window_id} #{pane_id}',
      '-s', options.session, '-n', 'agents', '-x', String(width), '-y', String(height), 'exec sleep 86400',
    ]).split(' ');
    created = true;
    for (const [key, value] of [
      ['status', 'on'], ['status-position', 'bottom'], ['status-style', 'bg=#252536,fg=#b6b6cc'],
      ['status-left', '#[fg=#7de1cc,bold] TERMINAL CHAOS #[default]│ SIMULATED '], ['status-left-length', '50'],
      ['status-right', ` ${options.rows}×${options.cols} · ${options.panes} PANES · ${options.speed}× │ q quit · C-b z zoom · C-b d detach `],
      ['status-right-length', '110'], ['status-interval', '1'], ['default-shell', '/bin/sh'], ['history-limit', '1000'],
    ]) tmux(['set-option', '-t', session, key, value]);
    for (const [key, value] of [
      ['pane-border-status', 'top'], ['pane-border-format', ' #{pane_title} '], ['pane-border-style', 'fg=#55516b'],
      ['pane-active-border-style', 'fg=#7de1cc'], ['window-style', 'bg=#181820,fg=#d0d0db'],
      ['window-active-style', 'bg=#181820,fg=#d0d0db'], ['automatic-rename', 'off'], ['remain-on-exit', 'off'],
    ]) tmux(['set-window-option', '-t', window, key, value]);
    tmux(['bind-key', '-n', 'q', 'kill-session']);
    tmux(['set-option', '-g', 'exit-empty', 'on']);

    const rowPanes = [first];
    let current = first;
    for (let remaining = options.rows; remaining > 1; remaining--) {
      const paneHeight = Number(tmux(['display-message', '-p', '-t', current, '#{pane_height}']));
      const topHeight = Math.floor((paneHeight - (remaining - 1)) / remaining);
      current = tmux(['split-window', '-d', '-v', '-P', '-F', '#{pane_id}', '-l', String(paneHeight - topHeight - 1), '-t', current, 'exec sleep 86400']);
      rowPanes.push(current);
    }
    const panes: string[] = [];
    for (let row = 0; row < options.rows; row++) {
      current = rowPanes[row];
      panes.push(current);
      for (let remaining = options.rowCounts[row]; remaining > 1; remaining--) {
        const paneWidth = Number(tmux(['display-message', '-p', '-t', current, '#{pane_width}']));
        const leftWidth = Math.floor((paneWidth - (remaining - 1)) / remaining);
        current = tmux(['split-window', '-d', '-h', '-P', '-F', '#{pane_id}', '-l', String(paneWidth - leftWidth - 1), '-t', current, 'exec sleep 86400']);
        panes.push(current);
      }
    }
    tmux(['select-pane', '-t', first]);
    // Start every worker in one tmux command queue after the grid is complete.
    const commands = panes.flatMap((pane, index) => [
      ...(index ? [';'] : []), 'respawn-pane', '-k', '-t', pane, worker(index),
    ]);
    tmux(commands);
  } catch (error) {
    if (created) tmux(['kill-session', '-t', target], false);
    throw error;
  }
  console.log(`Started ${options.panes} real tmux panes (${options.rows} rows × ${options.cols} columns) in '${options.session}' at ${options.speed}× speed.`);
  if (options.detach) {
    console.log(`Attach: npm start -- --attach --session ${options.session}\nStop:   npm start -- --stop --session ${options.session}`);
  } else attach(options.session);
}

try {
  const options = parseOptions(process.argv.slice(2));
  if (!options) console.log(HELP);
  else if (options.stream !== undefined) await stream(options);
  else launch(options);
} catch (error) {
  console.error(`Terminal Chaos: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
