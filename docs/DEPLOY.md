# HelixCRM — Netlify Deployment Guide
## GitHub → Netlify Auto-Deploy

Every push to `main` will trigger a new deployment automatically once this is set up.

---

## Step 1 — Push to GitHub

If you haven't already created a GitHub repo:

```bash
cd helixcrm   # your project folder
git init
git add .
git commit -m "Initial commit"
```

Then on GitHub.com → **New repository** → name it `helixcrm` → copy the remote URL, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/helixcrm.git
git branch -M main
git push -u origin main
```

If you already have a repo, just make sure `netlify.toml` and `.nvmrc` are committed and pushed.

---

## Step 2 — Connect to Netlify

1. Go to [netlify.com](https://netlify.com) → **Log in** → **Add new site** → **Import an existing project**
2. Choose **GitHub** → authorise Netlify to access your account
3. Search for and select your `helixcrm` repository
4. Netlify will detect `netlify.toml` automatically. Confirm these settings:
   - **Branch to deploy**: `main`
   - **Build command**: `npm run build`
   - **Publish directory**: `build`
5. **Do not click Deploy yet** — set environment variables first (Step 3)

---

## Step 3 — Set Environment Variables in Netlify

In the same setup screen → **Advanced** → **Add variable**, add both:

| Key | Value |
|-----|-------|
| `REACT_APP_SUPABASE_URL` | `https://xxxxxxxxxxxx.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | `eyJ...` (your anon/public key) |

Find these values in: Supabase → your project → **Settings** → **API**

> ⚠️ Never commit `.env` to GitHub. These must be set here in Netlify.

Now click **Deploy site**.

---

## Step 4 — Update Supabase Allowed URLs

Once Netlify assigns your site a URL (e.g. `https://helixcrm.netlify.app`), update Supabase:

1. Supabase → your project → **Authentication** → **URL Configuration**
2. Set **Site URL** to: `https://helixcrm.netlify.app`
3. Under **Redirect URLs**, add: `https://helixcrm.netlify.app/**`
4. Save

> If you set up a custom domain later, add that URL here too.

---

## Step 5 — (Optional) Custom Domain

In Netlify → your site → **Domain management** → **Add custom domain**

Enter your domain (e.g. `helixcrm.yourcompany.com`), then follow Netlify's DNS instructions. Once live, go back to Step 4 and add the custom domain to Supabase's redirect URLs.

---

## How Auto-Deploy Works After Setup

```
You push to GitHub main branch
        ↓
Netlify detects the push (webhook)
        ↓
Netlify runs: npm run build
        ↓
Builds output to /build folder
        ↓
Deploys to CDN — live in ~60 seconds
```

You can monitor build logs in Netlify → your site → **Deploys**.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Page refresh gives 404 | Confirm `netlify.toml` redirect rule is present and committed |
| Blank screen / auth not working | Check env vars are set correctly in Netlify — no quotes around values |
| Build fails with Node error | Confirm `.nvmrc` contains `20` and is committed |
| Login works but data doesn't load | Check Supabase Site URL and Redirect URLs match your Netlify domain exactly |
| "Missing Supabase env vars" error in build log | Both `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` must be set in Netlify |
