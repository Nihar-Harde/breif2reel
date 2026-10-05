# AZURE_SETUP.md — Brief2Reel Azure Setup Guide

> **Purpose:** Configure a fresh Microsoft Azure account from scratch to run Brief2Reel's self-hosted video generation pipeline (GPU inference via Azure Container Apps + video artifact storage via Azure Blob Storage).
>
> **Assumptions:**
> - Brand-new Azure account with **$200 free credit** (valid for 30 days).
> - You will create a **new Azure account each month** and repeat this setup.
> - You are on **Windows** with PowerShell.

---

## Table of Contents

1. [Create an Azure Account](#1-create-an-azure-account)
2. [Install the Azure CLI](#2-install-the-azure-cli)
3. [Sign In and Verify Subscription](#3-sign-in-and-verify-subscription)
4. [Create a Resource Group](#4-create-a-resource-group)
5. [Request GPU Quota (CRITICAL — Do This First!)](#5-request-gpu-quota-critical--do-this-first)
6. [Create Azure Blob Storage (Video Artifacts)](#6-create-azure-blob-storage-video-artifacts)
7. [Create Azure Container Registry (Docker Images)](#7-create-azure-container-registry-docker-images)
8. [Create the Container Apps Environment with GPU](#8-create-the-container-apps-environment-with-gpu)
9. [Build & Push the Video Inference Container](#9-build--push-the-video-inference-container)
10. [Deploy the Video Inference Container App](#10-deploy-the-video-inference-container-app)
11. [Set Up Budget Alerts](#11-set-up-budget-alerts)
12. [Connect Azure to the Brief2Reel Backend](#12-connect-azure-to-the-brief2reel-backend)
13. [Test the Connection](#13-test-the-connection)
14. [Monitor Usage and Costs](#14-monitor-usage-and-costs)
15. [Monthly Teardown & Recreation](#15-monthly-teardown--recreation)
16. [Troubleshooting](#16-troubleshooting)
17. [Quick Reference — All Values You Need](#17-quick-reference--all-values-you-need)

---

## 1. Create an Azure Account

### 1.1. Navigate to Azure Free Account

1. Open **https://azure.microsoft.com/en-us/free/** in your browser.
2. Click **"Start free"** (or **"Try Azure for free"**).

### 1.2. Sign In or Create a Microsoft Account

- If you already have a Microsoft/Outlook/Hotmail account, sign in.
- If not, click **"Create one!"** and register a new email.

> **Monthly rotation trick:** Each month, create a new Microsoft account (e.g., `yourname.sept2026@outlook.com`, `yourname.oct2026@outlook.com`) to get a fresh $200 credit. Use a different email and phone number (or a Google Voice number). Azure free accounts require a credit/debit card for identity verification but will **not** charge you unless you explicitly upgrade.

### 1.3. Complete Identity Verification

- Enter your **phone number** for SMS/call verification.
- Enter a **credit or debit card** — this is for identity verification only; you won't be charged.
- Agree to the terms and click **"Sign up"**.

### 1.4. Confirm Credit

After signup, you'll land on the Azure Portal. Verify your credit:

1. Go to **portal.azure.com** → Search **"Subscriptions"** in the top search bar.
2. Click your subscription (typically named **"Azure subscription 1"** or **"Free Trial"**).
3. In the left sidebar, click **"Overview"** — confirm it shows **$200.00 credit**.

> **IMPORTANT:** Note down your **Subscription ID** — you'll need it for CLI commands. It looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.

---

## 2. Install the Azure CLI

If you don't have the Azure CLI installed:

```powershell
# Option 1: Install via winget (recommended)
winget install -e --id Microsoft.AzureCLI

# Option 2: Install via MSI (download from browser)
# https://aka.ms/installazurecliwindows
```

Verify installation:

```powershell
az --version
# Should show az version 2.x.x
```

> **Note:** Close and reopen your terminal/PowerShell after installation for the `az` command to be recognized.

---

## 3. Sign In and Verify Subscription

### 3.1. Log In

```powershell
az login
```

This opens a browser window. Sign in with the Microsoft account you just created. After successful login, you'll see your subscription details in the terminal.

### 3.2. Set the Active Subscription

```powershell
# List all subscriptions
az account list --output table

# Set the active subscription (use your actual Subscription ID or Name)
az account set --subscription "Azure subscription 1"

# Verify
az account show --output table
```

### 3.3. Register Required Resource Providers

Azure requires explicit registration of resource providers before you can use certain services:

```powershell
# Container Apps
az provider register --namespace Microsoft.App --wait

# Container Registry
az provider register --namespace Microsoft.ContainerRegistry --wait

# Storage (Blob)
az provider register --namespace Microsoft.Storage --wait

# Managed Identity
az provider register --namespace Microsoft.ManagedIdentity --wait

# Verify all are "Registered"
az provider show --namespace Microsoft.App --query "registrationState" --output tsv
az provider show --namespace Microsoft.ContainerRegistry --query "registrationState" --output tsv
az provider show --namespace Microsoft.Storage --query "registrationState" --output tsv
```

> **Note:** Provider registration can take 1-5 minutes. The `--wait` flag blocks until it completes. If a provider is already registered, this is a no-op.

---

## 4. Create a Resource Group

All Brief2Reel resources go into one resource group, making teardown trivial (delete the group and everything inside is deleted).

```powershell
# Choose a region that supports Container Apps GPU
# As of Sept 2026, GPU support is available in:
#   - australiaeast, eastus2, northcentralus, swedencentral, westus3
# Pick the one closest to you:

$REGION = "eastus2"
$RESOURCE_GROUP = "breif2reel-rg"

az group create --name $RESOURCE_GROUP --location $REGION
```

Expected output:
```json
{
  "id": "/subscriptions/.../resourceGroups/breif2reel-rg",
  "location": "eastus2",
  "name": "breif2reel-rg",
  "properties": { "provisioningState": "Succeeded" }
}
```

> **Tip:** Region choice matters. GPU workload profiles are only available in specific regions. If quota requests are denied in one region, try another from the list above.

---

## 5. Request GPU Quota (CRITICAL — Do This First!)

> **CAUTION: This is the single biggest bottleneck.** Azure Container Apps GPU access is NOT self-serve. You must submit a support ticket and wait for approval. This can take **1-5 business days**. Submit this request immediately — do NOT wait until after writing code.

### 5.1. Submit the GPU Quota Request via Portal

1. Go to **portal.azure.com**.
2. In the top search bar, type **"Quotas"** → click **"Quotas"** (under "Azure services").
3. Select **"Microsoft.App"** (Container Apps) from the provider list.
4. Look for a GPU-related quota entry:
   - `Consumption GPU NC8as T4 cores per Subscription` (for T4)
   - `Consumption GPU NC24ads A100 cores per Subscription` (for A100)
5. If you see the quota, click the **pencil icon** → request an increase.
6. If you don't see a specific entry, click **"New Support Request"** at the top.

### 5.2. If Submitting via Support Request

Fill in:
- **Issue type:** Service and subscription limits (quotas)
- **Subscription:** Your free trial subscription
- **Quota type:** Azure Container Apps
- **Severity:** C - Minimal impact (keeps it polite)
- **Problem details / Description:**

```text
Subject: Request GPU quota for Azure Container Apps Consumption Workload Profile

I am a B.Tech CSE student working on a final-year project (Brief2Reel) that
requires serverless GPU inference for short-form video generation using
open-source text-to-video models (LTX-Video).

Request:
  - Service: Azure Container Apps
  - Quota: Consumption GPU workload profile
  - Primary GPU Type: NVIDIA A100 (Consumption-GPU-NC24ads-A100)
  - Secondary GPU Type: NVIDIA T4 (Consumption-GPU-NC8as-T4)
  - Region: East US 2 (or your chosen region)
  - Requested replicas: 1 (scale to zero when idle)

The project runs on the $200 Azure Free Trial credit with a hard safety stop at $190.
Workloads scale to zero when idle and generate only ~60 short video clips (10s each).
Expected GPU cost: $15-$25 total.

Thank you for your consideration.
```

### 5.3. Alternative: Submit via CLI

```powershell
az support tickets create `
  --ticket-name "breif2reel-gpu-quota" `
  --title "Container Apps GPU Quota - A100 for Student Project" `
  --description "Requesting Consumption-GPU-NC24ads-A100 (or NC8as-T4) workload profile quota for Azure Container Apps in eastus2. Student project using $200 free trial credit for text-to-video inference (~60 clips). Workloads scale to zero when idle." `
  --problem-classification "/providers/Microsoft.Support/services/CONTAINER_APPS/problemClassifications/QUOTA" `
  --severity "minimal" `
  --contact-first-name "YOUR_FIRST_NAME" `
  --contact-last-name "YOUR_LAST_NAME" `
  --contact-method "email" `
  --contact-email "YOUR_EMAIL" `
  --contact-timezone "Asia/Kolkata" `
  --contact-language "en-us" `
  --contact-country "IN"
```

> **IMPORTANT:** While waiting for GPU approval (1-5 days), continue with Steps 6-7. Blob Storage and Container Registry don't need GPU quota. You can also continue developing locally using the local motion engine fallback.

### 5.4. Check Quota Approval Status

```powershell
# Check your support tickets
az support tickets list --output table

# Or check quota directly
az containerapp env workload-profile list-supported `
  --location $REGION `
  --output table
```

You can also check in the Portal:
- **Help + support** → **Support requests** → look for your ticket status.

---

## 6. Create Azure Blob Storage (Video Artifacts)

This is where generated video files (.mp4) are stored after GPU inference.

### 6.1. Create a Storage Account

```powershell
# Storage account name must be globally unique, lowercase, 3-24 chars, no hyphens
$STORAGE_ACCOUNT = "breif2reelvideos"  # Change if taken

az storage account create `
  --name $STORAGE_ACCOUNT `
  --resource-group $RESOURCE_GROUP `
  --location $REGION `
  --sku Standard_LRS `
  --kind StorageV2 `
  --access-tier Hot `
  --min-tls-version TLS1_2
```

> **Note:** **Standard_LRS** (Locally Redundant Storage) is the cheapest option. Perfect for a student project — no need for geo-redundancy on generated videos.

### 6.2. Create the Blob Container

```powershell
az storage container create `
  --name "generated-videos" `
  --account-name $STORAGE_ACCOUNT `
  --public-access off
```

### 6.3. Get the Connection String

```powershell
# This is the value that goes in your .env file
az storage account show-connection-string `
  --name $STORAGE_ACCOUNT `
  --resource-group $RESOURCE_GROUP `
  --query "connectionString" `
  --output tsv
```

**Save this output!** It looks like:
```
DefaultEndpointsProtocol=https;AccountName=breif2reelvideos;AccountKey=aBcD1234...==;EndpointSuffix=core.windows.net
```

> **CAUTION: Never commit this connection string to Git.** It grants full access to your storage account. Add it only to your `.env` file (which should be in `.gitignore`).

### 6.4. Get the Blob Endpoint URL

```powershell
az storage account show `
  --name $STORAGE_ACCOUNT `
  --resource-group $RESOURCE_GROUP `
  --query "primaryEndpoints.blob" `
  --output tsv
```

Output: `https://breif2reelvideos.blob.core.windows.net/`

### 6.5. Verify Blob Storage Works

```powershell
# Upload a test file
echo "test" > test.txt
az storage blob upload `
  --account-name $STORAGE_ACCOUNT `
  --container-name "generated-videos" `
  --file test.txt `
  --name "test.txt" `
  --overwrite

# List blobs to confirm
az storage blob list `
  --account-name $STORAGE_ACCOUNT `
  --container-name "generated-videos" `
  --output table

# Clean up test file
az storage blob delete `
  --account-name $STORAGE_ACCOUNT `
  --container-name "generated-videos" `
  --name "test.txt"

Remove-Item test.txt
```

---

## 7. Create Azure Container Registry (Docker Images)

Your video inference container image needs to be stored somewhere Azure Container Apps can pull it from.

### 7.1. Create the Registry

```powershell
# Registry name must be globally unique, alphanumeric, 5-50 chars
$ACR_NAME = "breif2reelacr"  # Change if taken

az acr create `
  --name $ACR_NAME `
  --resource-group $RESOURCE_GROUP `
  --location $REGION `
  --sku Basic `
  --admin-enabled true
```

> **Note:** **Basic SKU** costs ~$0.167/day (~$5/month). This is the cheapest option and sufficient for this project.

### 7.2. Get Registry Credentials

```powershell
# Login server URL (you'll need this for docker push and Container Apps config)
az acr show --name $ACR_NAME --query "loginServer" --output tsv
# Output: breif2reelacr.azurecr.io

# Admin username (same as registry name)
az acr credential show --name $ACR_NAME --query "username" --output tsv
# Output: breif2reelacr

# Admin password
az acr credential show --name $ACR_NAME --query "passwords[0].value" --output tsv
# Output: aBcD1234... (save this!)
```

### 7.3. Log In to the Registry

```powershell
az acr login --name $ACR_NAME
```

---

## 8. Create the Container Apps Environment with GPU

> **WARNING:** You need GPU quota approval from Step 5 before this step will work. If your quota hasn't been approved yet, skip to Step 11 (budget alerts) and Step 12 (partial .env setup) — you can return here once approved.

### 8.1. Install/Update Container Apps Extension

```powershell
az extension add --name containerapp --upgrade
```

### 8.2. Create a Log Analytics Workspace (Required)

```powershell
$LOG_WORKSPACE = "breif2reel-logs"

az monitor log-analytics workspace create `
  --resource-group $RESOURCE_GROUP `
  --workspace-name $LOG_WORKSPACE `
  --location $REGION

# Get the workspace ID and key (needed for environment creation)
$LOG_ID = az monitor log-analytics workspace show `
  --resource-group $RESOURCE_GROUP `
  --workspace-name $LOG_WORKSPACE `
  --query "customerId" `
  --output tsv

$LOG_KEY = az monitor log-analytics workspace get-shared-keys `
  --resource-group $RESOURCE_GROUP `
  --workspace-name $LOG_WORKSPACE `
  --query "primarySharedKey" `
  --output tsv
```

### 8.3. Create the Container Apps Environment

```powershell
$CONTAINER_ENV = "breif2reel-env"

az containerapp env create `
  --name $CONTAINER_ENV `
  --resource-group $RESOURCE_GROUP `
  --location $REGION `
  --logs-workspace-id $LOG_ID `
  --logs-workspace-key $LOG_KEY `
  --enable-workload-profiles
```

### 8.4. Add the GPU Workload Profile

```powershell
# A100 GPU profile (primary — fast ~2.5–3 min inference, 80GB VRAM, no CPU offload)
az containerapp env workload-profile add `
  --name $CONTAINER_ENV `
  --resource-group $RESOURCE_GROUP `
  --workload-profile-name "gpu-a100" `
  --workload-profile-type "Consumption-GPU-NC24-A100" `
  --min-nodes 0 `
  --max-nodes 1

# T4 GPU profile (fallback — cheaper, slower, requires FP8 quantization)
az containerapp env workload-profile add `
  --name $CONTAINER_ENV `
  --resource-group $RESOURCE_GROUP `
  --workload-profile-name "gpu-t4" `
  --workload-profile-type "Consumption-GPU-NC8as-T4" `
  --min-nodes 0 `
  --max-nodes 1
```

> **Note:** `--min-nodes 0` ensures **scale-to-zero** — you won't be billed for GPU time when no inference jobs are running. `--max-nodes 1` limits to one GPU replica to prevent accidental cost spikes.

### 8.5. Verify Environment

```powershell
az containerapp env workload-profile list `
  --name $CONTAINER_ENV `
  --resource-group $RESOURCE_GROUP `
  --output table
```

Expected output should show your GPU profile with `min=0, max=1`.

---

## 9. Build & Push the Video Inference Container

> **Note:** This step assumes you have a Dockerfile for the video inference service. If you haven't built one yet, the project's `hf_space_files/app.py` is a starting point — it runs Wan 2.1 T2V 1.3B. You'll need to adapt it from a Gradio app to a Flask/FastAPI HTTP service that exposes `POST /generate` and `GET /generate/{job_id}` endpoints (matching the API contract in `06_API_Contract.md`).

### 9.1. Build and Push Using ACR Tasks (No Local Docker Needed)

```powershell
# From your project root, assuming Dockerfile is at backend/hf_space_files/Dockerfile
# ACR Tasks builds the image in the cloud — no local Docker Desktop required

az acr build `
  --registry $ACR_NAME `
  --image "breif2reel-video:v1" `
  --file backend/hf_space_files/Dockerfile `
  backend/hf_space_files/
```

### 9.2. Alternative: Build Locally and Push

If you have Docker Desktop installed:

```powershell
$ACR_LOGIN_SERVER = az acr show --name $ACR_NAME --query "loginServer" --output tsv

# Build locally
docker build -t "${ACR_LOGIN_SERVER}/breif2reel-video:v1" backend/hf_space_files/

# Push to ACR
docker push "${ACR_LOGIN_SERVER}/breif2reel-video:v1"
```

### 9.3. Verify the Image

```powershell
az acr repository list --name $ACR_NAME --output table
az acr repository show-tags --name $ACR_NAME --repository "breif2reel-video" --output table
```

---

## 10. Deploy the Video Inference Container App

### 10.1. Get Storage Connection String for Secrets

```powershell
$STORAGE_CONN_STR = az storage account show-connection-string `
  --name $STORAGE_ACCOUNT `
  --resource-group $RESOURCE_GROUP `
  --query "connectionString" `
  --output tsv
```

### 10.2. Create a Strong API Key for the Inference Service

```powershell
# Generate a random API key
$VIDEO_API_KEY = [System.Guid]::NewGuid().ToString() + "-" + [System.Guid]::NewGuid().ToString()
Write-Host "VIDEO_INFERENCE_API_KEY=$VIDEO_API_KEY"
# SAVE THIS VALUE — you'll need it for your backend .env
```

### 10.3. Deploy the Container App

```powershell
$ACR_LOGIN_SERVER = az acr show --name $ACR_NAME --query "loginServer" --output tsv
$ACR_PASSWORD = az acr credential show --name $ACR_NAME --query "passwords[0].value" --output tsv

az containerapp create `
  --name "breif2reel-video-svc" `
  --resource-group $RESOURCE_GROUP `
  --environment $CONTAINER_ENV `
  --workload-profile-name "gpu-a100" `
  --image "${ACR_LOGIN_SERVER}/breif2reel-video:v1" `
  --registry-server $ACR_LOGIN_SERVER `
  --registry-username $ACR_NAME `
  --registry-password $ACR_PASSWORD `
  --cpu 4 `
  --memory "16Gi" `
  --min-replicas 0 `
  --max-replicas 1 `
  --ingress external `
  --target-port 8080 `
  --transport http `
  --secrets `
    "storage-conn=$STORAGE_CONN_STR" `
    "api-key=$VIDEO_API_KEY" `
  --env-vars `
    "AZURE_STORAGE_CONNECTION_STRING=secretref:storage-conn" `
    "AZURE_STORAGE_CONTAINER=generated-videos" `
    "API_KEY=secretref:api-key" `
    "MODEL_NAME=Lightricks/LTX-Video"
```

> **Key settings explained:**
> - `--min-replicas 0` → **Scale to zero** (no cost when idle)
> - `--max-replicas 1` → Only 1 GPU instance at a time (cost control)
> - `--workload-profile-name "gpu-a100"` → A100 GPU profile for ~2.5–3 min generation
> - `--ingress external` → Makes the service accessible via HTTPS URL
> - `--target-port 8080` → Your inference service's listening port

### 10.4. Get the Service URL

```powershell
$VIDEO_SERVICE_URL = az containerapp show `
  --name "breif2reel-video-svc" `
  --resource-group $RESOURCE_GROUP `
  --query "properties.configuration.ingress.fqdn" `
  --output tsv

Write-Host "VIDEO_INFERENCE_URL=https://$VIDEO_SERVICE_URL"
```

Output example: `https://breif2reel-video-svc.niceforest-abc12345.eastus2.azurecontainerapps.io`

### 10.5. Verify Deployment

```powershell
# Check container app status
az containerapp show `
  --name "breif2reel-video-svc" `
  --resource-group $RESOURCE_GROUP `
  --query "{status: properties.runningStatus, url: properties.configuration.ingress.fqdn}" `
  --output table

# Check logs (useful for debugging startup issues)
az containerapp logs show `
  --name "breif2reel-video-svc" `
  --resource-group $RESOURCE_GROUP `
  --follow
```

---

## 11. Set Up Budget Alerts

> **IMPORTANT: Do this immediately after account creation** — even before GPU deployment. A misconfigured container can burn through $200 in hours.

### 11.1. Create a Budget via Portal (Easier)

1. Go to **portal.azure.com** → Search **"Cost Management + Billing"**.
2. In the left sidebar, click **"Budgets"**.
3. Click **"+ Add"**.
4. Fill in:
   - **Name:** `breif2reel-monthly`
   - **Reset period:** Monthly
   - **Amount:** `190` (hard stop at $190 of the $200 free credit, preserving $10 safety buffer)
   - **Expiration date:** End of current cycle
5. Click **"Next"** → Set alert conditions:
   - **Alert 1 (Info):** At **50%** of budget (₹9,050.00) — email notification
   - **Alert 2 (Advisory):** At **75%** of budget (₹13,575.00) — email notification
   - **Alert 3 (CRITICAL SHUTDOWN GATE):** At **90%** of budget (₹16,290.00) — email notification + automated emergency scale-down / stop all active resources
6. Enter `hardena@rknec.edu` under **"Alert recipients (email)"**.
7. Click **"Create"**.

### 11.2. Create a Budget via CLI (Modern REST API)

Due to preview bugs in `az consumption budget create` with modern Azure accounts, use `az rest` targeting the stable `2023-11-01` API:

```powershell
$SUB_ID = (az account show --query "id" -o tsv).Trim()

$budgetPayload = @"
{
  "properties": {
    "category": "Cost",
    "amount": 18100,
    "timeGrain": "Monthly",
    "timePeriod": {
      "startDate": "2026-10-01T00:00:00Z",
      "endDate": "2027-10-01T00:00:00Z"
    }
  }
}
"@

$tempJson = "$env:TEMP\azure_budget.json"
Set-Content -Path $tempJson -Value $budgetPayload

az rest --method put `
  --url "https://management.azure.com/subscriptions/$SUB_ID/providers/Microsoft.Consumption/budgets/breif2reel-inr-budget?api-version=2023-11-01" `
  --body "@$tempJson"
```

> **Note:** Azure free trial accounts have a built-in hard cap at $200 — you cannot be charged beyond your credit. Setting your budget ceiling to **$190** guarantees you receive critical warnings and trigger scale-down before the trial runs out mid-generation.

---

## 12. Connect Azure to the Brief2Reel Backend

Now update your project's `.env` file with all the Azure values you've collected.

### 12.1. Update `backend/.env`

Open `backend/.env` and update the video-related variables:

```ini
# -- Video Inference Service (Azure Container Apps GPU) --
VIDEO_PROVIDER=inference_service
VIDEO_INFERENCE_URL=https://breif2reel-video-svc.niceforest-abc12345.eastus2.azurecontainerapps.io
VIDEO_INFERENCE_API_KEY=<the-api-key-from-step-10.2>
VIDEO_MODEL=Lightricks/LTX-Video
VIDEO_GPU_PROFILE=Consumption-GPU-NC24ads-A100
VIDEO_WIDTH=720
VIDEO_HEIGHT=1280
VIDEO_FPS=24
VIDEO_DURATION_SECONDS=10
VIDEO_NUM_FRAMES=241
VIDEO_NUM_STEPS=35
VIDEO_REQUEST_TIMEOUT_SECONDS=900

# -- Azure Blob Storage (Video Artifacts) --
VIDEO_STORAGE_PROVIDER=azure_blob
VIDEO_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=breif2reelvideos;AccountKey=<your-key>;EndpointSuffix=core.windows.net
VIDEO_STORAGE_CONTAINER=generated-videos
```

### 12.2. Values Checklist

| `.env` Variable | Where to Get It | Step Reference |
|---|---|---|
| `VIDEO_INFERENCE_URL` | Container App FQDN | Step 10.4 |
| `VIDEO_INFERENCE_API_KEY` | Generated in Step 10.2 | Step 10.2 |
| `VIDEO_MODEL` | Your chosen model | Step 10.3 (env var) |
| `VIDEO_GPU_PROFILE` | T4 or A100 profile name | Step 8.4 |
| `VIDEO_STORAGE_CONNECTION_STRING` | Storage account connection string | Step 6.3 |
| `VIDEO_STORAGE_CONTAINER` | Blob container name | Step 6.2 (`generated-videos`) |

### 12.3. How the Video Agent Uses These Values

The video agent (`backend/app/agents/video_agent.py`) reads these from `backend/app/core/config.py`:

```
VIDEO_PROVIDER=inference_service  ->  Uses _generate_with_inference_service()
                                      Sends POST to VIDEO_INFERENCE_URL/generate
                                      Falls back to local motion engine on failure
```

**When you rotate Azure accounts**, only `VIDEO_INFERENCE_URL`, `VIDEO_INFERENCE_API_KEY`, and `VIDEO_STORAGE_CONNECTION_STRING` need to change. No code changes required.

---

## 13. Test the Connection

### 13.1. Test Blob Storage (Python)

```python
# Run from the backend directory with your .env loaded
from azure.storage.blob import BlobServiceClient
import os

conn_str = os.getenv("VIDEO_STORAGE_CONNECTION_STRING")
container = os.getenv("VIDEO_STORAGE_CONTAINER", "generated-videos")

blob_service = BlobServiceClient.from_connection_string(conn_str)
container_client = blob_service.get_container_client(container)

# Upload a test blob
container_client.upload_blob("test.txt", b"hello from breif2reel", overwrite=True)
print("Blob upload succeeded")

# List blobs
blobs = list(container_client.list_blobs())
print(f"Found {len(blobs)} blob(s): {[b.name for b in blobs]}")

# Clean up
container_client.delete_blob("test.txt")
print("Test blob deleted")
```

### 13.2. Test Video Inference Service (Health Check)

```powershell
# Replace with your actual URL from Step 10.4
$VIDEO_URL = "https://breif2reel-video-svc.niceforest-abc12345.eastus2.azurecontainerapps.io"

# Health check (if your service implements GET /health)
Invoke-RestMethod -Uri "$VIDEO_URL/health" -Method GET

# Test generation (WARNING: this will consume GPU credit!)
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer <your-api-key>"
}

$body = @{
    idempotency_key = "test-001"
    prompt = "A simple red cube rotating on a white background"
    width = 720
    height = 1280
    fps = 24
    num_frames = 81
    duration_seconds = 5
    num_steps = 15
} | ConvertTo-Json

# Submit generation
Invoke-RestMethod -Uri "$VIDEO_URL/generate" -Method POST -Headers $headers -Body $body
```

### 13.3. Test from the Brief2Reel Backend

```powershell
# Start the backend
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# In another terminal, create a campaign and trigger generation
# (This will attempt to use the Azure inference service)
```

> **Note: Cold start warning.** The first request after a scale-to-zero period will be slow (1-5 minutes) because Azure needs to provision the GPU and load the model into VRAM. Subsequent requests will be faster while the container is warm.

---

## 14. Monitor Usage and Costs

### 14.1. Check Current Credit Balance

**Portal:**
1. Go to **portal.azure.com** → **Cost Management + Billing**.
2. Click **"Azure credits"** in the left sidebar.
3. View remaining balance and days left.

### 14.2. Check Cost Breakdown by Service

```powershell
# View costs for your resource group
az cost query --type ActualCost `
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" `
  --timeframe MonthToDate `
  --output table
```

**Portal (more visual):**
1. **Cost Management + Billing** → **Cost analysis**.
2. Filter by resource group: `breif2reel-rg`.
3. Group by **Service name** to see which services are consuming credit.

### 14.3. Check GPU Usage Specifically

```powershell
# Container App metrics (CPU/memory/replica count)
az containerapp show `
  --name "breif2reel-video-svc" `
  --resource-group $RESOURCE_GROUP `
  --query "properties.runningStatus"

# Check if any replicas are currently running (costing money)
az containerapp revision list `
  --name "breif2reel-video-svc" `
  --resource-group $RESOURCE_GROUP `
  --output table
```

### 14.4. Expected Costs Breakdown

| Service | Estimated Cost | Notes |
|---|---|---|
| **Container Apps GPU (A100)** | $15-$25 total | Primary (~$1.90/hr, ~$0.08/clip for ~60 clips, scales to zero) |
| **Container Apps GPU (T4)** | $10-$20 total | Quota fallback (requires FP8 quantization) |
| **Blob Storage** | < $1 total | A few GB of video files |
| **Container Registry (Basic)** | ~$5/month | Stores your Docker image |
| **Log Analytics** | < $1 total | Minimal log volume |
| **Total expected** | **$20-$30** | Well within the $190 safety cap of the $200 trial |

### 14.5. Emergency Cost Stop

If you notice costs spiking unexpectedly:

```powershell
# Immediately scale the container app to 0 replicas
az containerapp update `
  --name "breif2reel-video-svc" `
  --resource-group $RESOURCE_GROUP `
  --max-replicas 0

# Nuclear option: delete the entire resource group
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

---

## 15. Monthly Teardown & Recreation

When your $200 credit expires (or you want to start fresh with a new account):

### 15.1. Export What You Need

Before deleting anything, save:

```powershell
# 1. Download all generated videos from Blob Storage
az storage blob download-batch `
  --destination ./exported_videos `
  --source "generated-videos" `
  --account-name $STORAGE_ACCOUNT

# 2. Save your Docker image tag/Dockerfile (already in Git, no action needed)

# 3. Note your current .env values for reference
```

### 15.2. Delete Everything in the Old Account

```powershell
# This single command deletes ALL resources in the group:
# Storage account, Container Registry, Container Apps, Log Analytics — everything
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

Optionally, cancel the old Azure subscription:
1. **portal.azure.com** → **Subscriptions** → select your subscription.
2. Click **"Cancel subscription"** → follow the prompts.

### 15.3. Create a New Azure Account

1. Sign out of Azure: **portal.azure.com** → click your avatar → **Sign out**.
2. Create a new Microsoft account (new email address).
3. Go back to Step 1 and repeat the entire guide.

### 15.4. Reconnect to the Project

After completing Steps 1-10 with the new account, update **only these 3 values** in `backend/.env`:

```ini
VIDEO_INFERENCE_URL=https://<new-container-app-url>
VIDEO_INFERENCE_API_KEY=<new-api-key>
VIDEO_STORAGE_CONNECTION_STRING=<new-storage-connection-string>
```

**No code changes. No config changes beyond .env. The video agent is designed for this.**

### 15.5. Monthly Rotation Checklist

- [ ] Export any videos you want to keep from old Blob Storage
- [ ] `az group delete --name breif2reel-rg --yes` on old account
- [ ] Create new Microsoft account + Azure free trial
- [ ] Run Steps 3-10 (takes ~30-45 minutes, excluding GPU quota wait)
- [ ] Submit GPU quota request immediately (Step 5)
- [ ] Set up budget alerts (Step 11)
- [ ] Update 3 values in `backend/.env` (Step 12)
- [ ] Run connection test (Step 13)

---

## 16. Troubleshooting

### GPU Quota Denied

**Problem:** Your GPU quota request was rejected.

**Solutions:**
1. **Try a different region** — resubmit the request for `westus3`, `northcentralus`, or `swedencentral`.
2. **Try A100 instead of T4** — sometimes the larger GPU has available quota when T4 doesn't.
3. **Wait and resubmit** — quota approvals depend on regional capacity. Try again in a few days.
4. **Use the HuggingFace Space fallback** — Set `VIDEO_PROVIDER=legacy` and configure `HF_SPACE_ID` in `.env` to use the free ZeroGPU path while waiting.

### Container App Won't Start

**Problem:** Container shows "Failed" or "ContainerBackOff" status.

**Debug:**
```powershell
# Check logs
az containerapp logs show `
  --name "breif2reel-video-svc" `
  --resource-group $RESOURCE_GROUP `
  --tail 100

# Check events
az containerapp revision list `
  --name "breif2reel-video-svc" `
  --resource-group $RESOURCE_GROUP `
  --output table
```

**Common causes:**
- Docker image too large (model not downloading) → Pre-bake the model into the image.
- OOM (Out of Memory) → Reduce `num_frames` or `num_steps`.
- Wrong port → Ensure `--target-port` matches the port your app listens on.

### Blob Storage Connection Refused

**Problem:** `azure.core.exceptions.ClientAuthenticationError`

**Fix:** Regenerate the connection string:
```powershell
az storage account show-connection-string `
  --name $STORAGE_ACCOUNT `
  --resource-group $RESOURCE_GROUP `
  --query "connectionString" `
  --output tsv
```

### "Provider Microsoft.App Not Registered"

**Fix:**
```powershell
az provider register --namespace Microsoft.App --wait
```

### Cold Start Taking Too Long (More Than 5 Minutes)

**Causes:** Model download on first boot (can be 2-8 GB).

**Fix:** Bake the model weights into the Docker image instead of downloading at startup:
```dockerfile
# In your Dockerfile, add:
RUN python -c "from diffusers import WanPipeline; WanPipeline.from_pretrained('Wan-AI/Wan2.1-T2V-1.3B-Diffusers')"
```
This makes the image larger (~8-12 GB) but eliminates download time on cold start.

### Free Trial Credit Running Low

```powershell
# Check remaining credit
# Portal: Cost Management + Billing -> Azure credits

# Reduce costs immediately:
# 1. Scale container app to 0
az containerapp update --name "breif2reel-video-svc" -g $RESOURCE_GROUP --max-replicas 0

# 2. Delete container registry if you've already pushed your image
# (You can re-push from Git when needed)
az acr delete --name $ACR_NAME --yes
```

---

## 17. Quick Reference — All Values You Need

After completing this guide, you'll have collected these values. Keep them in a secure note:

```
AZURE SETUP VALUES FOR backend/.env
====================================

SUBSCRIPTION_ID       = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
RESOURCE_GROUP        = breif2reel-rg
REGION                = eastus2

-- Blob Storage --
STORAGE_ACCOUNT       = breif2reelvideos
STORAGE_CONN_STRING   = DefaultEndpointsProtocol=https;Account...
BLOB_CONTAINER        = generated-videos

-- Container Registry --
ACR_LOGIN_SERVER      = breif2reelacr.azurecr.io
ACR_USERNAME          = breif2reelacr
ACR_PASSWORD          = aBcD1234...

-- Container App (Video Service) --
VIDEO_INFERENCE_URL   = https://breif2reel-video-svc.xxx.azurecontainerapps.io
VIDEO_INFERENCE_KEY   = <generated-uuid-key>
GPU_PROFILE           = Consumption-GPU-NC24ads-A100

-- .env File (copy these 3 lines on monthly rotation) --
VIDEO_INFERENCE_URL=https://...
VIDEO_INFERENCE_API_KEY=...
VIDEO_STORAGE_CONNECTION_STRING=...
```

---

> **Time estimate for full setup:** ~45 minutes of active work + 1-5 business days waiting for GPU quota approval. After your first time through this guide, the monthly rotation should take ~30 minutes.
