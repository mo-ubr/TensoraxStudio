# AI Studio vs Google Cloud (Vertex) – Why Frame Generation Uses Vertex

## Model used for frame generation

The app uses **one model** for the "Generate" button (9 keyframes):

- **`imagen-3.0-capability-001`** (Vertex AI)
- Set in: `server/tensorax_api.js`, `server/imagen.js`, `services/geminiService.ts`

All frame generation goes through this model.

---

## Two different systems

| | **AI Studio** (aistudio.google.com) | **Google Cloud / Vertex** (console.cloud.google.com) |
|---|-----------------------------------|------------------------------------------------------|
| **You get** | API key (e.g. `GEMINI_API_KEY`) | Service account **JSON key file** (e.g. `tensorax-key.json`) |
| **Used in this app for** | Chat, prompt enhancement, some fallback image paths | **Frame generation** (the main "Generate" button) |
| **Where quotas live** | AI Studio / Gemini API quotas | **Google Cloud Console → IAM & Admin → Quotas** (Vertex AI, imagen-3.0-capability, us-central1) |

- **Frame generation** = backend calls **Vertex AI** with the **JSON key** (`GOOGLE_APPLICATION_CREDENTIALS`). That key is created in **Google Cloud Console** (Service Accounts → Keys → Create key → JSON), **not** in AI Studio.
- If you only created something in **AI Studio**, that gives you an **API key**. That key does **not** power the main frame generation; the **JSON key** from **Google Cloud** does.
- The "Daily or rate limit exceeded" message comes from **Vertex AI**. So the JSON key is working and the limit is the **Vertex AI quota** for your GCP project.

---

## What you need for frame generation

1. **Google Cloud project** (same one in [Google Cloud Console](https://console.cloud.google.com)).
2. **Vertex AI API** enabled for that project.
3. **Service account** with a **JSON key** created in **Google Cloud Console** (IAM & Admin → Service Accounts → your account → Keys → Add key → JSON).
4. In the project folder, **`.env.local`**:
   - `GOOGLE_PROJECT_ID=<your-project-id>`
   - `GOOGLE_APPLICATION_CREDENTIALS=./tensorax-key.json` (path to that JSON file)

Quotas (e.g. 10 requests/minute for `imagen-3.0-capability`) are changed only in **Google Cloud Console → IAM & Admin → Quotas** (filter by Vertex AI, imagen, us-central1). AI Studio does not control these.

---

## Summary

- **Model**: Frame generation uses **`imagen-3.0-capability`** everywhere.
- **Auth**: Frame generation uses the **Vertex AI JSON key** from **Google Cloud Console**, not the AI Studio API key.
- **Limits**: Rate/daily limits are **Vertex** quotas in **Google Cloud Console**. Creating or managing the API in AI Studio does not change those; use the same GCP project and adjust quotas in the Console.
