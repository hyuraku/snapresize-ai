import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileUpload } from './FileUpload';
import { useImageStore } from '../store/imageStore';
import { MAX_FILES, MAX_INPUT_EDGE_PX } from '../constants/limits';

/** PNG シグネチャ + IHDR（寸法を指定できる最小ヘッダ） */
const makePngFile = (name: string, width: number, height: number): File => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([bytes], name, { type: 'image/png' });
};

describe('FileUpload - rejection panel', () => {
  let uuidCounter = 0;

  beforeEach(() => {
    uuidCounter = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => `uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`
    );
    useImageStore.setState({
      files: [],
      processed: [],
      rejectedFiles: [],
      customSizeClamped: false,
      isProcessing: false,
      currentBatchId: null,
      downloadedBatchId: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows nothing while there is no rejection', () => {
    render(<FileUpload lang="ja" />);
    expect(screen.queryByTestId('rejectedPanel')).not.toBeInTheDocument();
  });

  it('lists the rejected file with the limit and how to fix it (JA)', async () => {
    render(<FileUpload lang="ja" />);

    const tooLarge = makePngFile('huge.png', MAX_INPUT_EDGE_PX + 1, 100);
    await act(async () => {
      fireEvent.drop(screen.getByTestId('dropZone'), {
        dataTransfer: { files: [tooLarge], items: [], types: ['Files'] },
      });
    });

    const panel = await screen.findByTestId('rejectedPanel');
    expect(panel).toHaveTextContent('huge.png');
    // 実寸・上限・対処がすべて含まれる
    expect(panel).toHaveTextContent(`${MAX_INPUT_EDGE_PX + 1}×100px`);
    expect(panel).toHaveTextContent(`1辺の上限は${MAX_INPUT_EDGE_PX}px`);
    expect(panel).toHaveTextContent('縮小してから再度追加してください');
    // 拒否されたので一覧には入らない
    expect(useImageStore.getState().files).toHaveLength(0);
  });

  it('renders the same reason in English', async () => {
    useImageStore.setState({
      rejectedFiles: [
        { name: 'many.png', reason: { key: 'rejectTooManyFiles', params: { max: MAX_FILES } } },
      ],
    });
    render(<FileUpload lang="en" />);

    const panel = screen.getByTestId('rejectedPanel');
    expect(panel).toHaveTextContent('Some images could not be added');
    expect(panel).toHaveTextContent(`You can add up to ${MAX_FILES} images at a time`);
    expect(panel).toHaveTextContent('Please add fewer images');
  });

  it('can be dismissed', async () => {
    useImageStore.setState({
      rejectedFiles: [{ name: 'a.gif', reason: { key: 'rejectUnsupportedFormat' } }],
    });
    render(<FileUpload lang="ja" />);
    expect(screen.getByTestId('rejectedPanel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dismissRejected'));

    await waitFor(() => expect(screen.queryByTestId('rejectedPanel')).not.toBeInTheDocument());
    expect(useImageStore.getState().rejectedFiles).toEqual([]);
  });

  it('replaces the panel contents on the next add and keeps the accepted file', async () => {
    useImageStore.setState({
      rejectedFiles: [{ name: 'old.png', reason: { key: 'rejectUnsupportedFormat' } }],
    });
    render(<FileUpload lang="ja" />);
    expect(screen.getByTestId('rejectedPanel')).toHaveTextContent('old.png');

    await act(async () => {
      fireEvent.drop(screen.getByTestId('dropZone'), {
        dataTransfer: { files: [makePngFile('fine.png', 800, 600)], items: [], types: ['Files'] },
      });
    });

    await waitFor(() => expect(screen.queryByTestId('rejectedPanel')).not.toBeInTheDocument());
    expect(useImageStore.getState().files.map((f) => f.name)).toEqual(['fine.png']);
  });
});
