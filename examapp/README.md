# ExamPrep CBT — Netlify Deployment Guide

## Deploy in 3 steps

### Step 1 — Get free Gemini API key
1. Go to https://aistudio.google.com/app/apikey
2. Sign in with Google
3. Click **"Create API Key"**
4. Copy the key (starts with `AIzaSy...`)

### Step 2 — Deploy to Netlify
1. Go to https://netlify.com → Log in
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect GitHub and push this folder, OR drag-drop the zip
4. Build settings (auto-detected from netlify.toml):
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click **Deploy**

### Step 3 — Add API Key
1. In Netlify → your site → **Site Settings → Environment Variables**
2. Click **"Add variable"**
3. Key: `GEMINI_API_KEY`  Value: your key from Step 1
4. Click **Save** → then **Trigger deploy** to redeploy

**Done! Your app is live.**

---

## Custom AI Prompt (optional)
Add env variable `GEMINI_AI_PROMPT` to override the default extraction prompt.
Leave blank to use the built-in smart prompt.

## User API Keys
Users can add their own Gemini key in the app → Settings → API Key.
This gives them unlimited extractions independent of your shared key.

## Free Tier Limits
- **Netlify**: Unlimited sites, 100GB bandwidth/month, 125k function calls/month
- **Gemini**: 1,500 requests/day, 15 requests/minute (free, no credit card)
