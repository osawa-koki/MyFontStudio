#!/usr/bin/env bash
# GHCR のコンテナイメージの古いバージョンを消す（publish.yml の cleanup）。
# マルチアーキテクチャのイメージは、1 回のプッシュで「インデックス（タグ付き）」と「アーキテクチャごとのマニフェスト（タグなし）」の
# 複数のバージョンになる。バージョンの数で数えると、残したタグの子のマニフェストまで消えて pull できなくなるので、
# - タグの付いたバージョンを新しい順に KEEP_VERSIONS 個残し（main のタグが付いたものは必ず残す）
# - 残すインデックスが参照するマニフェスト（digest）も残し
# - それ以外（古いタグ・タグの外れたインデックスと、その子のマニフェスト）を消す
# 参照を読めないインデックスがあれば、何も消さずに失敗する（子を誤って消さないように）。
#
# 環境変数：OWNER（ユーザー名）、PACKAGE（パッケージ名・小文字）、IMAGE（ghcr.io/<owner>/<package>）、KEEP_VERSIONS、
# GH_TOKEN（gh が使う。packages: write）。DRY_RUN=1 なら消さずに表示だけする。docker で ghcr.io にログインしておく
set -euo pipefail

: "${OWNER:?}" "${PACKAGE:?}" "${IMAGE:?}" "${KEEP_VERSIONS:?}"
api="/users/${OWNER}/packages/container/${PACKAGE}/versions"

versions=$(gh api --paginate "${api}?per_page=100" | jq -s 'add // []')
if [ "$(jq 'length' <<<"$versions")" -eq 0 ]; then
  echo "::error::バージョンの一覧を読めませんでした"
  exit 1
fi

# タグの付いたバージョン（新しい順）のうち、残すもの。main のタグが付いたものは数に関係なく残す
keep_tagged=$(jq --argjson n "$KEEP_VERSIONS" '
  [ .[] | select((.metadata.container.tags | length) > 0) ]
  | sort_by(.created_at) | reverse
  | (.[:$n] + [ .[] | select(.metadata.container.tags | index("main")) ])
  | unique_by(.id)
  | map(.name)' <<<"$versions")

# 残すインデックスが参照するマニフェストの digest（単一アーキテクチャのイメージなら、参照はない）
keep=$(jq -r '.[]' <<<"$keep_tagged")
children=""
for digest in $keep; do
  if ! raw=$(docker buildx imagetools inspect "${IMAGE}@${digest}" --raw); then
    echo "::error::${digest} のマニフェストを読めませんでした（何も消しません）"
    exit 1
  fi
  children+=$(jq -r '.manifests[]?.digest' <<<"$raw")$'\n'
done
keep_all=$(printf '%s\n%s\n' "$keep" "$children" | sed '/^$/d' | sort -u | jq -R . | jq -s .)

# 消すバージョン（残すものの digest に含まれないもの）
delete=$(jq --argjson keep "$keep_all" '[ .[] | select(.name as $d | $keep | index($d) | not) ]' <<<"$versions")

{
  echo "### GHCR の古いバージョンの削除"
  echo "残すタグ付きのバージョン：$(jq 'length' <<<"$keep_tagged") 個（子のマニフェストを含めて $(jq 'length' <<<"$keep_all") 個）"
  echo '```'
  jq -r '.[] | "残す \(.name) \(.metadata.container.tags | join(","))"' \
    <<<"$(jq --argjson keep "$keep_all" '[ .[] | select(.name as $d | $keep | index($d)) ]' <<<"$versions")"
  jq -r '.[] | "消す \(.name) \(.metadata.container.tags | join(","))"' <<<"$delete"
  echo '```'
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "DRY_RUN=1 なので消さない"
  exit 0
fi
for id in $(jq -r '.[].id' <<<"$delete"); do
  gh api -X DELETE "${api}/${id}" --silent
done
