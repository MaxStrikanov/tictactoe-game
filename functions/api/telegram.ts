// functions/api/telegram.ts

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(keyBytes: Uint8Array, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
}

async function verifyInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "no_hash" };

  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}=${v}`)
    .join("\n");

  // secret_key = HMAC_SHA256(key="WebAppData", message=botToken)
  const secretBuf = await hmacSha256(new TextEncoder().encode("WebAppData"), botToken);
  const secretKeyBytes = new Uint8Array(secretBuf);

  // computed_hash = HMAC_SHA256(key=secret_key, message=dataCheckString)
  const computedBuf = await hmacSha256(secretKeyBytes, dataCheckString);
  const computed = toHex(computedBuf);

  if (computed !== hash) return { ok: false, reason: "hash_mismatch" };

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, reason: "no_user" };

  try {
    const user = JSON.parse(userRaw);
    return { ok: true, user };
  } catch {
    return { ok: false, reason: "bad_user_json" };
  }
}

async function tgSend(botToken: string, chat_id: string | number, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id, text, disable_web_page_preview: true }),
  });
  const data = await r.json().catch(() => ({}));
  return { http_ok: r.ok, data };
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

  // админу всегда
  const admin = await tgSend(env.BOT_TOKEN, env.ADMIN_CHAT_ID, text);

  // пользователю, если есть валидный initData
  let user_sent = false;
  let user_id: number | null = null;
  let verify_reason: string | null = null;

  if (initData) {
    const v = await verifyInitData(initData, env.BOT_TOKEN);
    if (v.ok) {
      user_id = v.user?.id ?? null;
      if (user_id) {
        const u = await tgSend(env.BOT_TOKEN, user_id, text);
        user_sent = Boolean(u.http_ok && u.data?.ok);
      }
    } else {
      verify_reason = v.reason;
    }
  } else {
    verify_reason = "initData_empty";
  }

  return new Response(JSON.stringify({
    ok: true,
    admin_ok: Boolean(admin.http_ok && admin.data?.ok),
    user_sent,
    user_id,
    verify_reason
  }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
