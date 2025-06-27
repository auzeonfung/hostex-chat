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

The application stores data in a SQLite database file named `db.sqlite` in the
project root. Installing the dependencies will automatically provide the
required SQLite driver.

## API Routes

- `GET /api/conversations` – fetches Hostex conversations from the last 7 days.
- `GET /api/conversations/:id` – retrieves details for a specific conversation.
- `GET /api/conversations/:id/replies` – list stored ChatGPT replies for a conversation.
- `POST /api/conversations/:id/replies` – generate a new reply using ChatGPT and store it.
- `POST /api/conversations/:id/send` – send a stored reply via the Hostex API.
- `POST /api/webhook/hostex` – receive Hostex webhook events verified with
  `HOSTEX_API_TOKEN` and persist new message events in `db.sqlite`.

Generated replies can be edited before sending on the conversation detail page.

Configure `HOSTEX_API_BASE` in the `.env` file if your Hostex endpoint differs from the default `https://api.hostex.io/v3`.

## Example: Sending a Message

Hostex expects new messages to be posted to the `/conversations/:id` endpoint
with a JSON body containing a single `message` field. Below is a minimal
example using `fetch`:

```javascript
const url = 'https://api.hostex.io/v3/conversations/YOUR_CONVERSATION_ID';
const options = {
  method: 'POST',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
    // Replace with your token or read from an environment variable
    'Hostex-Access-Token': process.env.HOSTEX_API_TOKEN,
  },
  body: JSON.stringify({
    message: 'Hello from Hostex Chat!',
  }),
};

fetch(url, options)
  .then((res) => res.json())
  .then((json) => console.log(json))
  .catch((err) => console.error(err));
```

Ensure the `Hostex-Access-Token` header is set to a valid API token and that the
conversation ID exists. Use the `message` field when posting new messages.

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

Webhook payloads are stored in `db.sqlite` and broadcast to connected clients via
Server‑Sent Events.

## Production Deployment

To run Hostex Chat on a public Ubuntu server you can use the helper script in
`scripts/setup_production.sh`. It installs Node.js and Nginx, builds the
Next.js app and sets up a systemd service. Nginx is configured to proxy traffic
on port 80/443 to the Node.js server running on port 3000. The server expects an
existing certificate in `/root/cert` named after the base domain, for example a
domain of `abc.ox.ci` should have `/root/cert/ox.ci.pem` and
`/root/cert/ox.ci.key`. HTTP traffic is redirected to HTTPS. An additional timer
checks the GitHub repository for updates, pulls the `main` branch, rebuilds and
restarts the service when changes are detected.

```bash
DOMAIN=example.com sudo ./scripts/setup_production.sh
```

Specify your domain via the `DOMAIN` environment variable when running the
script. Ensure the matching certificate and key exist in `/root/cert` before
executing the script. After it completes the application will be available over
HTTPS.

### Codex Environment

For the Codex test environment you can install the minimal dependencies using
`scripts/setup_codex.sh`:

```bash
./scripts/setup_codex.sh
```

This installs Node.js and the project dependencies so Codex can run the build or
test commands.
