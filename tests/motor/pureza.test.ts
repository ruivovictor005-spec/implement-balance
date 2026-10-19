import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// O núcleo é puro: dá para rodá-lo em qualquer lugar (teste, worker, navegador) porque ele não
// conhece banco, rede, framework, arquivo nem ambiente. Quem faz I/O é a borda, não o motor.
const PASTAS_PURAS = ['motor', 'leitores'];

const RAIZ_SRC = fileURLToPath(new URL('../../src/', import.meta.url));

function arquivosTs(pasta: string): string[] {
  let encontrados: string[] = [];
  for (const item of readdirSync(pasta)) {
    const caminho = `${pasta}/${item}`;
    if (statSync(caminho).isDirectory()) encontrados = encontrados.concat(arquivosTs(caminho));
    else if (item.endsWith('.ts')) encontrados.push(caminho);
  }
  return encontrados;
}

function existe(caminho: string): boolean {
  try {
    statSync(caminho);
    return true;
  } catch {
    return false;
  }
}

const arquivosPuros = PASTAS_PURAS.flatMap((pasta) => {
  const caminho = `${RAIZ_SRC}${pasta}`;
  return existe(caminho) ? arquivosTs(caminho) : [];
});

const nomeCurto = (caminho: string) => caminho.slice(RAIZ_SRC.length);

/** Pega o alvo de `import x from 'y'`, `import 'y'`, `export … from 'y'`, `import('y')` e `require('y')`. */
const ALVOS_DE_IMPORT = /(?:\bfrom|\bimport|\brequire\s*\()\s*['"]([^'"]+)['"]/g;

const PROIBIDOS: { nome: string; casa: (alvo: string) => boolean }[] = [
  { nome: 'node:*', casa: (a) => a.startsWith('node:') },
  { nome: 'fs', casa: (a) => a === 'fs' || a.startsWith('fs/') },
  { nome: 'path', casa: (a) => a === 'path' },
  { nome: 'next', casa: (a) => a === 'next' || a.startsWith('next/') },
  { nome: 'drizzle', casa: (a) => a.includes('drizzle') },
  { nome: 'pg', casa: (a) => a === 'pg' || a.startsWith('pg/') },
];

describe('pureza do núcleo', () => {
  it('a varredura alcança todos os arquivos do motor', () => {
    // Guarda contra o teste passar por não estar olhando: se o motor ganhar um arquivo, ele
    // entra nesta lista; se a varredura quebrar, a lista esvazia e o teste acusa.
    expect(arquivosPuros.length).toBeGreaterThan(0);
    const doMotor = arquivosTs(`${RAIZ_SRC}motor`).map(nomeCurto).sort();
    expect(arquivosPuros.map(nomeCurto)).toEqual(expect.arrayContaining(doMotor));
    expect(doMotor).toContain('motor/normalizar.ts');
    expect(doMotor).toContain('motor/tipos.ts');
  });

  it('motor e leitores não importam banco, rede, Next nem arquivo', () => {
    const violacoes: string[] = [];
    for (const arquivo of arquivosPuros) {
      const codigo = readFileSync(arquivo, 'utf8');
      for (const [, alvo] of codigo.matchAll(ALVOS_DE_IMPORT)) {
        const proibido = PROIBIDOS.find((p) => p.casa(alvo as string));
        if (proibido) violacoes.push(`${nomeCurto(arquivo)} importa ${alvo} (${proibido.nome})`);
      }
    }
    expect(violacoes).toEqual([]);
  });

  it('motor e leitores não leem variáveis de ambiente', () => {
    const violacoes = arquivosPuros
      .filter((arquivo) => readFileSync(arquivo, 'utf8').includes('process.env'))
      .map(nomeCurto);
    expect(violacoes).toEqual([]);
  });
});
