// Subprocess used by gen-scrambles.ts to run cubejs's solve() with a wall-clock
// timeout enforced by the parent (which kills+respawns this process on timeout,
// since a synchronous JS search can't be interrupted from inside the same process).
//
// Protocol: one 54-char Kociemba facelet string per line on stdin.
// Replies on stdout: "OK <alg>" or "FAIL", one line per request, flushed immediately.
import { createInterface } from 'node:readline';
import Cube from 'cubejs';

const MAX_HTM = 14;

// The parent kills this process on shutdown, but a write can still race the
// pipe closing; treat that as harmless rather than an unhandled crash.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EPIPE') throw err;
});

Cube.initSolver();
process.stdout.write('READY\n');

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const facelets = line.trim();
  if (!facelets) return;
  try {
    const solution = Cube.fromString(facelets).solve(MAX_HTM).trim();
    process.stdout.write(`OK ${solution}\n`);
  } catch {
    process.stdout.write('FAIL\n');
  }
});
