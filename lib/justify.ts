/**
 * Splits photos (given as width/height ratios) into rows whose ratios add up
 * to roughly `target`. A row that fills the container width then comes out at
 * about containerWidth / target pixels tall.
 *
 * Returns the rows as index lists, and how much of the target the last row is
 * missing when it's well short, so it can be padded to the usual height
 * instead of stretching a couple of photos across the full width.
 */
export function splitRows(ratios: number[], target: number): { rows: number[][]; lastRowGap: number } {
  const rows: number[][] = [];
  let row: number[] = [];
  let sum = 0;

  for (let i = 0; i < ratios.length; i++) {
    const ratio = ratios[i];
    // Adding this photo would overshoot. End the row here instead if the row is
    // already reasonably full and ending it lands closer to the target.
    if (row.length > 0 && sum + ratio > target && sum >= target * 0.6 && target - sum < sum + ratio - target) {
      rows.push(row);
      row = [];
      sum = 0;
    }
    row.push(i);
    sum += ratio;
    if (sum >= target) {
      rows.push(row);
      row = [];
      sum = 0;
    }
  }

  if (row.length > 0) rows.push(row);
  return { rows, lastRowGap: row.length > 0 && sum < target * 0.7 ? target - sum : 0 };
}
