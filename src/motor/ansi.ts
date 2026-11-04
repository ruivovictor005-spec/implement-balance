// Codificação Windows-1252 ("ANSI") do TXT de importação. O Domínio lê o arquivo em ANSI e por
// POSIÇÃO DE BYTE. Em UTF-8 cada letra acentuada ocupa 2 bytes: o texto aparece estragado
// ("IMPLANTAÃ‡ÃƒO") e todo campo depois dela anda uma casa. Em Windows-1252 cada caractere é
// exatamente 1 byte, então as posições do leiaute batem com as do texto.

/** Caracteres fora do Latin-1 que o Windows-1252 representa na faixa 0x80–0x9F. */
const FAIXA_80_9F: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201c: 0x93, // "
  0x201d: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

const INTERROGACAO = 0x3f;

/**
 * Um byte por caractere: ASCII e Latin-1 (onde estão todas as letras acentuadas do português) vão
 * como estão; os especiais do Windows-1252 vão para a faixa 0x80–0x9F; o resto vira '?'. Nunca muda
 * o tamanho — é isso que mantém o leiaute posicional.
 */
export function codificarWindows1252(texto: string): Uint8Array {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) bytes[i] = c;
    else bytes[i] = FAIXA_80_9F[c] ?? INTERROGACAO;
  }
  return bytes;
}
