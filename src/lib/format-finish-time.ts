/**
 * Auto-format raw user input into mm:ss while typing.
 *
 * Mobile numeric keypads (inputMode="numeric") often hide the ':' character,
 * so we strip non-digits and insert ':' before the last two digits once the
 * user has typed 3+ digits. Capped at 5 digits => max format mmm:ss.
 */
export function formatFinishTime(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 5);
  if (digits.length < 3) return digits;
  const ss = digits.slice(-2);
  const mm = digits.slice(0, digits.length - 2);
  return `${mm}:${ss}`;
}
