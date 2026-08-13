import { solvedCube } from '../src/core/cube/model';
import { applyAlg, invert, parseAlg, toAlgString } from '../src/core/cube/parser';
import { normalizedOllPattern, orientYellowUp } from '../src/core/cube/pattern';

export const CANONICAL_OLL: Record<number, string> = {
  1: "R U2 R2 F R F' U2 R' F R F'",
  2: "R U' R2 D' r U r' D R2 U R'",
  3: "f R U R' U' f' U' F R U R' U' F'",
  4: "f R U R' U' f' U F R U R' U' F'",
  5: "l' U2 L U L' U l",
  6: "r U2 R' U' R U' r'",
  7: "r U R' U R U2 r'",
  8: "l' U' L U' L' U2 l",
  9: "R U R' U' R' F R2 U R' U' F'",
  10: "R U R' U R' F R F' R U2 R'",
  11: "r' R2 U R' U R U2 R' U M'",
  12: "r R2' U' R U' R' U2 R U' r' R",
  13: "F U R U2 R' U' R U R' F'",
  14: "R' F R U R' F' R F U' F'",
  15: "l' U' l L' U' L U l' U l",
  16: "r U r' R U R' U' r U' r'",
  17: "R U R' U R' F R F' U2 R' F R F'",
  18: "R U2 R2 F R F' U2 M' U R U' r'",
  19: "S' R U R' S U' R' F R F'",
  20: "r' R U R U R' U' r R' M' U R U' r'",
  21: "R U R' U R U' R' U R U2 R'",
  22: "R U2 R2 U' R2 U' R2 U2 R",
  23: "R2 D' R U2 R' D R U2 R",
  24: "r U R' U' r' F R F'",
  25: "F R' F' r U R U' r'",
  26: "R U2 R' U' R U' R'",
  27: "R U R' U R U2 R'",
  28: "r U R' U' r' R U R U' R'",
  29: "R U R' U' R U' R' F' U' F R U R'",
  30: "F U R U2 R' U' R U2 R' U' F'",
  31: "R' U' F U R U' R' F' R",
  32: "S R U R' U' R' F R f'",
  33: "R U R' U' R' F R F'",
  34: "R U R2' U' R' F R U R U' F'",
  35: "R U2 R2 F R F' R U2 R'",
  36: "L' U' L U' L' U L U L F' L' F",
  37: "F R' F' R U R U' R'",
  38: "R U R' U R U' R' U' R' F R F'",
  39: "L F' L' U' L U F U' L'",
  40: "R' F R U R' U' F' U R",
  41: "R U R' U R U2 R' F R U R' U' F'",
  42: "R' U' R U' R' U2 R F R U R' U' F'",
  43: "R' U' F' U F R",
  44: "F U R U' R' F'",
  45: "F R U R' U' F'",
  46: "R' U' R' F R F' U R",
  47: "F R' F' R U2 R U' R' U R U2 R'",
  48: "F R U R' U' R U R' U' F'",
  49: "r U' r2' U r2 U r2' U' r",
  50: "R' F R2 B' R2' F' R2 B R'",
  51: "F U R U' R' U R U' R' F'",
  52: "R U R' U R U' B U' B' R'",
  53: "l' U' L U' L' U L U' L' U2 l",
  54: "r U R' U R U' R' U R U2 r'",
  55: "R' F R U R U' R2' F' R2 U' R' U R U R'",
  56: "r U r' U R U' R' U R U' R' r U' r'",
  57: "R U R' U' M' U R U' r'",
};

export function canonicalPatternTable(): Map<string, number> {
  const table = new Map<string, number>();
  for (const [num, alg] of Object.entries(CANONICAL_OLL)) {
    const state = orientYellowUp(applyAlg(solvedCube(), toAlgString(invert(parseAlg(alg)))));
    table.set(normalizedOllPattern(state), Number(num));
  }
  return table;
}
