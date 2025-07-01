# Hostex Chat

Hostex Chat integrates Hostex conversations with ChatGPT. The web UI lives in `frontend/` and communicates with a Node.js backend in `backend/`.

## Quick Start

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/auzeonfung/hostex-chat.git
cd hostex-chat/frontend && npm install
cd ../backend && npm install
```

2. Copy the example environment file and set your keys:

```bash
cp ../frontend/.env.example ../frontend/.env
# edit frontend/.env and set HOSTEX_API_TOKEN, OPENAI_API_KEY and NEXT_PUBLIC_BACKEND_URL
```

3. Start the servers in two terminals:

```bash
# Terminal 1
cd frontend
npm run dev

# Terminal 2
cd backend
npm start
```

Browse <http://localhost:3000> to access the app. The backend stores data in `frontend/db.sqlite`.

## Production Setup

Run the automated script on Ubuntu to install Node.js, build the app and start systemd services. Provide your API keys and domain as environment variables:

```bash
export HOSTEX_API_TOKEN=your-token
export OPENAI_API_KEY=sk-xxx
export DOMAIN=example.com
sudo ./scripts/setup_full_production.sh
```

To deploy from the current directory without cloning:

```bash
export HOSTEX_API_TOKEN=your-token
export OPENAI_API_KEY=sk-xxx
export DOMAIN=example.com
sudo ./scripts/setup_local_production.sh
```

For the Codex test environment you can install minimal dependencies with:

```bash
./scripts/setup_codex.sh
```
