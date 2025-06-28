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
4. In a separate terminal start the backend polling server:
   ```bash
   cd ../backend
   npm install
   npm start
   ```

The application stores data in a SQLite database file created in the
`frontend/` directory as `frontend/db.sqlite` when the server runs. This file is
already excluded by `.gitignore` inside `frontend/`. Installing the
dependencies will automatically provide the required SQLite driver.

## Configuration

Environment variables are loaded from a `.env` file in the `frontend/`
directory. Create the file if it does not exist by copying the example
template:

```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env` and set the following variables:

- `HOSTEX_API_TOKEN` – API token from your Hostex account.
- `OPENAI_API_KEY` – OpenAI API key for generating replies.
- `HOSTEX_API_BASE` – optional Hostex API endpoint, defaults to
  `https://api.hostex.io/v3`.
- `NEXT_PUBLIC_BACKEND_URL` – URL for the backend server used by the frontend.
- `DB_PATH` – optional path for the SQLite database used by the backend.

These settings are required both for development and when deploying to
production using `scripts/setup_full_production.sh` or
`scripts/setup_local_production.sh`.

## API Routes

The backend server polls Hostex and stores data in `db.sqlite`. It exposes the following routes on `NEXT_PUBLIC_BACKEND_URL`:

- `GET /conversations` – list cached conversations.
- `GET /conversations/:id` – conversation detail with messages.
- `GET /read-state` – list read state information.
- `POST /read-state` – update read state.

The Next.js frontend still provides routes for ChatGPT features:
- `GET /api/conversations/:id/replies` – list stored ChatGPT replies for a conversation.
- `POST /api/conversations/:id/replies` – generate a new reply using ChatGPT and store it.
- `POST /api/conversations/:id/send` – send a stored reply via the Hostex API.
- `POST /api/webhook/hostex` – receive Hostex webhook events verified with `HOSTEX_API_TOKEN`.

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

When running the standalone webhook worker (see below) the URL should still
point to `/api/webhook/hostex` as nginx proxies this path to the worker.

## Production Deployment

To run Hostex Chat on a public Ubuntu server you can use the helper script in
`scripts/setup_full_production.sh`. It installs Node.js 22 LTS and Nginx, builds the
frontend and backend and sets up systemd services. Nginx is configured to proxy traffic
on port 80/443 to the Node.js servers running on ports 3000 and 4000. The server expects an
existing certificate in `/root/cert` named after the base domain, for example a
domain of `abc.ox.ci` should have `/root/cert/ox.ci.pem` and
`/root/cert/ox.ci.key`. HTTP traffic is redirected to HTTPS. An additional timer
checks the GitHub repository for updates, pulls the `main` branch, rebuilds and
restarts the service when changes are detected.

The script also compiles `scripts/webhook-worker.ts` and installs a
`hostex-chat-worker.service` which listens on port 3100 for webhook events. Nginx
forwards `/api/webhook/hostex` to this worker. Ensure `HOSTEX_API_TOKEN` is set
so requests can be verified. The worker is started automatically but you can
restart it with `systemctl restart hostex-chat-worker.service` when updating the
code.

A sample nginx configuration suitable for Cloudflare is included at
`nginx/hostex-chat-cloudflare.conf`.

```bash
DOMAIN=example.com sudo ./scripts/setup_full_production.sh
```

To deploy from your current directory without cloning, use
`scripts/setup_local_production.sh` instead:

```bash
DOMAIN=example.com sudo ./scripts/setup_local_production.sh
```

When using `setup_full_production.sh` you can set the `REPO_URL` environment
variable to clone from a different repository.

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
