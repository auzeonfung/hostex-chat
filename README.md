# Hostex Chat

Hostex Chat integrates Hostex conversations with ChatGPT. The project contains a Next.js frontend and a Node-based backend that polls the Hostex API. Both services must run together.

## Quick Start

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/auzeonfung/hostex-chat.git
cd hostex-chat
cd frontend && npm install
cd ../backend && npm install
cd ..
```

2. Copy the example environment file and set your keys:

```bash
cp .env.example .env
cp .env frontend/.env
# edit .env and set HOSTEX_API_TOKEN, OPENAI_API_KEY and DOMAIN
```

3. Start the combined server which hosts both the frontend and backend APIs. It
   reads configuration from `.env` and will run the Next.js development server
   when `NODE_ENV` is not set to `production`:

```bash
node server.mjs
```

    To use a custom port define the `PORT` environment variable before running
    the file. When deploying you should first build the frontend and then run
    the server in production mode:

    ```bash
    npm run build --prefix frontend
    NODE_ENV=production PORT=4000 node server.mjs
    ```

4. Alternatively you can start the services separately. First run the backend server:

```bash
npm start --prefix backend
```

5. In another terminal start the frontend dev server:

```bash
npm run dev --prefix frontend
```

Browse <http://localhost:3000> to access the app. The server stores data in `frontend/db.sqlite`.

## Production Setup

Run the automated script on Ubuntu to install Node.js, build the app and start systemd services. Provide your API keys and domain as environment variables. The script writes them to `/opt/hostex-chat/.env` which both services load:

```bash
export HOSTEX_API_TOKEN=your-token
export OPENAI_API_KEY=sk-xxx
export DOMAIN=example.com
sudo ./scripts/setup_full_production.sh
```
The script creates `/opt/hostex-chat/.env` containing these values. Both the
frontend and backend services read from this file at startup.  You can also run
them as a single service by launching `server.mjs` through your service manager.
For a `systemd` unit the `ExecStart` line might look like:

```ini
ExecStart=/usr/bin/node /opt/hostex-chat/server.mjs
Environment=NODE_ENV=production
```

To deploy from the current directory without cloning:

```bash
export HOSTEX_API_TOKEN=your-token
export OPENAI_API_KEY=sk-xxx
export DOMAIN=example.com
sudo ./scripts/setup_local_production.sh
```
This variant reuses the same `/opt/hostex-chat/.env` file so the services run with identical configuration.

For the Codex test environment you can install minimal dependencies with:

```bash
./scripts/setup_codex.sh
```
