// Envio do código de recuperação por e-mail. Lê a configuração SMTP das variáveis de ambiente
// (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE). Enquanto o SMTP não estiver
// configurado, o código é apenas registrado no log do servidor (para testar o fluxo localmente).
export async function enviarCodigoRecuperacao(
  para: string,
  nome: string,
  codigo: string,
): Promise<{ enviado: boolean }> {
  const host = process.env.SMTP_HOST;
  if (host == null || host === '') {
    console.log(`[recuperação de senha] código para ${para}: ${codigo}`);
    return { enviado: false };
  }

  // Import dinâmico: o nodemailer só é necessário quando há SMTP configurado.
  const { createTransport } = await import('nodemailer');
  const transporter = createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER != null
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
        : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to: para,
    subject: 'Implement Balance — código de recuperação de senha',
    text:
      `Olá, ${nome}.\n\n` +
      `Seu código para redefinir a senha é: ${codigo}\n` +
      `Ele vale por 30 minutos. Se não foi você quem pediu, ignore este e-mail.`,
  });
  return { enviado: true };
}
