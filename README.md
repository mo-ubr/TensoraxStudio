<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1YXOt22xlqf83Rertf4okhlfZ-5Z1l1OI

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. **Gemini API key** (for prompt enhancement, chat, video): Set `GEMINI_API_KEY` in [.env.local](.env.local)

3. **Image generation (Vertex AI Imagen 3)** – for character consistency across the 9-frame grid.  
   **→ Step-by-step guide:** [SETUP-VERTEX-KEY.md](SETUP-VERTEX-KEY.md) (where to go, what to click).
   - Create a GCP project (e.g. `tensorax-studio`) and enable [Vertex AI API](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com)
   - Go to IAM & Admin > Service Accounts, create `tensorax-backend`, give it "Vertex AI User" role
   - **Create and download the JSON key:** Keys tab → **Add Key** → **Create new key** → JSON → save as `tensorax-key.json` in the project folder. If your org has a policy that blocks key creation, you may need to turn it off temporarily to create the key.
   - Add to [.env.local](.env.local) (path is relative to project root when you run the server):
     ```
     GOOGLE_PROJECT_ID=tensorax-studio
     GOOGLE_APPLICATION_CREDENTIALS=./tensorax-key.json
     ```
   - **If you get "Permission Denied":** The JSON key file is missing or the path is wrong. Ensure you clicked **Create Key**, downloaded the file, and that `GOOGLE_APPLICATION_CREDENTIALS` in `.env.local` points to that file (e.g. `./tensorax-key.json` if it’s in the project folder).

4. **OpenAI DALL-E 3** (fallback when Google quotas are exceeded):
   - Add `OPENAI_API_KEY=sk-...` to [.env.local](.env.local)
   - In the app, select **OpenAI (DALL-E 3)** from the IMAGE API dropdown

5. Run the app:
   - **Frontend only:** `npm run dev` (uses Gemini consumer API for images)
   - **Frontend + backend:** `npm run dev:full` (Vertex Imagen + OpenAI fallback; requires backend for both)
