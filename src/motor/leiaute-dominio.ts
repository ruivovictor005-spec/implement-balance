// Arquivo TXT posicional de importação do Domínio — leiaute 19 (§6.7). Cada registro é uma
// string de tamanho fixo; a concatenação na ordem certa reproduz byte a byte o que a planilha gera.
import type { Lancamento } from './agregar.js';

export type ParametrosLote = {
  dataSaldo: Date;
  cnpj: string;
  codigoEmpresa: string;
  tipoLote: string;
  codigoHistorico: string;
  incluirCabecalho: boolean;
};

const espacos = (n: number): string => ' '.repeat(n);

/** Zeros à esquerda, como o TEXT("0000000") da planilha. */
const digitos = (valor: string | number, tamanho: number): string =>
  String(valor).padStart(tamanho, '0');

/** Data no formato dd/mm/aaaa, pelos componentes locais — a planilha usa a data civil, sem fuso. */
function dataBr(d: Date): string {
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
}

/** CNPJ só com dígitos, preenchido com espaços à direita até 14 (a planilha tira só `.`, `/` e `-`). */
const cnpjFormatado = (cnpj: string): string => (cnpj.replace(/\D/g, '') + espacos(14)).slice(0, 14);

/** Registro 01 — cabeçalho da empresa (54). Só entra quando a pessoa pede. */
export function gerarRegistro01(p: ParametrosLote): string {
  const data = dataBr(p.dataSaldo);
  return (
    '01' +
    digitos(p.codigoEmpresa, 7) +
    cnpjFormatado(p.cnpj) +
    data +
    data +
    'N' +
    '05' +
    '00000' +
    '1' +
    '17'
  );
}

/** Registro 02 — abertura do lote (150). */
export function gerarRegistro02(p: ParametrosLote): string {
  return '02' + '0000001' + p.tipoLote + dataBr(p.dataSaldo) + espacos(30) + espacos(100);
}

/** Registro 03 — uma partida (664). `sequencia` começa em 2 na primeira partida. */
export function gerarRegistro03(l: Lancamento, p: ParametrosLote, sequencia: number): string {
  const valorEmCentavos = Math.round(l.valor * 100);
  // CR e LF viram espaço, depois corte ou preenchimento em 512 posições exatas.
  const complemento = (l.complemento.replace(/[\r\n]/g, ' ') + espacos(512)).slice(0, 512);
  return (
    '03' +
    digitos(sequencia, 7) +
    digitos(l.contaDebito ?? 0, 7) +
    digitos(l.contaCredito ?? 0, 7) +
    digitos(valorEmCentavos, 15) +
    digitos(p.codigoHistorico, 7) +
    complemento +
    '0000000' +
    espacos(100)
  );
}

/** Registro 99 — encerramento (100): `99` seguido de 98 noves. */
const gerarRegistro99 = (): string => '99' + '9'.repeat(98);

/**
 * Arquivo inteiro: cabeçalho opcional, abertura do lote, uma partida por lançamento (sequência a
 * partir de 2) e o encerramento.
 */
export function gerarTxt(lancamentos: Lancamento[], p: ParametrosLote): string[] {
  const linhas: string[] = [];
  if (p.incluirCabecalho) linhas.push(gerarRegistro01(p));
  linhas.push(gerarRegistro02(p));
  lancamentos.forEach((l, i) => linhas.push(gerarRegistro03(l, p, i + 2)));
  linhas.push(gerarRegistro99());
  return linhas;
}
