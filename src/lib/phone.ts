// Работа с телефонами. Люди вводят номера по-разному: «+84 90 123 45 67»,
// «090-123-4567», «84901234567». Чтобы искать клиента по телефону, приводим
// всё к цифрам и сравниваем по хвосту.

// Только цифры: "+84 90 123-45-67" → "84901234567".
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

// Совпадают ли два номера. Сравниваем последние 9 цифр — этого достаточно,
// чтобы «+84 901 234 567» и «0901234567» считались одним номером, и при этом
// не путать разных людей.
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = phoneDigits(a ?? "");
  const db = phoneDigits(b ?? "");
  if (da.length < 7 || db.length < 7) return da === db && da !== "";
  return da.slice(-9) === db.slice(-9);
}
