# Fix "Vertex AI: Permission denied on this project"

Your service account must have permission to use Vertex AI.

## Step-by-step: Add Vertex AI User to the service account

1. Open **IAM** for project **tensoraxstudio**:  
   https://console.cloud.google.com/iam-admin/iam?project=tensoraxstudio

2. In the **Principals** table, find **tensorax-backend@tensoraxstudio.iam.gserviceaccount.com**.

3. Click the **pencil (Edit)** on the right of that row.

4. Click **+ ADD ANOTHER ROLE**.

5. In "Select a role", search for **Vertex AI User**.

6. Select **Vertex AI User** and click **Save**.

7. Wait a minute, then try generating an image again in the app.

---

If the service account is not in the list, add it: **+ GRANT ACCESS** → Principal: `tensorax-backend@tensoraxstudio.iam.gserviceaccount.com` → Role: **Vertex AI User** → Save.
