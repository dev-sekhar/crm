# HubClone CRM — Supabase Setup Guide

A full HubSpot-style CRM with a real PostgreSQL database hosted on Supabase.

---

## 🚀 Setup in 5 Steps

### Step 1 — Create a Supabase Project (free)

1. Go to **https://supabase.com** → Sign up / Log in
2. Click **"New Project"**
3. Choose a name (e.g. `hubclone`) and a strong database password
4. Pick a region close to you → **Create Project**
5. Wait ~1 minute for the project to spin up

---

### Step 2 — Run the Database Schema

1. In the Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open the file `supabase_schema.sql` from this project
4. Copy the entire contents and paste into the SQL editor
5. Click **"Run"** (or press Cmd/Ctrl+Enter)

This creates 3 tables (`contacts`, `deals`, `activities`) and seeds them with sample data.

---

### Step 3 — Get Your API Keys

1. In Supabase dashboard, go to **Settings → API** (or **Project Settings → API**)
2. Copy:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public key** — a long JWT string

---

### Step 4 — Add Your Keys to the App

Open `src/supabaseClient.js` and replace the two placeholder values:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co'   // ← your Project URL
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY'                   // ← your anon key
```

Save the file.

---

### Step 5 — Run the App

```bash
# Install dependencies
npm install

# Start dev server
npm start
```

Your browser will open at **http://localhost:3000** with a live CRM connected to your Supabase database.

---

## ✅ Features

| Feature | Details |
|---|---|
| **Real Database** | PostgreSQL hosted on Supabase (free tier: 500MB) |
| **Live Sync** | Supabase Realtime — changes appear instantly across tabs |
| **Contacts** | Full CRUD — create, view, edit, delete with detail panel |
| **Deals** | Pipeline tracking with probability, close date, value |
| **Pipeline** | Kanban view by stage |
| **Activities** | Log calls, emails, meetings, notes per contact |
| **Dashboard** | Live metrics — pipeline value, win rate, revenue won |
| **Search** | Filters contacts and deals in real time |

---

## 📁 File Structure

```
hubclone/
├── supabase_schema.sql     ← Run this in Supabase SQL Editor
├── package.json
├── public/
│   └── index.html
└── src/
    ├── index.js
    ├── supabaseClient.js   ← Add your Supabase URL + key here
    └── App.jsx             ← Full React app
```

---

## 🌐 Deploy to Production (optional)

To share your CRM publicly:

```bash
npm run build
```

Then deploy the `build/` folder to **Vercel**, **Netlify**, or any static host.

For Vercel (easiest):
```bash
npx vercel --prod
```

---

## 🔒 Add Authentication (optional)

Supabase has built-in Auth. To restrict access:

1. Enable auth in Supabase Dashboard → Authentication
2. Uncomment the Row Level Security policies in `supabase_schema.sql`
3. Add a login page using `supabase.auth.signInWithPassword()`

---

## Troubleshooting

**"Could not connect to Supabase"** → Double-check your URL and anon key in `supabaseClient.js`

**"permission denied for table contacts"** → In Supabase → Table Editor → contacts → RLS is enabled but no policies exist. Either disable RLS or add a policy (see schema file comments).

**Data not showing after schema run** → Make sure you ran the full SQL file including the `insert` statements at the bottom.
