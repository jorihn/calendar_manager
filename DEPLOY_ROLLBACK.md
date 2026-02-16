# Deploy & Rollback Playbook (API Server v2.1)

Mục tiêu: mỗi release đều có thể truy vết rõ ràng theo bộ ba **git tag ↔ commit SHA ↔ release record** (không phụ thuộc Docker).

## 1) Trunk-based policy (bắt buộc)

- `main` là trunk duy nhất để release.
- Chỉ merge PR ngắn hạn (small batch), ưu tiên squash merge.
- Chỉ tạo release từ `origin/main` (không release từ branch local).
- Mỗi release phải có tag SemVer `vX.Y.Z` dạng annotated tag.

## 2) Release checklist (v2.1 chuẩn hóa)

1) **Pre-flight**
- `git fetch origin`
- `git checkout main && git pull --ff-only origin main`
- `git status` sạch
- `npm ci && npm run build`

2) **DB backup (required trước migration)**

```bash
mkdir -p /var/backups/api-server
pg_dump -Fc -f /var/backups/api-server/pre_release_$(date +%F_%H%M%S).dump
```

3) **Run migrations**

```bash
npm run migrate:status
npm run migrate:up
```

4) **Create git tag baseline**

```bash
VERSION=v2.1.0
git tag -a "$VERSION" -m "Release $VERSION"
git push origin "$VERSION"
```

5) **Deploy từ source tag trên VPS (non-Docker)**

```bash
VERSION=v2.1.0
git fetch --tags origin
git checkout "$VERSION"
npm ci
npm run build
pm2 restart api-server --update-env
```

6) **Create release record (required)**
- Tạo file `releases/<version>.md` (ví dụ `releases/v2.1.0.md`)
- Bắt buộc có:
  - commit SHA đầy đủ
  - git tag
  - deployment artifact: `source@tag + commit` (và optional `dist` checksum)
  - target environment (VPS/service name)
  - config/version note (migrate, env, feature flag)

## 3) Deploy

- Pull source theo **tag** (không deploy từ nhánh local chưa tag)
- Build lại trên VPS (`npm ci && npm run build`)
- Restart service (`pm2 restart ... --update-env`)
- Smoke test: `/health`, endpoint quan trọng, migration status

## 4) Rollback

### Rollback application code (source/tag)

Rollback theo tag đã audit trong release record:

```bash
git fetch --tags
git checkout v2.1.0
npm ci
npm run build
pm2 restart api-server --update-env
```

### Rollback database

Preferred: restore từ dump tạo trước release.

```bash
# DANGER: ghi đè DB hiện tại
pg_restore --clean --if-exists -d "$PGDATABASE" /var/backups/api-server/<dump-file>.dump
```

Nếu migration hỗ trợ down an toàn:

```bash
npm run migrate:down -- 1
```

## 5) Migration rules (để rollback được)

- Viết migration tăng dần trong `src/db/migrations/`.
- Mỗi `.up.sql` phải có `.down.sql` tương ứng.
- Ưu tiên backward-compatible rollout:
  - thêm cột/bảng trước
  - deploy app
  - backfill data
  - chỉ destructive sau khi ổn định
- Trước thay đổi destructive: bắt buộc backup DB.
