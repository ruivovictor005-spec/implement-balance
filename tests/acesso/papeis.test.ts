import { describe, expect, it } from 'vitest';
import { exigirPapel, podeAdministrar, podeRevisar } from '../../src/acesso/papeis.js';

describe('papéis', () => {
  it('usuário comum não revisa nem administra', () => {
    const u = { papel: 'usuario' as const };
    expect(podeRevisar(u)).toBe(false);
    expect(podeAdministrar(u)).toBe(false);
  });

  it('revisor revisa mas não administra', () => {
    const u = { papel: 'revisor' as const };
    expect(podeRevisar(u)).toBe(true);
    expect(podeAdministrar(u)).toBe(false);
  });

  it('admin revisa e administra', () => {
    const u = { papel: 'admin' as const };
    expect(podeRevisar(u)).toBe(true);
    expect(podeAdministrar(u)).toBe(true);
  });

  it('exigirPapel barra quem não tem o papel e libera quem tem', () => {
    expect(() => exigirPapel('revisor', { papel: 'usuario' })).toThrow();
    expect(() => exigirPapel('revisor', { papel: 'revisor' })).not.toThrow();
    expect(() => exigirPapel('revisor', { papel: 'admin' })).not.toThrow();
    expect(() => exigirPapel('admin', { papel: 'revisor' })).toThrow();
  });
});
