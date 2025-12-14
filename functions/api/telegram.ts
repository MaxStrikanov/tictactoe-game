export const onRequestPost: PagesFunction<{
  BOT_TOKEN: string;
  CHAT_ID: string;
}> = async ({ request, env }) => {
  const json = await request.json().catch(() => ({}));
  const text = String((json as any)?.text ?? "").trim();

  if (!text) {
    return new Response(JSON.stringify({ ok: false, error: "text_required" }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (!env.BOT_TOKEN || !env.CHAT_ID) {
    return new Response(JSON.stringify({ ok: false, error: "env_missing" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const tgResp = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: env.CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const data = await tgResp.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: tgResp.ok, telegram: data }), {
    status: tgResp.ok ? 200 : 502,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
