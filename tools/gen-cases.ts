import { readFileSync, writeFileSync } from 'node:fs';
import { enrichCases, type CasesDb } from './enrich';

const db: CasesDb = JSON.parse(readFileSync('data/cases.json', 'utf8'));
writeFileSync('data/cases.json', JSON.stringify(enrichCases(db), null, 2) + '\n');
console.log('enriched data/cases.json');
