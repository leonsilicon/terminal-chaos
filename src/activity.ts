import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Options } from './options.ts';

const RESET = '\x1b[0m';
const COLORS = {
  muted: '\x1b[38;5;103m', white: '\x1b[38;5;252m', green: '\x1b[38;5;114m',
  cyan: '\x1b[38;5;80m', orange: '\x1b[38;5;215m', red: '\x1b[38;5;203m',
  purple: '\x1b[38;5;183m', add: '\x1b[48;5;22m\x1b[38;5;157m',
  remove: '\x1b[48;5;52m\x1b[38;5;217m',
};
const NAMES = ['astra', 'fable', 'forge', 'ember', 'nova', 'orbit', 'flux', 'echo'];
const ROLES = ['orchestrator', 'backend', 'frontend', 'tests', 'database', 'infra', 'compiler', 'review'];
const FILES = [
  'src/api/router.ts', 'src/auth/session.ts', 'src/components/Grid.tsx',
  'src/engine/physics.ts', 'src/cache/ttl.ts', 'prisma/schema.prisma',
  'src/workers/queue.ts', 'src/render/scene.ts', 'tests/integration.test.ts',
  'src/hooks/useStream.ts', 'src/server/index.ts', 'src/lib/match.ts',
];
const TASKS = [
  'reconcile worker state', 'fix cache invalidation', 'tighten request validation',
  'patch collision response', 'stream incremental updates', 'batch database writes',
  'remove redundant renders', 'resolve dependency graph', 'optimize query planner',
  'wire up websocket events', 'stabilize integration suite', 'merge route changes',
];
const CODE = [
  ['const ttl = 30_000;', 'const ttl = Infinity;'],
  ['await run(task);', 'await Promise.all(batch.map(run));'],
  ['return state.value;', 'return cache.get(key) ?? state.value;'],
  ['const damping = 0.98;', 'const damping = 0.35;'],
  ['if (queue.length) flush();', 'if (queue.length >= batchSize) flush();'],
  ['const retries = 1;', 'const retries = 5;'],
];

type Line = [keyof typeof COLORS, string];
type Random = () => number;
const pad = (number: number) => String(number).padStart(2, '0');
const int = (rng: Random, min: number, max: number) => Math.floor(rng() * (max - min)) + min;
const pick = <T>(rng: Random, items: readonly T[]): T => items[int(rng, 0, items.length)];

export function random(seed?: number): Random {
  if (seed === undefined) return Math.random;
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function agentName(index: number): string {
  return index === 0 ? 'astra / orchestrator' : `${NAMES[index % NAMES.length]}-${pad(index)} / ${ROLES[index % ROLES.length]}`;
}

function activity(rng: Random, index: number, count: number): Line[] {
  const path = pick(rng, FILES);
  const task = pick(rng, TASKS);
  const kind = int(rng, 0, 7);
  if (index === 0) {
    const worker = int(rng, 1, Math.max(2, count));
    return [
      ['cyan', `◆ dispatch → ${NAMES[worker % NAMES.length]}-${pad(worker)}`],
      ['white', `  ${task}`],
      ['green', `● ${int(rng, 3, 28)} tasks landed · ${count} agents online`],
      ['muted', `  queue ${int(rng, 5, 80)} · context ${int(rng, 25, 95)}%`],
      ['orange', pick(rng, ['✻ Orchestrating…', '✻ Reconciling patches…', '✻ Reviewing results…'])],
    ];
  }
  if (kind === 0) {
    const [old, next] = pick(rng, CODE);
    const line = String(int(rng, 10, 240)).padStart(3);
    return [
      ['green', `● Edit(${path})`], ['remove', `${line} - ${old}`], ['add', `${line} + ${next}`],
      ['muted', `    +${int(rng, 1, 80)} −${int(rng, 1, 20)} lines`],
    ];
  }
  if (kind === 1) return [
    ['white', '● Bash(npm test -- --run)'], ['green', `  ✓ ${path} (${int(rng, 2, 16)} tests)`],
    ['green', `  ${int(rng, 12, 480)} passed · 0 failed`], ['muted', `  duration ${(0.1 + rng() * 4.7).toFixed(2)}s`],
  ];
  if (kind === 2) return [
    ['white', `● Read(${path})`], ['muted', `  └ Read ${int(rng, 40, 800)} lines`],
    ['purple', `  Plan: ${task}`], ['orange', `✻ Thinking… (↓ ${(1 + rng() * 179).toFixed(1)}k tokens)`],
  ];
  if (kind === 3) return [
    ['cyan', `→ compiling ${path}`], ['white', `  transform ${int(rng, 100, 3000)} modules`],
    ['green', `  ✓ built in ${int(rng, 30, 900)}ms`],
    ['muted', `  bundle ${(10 + rng() * 270).toFixed(2)} kB · gzip ${(3 + rng() * 67).toFixed(2)} kB`],
  ];
  if (kind === 4) return [
    ['white', '● Bash(git diff --stat)'], ['cyan', `  ${path} | +${int(rng, 1, 70)} −${int(rng, 1, 20)}`],
    ['green', `  ✓ patch ${int(rng, 0, 2 ** 28).toString(16).padStart(7, '0')} ready`],
    ['orange', `✻ ${task[0].toUpperCase()}${task.slice(1)}…`],
  ];
  if (kind === 5) return [
    ['muted', `[${new Date().toTimeString().slice(0, 8)}] worker:${pad(index)} live`],
    ['green', `  GET ${pick(rng, ['/api/events', '/health', '/api/agents', '/api/stream', '/api/tasks'])} 200 ${int(rng, 1, 70)}ms`],
    ['cyan', `  websocket → ${int(rng, 20, 900)} events/s`], ['white', `  queue drained · ${int(rng, 2, 80)} jobs`],
  ];
  return [
    ['orange', '● Checking types…'], ['red', `  retry: worker-${pad(int(rng, 1, Math.max(2, count)))} busy`],
    ['muted', `  backoff ${int(rng, 5, 90)}ms → recovered`], ['green', '  ✓ typecheck clean · 0 errors'],
    ['purple', `  next → ${task}`],
  ];
}

export async function stream(options: Options): Promise<void> {
  const index = options.stream!;
  const rng = random(options.seed === undefined ? undefined : options.seed + index);
  const started = performance.now();
  const deadline = options.duration === undefined ? Infinity : started + options.duration * 1000;
  const name = agentName(index);
  const controller = new AbortController();
  const stop = () => controller.abort();
  const onError = (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') stop();
    else throw error;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.stdout.on('error', onError);
  const write = async (text: string) => {
    if (!process.stdout.write(text)) await once(process.stdout, 'drain', { signal: controller.signal });
  };
  let lines = 0;
  let pending: Line[] = [];
  try {
    await write(`\x1b]2;${name}\x07\x1b[?25l`);
    while (!controller.signal.aborted && performance.now() < deadline) {
      if (!pending.length) pending = [...activity(rng, index, options.panes), ['muted', '']];
      const [color, line] = pending.shift()!;
      const width = Math.max(1, (process.stdout.columns || 80) - 1);
      await write(`${COLORS[color]}${Array.from(line).slice(0, width).join('')}${RESET}\n`);
      if (++lines % 40 === 0) {
        const elapsed = Math.floor((performance.now() - started) / 1000);
        await write(`\x1b]2;${name} · ${Math.floor(elapsed / 60)}m ${pad(elapsed % 60)}s\x07`);
      }
      const delay = Math.min((25 + rng() * 115) / options.speed, Math.max(0, deadline - performance.now()));
      await sleep(delay, undefined, { signal: controller.signal });
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  } finally {
    if (!process.stdout.destroyed) process.stdout.write(`${RESET}\x1b[?25h`);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}
