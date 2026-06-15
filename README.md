# LinkSnap API

A tiny backend that decodes QR codes from uploaded images using ZBar (the same
decoder used in the LinkSnap browser extension, Windows app, and PWA).

## Endpoint

**POST /decode**
- Body: `multipart/form-data` with field name `image`
- Response:
  ```json
  {
    "success": true,
    "data": "https://example.com",
    "isUrl": true,
    "url": "https://example.com"
  }
  ```
  or, if nothing found:
  ```json
  { "success": false, "error": "No QR code found in image." }
  ```

**GET /** — health check, returns `{"status":"ok", ...}`

## Run locally

```bash
npm install
node server.js
```

Server runs on port 3000 by default (set `PORT` env var to change).

Test it:
```bash
curl -X POST http://localhost:3000/decode -F "image=@/path/to/qr.png"
```

## Deploy to Render.com (free)

1. Push this folder to a GitHub repo
2. Go to https://render.com → New → Web Service
3. Connect your repo
4. Render will detect `render.yaml` automatically and use these settings:
   - Build command: `npm install`
   - Start command: `node server.js`
   - Plan: Free
5. Click "Create Web Service"
6. Wait ~2 minutes for the first deploy
7. Your API will be live at `https://linksnap-api-XXXX.onrender.com`

**Note on the free tier:** Render's free web services spin down after 15
minutes of inactivity and take ~30-60 seconds to wake up on the next
request. This is fine for occasional use (like an iOS Shortcut) but means
the first request after a while will be slow. If this matters, Render's
paid tier ($7/mo) keeps it always-on.

## Deploy to Fly.io (alternative, free tier available)

```bash
fly launch
fly deploy
```

Fly.io's free tier doesn't spin down as aggressively, but requires a
credit card on file even for free usage.

## Using with the iOS Shortcut

Once deployed, copy your service URL (e.g. `https://linksnap-api-xxxx.onrender.com`)
— this is the URL the LinkSnap iOS Shortcut will upload screenshots to.

## Keeping the API awake (recommended)

This repo includes a GitHub Actions workflow (`.github/workflows/keep-alive.yml`)
that pings your API every 10 minutes — just under Render's 15-minute sleep
threshold — so it never goes cold. This means your iOS Shortcut will
(almost) always get the fast, accurate ZBar decode instead of falling
back to on-device detection.

**Setup (2 minutes):**

1. After deploying to Render and getting your URL, go to your GitHub repo
2. Go to **Settings → Secrets and variables → Actions → Variables tab**
3. Click **New repository variable**
   - Name: `LINKSNAP_API_URL`
   - Value: `https://linksnap-api-xxxx.onrender.com` (your actual URL)
4. Save

That's it — the workflow starts running automatically on its schedule.
You can check it's working under the **Actions** tab in your repo; you
should see a green checkmark every ~10 minutes.

**To test it immediately** without waiting: go to the **Actions** tab →
click "Keep LinkSnap API Awake" → click **Run workflow** → Run workflow.

### Free tier limits to know about

GitHub Actions free tier gives you 2,000 minutes/month for private repos
(unlimited for public repos). Each ping takes a few seconds, running every
10 minutes is roughly 4,300 runs/month at a few seconds each — comfortably
within free limits, especially if your repo is public.

