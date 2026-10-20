// Gera três arquivos de exemplo a partir de fixtures/balancete.json, para os testes dos leitores
// e para a prova ponta a ponta da tela: o balancete Domínio normal, uma variante com linhas de
// título antes do cabeçalho e um CSV com decimal por vírgula (formato brasileiro).
//
// Uso: npx tsx scripts/gerar-arquivos-exemplo.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import type { LinhaBalanceteGabarito } from '../src/motor/tipos.js';

const PASTA = new URL('../fixtures/arquivos/', import.meta.url);

// Cabeçalho do balancete Domínio, com os nomes de coluna que o perfil reconhece.
const CABECALHO = ['codi_cta', 'nome_cta', 'clas_cta', 'tipo_cta', 'saldoant', 'totdeb', 'totcre', 'saldoatu'];

const linhaDe = (l: LinhaBalanceteGabarito): (string | number)[] => [
  l.codiCta,
  l.nomeCta,
  l.clasCta,
  l.tipoCta,
  l.saldoAnterior,
  l.totalDebito,
  l.totalCredito,
  l.saldoAtual,
];

/** Número no formato brasileiro: milhar com ponto, decimal com vírgula (ex.: -29.341,66). */
const ptBr = (v: number): string =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function gerarXlsx(arquivo: string, linhasAntes: string[][], balancete: LinhaBalanceteGabarito[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Balancete');
  for (const linha of linhasAntes) ws.addRow(linha);
  ws.addRow(CABECALHO);
  for (const l of balancete) ws.addRow(linhaDe(l));
  await wb.xlsx.writeFile(fileURLToPath(new URL(arquivo, PASTA)));
}

function gerarCsv(arquivo: string, balancete: LinhaBalanceteGabarito[]): void {
  const linhas = [
    CABECALHO.join(';'),
    ...balancete.map((l) =>
      [
        l.codiCta,
        l.nomeCta,
        l.clasCta,
        l.tipoCta,
        ptBr(l.saldoAnterior),
        ptBr(l.totalDebito),
        ptBr(l.totalCredito),
        ptBr(l.saldoAtual),
      ].join(';'),
    ),
  ];
  writeFileSync(fileURLToPath(new URL(arquivo, PASTA)), `${linhas.join('\r\n')}\r\n`, 'utf8');
}

async function main(): Promise<void> {
  const balancete = JSON.parse(
    readFileSync(fileURLToPath(new URL('../fixtures/balancete.json', import.meta.url)), 'utf8'),
  ) as LinhaBalanceteGabarito[];

  mkdirSync(fileURLToPath(PASTA), { recursive: true });

  await gerarXlsx('balancete-dominio.xlsx', [], balancete);
  await gerarXlsx(
    'balancete-com-titulo.xlsx',
    [
      ['Empresa Exemplo LTDA'],
      ['CNPJ 00.000.000/0001-00'],
      ['Período: 01/08/2026 a 31/08/2026'],
    ],
    balancete,
  );
  gerarCsv('balancete-virgula-decimal.csv', balancete);

  console.log(`3 arquivos gerados em ${fileURLToPath(PASTA)} (${balancete.length} linhas cada)`);
}

main();
