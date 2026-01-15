# LingoPal

Voice-first AI language partner with real-time feedback, vocabulary highlights, and pronunciation support.

## Run Locally

**Prerequisites:** Node.js


1. Install dependencies:
   `npm install`
2. (Optional) Set `VITE_GEMINI_API_KEY` in `.env.local` for a shared key
3. Run the app:
   `npm run dev`

## Deploy (Free)

### Vercel (Recommended)
1. Push this repo to GitHub.
2. Go to https://vercel.com and import the repo.
3. Build command: `npm run build`
4. Output directory: `dist`
5. **Do not set** `VITE_GEMINI_API_KEY` if you want users to bring their own key.

### Netlify
1. Push this repo to GitHub.
2. Go to https://app.netlify.com and import the repo.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. **Do not set** `VITE_GEMINI_API_KEY` if you want users to bring their own key.
