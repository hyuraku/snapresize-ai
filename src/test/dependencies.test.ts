import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * backgroundRemoval.worker.ts は onnxruntime-web の wasm / mjs を `?url` で
 * 直接読み込み、そのパスを env.backends.onnx.wasm.wasmPaths に固定している。
 * この wasm を実際に動かすのは @huggingface/transformers が持つ ONNX Runtime の
 * JS 側なので、両者のバージョンがずれると噛み合わなくなる。
 *
 * ずれるのは、依存更新で transformers だけが上がったとき。npm は
 * node_modules/onnxruntime-web に我々が固定した版を、transformers の下に
 * その要求する版を入れる（nested install）。ビルドも型チェックも通ってしまい、
 * 実際に背景除去を動かすまで気づけない。
 *
 * このテストはその状態を CI で落とすためにある。
 * 落ちたときは package.json の onnxruntime-web を transformers に合わせて上げる。
 */
const readPackageJson = (path: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as {
    dependencies?: Record<string, string>;
  };

describe('onnxruntime-web', () => {
  it('is pinned to the version @huggingface/transformers depends on', () => {
    const app = readPackageJson('package.json');
    const transformers = readPackageJson('node_modules/@huggingface/transformers/package.json');

    const ours = app.dependencies?.['onnxruntime-web'];
    const theirs = transformers.dependencies?.['onnxruntime-web'];

    expect(theirs).toBeDefined();
    expect(ours).toBe(theirs);
  });
});
