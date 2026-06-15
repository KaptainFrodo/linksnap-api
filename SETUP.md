# LinkSnap API — Full Setup Guide

This covers everything needed before building the iOS Shortcut: getting the
code on GitHub, deploying it to Render, and setting up the keep-alive job.

---

## Part 1 — Create a GitHub repository

1. Go to **github.com** and sign in (or create a free account if you don't have one)
2. Click the **+** icon in the top right → **New repository**
3. Name it `linksnap-api`
4. Set it to **Public** (this keeps you comfortably within GitHub Actions' free minutes — public repos get unlimited Actions minutes)
5. Leave "Add a README" **unchecked** — we already have one
6. Click **Create repository**

---

## Part 2 — Upload the project to GitHub

You have two options — pick whichever feels easier.

### Option A — Upload via the website (no Git knowledge needed)

1. Unzip the `linksnap-api` folder on your computer
2. On your new GitHub repo page, click **uploading an existing file**
3. Drag in all the files and folders from the unzipped `linksnap-api` folder:
   - `server.js`
   - `package.json`
   - `package-lock.json`
   - `render.yaml`
   - `README.md`
   - `.gitignore`
   - the `.github` folder (drag the whole folder — GitHub will preserve the path)
4. Scroll down, click **Commit changes**

> **Note:** GitHub's drag-and-drop sometimes hides folders that start with a dot (like `.github`). If `.github/workflows/keep-alive.yml` doesn't appear after upload, use Option B instead, or create the file manually through GitHub's web interface: click **Add file → Create new file**, type `.github/workflows/keep-alive.yml` as the filename (the slashes will auto-create folders), and paste the contents in.

### Option B — Upload via Git (if you have Git installed)

Open a terminal in the unzipped `linksnap-api` folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/linksnap-api.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Part 3 — Deploy to Render

1. Go to **render.com** and sign up (you can sign up directly with your GitHub account — this also makes connecting repos easier)
2. Once logged in, click **New** (top right) → **Web Service**
3. Connect your GitHub account if prompted, then find and select the `linksnap-api` repo
4. Render should auto-detect the `render.yaml` file and pre-fill the settings:
   - **Name:** `linksnap-api` (or whatever you'd like)
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free
5. Click **Create Web Service**
6. Wait — the first deploy takes about 2-3 minutes. You'll see build logs streaming live
7. Once it says **"Live"** with a green dot, copy the URL shown at the top of the page — it'll look like:
   ```
   https://linksnap-api-xxxx.onrender.com
   ```
   **Save this URL** — you'll need it for both the keep-alive setup and the iOS Shortcut

---

## Part 4 — Test the deployed API

Before moving on, confirm it actually works:

1. Open your Render URL in a browser (e.g. `https://linksnap-api-xxxx.onrender.com`)
2. You should see:
   ```json
   {"status":"ok","service":"LinkSnap API","version":"1.0.0"}
   ```

If you see this, the API is live and working.

(Optional deeper test — if you're comfortable with a terminal, you can test the actual decode endpoint:
```bash
curl -X POST https://linksnap-api-xxxx.onrender.com/decode -F "image=@/path/to/a/qr/image.png"
```
This should return JSON with the decoded URL.)

---

## Part 5 — Set up the keep-alive job

This stops the free server from "sleeping" and causing slow first-requests.

1. On your GitHub repo page, click **Settings** (top menu of the repo, not your account settings)
2. In the left sidebar, click **Secrets and variables** → **Actions**
3. Click the **Variables** tab (not "Secrets")
4. Click **New repository variable**
5. Fill in:
   - **Name:** `LINKSNAP_API_URL`
   - **Value:** your Render URL from Part 3, e.g. `https://linksnap-api-xxxx.onrender.com`
6. Click **Add variable**

### Verify it's working

1. Go to the **Actions** tab on your repo
2. You should see a workflow called **"Keep LinkSnap API Awake"**
3. Click on it, then click **Run workflow** (dropdown button) → **Run workflow** — this triggers it manually right away
4. After ~10-20 seconds, refresh — you should see a green checkmark ✅
5. Click into the run and check the log — it should say `✅ API is awake`

From now on, this runs automatically every 10 minutes in the background. No further action needed.

---

## Part 6 — What you should have now

By this point you have:

- ✅ A live API at `https://linksnap-api-xxxx.onrender.com`
- ✅ A `/decode` endpoint that accepts an image and returns a decoded QR URL
- ✅ An automatic keep-alive job so the API stays fast and responsive
- ✅ The URL saved somewhere handy for the next step

---

## Next: Building the iOS Shortcut

With the API live and warm, the next step is building the Shortcut itself —
the thing you'll trigger from Control Center or the Action Button. It will:

1. Take a screenshot silently
2. Upload it to your `/decode` endpoint (with a short timeout)
3. If that succeeds → open the returned link
4. If it times out or fails → fall back to Shortcuts' built-in on-device QR detection
5. Clean up the screenshot either way

Let me know once you've got your Render URL working and we'll build that shortcut next.
