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

Generated replies can be edited before sending on the conversation detail page.

Configure `HOSTEX_API_BASE` in the `.env` file if your Hostex endpoint differs from the default `https://api.hostex.io/v3`.
