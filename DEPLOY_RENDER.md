# SnickyLink Backend — Render deployment

This backend is prepared for a free testing deployment on Render.

## Deploy
1. Upload this folder to GitHub.
2. In Render choose **New → Blueprint** and select the repository.
3. Render reads `render.yaml` and creates the API, PostgreSQL database and Redis-compatible Key Value service.
4. Set `CLIENT_ORIGIN` to the origin allowed to call the API. Multiple comma-separated origins are supported.
5. After deployment, test `https://YOUR-SERVICE.onrender.com/health` and expect `{"status":"ok"}`.

The API automatically runs `prisma db push` before startup so the supplied Prisma schema is created without requiring a migration history.
