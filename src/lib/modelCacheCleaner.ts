/**
 * 使われなくなったモデル重みを Cache Storage から削除する
 *
 * Transformers.js は dtype ごとに別ファイル（model.onnx / model_fp16.onnx /
 * model_quantized.onnx）を取得するが、古いエントリを消す仕組みは持たない。
 * WebGPU の有無や shader-f16 の有無で dtype が変わると、使わない重みが
 * 残り続けてディスクを圧迫するため、明示的に掃除する。
 */

import type { ModelDtype } from './capabilityDetector';

/** Transformers.js v4 の env.cacheKey 既定値 */
const CACHE_NAME = 'transformers-cache';

/** dtype と ONNX ファイル名の対応 */
const DTYPE_FILE: Record<ModelDtype, string> = {
  fp32: 'model.onnx',
  fp16: 'model_fp16.onnx',
  q8: 'model_quantized.onnx',
};

/**
 * 指定モデルの、いま使う dtype 以外の重みをキャッシュから削除する
 *
 * NOTE: 必ずモデルのロードが成功したあとに呼ぶこと。
 * ロード前に消すと、新しい重みの取得に失敗したとき古い重みも失われ、
 * オフラインのユーザーが背景除去を一切使えなくなる。
 *
 * @param modelId 対象モデル（例: 'briaai/RMBG-1.4'）。他モデルを巻き込まないための絞り込みに使う
 * @param keep 残す dtype
 * @returns 削除したエントリ数
 */
export const cleanupStaleModelCache = async (
  modelId: string,
  keep: ModelDtype
): Promise<number> => {
  if (typeof caches === 'undefined') return 0;

  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();

    const staleFiles = (Object.keys(DTYPE_FILE) as ModelDtype[])
      .filter((dtype) => dtype !== keep)
      .map((dtype) => DTYPE_FILE[dtype]);

    let removed = 0;
    for (const request of requests) {
      // 対象モデル以外には触れない
      if (!request.url.includes(modelId)) continue;
      if (!staleFiles.some((file) => request.url.endsWith(`/${file}`))) continue;

      if (await cache.delete(request)) removed++;
    }

    if (removed > 0) {
      console.log(`ModelCacheCleaner: removed ${removed} stale model file(s) for ${modelId}`);
    }
    return removed;
  } catch (error) {
    // 掃除の失敗はアプリの動作を妨げない
    console.warn('ModelCacheCleaner: cleanup failed:', error);
    return 0;
  }
};

export default cleanupStaleModelCache;
