<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## App version (local & production UI)

After material code or UX changes the agent completes: run **`npm version patch --no-git-tag-version`** so `package.json` / `package-lock.json` advance; Next exposes this as **`NEXT_PUBLIC_APP_VERSION`** (see `next.config.ts`). Official deploy scripts (`deploy`, `deploy:sync`, `vercel:prod`, …) already bump before build—do not duplicate the bump right before those if the script runs the same bump. When client-facing PWA behavior or cached shell changes matter, bump **`CACHE_NAME`** in `public/sw.js` so browsers install a new service worker.
