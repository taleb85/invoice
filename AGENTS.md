<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## App version (local & production UI)

**Do not** run **`npm version patch`** (or bump `package.json` / `package-lock.json`) as part of ordinary agent edits unless the **user explicitly asks** for a version bump. Deploy scripts (`deploy`, `deploy:sync`, `vercel:prod`, …) can still advance the version before build—do not duplicate their bump.

Next exposes the version as **`NEXT_PUBLIC_APP_VERSION`** (see `next.config.ts`). When client-facing PWA behaviour or cached shell changes matter and the **user asks** or you touch the service worker deliberately, **`CACHE_NAME`** in `public/sw.js` still needs bumps so browsers install the new SW.
