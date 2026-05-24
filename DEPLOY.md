# Deploying Atlas

Get a public URL in 10 minutes. This makes your portfolio link work for
recruiters and hiring managers who won't `git clone` anything.

## Strategy

| Component | Where | Cost |
|---|---|---|
| **Web** | Vercel (free tier) | $0 |
| **API** | Railway / Render / Fly.io (free tiers) | $0 for portfolio traffic |
| **Database** | SQLite (in the API container) → Postgres if you want collab | $0 |
| **Ollama** | NOT deployed (it's local-only) | n/a |

For the portfolio demo, you can deploy **just the web app** with no API.
Atlas works fully offline thanks to Yjs + IndexedDB. The "Summarize with AI"
button falls back to a clear offline message, which is fine for a demo.

If you want the AI feature on the deployed site, deploy the API too and
configure it to call **Groq** (free, fast, no credit card) instead of
Ollama. See "Optional: AI in production" below.

---

## 1. Deploy the web app to Vercel

### Pre-deploy checklist

The repo needs to be on GitHub (public or private).

```bash
cd "/Users/juancanul/New project"
git init                            # if not already
git add .
git commit -m "Atlas v0.1 portfolio drop"
gh repo create atlas --public --source=. --remote=origin --push
# Or push to an existing repo
```

### Deploy

```bash
# Install Vercel CLI if you don't have it
npm i -g vercel

cd "/Users/juancanul/New project"
vercel login
vercel link                         # creates a Vercel project
```

Vercel auto-detects Next.js. **But our app is in `apps/web` inside a
monorepo**, so override the root directory:

When prompted:
- **Project name:** `atlas` (or whatever)
- **Root directory:** `apps/web`
- **Build command:** `pnpm build` (auto)
- **Output directory:** `.next` (auto)
- **Install command:** `pnpm install` (auto)

Then:
```bash
vercel --prod
```

That builds and deploys. You'll get a URL like `https://atlas-xyz.vercel.app`.

### Vercel project settings

After first deploy, go to **vercel.com → atlas → Settings**:

- **Build & Development Settings**
  - Framework Preset: `Next.js`
  - Root Directory: `apps/web`
  - Install Command: `pnpm install --frozen-lockfile=false`
- **Environment Variables** — leave empty for offline-only demo, or add:
  - `NEXT_PUBLIC_ATLAS_API_URL` → URL of your deployed API (next section)

### Custom domain (optional but worth it)

If you have a domain like `juancanul.com`:
```bash
vercel domains add atlas.juancanul.com
```
Or buy one for $12 on Cloudflare — `juancanul.dev` looks more professional
than `vercel.app` on a resume.

---

## 2. Deploy the API (optional)

Skip this if you only want the offline web demo. The web works fine without
the API.

### Option A · Railway (easiest)

```bash
# Install Railway CLI
brew install railwayapp/railway/railway

cd "/Users/juancanul/New project/apps/api"
railway login
railway init                        # creates a project
railway up                          # deploys
```

Set env vars in the Railway dashboard:
```
DATABASE_URL=file:./dev.db
PORT=4001
CORS_ORIGINS=https://atlas-xyz.vercel.app
ATLAS_AI_COMPLETION=echo            # or "groq" — see below
```

Railway gives you a public URL. Copy it.

### Wire web → API

Back in Vercel project settings → Environment Variables:
```
NEXT_PUBLIC_ATLAS_API_URL=https://atlas-api-xyz.up.railway.app
```

Redeploy the web. Now the deployed site has realtime sync + AI ready.

### Option B · Render or Fly.io

Same shape, different dashboard. Pick whichever has UI you like.

---

## 3. Optional: AI in production with Groq (free)

Ollama only runs on your local machine. For the deployed API to do real
AI summaries, use **Groq** — free tier, no credit card, blazing fast
Llama 3.3 70B.

1. Sign up at [console.groq.com](https://console.groq.com) (Google login)
2. Generate API key
3. Add provider to Atlas:

```typescript
// packages/ai/src/providers/groq.ts
import type { CompletionOptions, CompletionProvider } from '../types';

export function createGroqProvider(cfg: { apiKey: string; model?: string }): CompletionProvider {
  const model = cfg.model ?? 'llama-3.3-70b-versatile';
  return {
    name: 'groq',
    version: model,
    async complete(prompt, opts: CompletionOptions = {}) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
            { role: 'user', content: prompt },
          ],
          max_tokens: opts.maxTokens ?? 256,
          temperature: opts.temperature ?? 0.3,
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
      const json = await res.json();
      return json.choices?.[0]?.message?.content?.trim() ?? '';
    },
  };
}
```

4. Wire it in `factory.ts` alongside the other providers
5. In Railway env: `ATLAS_AI_COMPLETION=groq` and `GROQ_API_KEY=...`

Now the deployed Atlas has real AI on Groq's free tier (30 RPM, plenty for
a portfolio demo).

---

## 4. Mobile (TestFlight via EAS Build)

Optional but impressive — having a TestFlight link to download Atlas on
their iPhone is a **next-level move** in interviews.

```bash
cd "/Users/juancanul/New project/apps/mobile"
pnpm install -g eas-cli
eas login
eas build:configure                 # creates eas.json
eas build --platform ios            # ~15-20 min the first time
eas submit --platform ios           # ships it to TestFlight
```

You need an Apple Developer account ($99/year). The cheapest investment in
your career — TestFlight links from your portfolio convert at a wild rate.

In your portfolio: `"Want to try it on your iPhone? DM me for a TestFlight invite."`

---

## 5. Portfolio landing page

You probably already have one. If not, the fastest path:

- Buy `your-name.dev` from Cloudflare
- One Next.js page hosted on Vercel
- Above-the-fold: name, role, one-line value prop
- Below: case studies (Atlas being the lead one)
- Each case study links to:
  - Live demo URL
  - GitHub repo
  - 60s video (YouTube embed)
  - Full PORTFOLIO.md as a separate page

If you want, I can draft the structure for that page too — say the word.

---

## Realistic timeline

| Day | Task |
|---|---|
| 1 | Push to GitHub, deploy web to Vercel, record video |
| 2 | Deploy API to Railway, wire Groq, edit video |
| 3 | Build TestFlight, post on LinkedIn + Twitter |
| 4 | Start applications |

Three days, end-to-end. The hardest part is recording yourself talking
clearly for 60 seconds — that takes ~10 takes. Plan for it.
