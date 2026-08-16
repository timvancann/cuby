declare module 'cubejs' {
  export default class Cube {
    static initSolver(): void;
    static fromString(s: string): Cube;
    static random(): Cube;
    solve(maxDepth?: number): string;
  }
}
