# Step-by-step: Google Cloud JSON key for Tensorax Studio

Use this when you want **Vertex AI Imagen 3** image generation (backend server). Follow in order.

---

## Part 1: Create a GCP project (if you don’t have one)

1. **Go to:** [Google Cloud Console](https://console.cloud.google.com/)
2. **Top bar:** click the project dropdown (says “Select a project” or the current project name).
3. **Click:** “New Project”.
4. **Project name:** e.g. `tensorax-studio` (or any name).
5. **Click:** “Create”.
6. **Select** the new project from the dropdown so it’s the active project.

---

## Part 2: Enable Vertex AI API

1. **Go to:** [Vertex AI API – Enable](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com)  
   (Or: Console → “APIs & Services” → “Library” → search “Vertex AI API” → open it.)
2. **Click:** “Enable”.
3. Wait until it says the API is enabled.

---

## Part 3: Create a service account and download the JSON key

1. **Go to:** [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)  
   (Or: Console → “IAM & Admin” → “Service Accounts”.)
2. **Click:** “+ Create Service Account”.
3. **Service account name:** e.g. `tensorax-backend`.
4. **Click:** “Create and Continue”.
5. **Role:** open the dropdown → search **“Vertex AI User”** → select it → **Click:** “Continue”.
6. **Click:** “Done”.
7. In the list, find the service account you just created (e.g. `tensorax-backend`). **Click** its email/name.
8. Open the **“Keys”** tab.
9. **Click:** “Add Key” → “Create new key”.
10. Choose **JSON** → **Click:** “Create”.
11. A JSON file will download. **Rename or move it** to your Tensorax Studio project folder as `tensorax-key.json`  
    (e.g. `TensoraxStudio/TensoraxStudio/tensorax-key.json` so it sits next to `package.json`).

**If “Create new key” is disabled or you get a policy error:**  
Your organization may block key creation. You (or an admin) need to temporarily allow service account key creation in the org policy, then repeat from step 9.

---

## Part 4: Point the app at the key

1. Open the **TensoraxStudio** project folder (the one that contains `package.json` and, now, `tensorax-key.json`).
2. Open or create **`.env.local`** in that same folder.
3. Add or set these lines (replace `tensorax-studio` with your real project ID if different):

   ```env
   GOOGLE_PROJECT_ID=tensorax-studio
   GOOGLE_APPLICATION_CREDENTIALS=./tensorax-key.json
   GOOGLE_LOCATION=us-central1
   ```

4. **If the key file is in a different folder:** use the path relative to the project folder, or an absolute path, e.g.:

   ```env
   GOOGLE_APPLICATION_CREDENTIALS=C:\Users\marie\Documents\11 Apps\TensoraxStudio\TensoraxStudio\tensorax-key.json
   ```

5. Save `.env.local`.

---

## Part 5: Check that it works

1. In the project folder, run:

   ```bash
   npm run server
   ```

2. **In the terminal:**  
   - If you see **“JSON key file not found”** and a path → the key file isn’t where the app is looking. Fix the path in `.env.local` or move the key file.  
   - If you don’t see that warning → the key path is OK.

3. **In the browser:** open [http://localhost:5182/api/health](http://localhost:5182/api/health).  
   You want:

   ```json
   { "ok": true, "vertex": { "project": true, "credentials": true, "keyFileExists": true } }
   ```

   If `keyFileExists` is `false`, the path in `GOOGLE_APPLICATION_CREDENTIALS` is wrong.

4. Run the full app with **Frontend + backend:** `npm run dev:full`, then try generating an image.  
   - **“Permission Denied”** → key missing or wrong path (re-check Parts 3 and 4).  
   - **“Quota” / “Rate limit”** → key is fine; quota or rate limit on the Vertex AI side.

---

## Quick links

| Step              | Where to go |
|-------------------|-------------|
| GCP Console       | https://console.cloud.google.com/ |
| Enable Vertex AI  | https://console.cloud.google.com/apis/library/aiplatform.googleapis.com |
| Service Accounts  | https://console.cloud.google.com/iam-admin/serviceaccounts |
| Quotas (if needed)| https://console.cloud.google.com/iam-admin/quotas (filter: Vertex AI, Imagen) |

---

## Summary

1. Create/select project → Enable Vertex AI API.  
2. Create service account → assign “Vertex AI User” → Keys → Add Key → Create new key (JSON) → download.  
3. Save the file as `tensorax-key.json` in the project folder.  
4. In `.env.local` set `GOOGLE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS=./tensorax-key.json`, and `GOOGLE_LOCATION=us-central1`.  
5. Run `npm run server` and check `/api/health`; then run `npm run dev:full` and try generating an image.
