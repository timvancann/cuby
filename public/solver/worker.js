// Classic (non-module) worker, deliberately unbundled: cube.js/solve.js are
// vendored verbatim from the cubejs package (node_modules/cubejs/lib), whose
// UMD wrapper attaches `Cube` to the worker global under importScripts.
// Generates csTimer-style random-state scrambles: random state, two-phase
// solve, inverted solution.
importScripts('./cube.js', './solve.js');

var ready = false;

self.onmessage = function (e) {
  try {
    if (!ready) {
      Cube.initSolver(); // one-time pruning tables, a few seconds
      ready = true;
    }
    var solution = Cube.random().solve().trim().split(/\s+/);
    var scramble = solution
      .reverse()
      .map(function (m) {
        if (m.slice(-1) === '2') return m;
        return m.slice(-1) === "'" ? m.slice(0, -1) : m + "'";
      })
      .join(' ');
    postMessage({ id: e.data.id, scramble: scramble });
  } catch (err) {
    postMessage({ id: e.data.id, error: String(err) });
  }
};
