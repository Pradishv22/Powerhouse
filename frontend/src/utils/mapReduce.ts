// A tiny in-browser SIMULATION of MapReduce, used only to explain the concept.
export type InputRecord = { household: string; appliance: string; kwh: number };

export function runMapReduce(records: InputRecord[]) {
  // MAP: emit (household, kwh) for each record
  const mapped = records.map((r) => ({ key: r.household, value: r.kwh }));

  // SHUFFLE & SORT: group values by key
  const groups: Record<string, number[]> = {};
  for (const pair of mapped) {
    (groups[pair.key] ??= []).push(pair.value);
  }
  const shuffled = Object.keys(groups)
    .sort()
    .map((key) => ({ key, values: groups[key] ?? [] }));

  // REDUCE: sum the values for each key
  const reduced = shuffled.map((g) => ({ key: g.key, total: g.values.reduce((a, b) => a + b, 0) }));

  return { mapped, shuffled, reduced };
}
