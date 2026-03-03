# "Daily or rate limit exceeded" – Troubleshooting

If you get this error after **only 1 request**, the cause is usually not per-minute quota but one of the following.

---

## 1. Billing must be enabled (most common)

**Vertex AI Imagen requires billing to be enabled** on your Google Cloud project. Without it, the API can return a generic "rate limit" or "resource exhausted" message even for the first request.

**Check:**
- [Google Cloud Console](https://console.cloud.google.com) → select your project → **Billing** (or search "Billing").
- Ensure a billing account is **linked** to this project.

**Docs:** [Generate images with Imagen on Vertex AI](https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images) states billing must be enabled.

---

## 2. Use the correct model ID in code

The **predict endpoint** expects the model ID **`imagen-3.0-capability-001`** (not `imagen-3.0-capability`). In the GCP Quotas page, the quota row may show **base_model: imagen-3.0-capability**; that same quota applies to `imagen-3.0-capability-001`. This project is set to use `imagen-3.0-capability-001`.

---

## 3. Enable Vertex AI API

- In [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Library**.
- Search for **Vertex AI API** and open it.
- Click **Enable** for your project.

---

## 4. Request a quota increase (if billing is already on)

If billing is enabled and you still hit the error:

- Go to [Quotas and System Limits](https://console.cloud.google.com/iam-admin/quotas).
- Filter by: **Vertex AI API**, **prediction**, **imagen**, **us-central1**.
- Find the row: **Regional online prediction requests per base model per minute per region per base_model** with dimension **base_model: imagen-3.0-capability** (or **imagen-3.0-capability-001**).
- Use the **⋮** menu → **Edit quota** / **Request increase** and ask for a higher value (e.g. 20 or 60).

---

## 5. Service account and JSON key

- The backend uses **GOOGLE_APPLICATION_CREDENTIALS** (path to a **service account JSON key** from Google Cloud Console, not an AI Studio API key).
- Create the key in: **IAM & Admin** → **Service Accounts** → [your account] → **Keys** → **Add key** → **Create new key** → **JSON**.
- Put the file in the project folder and set in `.env.local`:  
  `GOOGLE_APPLICATION_CREDENTIALS=./your-key-file.json`

---

## 6. First request / new project

Google’s docs sometimes mention an **initial setup delay** (e.g. up to a few minutes) for a new project or first use. If everything above is correct, wait 2–3 minutes and try **one** request again.

---

## Summary checklist

| Check | Where |
|-------|--------|
| Billing enabled on project | Cloud Console → Billing |
| Vertex AI API enabled | APIs & Services → Library → Vertex AI API |
| Model ID in code | `imagen-3.0-capability-001` (this project uses it) |
| JSON key from GCP (not AI Studio) | `.env.local` → `GOOGLE_APPLICATION_CREDENTIALS` |
| Quota increase (optional) | IAM & Admin → Quotas → filter Vertex AI, imagen, us-central1 |

**Most likely fix when only 1 request fails:** enable **billing** for the project and ensure the **Vertex AI API** is enabled.
