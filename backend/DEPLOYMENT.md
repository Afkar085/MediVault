# Deploying MediVault backend (Render, free tier)

Railway's free trial credit runs out and then the service stops — this is why the app went down. Render's free web service tier doesn't require a card and doesn't expire; the tradeoff is it sleeps after 15 minutes of no traffic and takes ~30-50s to wake on the next request. For a personal/family app that's a fine tradeoff.

Your Supabase project is untouched and still has all your data — nothing to migrate there.

This checklist assumes the security-hardening pass has already landed (restricted CORS, rate limiting, security headers, signed file URLs — see the audit summary in chat for the full list). A couple of those changes add new required steps below; they're marked **(new)**.

## What you need before you start

Pull these from wherever you saved them when you first set up Railway (or from Supabase's dashboard directly — don't paste secrets into chat with anyone, including AI tools):

- `SUPABASE_URL` — Supabase project settings -> API
- `SUPABASE_KEY` — same page (the anon/service key you were already using)
- `JWT_SECRET` — whatever random string you used before (or generate a new one — see note below)
- `GROQ_API_KEY` — console.groq.com -> API Keys
- Your frontend's exact URL (e.g. `https://medivault.vercel.app`) — needed for `ALLOWED_ORIGINS` **(new)**

## Steps (~10-15 min)

1. **Go to [render.com](https://render.com) -> sign up / log in** (GitHub login is fastest since your repo is already on GitHub as `Afkar085/MediVault`).

2. **New + -> Web Service -> connect the `MediVault` repo.**

3. **Configure the service:**
   - Name: `medivault-api` (or anything)
   - Root directory: `backend`
   - Runtime: `Python 3`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Instance type: `Free`

4. **Add environment variables** (Render dashboard -> Environment), one per row:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | from Supabase dashboard |
   | `SUPABASE_KEY` | from Supabase dashboard |
   | `JWT_SECRET` | your existing secret, or a new random 32+ char string |
   | `JWT_EXPIRE_HOURS` | `24` |
   | `GROQ_API_KEY` | from console.groq.com |
   | `GROQ_TEXT_MODEL` | `openai/gpt-oss-120b` |
   | `ALLOWED_ORIGINS` | your exact frontend URL, e.g. `https://medivault.vercel.app` (comma-separate if there's more than one, no trailing slash) **(new)** |
   | `DEBUG` | `false` **(new)** — leave unset or `false` in production; only set `true` temporarily if you need `/docs` to debug something |

   Note: if you generate a **new** `JWT_SECRET` instead of reusing the old one, every existing user gets logged out and has to sign in again — their data is unaffected either way. Reuse the old value if you still have it and want to avoid that.

   The app now refuses to start if any of `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`, or `GROQ_API_KEY` is missing, and Render's logs will say exactly which one — so a bad deploy here fails loudly instead of silently.

5. **Create Web Service** and wait for the first deploy to finish. Render gives you a URL like `https://medivault-api.onrender.com`.

6. **Sanity check the backend by itself** — visit `https://medivault-api.onrender.com/health` in a browser. You should see `{"status":"ok"}`. (First request after idle will be slow — that's the free-tier cold start, not a bug.) `/docs` should 404 — that's correct, it's disabled unless `DEBUG=true`.

7. **Point the frontend at the new backend** — tell me the Render URL once you have it and I'll update [frontend/src/api.js](../frontend/src/api.js) (it's currently hardcoded to the dead Railway URL) and you redeploy the frontend on Vercel.

8. **Make the Supabase storage bucket private (new, do this manually — dashboard only, not fixable from code)** — Supabase dashboard -> Storage -> `medical-records` bucket -> Settings -> turn **off** "Public bucket" if it's currently on. The backend now generates short-lived signed URLs for every file instead of relying on permanent public links, but that only actually protects anything once the bucket itself is private — right now, anyone who ever obtained one of the old public URLs (browser history, a shared screenshot, server logs) could still view that medical document indefinitely.

9. **Check for the test account (new)** — in Supabase, look at the `users` table for a row with email `test@medivault.dev`. If your team ever ran `backend/database/seed.sql` against this live project, delete that row — its password hash is a publicly-known example hash, not a real secret.

10. **Full walkthrough test** once both are live: sign in, switch/add a family member, upload a prescription photo, confirm it shows "processing" then fills in with AI-extracted fields, check Search, check the Health Journey AI summary, check a bill's insurance-claim toggle, and try Profile -> Delete Account on a throwaway test account to confirm it actually removes everything.

## CORS is now restricted, not wildcard

`backend/app/main.py` used to allow `*`. It now only allows the origins listed in `ALLOWED_ORIGINS` — if you add a second frontend (a staging URL, a custom domain), add it to that env var as a comma-separated list, or requests from it will be rejected with `Disallowed CORS origin`.

## Cleanup done in this pass

- Removed `backend/backend/` — an unused, git-tracked duplicate of `profile.py` left over from an earlier mistake.
- Removed `backend/requirements-prod.txt` — wasn't referenced by any build config and pulled in unused heavy deps (numpy, opencv).
