/* One entry per starter in github.com/contioreach. Everything the CLI knows
   about a framework is here: where to download it, which env file the
   framework reads, the oldest Node it runs on, and where its dev server and
   publish webhook live. The demo API key is not — it ships in each starter's
   .env.example, so rotating it never needs a new CLI release. */

export const GITHUB_ORG = "contioreach";
export const BRANCH = "main";

export const FRAMEWORKS = [
  {
    id: "next",
    label: "Next.js",
    hint: "recommended",
    aliases: ["nextjs", "next.js"],
    repo: "nextjs-starter-contioreach",
    envFile: ".env.local",
    node: "20.9.0",
    devUrl: "http://localhost:3000",
    revalidateRoute: "src/app/api/revalidate/all/route.js",
  },
  {
    id: "nuxt",
    label: "Nuxt",
    aliases: ["nuxtjs", "nuxt.js"],
    repo: "nuxtjs-starter-contioreach",
    envFile: ".env",
    node: "22.19.0",
    devUrl: "http://localhost:3000",
    revalidateRoute: "server/api/revalidate/all.post.js",
  },
  {
    id: "astro",
    label: "Astro",
    aliases: ["astrojs"],
    repo: "astro-starter-contioreach",
    envFile: ".env",
    node: "22.12.0",
    devUrl: "http://localhost:4321",
    revalidateRoute: "src/pages/api/revalidate/all.js",
  },
  {
    id: "sveltekit",
    label: "SvelteKit",
    aliases: ["svelte", "svelte-kit"],
    repo: "sveltekit-starter-contioreach",
    envFile: ".env",
    node: "20.19.0",
    devUrl: "http://localhost:5173",
    revalidateRoute: "src/routes/api/revalidate/all/+server.js",
  },
  {
    id: "remix",
    label: "Remix",
    aliases: ["remix-run"],
    repo: "remix-starter-contioreach",
    envFile: ".env",
    node: "20.0.0",
    devUrl: "http://localhost:5173",
    revalidateRoute: "app/routes/api.revalidate.all.jsx",
  },
  {
    id: "react",
    label: "React (Vite)",
    aliases: ["vite", "react-vite", "reactjs"],
    repo: "react-starter-contioreach",
    envFile: ".env",
    node: "20.19.0",
    devUrl: "http://localhost:5173",
    revalidateRoute: "server/index.js",
  },
];

export function findFramework(name) {
  const wanted = String(name).trim().toLowerCase();
  return FRAMEWORKS.find((fw) => fw.id === wanted || fw.aliases.includes(wanted)) ?? null;
}

export function tarballUrl(fw) {
  return `https://codeload.github.com/${GITHUB_ORG}/${fw.repo}/tar.gz/refs/heads/${BRANCH}`;
}

// ref=cli and fw=<id> let signups that start from the CLI be counted.
export function signupUrl(fw) {
  return `https://app.contioreach.com/signup?ref=cli&fw=${fw.id}`;
}
