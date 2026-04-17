const KEY_RU: Record<string, string> = {
  color: 'Цвет', gender: 'Пол', size: 'Размер', length: 'Длина',
};
const VAL_RU: Record<string, string> = {
  female: 'Женский', male: 'Мужской',
};
const SKIP_KEYS = new Set(['fabric']);

export function localizeAttrSummary(s: string | null | undefined): string {
  if (!s) return '';
  return s.split(', ').flatMap(part => {
    const idx = part.indexOf(': ');
    if (idx === -1) return [part];
    const key = part.slice(0, idx).trim();
    if (SKIP_KEYS.has(key)) return [];
    const val = part.slice(idx + 2).trim();
    return [`${KEY_RU[key] ?? key}: ${VAL_RU[val] ?? val}`];
  }).join(', ');
}
