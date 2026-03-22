# Fix "Permission denied" and "Free tier" / Tier 1

You’re seeing three different errors. Fix them in this order.

---

## 1. Vertex AI: "Permission denied on resource project tensorax-studio"

This is your **main** image path (backend with JSON key). Fix it first.

**Do this in Google Cloud Console (console.cloud.google.com), project `tensorax-studio`:**

1. **Billing – link a billing account to the project**
   - Open: **[My Projects (Billing)](https://console.cloud.google.com/billing/projects)**  
     (or go to **Billing** in the top menu, then the **My projects** tab).
   - In the list, find **tensorax-studio** (or your project). Check the **Billing account** column.
   - If it says **"Billing is disabled"** or no account:
     - Click the **⋮** (three dots) at the end of that project’s row.
     - Click **Change billing**.
     - Choose an existing **billing account** (e.g. your company or personal one), then click **Set account**.
   - If you **don’t have a billing account** yet:
     - Go to **[Billing](https://console.cloud.google.com/billing)** → **Manage billing accounts**.
     - Click **Create account**, follow the steps (payment method, etc.), then return to the My Projects page and link that new account to **tensorax-studio** as above.
   - Vertex AI Imagen requires billing to be enabled on the project.

2. **Vertex AI API**
   - Go to **APIs & Services** → **Library** → search **Vertex AI API** → open it → **Enable**.

3. **Service account role**
   - Go to **IAM & Admin** → **IAM**.
   - Find the **service account** whose JSON key you use (e.g. `tensorax-backend@tensorax-studio.iam.gserviceaccount.com`).
   - Ensure it has the role **Vertex AI User** (or at least the same project and permissions needed for Vertex AI).  
   - If you’re not sure, go to **IAM & Admin** → **Service Accounts** → open the account → **Permissions** and add **Vertex AI** → **Vertex AI User**.

4. **Project ID**
   - In your app’s `.env.local`, set:
     - `GOOGLE_PROJECT_ID=tensorax-studio`
   - Use the **exact** project ID where you enabled billing and Vertex AI API and where the service account lives (it might be different from `tensorax-studio` if you use another project).

After this, restart the backend and try **one** image again. If it still says "Permission denied", double‑check the project ID and that the JSON key was created in that same project.

---

## 2. Gemini API: "Free tier" / quota 0 → move to Tier 1

The **fallback** path uses the **Gemini API** (AI Studio) with your **GEMINI_API_KEY**. The error says you’re on the **free tier** (limit 0 for `gemini-3-pro-image`). To get **Tier 1** (paid):

1. Open **https://ai.google.dev** (Google AI Studio).
2. Check **billing / plan** for the key or project (e.g. Get API key → billing or usage).
3. Or open the link from the error: **https://ai.google.dev/gemini-api/docs/rate-limits** and follow the steps to enable billing / upgrade from free tier.
4. In **Google Cloud Console**: if your Gemini API key is tied to a GCP project, enable **billing** for that project and ensure the **Generative Language API** is enabled; quotas and tiers can depend on that.

Once you’re on a paid tier (Tier 1), the Gemini fallback (e.g. `gemini-3-pro-image`) can work when Vertex is unavailable.

---

## 3. "imagen-3.0-capability-001 is not found for API version v1beta"

The **third** path uses the **Gemini consumer API** (generativelanguage.googleapis.com) with the model `imagen-3.0-capability-001`. That model is **only** available on **Vertex AI**, not on the consumer API, so this call correctly returns 404. You can ignore this error once **Vertex** (section 1) is fixed.

---

## Order of use in the app

1. **Vertex AI** (backend + JSON key) – main path; fix with section 1.
2. **Gemini (AI Studio style)** – fallback; fix with section 2 if you want it.
3. **SDK Imagen** – consumer API; will 404 for this model; no action needed.

**Summary:** Fix **Vertex** (billing + Vertex AI API + service account role + correct `GOOGLE_PROJECT_ID`). Then, if you want the Gemini fallback, move your **Gemini API** key off free tier to **Tier 1** as in section 2.
