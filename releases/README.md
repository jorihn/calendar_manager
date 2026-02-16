# Release Records

Thư mục này lưu release record bất biến cho từng bản phát hành.

## Naming

- Mỗi release dùng 1 file: `releases/vX.Y.Z.md`
- Ví dụ: `releases/v2.1.0.md`

## Required fields

Mỗi release record **bắt buộc** có đủ:

1. `git tag` (annotated, SemVer)
2. `commit SHA` (full 40 chars)
3. `deployment artifact`:
   - mode (`source-tag` hoặc `image`)
   - source ref (`tag + commit`) nếu non-Docker
   - optional checksum (ví dụ `dist` tarball sha256)
4. `target environment`:
   - VPS host/service name
   - deploy path (nếu cần)
5. `config/version notes`:
   - migration run status
   - env/config changes
   - feature flags (nếu có)

## Audit & rollback principle

- Với non-Docker, deploy production phải pin theo **git tag + commit SHA**.
- Rollback dùng mapping trong release record:
  - `tag -> commit -> deploy artifact -> config notes`
- Không có release record đầy đủ thì không coi là release hợp lệ.
