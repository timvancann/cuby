import { expect, test } from 'vitest';
import { solvedCube, applyMoves, type Move, type Cube } from './model';

const mv = (base: string, q: number): Move => ({ label: base, base, q });

function applied(...moves: Move[]): Cube {
  return applyMoves(solvedCube(), moves);
}

test('solved cube has 9 stickers of each color', () => {
  const counts = new Array(6).fill(0);
  for (const v of solvedCube()) counts[v]++;
  expect(counts).toEqual([9, 9, 9, 9, 9, 9]);
});

test('each base move applied 4x is identity, 1x is not', () => {
  for (const base of ['U', 'D', 'L', 'R', 'F', 'B', 'M', 'E', 'S', 'x', 'y', 'z', 'r', 'l', 'u', 'd', 'f', 'b']) {
    const once = applied(mv(base, 1));
    expect(once, base).not.toEqual(solvedCube());
    const four = applyMoves(once, [mv(base, 1), mv(base, 1), mv(base, 1)]);
    expect(four, base).toEqual(solvedCube());
  }
});

test('sexy move has order 6', () => {
  let c = solvedCube();
  const sexy = [mv('R', 1), mv('U', 1), mv('R', -1), mv('U', -1)];
  for (let i = 0; i < 6; i++) c = applyMoves(c, sexy);
  expect(c).toEqual(solvedCube());
});

test('wide move equals face + inverse slice, and rotation + opposite face', () => {
  expect(applied(mv('r', 1))).toEqual(applied(mv('R', 1), mv('M', -1)));
  expect(applied(mv('r', 1))).toEqual(applied(mv('x', 1), mv('L', 1)));
});

test('q=2 equals two quarter turns', () => {
  expect(applied(mv('U', 2))).toEqual(applied(mv('U', 1), mv('U', 1)));
  expect(applied(mv('U', -2))).toEqual(applied(mv('U', 2)));
});
