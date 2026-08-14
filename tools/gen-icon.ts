import { mkdirSync, writeFileSync } from 'node:fs';
import { cubeGeometry } from '../src/ui/train/cubeProjection';

// App icon: the perspective cube on the app background, sized to sit inside
// the maskable safe zone (content within the central ~80%).
const g = cubeGeometry(1024, 600);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#101114"/>
  <polygon points="${g.frontFace}" fill="#31353f"/>
  <polygon points="${g.rightFace}" fill="#252932"/>
  <path d="${g.sideGrid}" stroke="#101114" stroke-width="10" fill="none"/>
  <polygon points="${g.topFace}" fill="#3a3f4a"/>
  ${g.topCells.map(c => `<polygon points="${c}" fill="#ffd500"/>`).join('\n  ')}
</svg>
`;

mkdirSync('public', { recursive: true });
writeFileSync('public/icon.svg', svg);
console.log('wrote public/icon.svg');
