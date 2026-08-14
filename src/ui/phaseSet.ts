export function parsePhaseLabels(text: string): { labels: string[] } | { error: string } {
  const labels = text.split(/[,→>]/).map(s => s.trim()).filter(Boolean);
  if (labels.length === 0) return { error: 'need at least one phase' };
  if (labels.length > 12) return { error: 'at most 12 phases' };
  if (labels.some(l => l.length > 16)) return { error: 'phase names max 16 characters' };
  return { labels };
}
