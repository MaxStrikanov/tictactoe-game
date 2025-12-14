import { createHmac } from "node:crypto";

function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}=${v}`)
    .join("\n");

  return { params, hash, dataCheckString };
}

function verifyInitData(initData: string, botToken: string) {
  const { params, hash, dataCheckString } = parseInitData(initData);
  if (!hash) return null;

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computed !== hash) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  const user = JSON.parse(userRaw);
  return user; // { id, first_name, ... }
}

async function tgSend(botToken: string, chat_id: string | number, text: string) {
  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id, text, disable_web_page_preview: true }),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, data };
}

export const onRequestPost: PagesFunction<{
  BOT_TOKEN: string;
  ADMIN_CHAT_ID: string;
}> = async ({ request, env }) => {
  const body = await request.json().catch(() => ({}));
  const text = String(body?.text ?? "").trim();
  const initData = String(body?.initData ?? "").trim();

  if (!text) return new Response(JSON.stringify({ ok: false, error: "text_required" }), { status: 400 });

  if (!env.BOT_TOKEN || !env.ADMIN_CHAT_ID) {
    return new Response(JSON.stringify({ ok: false, error: "env_missing" }), { status: 500 });
  }

  // 1) всегда админу
  const adminRes = await tgSend(env.BOT_TOKEN, env.ADMIN_CHAT_ID, text);

  // 2) пользователю, если сайт открыт из Telegram WebApp и initData валиден
  let userRes: any = null;
  const user = initData ? verifyInitData(initData, env.BOT_TOKEN) : null;
  if (user?.id) {
    userRes = await tgSend(env.BOT_TOKEN, user.id, text);
  }

  return new Response(JSON.stringify({
    ok: adminRes.ok && (userRes ? userRes.ok : true),
    admin: adminRes.data,
    user: userRes?.data ?? null,
    user_sent: Boolean(user?.id),
  }), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
};
