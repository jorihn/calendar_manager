# Deploy & Rollback Playbook (API Server v2.1)

Mục tiêu: mỗi release đều có thể truy vết rõ ràng theo bộ ba **git tag ↔ image tag/digest ↔ release record**.

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

5) **Build & push image with immutable tags**

```bash
VERSION=v2.1.0
SHA=$(git rev-parse --short HEAD)
IMAGE=ghcr.io/jorihn/calendar_manager-api

docker build -t "$IMAGE:$VERSION" -t "$IMAGE:$VERSION-$SHA" .
docker push "$IMAGE:$VERSION"
docker push "$IMAGE:$VERSION-$SHA"

# Lấy digest sau push (ví dụ bằng buildx imagetools)
docker buildx imagetools inspect "$IMAGE:$VERSION"
```

6) **Create release record (required)**
- Tạo file `releases/<version>.md` (ví dụ `releases/v2.1.0.md`)
- Bắt buộc có:
  - commit SHA đầy đủ
  - git tag
  - image tag
  - image digest (sha256)
  - config/version note (migrate, env, feature flag)

## 3) Deploy

- Pull artifact theo **digest** (không deploy theo mutable tag latest)
- Restart service
- Smoke test: `/health`, endpoint quan trọng, migration status

## 4) Rollback

### Rollback application code/image

Ưu tiên rollback theo **image digest** từ release record:

```bash
docker pull ghcr.io/jorihn/calendar_manager-api@sha256:<digest>
# restart service bằng image digest đó
```

Nếu deploy theo source:

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
