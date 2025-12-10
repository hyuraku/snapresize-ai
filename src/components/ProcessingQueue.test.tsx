import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock FileItem type
interface FileItem {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
}

// Mock ProcessingQueue Component
interface ProcessingQueueProps {
  files: FileItem[];
  onClear?: () => void;
}

const ProcessingQueue: React.FC<ProcessingQueueProps> = ({ files, onClear }) => {
  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'text-slate-400',
      processing: 'text-sky-400',
      completed: 'text-emerald-400',
      failed: 'text-red-400',
    };
    return map[status] || 'text-slate-400';
  };

  return (
    <div data-testid="processing-queue">
      <div data-testid="queue-header">
        <h2>処理キュー</h2>
        <span data-testid="queue-count">{files.length}枚</span>
      </div>
      {files.length === 0 ? (
        <p data-testid="empty-message">画像を追加してください</p>
      ) : (
        <div data-testid="file-list">
          {files.map((file) => (
            <div key={file.id} data-testid={`file-item-${file.id}`}>
              <span data-testid="file-name">{file.name}</span>
              <span
                data-testid="file-status"
                className={getStatusColor(file.status)}
              >
                {file.progress}%
              </span>
              <div
                data-testid="progress-bar"
                style={{ width: `${file.progress}%` }}
              />
            </div>
          ))}
        </div>
      )}
      {onClear && (
        <button data-testid="clear-button" onClick={onClear}>
          すべてクリア
        </button>
      )}
    </div>
  );
};

describe('ProcessingQueue Component', () => {
  const mockFiles: FileItem[] = [
    {
      id: '1',
      name: 'test1.png',
      size: 1024,
      status: 'pending',
      progress: 0,
    },
    {
      id: '2',
      name: 'test2.jpg',
      size: 2048,
      status: 'processing',
      progress: 50,
    },
    {
      id: '3',
      name: 'test3.webp',
      size: 3072,
      status: 'completed',
      progress: 100,
    },
  ];

  it('should render processing queue', () => {
    render(<ProcessingQueue files={mockFiles} />);

    expect(screen.getByTestId('processing-queue')).toBeInTheDocument();
    expect(screen.getByTestId('queue-header')).toBeInTheDocument();
    expect(screen.getByText('処理キュー')).toBeInTheDocument();
  });

  it('should display correct file count', () => {
    render(<ProcessingQueue files={mockFiles} />);

    expect(screen.getByTestId('queue-count')).toHaveTextContent('3枚');
  });

  it('should display empty message when no files', () => {
    render(<ProcessingQueue files={[]} />);

    expect(screen.getByTestId('empty-message')).toBeInTheDocument();
    expect(screen.getByText('画像を追加してください')).toBeInTheDocument();
  });

  it('should render all file items', () => {
    render(<ProcessingQueue files={mockFiles} />);

    expect(screen.getByTestId('file-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('file-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('file-item-3')).toBeInTheDocument();
  });

  it('should display file names', () => {
    render(<ProcessingQueue files={mockFiles} />);

    expect(screen.getByText('test1.png')).toBeInTheDocument();
    expect(screen.getByText('test2.jpg')).toBeInTheDocument();
    expect(screen.getByText('test3.webp')).toBeInTheDocument();
  });

  it('should display progress for each file', () => {
    render(<ProcessingQueue files={mockFiles} />);

    const fileItems = screen.getAllByTestId('file-status');
    expect(fileItems[0]).toHaveTextContent('0%');
    expect(fileItems[1]).toHaveTextContent('50%');
    expect(fileItems[2]).toHaveTextContent('100%');
  });

  it('should apply correct status colors', () => {
    render(<ProcessingQueue files={mockFiles} />);

    const fileItems = screen.getAllByTestId('file-status');
    expect(fileItems[0]).toHaveClass('text-slate-400'); // pending
    expect(fileItems[1]).toHaveClass('text-sky-400'); // processing
    expect(fileItems[2]).toHaveClass('text-emerald-400'); // completed
  });

  it('should render progress bars', () => {
    render(<ProcessingQueue files={mockFiles} />);

    const progressBars = screen.getAllByTestId('progress-bar');
    expect(progressBars).toHaveLength(3);
    expect(progressBars[0]).toHaveStyle({ width: '0%' });
    expect(progressBars[1]).toHaveStyle({ width: '50%' });
    expect(progressBars[2]).toHaveStyle({ width: '100%' });
  });

  it('should handle clear button click', () => {
    const mockOnClear = vi.fn();
    render(<ProcessingQueue files={mockFiles} onClear={mockOnClear} />);

    const clearButton = screen.getByTestId('clear-button');
    fireEvent.click(clearButton);

    expect(mockOnClear).toHaveBeenCalledTimes(1);
  });

  it('should not render clear button when onClear not provided', () => {
    render(<ProcessingQueue files={mockFiles} />);

    expect(screen.queryByTestId('clear-button')).not.toBeInTheDocument();
  });

  it('should handle failed status correctly', () => {
    const failedFiles: FileItem[] = [
      {
        id: '1',
        name: 'failed.png',
        size: 1024,
        status: 'failed',
        progress: 0,
      },
    ];

    render(<ProcessingQueue files={failedFiles} />);

    const fileStatus = screen.getByTestId('file-status');
    expect(fileStatus).toHaveClass('text-red-400');
  });

  it('should update when files prop changes', () => {
    const { rerender } = render(<ProcessingQueue files={mockFiles} />);

    expect(screen.getByTestId('queue-count')).toHaveTextContent('3枚');

    const newFiles = mockFiles.slice(0, 1);
    rerender(<ProcessingQueue files={newFiles} />);

    expect(screen.getByTestId('queue-count')).toHaveTextContent('1枚');
  });
});
