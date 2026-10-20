// Rota de saúde, liberada pelo middleware: serve para checar se o site está de pé.
export function GET(): Response {
  return Response.json({ ok: true });
}
