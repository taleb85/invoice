<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## App version (local & production UI)

**Do not** run **`npm version patch`** or manually bump `package.json` / `package-lock.json` after routine code or UX changes. The app version is advanced **only** when you run a **deploy** script that already includes the bump (`deploy`, `deploy:sync`, `vercel:prod`, `version:bump` before production build, etc.), or **when the user explicitly asks** for a version change. If a deploy script runs the bump, **do not** run the same bump again in the same flow.

Next exposes the version as **`NEXT_PUBLIC_APP_VERSION`** (see `next.config.ts`). When client-facing PWA behaviour or cached shell changes matter and the **user asks** or you touch the service worker deliberately, **`CACHE_NAME`** in `public/sw.js` still needs bumps so browsers install the new SW.
