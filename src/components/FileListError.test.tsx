import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileList } from './FileList';
import { useImageStore } from '../store/imageStore';
import { MAX_INPUT_EDGE_PX } from '../constants/limits';
import type { ImageFile } from '../types';

const makeFile = (overrides: Partial<ImageFile> = {}): ImageFile => ({
  id: 'f1',
  name: 'photo.jpg',
  size: 1000,
  type: 'image/jpeg',
  blob: new Blob(['x'], { type: 'image/jpeg' }),
  status: 'pending',
  progress: 0,
  ...overrides,
});

describe('FileList - failure reason', () => {
  beforeEach(() => {
    useImageStore.setState({ files: [], processed: [] });
  });

  it('shows nothing extra for a pending file', () => {
    useImageStore.setState({ files: [makeFile()] });
    render(<FileList lang="ja" />);
    expect(screen.queryByTestId('fileError')).not.toBeInTheDocument();
  });

  it('renders a structured failure reason with the limit and the fix (JA)', () => {
    useImageStore.setState({
      files: [
        makeFile({
          status: 'failed',
          error: 'fallback',
          errorReason: {
            key: 'rejectEdgeTooLarge',
            params: { width: 12000, height: 100, max: MAX_INPUT_EDGE_PX },
          },
        }),
      ],
    });
    render(<FileList lang="ja" />);

    const message = screen.getByTestId('fileError');
    expect(message).toHaveTextContent('12000×100px');
    expect(message).toHaveTextContent(`1辺の上限は${MAX_INPUT_EDGE_PX}px`);
    expect(message).toHaveTextContent('縮小してから再度追加してください');
  });

  it('renders the exact pixel counts so the message is not self-contradicting', () => {
    // 6400 x 6251 = 40,006,400（MP に丸めると上限と同じ「40MP」になってしまう値）
    useImageStore.setState({
      files: [
        makeFile({
          status: 'failed',
          errorReason: {
            key: 'rejectTooManyPixels',
            params: {
              pixels: '40,006,400',
              width: 6400,
              height: 6251,
              max: '40,000,000',
            },
          },
        }),
      ],
    });
    render(<FileList lang="ja" />);

    expect(screen.getByTestId('fileError')).toHaveTextContent(
      '総画素数が40,006,400画素（6400×6251px）です。上限は40,000,000画素です。縮小してから再度追加してください。'
    );
  });

  it('renders the broken-image guidance in English', () => {
    useImageStore.setState({
      files: [makeFile({ status: 'failed', errorReason: { key: 'errorDecodeFailed' } })],
    });
    render(<FileList lang="en" />);

    expect(screen.getByTestId('fileError')).toHaveTextContent(
      'The image could not be loaded. The file may be corrupted.'
    );
  });

  it('falls back to the raw error text when there is no structured reason', () => {
    useImageStore.setState({
      files: [makeFile({ status: 'failed', error: 'Workerエラー: boom' })],
    });
    render(<FileList lang="ja" />);

    expect(screen.getByTestId('fileError')).toHaveTextContent('Workerエラー: boom');
  });
});
