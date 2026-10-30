// Splits an algorithm's text into pieces that must not line-break internally:
// a bracket group "(R U R' U')" or a lone move "U2'". Separators are kept as
// their own pieces, so joining the result gives back the input exactly, odd
// spacing and unbalanced brackets included.
export function algGroups(alg: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of alg) {
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      out.push(ch);
      cur = '';
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
