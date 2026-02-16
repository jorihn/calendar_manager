# Deploy & Rollback Playbook (API Server)

This repo is treated as **stable v2.0** once tagged.

## Release checklist

1) **Pre-flight**
- `git status` is clean
- `npm ci && npm run build`

2) **DB backup (required before any migration)**

```bash
# Fill these env vars (or use DATABASE_URL)
# export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=... PGPASSWORD=... PGDATABASE=...
mkdir -p /var/backups/api-server
pg_dump -Fc -f /var/backups/api-server/pre_release_$(date +%F_%H%M%S).dump
```

3) **Run migrations**

```bash
npm run migrate:status
npm run migrate:up
```

4) **Deploy app**
- Build: `npm run build`
- Restart: `pm2 restart api-server --update-env`

5) **Tag release**

```bash
git tag -a v2.0.0 -m "Stable release v2.0.0"
git push origin main --tags
```

## Rollback

### Rollback application code

```bash
git fetch --tags
git checkout v2.0.0
npm ci
npm run build
pm2 restart api-server --update-env
```

### Rollback database

Preferred: **restore from dump** created before the migration.

```bash
# DANGER: this overwrites the database
pg_restore --clean --if-exists -d "$PGDATABASE" /var/backups/api-server/<dump-file>.dump
```

If you have a safe down-migration for the last release, you can rollback one step:

```bash
npm run migrate:down -- 1
```

## Migration rules (to keep rollback possible)

- Write migrations as *incremental* changes in `src/db/migrations/`.
- Every `.up.sql` **must** have a matching `.down.sql`.
- Prefer backward-compatible changes:
  - add columns/tables first (nullable/default)
  - deploy app
  - backfill data
  - only then do destructive changes (drop/rename)
- Before any destructive migration, require a DB backup.
