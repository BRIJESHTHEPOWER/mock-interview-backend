# Mock Interview Backend

Node.js + Express backend for Voice-Based AI Mock Interview Platform.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your Retell AI credentials
```

### 3. Get Retell AI Credentials

1. Go to [Retell AI Dashboard](https://app.retellai.com/)
2. Create a new **Web Call Agent**
3. In the agent's system prompt, include `{{jobRole}}` placeholder:
   ```
   You are an AI interviewer conducting a mock interview for a {{jobRole}} position.
   Ask relevant technical and behavioral questions based on the role.
   ```
4. Copy your **Agent ID** and **API Key**
5. Paste them into `.env` file

### 4. Run the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server will start on `http://localhost:5000`

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "message": "Mock Interview Backend is running",
  "timestamp": "2026-01-07T13:37:34.000Z"
}
```

### `POST /create-interview`
Creates a new Retell AI interview session.

**Request Body:**
```json
{
  "jobRole": "Software Engineer"
}
```

**Response:**
```json
{
  "success": true,
  "callId": "call_abc123...",
  "accessToken": "token_xyz789...",
  "agentId": "agent_123..."
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional details"
}
```

### `GET /interview-status/:callId`
Get the status of an ongoing interview.

**Response:**
```json
{
  "success": true,
  "status": { ... }
}
```

## Security Notes

- ✅ API keys are stored in `.env` (never exposed to frontend)
- ✅ CORS is configured to only allow requests from frontend
- ✅ Input validation on all endpoints
- ✅ Proper error handling and logging
- ✅ Request timeouts to prevent hanging

## Troubleshooting

**Error: Missing environment variables**
- Make sure you've created `.env` file
- Verify `RETELL_API_KEY` and `RETELL_AGENT_ID` are set

**Error: CORS issues**
- Check `FRONTEND_URL` in `.env` matches your frontend URL
- Default is `http://localhost:5173` for Vite

**Error: Retell API timeout**
- Check your internet connection
- Verify Retell API key is valid
- Check Retell AI service status

## Project Structure

```
backend/
├── server.js          # Main Express server
├── package.json       # Dependencies
├── .env.example       # Environment template
├── .env              # Your actual credentials (gitignored)
├── .gitignore        # Git ignore rules
└── README.md         # This file
```
