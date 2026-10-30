import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseOptions } from './options.ts';
import { random } from './activity.ts';

test('default grid and exact rows × columns', () => {
  const defaults = parseOptions([])!;
  assert.deepEqual(defaults.rowCounts, [6, 6, 6, 6]);
  const exact = parseOptions(['--rows', '3', '--cols', '5'])!;
  assert.equal(exact.panes, 15);
  assert.deepEqual(exact.rowCounts, [5, 5, 5]);
  assert.equal(parseOptions(['-r', '1', '-c', '1'])!.panes, 1);
});

test('one dimension preserves the requested pane count and handles uneven rows', () => {
  assert.deepEqual(parseOptions(['--panes', '10', '--cols', '4'])!.rowCounts, [4, 4, 2]);
  assert.deepEqual(parseOptions(['--panes', '10', '--rows', '4'])!.rowCounts, [3, 3, 2, 2]);
  assert.deepEqual(parseOptions(['--panes', '6', '--rows', '5'])!.rowCounts, [2, 1, 1, 1, 1]);
  assert.deepEqual(parseOptions(['--cols', '4'])!.rowCounts, [4, 4, 4, 4, 4, 4]);
  assert.deepEqual(parseOptions(['--panes', '1'])!.rowCounts, [1]);
});

test('invalid input fails before creating a session', () => {
  for (const args of [
    ['--rows', '0'], ['--cols', '-1'], ['--panes', '257'], ['--rows', '1.5'],
    ['--rows', '17', '--cols', '16'], ['--panes', '5', '--rows', '2', '--cols', '3'],
    ['--panes', '2', '--rows', '3'], ['--panes', '2', '--cols', '3'],
    ['--speed', 'Infinity'], ['--speed', '0'], ['--duration', 'NaN'], ['--duration', '0'],
    ['--session', '../bad'], ['--detach', '--stop'], ['--attach', '--detach'],
    ['--stream=-1'], ['--unknown'], ['--seed', '1.5'],
  ]) assert.throws(() => parseOptions(args), Error, args.join(' '));
});

test('grid limits and aliases', () => {
  const options = parseOptions(['-r', '16', '-c', '16', '-n', '256', '-s', '3'])!;
  assert.equal(options.panes, 256);
  assert.equal(options.speed, 3);
  assert.equal(options.rowCounts.reduce((sum, count) => sum + count, 0), 256);
  assert.equal(parseOptions(['--help']), undefined);
  assert.equal(parseOptions(['--seed=-1'])!.seed, -1);
});

test('seeded activity random numbers are repeatable', () => {
  const first = random(42);
  const second = random(42);
  assert.deepEqual(Array.from({ length: 20 }, first), Array.from({ length: 20 }, second));
});
