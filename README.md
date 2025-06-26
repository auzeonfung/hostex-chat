# Hostex Chat

This project integrates Hostex conversations with ChatGPT, offering a web-based interface to view chats and send AI-assisted replies. The frontend lives in the `frontend/` directory and exposes several API routes for backend functionality. From the conversation list you can click a chat to view its full details. On the detail page you can generate ChatGPT replies and send any stored reply back to Hostex.

## Getting Started

1. Change into the `frontend` folder and install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Copy `.env.example` to `.env` and set your Hostex and OpenAI keys.
3. Run the development server:
   ```bash
   npm run dev
   ```

## API Routes

- `GET /api/conversations` – fetches Hostex conversations from the last 7 days.
- `GET /api/conversations/:id` – retrieves details for a specific conversation.
- `GET /api/conversations/:id/replies` – list stored ChatGPT replies for a conversation.
- `POST /api/conversations/:id/replies` – generate a new reply using ChatGPT and store it.
- `POST /api/conversations/:id/send` – send a stored reply via the Hostex API.
- `POST /api/webhook/hostex` – receive Hostex webhook events verified with
  `HOSTEX_API_TOKEN` and persist new message events in `db.json`.

Generated replies can be edited before sending on the conversation detail page.

Configure `HOSTEX_API_BASE` in the `.env` file if your Hostex endpoint differs from the default `https://api.hostex.io/v3`.

## Webhook Setup

To keep conversations up to date you can configure a webhook in Hostex so that
new messages are pushed to this application. Create a webhook in your Hostex
dashboard with the following settings:

1. **URL** – the publicly accessible URL of `/api/webhook/hostex` (for local
   development you can expose your dev server using a tool such as `ngrok`).
2. **Secret** – set the secret/token to the same value as `HOSTEX_API_TOKEN` in
   your `.env` file. Incoming requests must include a `hostex-signature` header
   computed as an HMAC SHA‑256 of the request body using this secret.
3. **Events** – subscribe to the `message.created` event to capture new incoming
   messages.

Webhook payloads are stored in `db.json` and broadcast to connected clients via
Server‑Sent Events.
