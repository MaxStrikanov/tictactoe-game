// functions/api/telegram.ts

async function hmacSha256Hex(key: ArrayBuffer, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(message)
  );

  return [...new Uint8Array(signature)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}=${v}`)
    .join("\n");

  // secret key = SHA256("WebAppData" + botToken)
  const secretKey = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("WebAppData" + botToken)
  );

  const computedHash = await hmacSha256Hex(secretKey, dataCheckString);
  if (computedHash !== hash) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  return JSON.parse(userRaw); // { id, first_name, ... }
}

export const onRequestPost: PagesFunction<{
  BOT_TOKEN: string;
  ADMIN_CHAT_ID: string;
}> = async ({ request, env }) => {

  const body = await request.json().catch(() => ({}));
  const text = String(body?.text ?? "").trim();
  const initData = String(body?.initData ?? "").trim();

  if (!text) {
    return new Response(JSON.stringify({ ok: false, error: "text_required" }), { status: 400 });
  }

  if (!env.BOT_TOKEN || !env.ADMIN_CHAT_ID) {
    return new Response(JSON.stringify({ ok: false, error: "env_missing" }), { status: 500 });
  }

  const send = async (chat_id: string | number) => {
    return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text,
        disable_web_page_preview: true
      }),
    }).then(r => r.json());
  };

  // 1️⃣ всегда админу
  const admin = await send(env.ADMIN_CHAT_ID);

  // 2️⃣ пользователю, если открыт как Telegram WebApp
  let userSent = false;
  if (initData) {
    const user = await verifyInitData(initData, env.BOT_TOKEN);
    if (user?.id) {
      await send(user.id);
      userSent = true;
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    admin,
    user_sent: userSent
  }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
