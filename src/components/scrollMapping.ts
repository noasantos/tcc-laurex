/** Match document block positions instead of assuming equal rendered heights. */
export function mapScroll(
  top: number,
  sourceMax: number,
  targetMax: number,
  source: number[],
  target: number[],
) {
  if (top <= 0 || sourceMax <= 0 || targetMax <= 0) return 0;
  if (top >= sourceMax - 0.5) return targetMax;
  const count = Math.min(source.length, target.length);
  const anchors = [{ from: 0, to: 0 }];
  for (let i = 0; i < count; i++) {
    if (source[i] > 0 && source[i] < sourceMax)
      anchors.push({
        from: source[i],
        to: Math.min(targetMax, Math.max(0, target[i])),
      });
  }
  anchors.push({ from: sourceMax, to: targetMax });
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1],
      b = anchors[i];
    if (top <= b.from) {
      const fraction = (top - a.from) / (b.from - a.from);
      return Math.max(0, Math.min(targetMax, a.to + fraction * (b.to - a.to)));
    }
  }
  return targetMax;
}
