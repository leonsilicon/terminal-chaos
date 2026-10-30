import { parseArgs } from 'node:util';

export const HELP = `Terminal Chaos — real tmux panes, simulated agent activity.

Usage: npm start -- [options]
       bun src/cli.ts [options]

  --panes, -n N       Number of panes, 1–256 (default: 24)
  --rows, -r N        Number of grid rows
  --cols, -c N        Number of grid columns
                      Both together create exactly rows × cols panes.
                      With one dimension, --panes defaults to 24.
  --speed, -s N       Output speed multiplier (default: 1)
  --session NAME     Session name (default: chaos)
  --detach           Start in the background
  --attach           Attach to a running demo
  --stop             Stop a demo and every worker in it
  --duration SECONDS End each worker after this many seconds
  --seed N           Repeatable synthetic output
  --stream ID        Run a single stream without tmux
  --help, -h         Show this help

Examples:
  npm start -- --rows 3 --cols 4
  npm start -- --panes 48 --cols 8 --speed 3
  bun src/cli.ts --rows 2 --cols 3 --detach
`;

export interface Grid {
  panes: number;
  rows: number;
  cols: number;
  rowCounts: number[];
}

export interface Options extends Grid {
  speed: number;
  session: string;
  detach: boolean;
  attach: boolean;
  stop: boolean;
  duration?: number;
  seed?: number;
  stream?: number;
}

function integer(value: string, name: string, min: number, max: number): number {
  const number = Number(value);
  if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return number;
}

function positive(value: string, name: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${name} must be a finite number greater than zero.`);
  }
  return number;
}

export function resolveGrid(panes?: number, rows?: number, cols?: number): Grid {
  if (rows !== undefined && cols !== undefined) {
    const total = rows * cols;
    if (total > 256) throw new Error('--rows × --cols must not exceed 256 panes.');
    if (panes !== undefined && panes !== total) {
      throw new Error('--panes must equal --rows × --cols when both dimensions are supplied.');
    }
    return { panes: total, rows, cols, rowCounts: Array(rows).fill(cols) };
  }
  const total = panes ?? 24;
  if (rows !== undefined) {
    if (rows > total) throw new Error('--rows cannot exceed the number of panes.');
    const base = Math.floor(total / rows);
    const extra = total % rows;
    const rowCounts = Array.from({ length: rows }, (_, i) => base + Number(i < extra));
    return { panes: total, rows, cols: Math.ceil(total / rows), rowCounts };
  }
  const columns = cols ?? Math.min(total, Math.ceil(Math.sqrt(total * 1.5)));
  if (columns > total) throw new Error('--cols cannot exceed the number of panes.');
  const rowCounts: number[] = [];
  for (let left = total; left > 0; left -= columns) rowCounts.push(Math.min(columns, left));
  return { panes: total, rows: rowCounts.length, cols: columns, rowCounts };
}

export function parseOptions(argv: string[]): Options | undefined {
  const { values } = parseArgs({
    args: argv,
    options: {
      panes: { type: 'string', short: 'n' },
      rows: { type: 'string', short: 'r' },
      cols: { type: 'string', short: 'c' },
      speed: { type: 'string', short: 's' },
      session: { type: 'string', default: 'chaos' },
      detach: { type: 'boolean', default: false },
      attach: { type: 'boolean', default: false },
      stop: { type: 'boolean', default: false },
      duration: { type: 'string' },
      seed: { type: 'string' },
      stream: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) return undefined;
  if ([values.detach, values.attach, values.stop].filter(Boolean).length > 1) {
    throw new Error('Choose only one of --detach, --attach, and --stop.');
  }
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(values.session)) {
    throw new Error('--session must use 1–40 letters, digits, underscores, or hyphens.');
  }
  const dimension = (value: string | undefined, name: string) =>
    value === undefined ? undefined : integer(value, name, 1, 256);
  return {
    ...resolveGrid(dimension(values.panes, '--panes'), dimension(values.rows, '--rows'), dimension(values.cols, '--cols')),
    speed: positive(values.speed ?? '1', '--speed'),
    session: values.session,
    detach: values.detach,
    attach: values.attach,
    stop: values.stop,
    duration: values.duration === undefined ? undefined : positive(values.duration, '--duration'),
    seed: values.seed === undefined ? undefined : integer(values.seed, '--seed', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    stream: values.stream === undefined ? undefined : integer(values.stream, '--stream', 0, Number.MAX_SAFE_INTEGER),
  };
}
