export const compactCurrency = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return sign + "$" + (abs/1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (abs >= 1_000) return sign + "$" + (abs/1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return sign + "$" + abs.toFixed(2);
};
