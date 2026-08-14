import { expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test('src/ never imports node builtins or tools/', () => {
  const offenders: string[] = [];
  for (const file of walk('src')) {
    if (!/\.(ts|svelte)$/.test(file) || file.endsWith('.test.ts')) continue;
    const text = readFileSync(file, 'utf8');
    if (/from\s+['"](node:|.*\/tools\/)/.test(text) || /import\s+['"]node:/.test(text)) {
      offenders.push(file);
    }
  }
  expect(offenders).toEqual([]);
});
