import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock FileUpload Component
interface FileUploadProps {
  onFilesAdded: (files: File[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesAdded,
  maxFiles = 50,
  maxFileSize = 50 * 1024 * 1024,
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles = files
        .filter((file) => /image\/(png|jpeg|webp)/.test(file.type))
        .filter((file) => file.size <= maxFileSize)
        .slice(0, maxFiles);

      if (validFiles.length > 0) {
        onFilesAdded(validFiles);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files
      .filter((file) => /image\/(png|jpeg|webp)/.test(file.type))
      .filter((file) => file.size <= maxFileSize)
      .slice(0, maxFiles);

    if (validFiles.length > 0) {
      onFilesAdded(validFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      data-testid="drop-zone"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        data-testid="file-input"
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
      />
      <p>ドラッグ＆ドロップまたはファイルを選択</p>
    </div>
  );
};

describe('FileUpload Component', () => {
  let mockOnFilesAdded: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnFilesAdded = vi.fn();
  });

  it('should render file upload component', () => {
    render(<FileUpload onFilesAdded={mockOnFilesAdded} />);

    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
    expect(screen.getByTestId('file-input')).toBeInTheDocument();
    expect(screen.getByText('ドラッグ＆ドロップまたはファイルを選択')).toBeInTheDocument();
  });

  it('should handle file selection', async () => {
    render(<FileUpload onFilesAdded={mockOnFilesAdded} />);

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByTestId('file-input') as HTMLInputElement;

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockOnFilesAdded).toHaveBeenCalledWith([file]);
    });
  });

  it('should handle multiple file selection', async () => {
    render(<FileUpload onFilesAdded={mockOnFilesAdded} />);

    const files = [
      new File(['test1'], 'test1.png', { type: 'image/png' }),
      new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
      new File(['test3'], 'test3.webp', { type: 'image/webp' }),
    ];
    const input = screen.getByTestId('file-input') as HTMLInputElement;

    await userEvent.upload(input, files);

    await waitFor(() => {
      expect(mockOnFilesAdded).toHaveBeenCalledWith(files);
    });
  });

  it('should filter out invalid file types', async () => {
    render(<FileUpload onFilesAdded={mockOnFilesAdded} />);

    const files = [
      new File(['test1'], 'test1.png', { type: 'image/png' }),
      new File(['test2'], 'test2.gif', { type: 'image/gif' }),
      new File(['test3'], 'test3.pdf', { type: 'application/pdf' }),
    ];
    const input = screen.getByTestId('file-input') as HTMLInputElement;

    await userEvent.upload(input, files);

    await waitFor(() => {
      expect(mockOnFilesAdded).toHaveBeenCalledWith([files[0]]);
    });
  });

  it('should respect max file limit', async () => {
    render(<FileUpload onFilesAdded={mockOnFilesAdded} maxFiles={2} />);

    const files = Array.from({ length: 5 }, (_, i) =>
      new File([`test${i}`], `test${i}.png`, { type: 'image/png' })
    );
    const input = screen.getByTestId('file-input') as HTMLInputElement;

    await userEvent.upload(input, files);

    await waitFor(() => {
      expect(mockOnFilesAdded).toHaveBeenCalledWith(files.slice(0, 2));
    });
  });

  it('should filter out files exceeding size limit', async () => {
    const maxSize = 1024; // 1KB
    render(<FileUpload onFilesAdded={mockOnFilesAdded} maxFileSize={maxSize} />);

    const smallFile = new File(['x'], 'small.png', { type: 'image/png' });
    const largeFile = new File(['x'.repeat(2000)], 'large.png', { type: 'image/png' });

    const input = screen.getByTestId('file-input') as HTMLInputElement;

    await userEvent.upload(input, [smallFile, largeFile]);

    await waitFor(() => {
      expect(mockOnFilesAdded).toHaveBeenCalledWith([smallFile]);
    });
  });

  it('should handle drag and drop', async () => {
    render(<FileUpload onFilesAdded={mockOnFilesAdded} />);

    const dropZone = screen.getByTestId('drop-zone');
    const file = new File(['test'], 'test.png', { type: 'image/png' });

    const dataTransfer = {
      files: [file],
      items: [],
      types: ['Files'],
    } as any;

    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => {
      expect(mockOnFilesAdded).toHaveBeenCalledWith([file]);
    });
  });

  it('should handle drag over event', () => {
    render(<FileUpload onFilesAdded={mockOnFilesAdded} />);

    const dropZone = screen.getByTestId('drop-zone');

    // dragOver イベントが正常に発火することを確認
    // (preventDefault はブラウザのデフォルト動作を防ぐために呼ばれる)
    expect(() => fireEvent.dragOver(dropZone)).not.toThrow();
  });

  it('should not call onFilesAdded with empty file list', async () => {
    render(<FileUpload onFilesAdded={mockOnFilesAdded} />);

    const input = screen.getByTestId('file-input') as HTMLInputElement;

    await userEvent.upload(input, []);

    await waitFor(() => {
      expect(mockOnFilesAdded).not.toHaveBeenCalled();
    });
  });
});
