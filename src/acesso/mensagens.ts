// Mensagens das telas de acesso. Fica fora das ações (`'use server'` só exporta função async).

/** Falha técnica: o login não chegou a ser avaliado (banco fora do ar, configuração errada). */
export const ERRO_INDISPONIVEL =
  'Não foi possível verificar seu acesso agora: o sistema não conseguiu falar com o banco de dados. ' +
  'Isso não é problema na sua senha — avise quem cuida da aplicação.';
