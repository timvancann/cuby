export function toggleCase(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id];
}

export function toggleGroup(selected: string[], groupCaseIds: string[]): string[] {
  const allIn = groupCaseIds.every(id => selected.includes(id));
  if (allIn) return selected.filter(id => !groupCaseIds.includes(id));
  return [...selected, ...groupCaseIds.filter(id => !selected.includes(id))];
}
