// Detecta padrão típico de bytes UTF-8 low escapados como texto (ex: " e9 ", " f3 ", " e7 ").
// Modelos LLM às vezes retornam "Aparecida e9 Show" no lugar de "Aparecida é Show".
// Bytes UTF-8 low pra latin diacríticos começam com 'e' ou 'f' — regex evita falso-positivo
// em números ("21", "07", "10 fev").
const MOJIBAKE_RE = /(?:^|\s)[ef][0-9a-f](?=\s|$)/i;

export function hasMojibake(s: string | null | undefined): boolean {
  if (!s) return false;
  return MOJIBAKE_RE.test(s);
}
