declare module 'cubejs' {
  export default class Cube {
    static initSolver(): void;
    static fromString(s: string): Cube;
    solve(maxDepth?: number): string;
  }
}
