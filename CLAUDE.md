# SnapResize AI

ブラウザ完結型の AI 画像処理ツール（リサイズ・背景除去・透かし）。

## Agent skills

### Issue tracker

Issue と spec は `.scratch/<feature>/` 配下の markdown ファイルとして管理する。GitHub Issues は使わない。See `docs/agents/issue-tracker.md`.

### Triage labels

5 つの標準ロールをそのままラベル名として使う（`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`）。See `docs/agents/triage-labels.md`.

### Domain docs

single-context。ルートの `CONTEXT.md` と `docs/adr/` を使う。See `docs/agents/domain.md`.
