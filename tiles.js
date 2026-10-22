// Fisher-Yates order for the answer tiles, with the catch-all option always last,
// so no shape or motion is favoured by its position.
export function tileOrder(ids, random = Math.random) {
  const rest = ids.filter((id) => id !== 'other');
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return ids.includes('other') ? [...rest, 'other'] : rest;
}
