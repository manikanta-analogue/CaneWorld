# CaneWorld

A loyalty and branch sales app for juice shops.

## Development

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Copy `.env.example` to `.env.local` for local development. In Vercel, add the
same variables in Project Settings → Environment Variables for Production and
Preview, then redeploy. Variables beginning with `VITE_` are embedded during
the build; `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use the
`VITE_` prefix.

## Stack

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Supabase
