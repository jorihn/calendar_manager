# Release Records

Thư mục này lưu release record bất biến cho từng bản phát hành.

## Naming

- Mỗi release dùng 1 file: `releases/vX.Y.Z.md`
- Ví dụ: `releases/v2.1.0.md`

## Required fields

Mỗi release record **bắt buộc** có đủ:

1. `git tag` (annotated, SemVer)
2. `commit SHA` (full 40 chars)
3. `image`:
   - repository
   - immutable tag (`vX.Y.Z` và/hoặc `vX.Y.Z-<shortSHA>`)
   - digest (`sha256:...`)
4. `config/version notes`:
   - migration run status
   - env/config changes
   - feature flags (nếu có)

## Audit & rollback principle

- Deploy production phải pin theo **digest**, không theo mutable tag.
- Rollback dùng mapping trong release record:
  - `tag -> commit -> image digest -> config notes`
- Không có release record đầy đủ thì không coi là release hợp lệ.
