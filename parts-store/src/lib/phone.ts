/**
 * US phone formatting for the request form.
 *
 * This runs on every keystroke of a controlled input, so it is handed back its
 * OWN previous output. That makes idempotency the whole ballgame: the original
 * version prepended "1-" and then, on the next keystroke, re-read that "1" as
 * a dialled digit. Typing 2695550142 produced 1-111-126-9555 and silently
 * dropped the last four digits — a wrong callback number on a parts request,
 * which is the one field the desk needs to be right.
 *
 * A leading 1 is therefore always treated as the country code, never as part
 * of the number. That is unambiguous under the North American Numbering Plan:
 * no area code or exchange begins with 1.
 */
export function formatPhone(raw: string): string {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("1")) digits = digits.slice(1); // country code or our own prefix
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `1-${digits}`;
  if (digits.length <= 6) return `1-${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}
