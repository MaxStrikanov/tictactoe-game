# Деплой на Cloudflare Pages (Vite + React + Telegram)

## Локально
```bash
npm i
npm run build
npm run preview
```

## Cloudflare Pages
1. Залей проект в GitHub.
2. Cloudflare → Pages → Create a project → подключи репозиторий.
3. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Settings → Environment variables (Production):
   - `BOT_TOKEN` = токен Telegram-бота
   - `CHAT_ID` = chat id группы (`-100...`) или `@channelname` (бот админ)

## Как работает отправка в Telegram
Фронт вызывает `POST /api/telegram`, а функция Cloudflare Pages в `functions/api/telegram.ts`
уже ходит в Telegram Bot API. Токен не попадает в браузер.

## Проверка после деплоя
Открой сайт и в консоли браузера:
```js
fetch('/api/telegram', {
  method: 'POST',
  headers: {'content-type':'application/json'},
  body: JSON.stringify({ text: 'Тест с Cloudflare' })
}).then(r=>r.json()).then(console.log)
```
