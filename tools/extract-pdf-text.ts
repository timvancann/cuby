import { readFileSync, writeFileSync } from 'node:fs';
import { PDFParse } from 'pdf-parse';

const buf = readFileSync('OLL in one month.pdf');
const parser = new PDFParse({ data: buf });
const { text } = await parser.getText();
writeFileSync('tools/pdf-text.txt', text);
console.log('wrote tools/pdf-text.txt,', text.length, 'chars');
