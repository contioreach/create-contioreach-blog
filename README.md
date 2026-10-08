# create-contioreach-blog

Create a blog wired to [ContioReach](https://contioreach.com/?utm_source=npm&utm_medium=package_page&utm_campaign=create-contioreach-blog&utm_content=readme_intro_link&ref=npm) in one command. It runs on demo content straight away — no signup, no login, no questions about workspaces.

```bash
npx create-contioreach-blog my-blog
```

```
┌   create-contioreach-blog
│
◇  Which framework?
│  Next.js (recommended)
│
◇  Starter downloaded
◆  Demo API key added to .env.local
◆  Revalidation route ready: src/app/api/revalidate/all/route.js
◇  Dependencies installed
│
◇  Next ──────────────────────────────────╮
│  cd my-blog                             │
│  npm run dev   → http://localhost:3000  │
├─────────────────────────────────────────╯
│
●  You're on demo content. To use your own posts:
│    1. Sign up free: https://app.contioreach.com/signup?ref=cli&fw=next
│    2. Copy your API key into .env.local
│
└  Happy publishing!
```

## Options

| Option | |
| --- | --- |
| `[project-name]` | Folder to create. Asked for when left out (default `my-blog`). |
| `--framework <name>` | Skip the question: `next`, `nuxt`, `astro`, `sveltekit`, `remix` or `react`. |
| `--no-install` | Skip installing dependencies. |

Works with `npm create contioreach-blog`, `pnpm create contioreach-blog`, `yarn create contioreach-blog` and `bun create contioreach-blog` too — dependencies are installed with whichever one ran it.

## What it does

1. Downloads the framework's starter from [github.com/contioreach](https://github.com/contioreach).
2. Copies the starter's `.env.example` to `.env.local` (Next.js) or `.env` (everything else). That file already holds the read-only key of the ContioReach demo workspace.
3. Renames the project in `package.json`.
4. Installs dependencies.

The publish webhook route is already part of every starter (`/api/revalidate/all`). `REVALIDATION_SECRET` stays empty: it is generated in your own dashboard when you set the webhook up, and the route rejects every call until then.

The demo key is not hard-coded in the CLI. It lives in each starter's `.env.example` (and `DEMO_API_KEY` constant), so rotating it is a commit to the starters and every CLI version picks it up.

## The demo banner

Every starter shows a banner above the site header while `CMS_API_KEY` is the demo key — on a deployed site too, so nobody launches a public blog on demo content by accident. The check runs on the server; the browser only ever gets a status, never the key. The close button hides it for the browser session.

Paste your own key and restart, and the banner goes away by itself. If ContioReach rejects the key, the banner turns into an "Invalid API key" notice instead.

## When something goes wrong

| Situation | What happens |
| --- | --- |
| Folder exists and isn't empty | Asks for another name. Never overwrites files. |
| Node too old for the framework | Stops before downloading and names the version needed. |
| No internet / GitHub unreachable | Stops with a message. Nothing is left behind. |
| Dependency install fails | Keeps the project and prints the install command to run yourself. |
| Ctrl+C | Stops any running install and deletes the partly created folder. |

## Develop

```bash
npm install
npm test
node bin/create-contioreach-blog.js my-blog --no-install
```
