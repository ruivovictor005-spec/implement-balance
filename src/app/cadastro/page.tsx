'use client';
import * as React from 'react';
import { useState } from 'react';
import { cadastrarAcao } from './acoes.js';

export default function Cadastro() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await cadastrarAcao(nome, email, senha);
    setEnviando(false);
    if (r.erro) setErro(r.erro);
  }

  return (
    <main className="home">
      <h1>
        <span className="marca-glow">Implement Balance</span>
      </h1>
      <p className="sub">Crie sua conta para começar a implantar saldos.</p>
      <section className="cartao" style={{ maxWidth: 440 }}>
        <h2>Criar conta</h2>
        <form onSubmit={cadastrar}>
          <label htmlFor="nome">Nome completo</label>
          <input id="nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ana Cláudia Vieira Martins" autoComplete="name" required />
          <label htmlFor="email" style={{ marginTop: 12 }}>E-mail corporativo</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <label htmlFor="senha" style={{ marginTop: 12 }}>Senha (mínimo 8 caracteres)</label>
          <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required />
          {erro && <div className="erro">{erro}</div>}
          <div className="linha-acoes">
            <button type="submit" disabled={enviando}>{enviando ? 'Criando…' : 'Criar conta e entrar'}</button>
          </div>
        </form>
        <p className="sub" style={{ margin: '14px 0 0' }}>
          Já tem conta? <a href="/entrar">Entrar</a>
        </p>
      </section>
    </main>
  );
}
