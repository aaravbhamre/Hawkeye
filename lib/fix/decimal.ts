export const SCALE = 1_000_000n;
export function decimal(value: string): bigint {
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(value)) throw new Error("Expected a nonnegative decimal with at most 12 integer and 6 fractional digits.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
}
export function format(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const fraction = (absolute % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return `${sign}${absolute / SCALE}${fraction ? `.${fraction}` : ""}`;
}
export function average(notional: bigint, quantity: bigint): string | null {
  return quantity ? format(notional / quantity) : null;
}
