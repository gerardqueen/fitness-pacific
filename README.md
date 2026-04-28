# Fitness Pacific

Coach + client web app for Fitness Pacific, Kirkcaldy. Built with React + Vite, deployed via GitHub Pages.

This is the **frontend only** — currently runs on mock data that resets on reload. Backend (Railway + Postgres) comes next.

---

## What's in here

```
fitness-pacific/
├── .github/workflows/deploy.yml   ← auto-deploy on push to main
├── public/favicon.svg
├── src/
│   ├── main.jsx                   ← React entry, mounts <App />
│   └── FitnessPacific.jsx         ← the entire app (~4,300 lines)
├── index.html                     ← Vite entry
├── package.json
├── vite.config.js
└── README.md
```

The whole app lives in `src/FitnessPacific.jsx`. We'll split it into multiple files when we wire up the real backend, but for now it's deliberately one file — easier to navigate and review.

---

## Local development

```bash
npm install
npm run dev
```

Opens at <http://localhost:5173>. The app will hot-reload as you edit `src/FitnessPacific.jsx`.

Top-right of the running app has a **CLIENT / COACH** toggle for previewing both views.

> ⚠️ The barcode scanner needs `https://` to access the camera. It works on `localhost`, but if you use `npm run dev -- --host` to test on your phone over LAN you'll need to add a `--https` flag or use a tunnel like ngrok. Once deployed (GitHub Pages is HTTPS by default), this works automatically.

---

## Deploying to GitHub Pages — first-time setup

These steps only need doing once.

### 1. Push the code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fitness-pacific.git
git push -u origin main
```

### 2. Enable GitHub Pages in the repo settings

1. Go to **Settings → Pages** in your GitHub repo
2. Under **Build and deployment → Source**, choose **GitHub Actions**
3. That's it — no other config needed

### 3. Make sure the base path matches your repo name

Open `.github/workflows/deploy.yml` and find this line:

```yaml
VITE_BASE: /fitness-pacific/
```

The value must match your repo name with a leading and trailing slash. If you call your repo `fp-app` instead, change it to `/fp-app/`.

### 4. Push to `main` to trigger the first deploy

```bash
git commit --allow-empty -m "Trigger deploy"
git push
```

The Actions tab in your repo will show the build running. After ~1 min the site will be live at:

```
https://YOUR_USERNAME.github.io/fitness-pacific/
```

Send that URL to the gym owner to share with the team. Every push to `main` from now on will auto-deploy in about a minute.

---

## Custom domain (optional, ~£10/year)

If/when the gym wants `fitnesspacific.app` (or `.co.uk` / `.fit`):

1. Buy the domain from any registrar (Cloudflare, Namecheap, GoDaddy)
2. Add a `CNAME` record pointing to `YOUR_USERNAME.github.io`
3. In **Settings → Pages → Custom domain**, enter the domain and tick **Enforce HTTPS**
4. Edit `.github/workflows/deploy.yml` and change:
   ```yaml
   VITE_BASE: /
   ```
   (Custom domains serve from root, not `/fitness-pacific/`.)
5. Commit and push — done.

---

## What's next: backend

The app is currently all mock data. Next steps to make it real (in order):

1. **Railway Postgres** — separate database alongside your No Rules one
2. **Express API** — auth (JWT), CRUD for workouts, lifts, tracking, messages
3. **Frontend wiring** — replace the `seed*()` functions with `fetch()` calls
4. **Login screen** — replace the demo banner role-toggle with real auth

When you're ready to start that piece, the path is:
- New service in your existing Railway project
- New Postgres database in the same project
- API on something like `fp-api.railway.app`, frontend continues to live on GitHub Pages
- The frontend talks to the API via `import.meta.env.VITE_API_URL` (set as a GitHub Actions secret)

---

## Editing the app

Almost everything visual is controlled by **brand tokens** at the top of `src/FitnessPacific.jsx`:

```js
const T = {
  bg:        "#f6f1e8",   // warm parchment background
  text:      "#1c1915",   // logo black / body text
  pacific:   "#1d6f7a",   // primary action colour (teal)
  clay:      "#c97e4a",   // secondary accent
  // ...
};
```

If the gym wants a different colour scheme, swap two or three values here and the whole app updates.

The exercise library lives in the `EXERCISES = [...]` array, also at the top of the file. Add/edit exercises there.
