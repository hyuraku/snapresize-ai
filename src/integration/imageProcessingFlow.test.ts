import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock state management
interface FileItem {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  blob: Blob;
}

interface AppState {
  files: FileItem[];
  processed: Array<{
    id: string;
    name: string;
    blob: Blob;
  }>;
  processing: boolean;
  modelLoaded: boolean;
}

// Mock image processing workflow
class ImageProcessingService {
  state: AppState = {
    files: [],
    processed: [],
    processing: false,
    modelLoaded: false,
  };

  async addFiles(fileList: File[]): Promise<void> {
    const entries = fileList
      .filter((file) => /image\/(png|jpeg|webp)/.test(file.type))
      .filter((file) => file.size <= 50 * 1024 * 1024)
      .slice(0, 50 - this.state.files.length)
      .map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        status: 'pending' as const,
        progress: 0,
        blob: file,
      }));

    this.state.files.push(...entries);
  }

  async processImage(
    file: FileItem,
    targetSize: { width: number; height: number },
    quality: number
  ): Promise<Blob> {
    // Simulate processing
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(new Blob(['processed-image'], { type: 'image/jpeg' }));
      }, 10);
    });
  }

  async runBatch(targetSize: { width: number; height: number }, quality: number): Promise<void> {
    if (this.state.processing || !this.state.files.length) return;

    this.state.processing = true;

    for (const file of this.state.files) {
      if (file.status === 'completed' || file.status === 'failed') continue;

      file.status = 'processing';
      file.progress = 10;

      try {
        file.progress = 30;
        const processedBlob = await this.processImage(file, targetSize, quality);
        file.progress = 90;
        file.status = 'completed';
        file.progress = 100;

        const newName = file.name.replace(/\.[^.]+$/, '_resized.jpg');
        this.state.processed.push({
          id: file.id,
          name: newName,
          blob: processedBlob,
        });
      } catch (error) {
        file.status = 'failed';
        file.progress = 0;
      }
    }

    this.state.processing = false;
  }

  async downloadAll(): Promise<Blob> {
    // Simulate ZIP creation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(new Blob(['zip-content'], { type: 'application/zip' }));
      }, 10);
    });
  }

  clear(): void {
    this.state.files = [];
    this.state.processed = [];
    this.state.processing = false;
  }
}

describe('Image Processing Integration Tests', () => {
  let service: ImageProcessingService;

  beforeEach(() => {
    service = new ImageProcessingService();
  });

  it('should complete full workflow from upload to download', async () => {
    // Step 1: Add files
    const files = [
      new File(['test1'], 'test1.png', { type: 'image/png' }),
      new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
    ];

    await service.addFiles(files);

    expect(service.state.files).toHaveLength(2);
    expect(service.state.files[0].status).toBe('pending');
    expect(service.state.files[1].status).toBe('pending');

    // Step 2: Process batch
    const targetSize = { width: 1080, height: 1080 };
    const quality = 90;

    await service.runBatch(targetSize, quality);

    expect(service.state.processing).toBe(false);
    expect(service.state.files[0].status).toBe('completed');
    expect(service.state.files[1].status).toBe('completed');
    expect(service.state.files[0].progress).toBe(100);
    expect(service.state.files[1].progress).toBe(100);
    expect(service.state.processed).toHaveLength(2);

    // Step 3: Download
    const zipBlob = await service.downloadAll();

    expect(zipBlob).toBeInstanceOf(Blob);
    expect(zipBlob.type).toBe('application/zip');
  });

  it('should filter invalid files during upload', async () => {
    const files = [
      new File(['valid'], 'valid.png', { type: 'image/png' }),
      new File(['invalid'], 'invalid.gif', { type: 'image/gif' }),
      new File(['invalid'], 'invalid.pdf', { type: 'application/pdf' }),
    ];

    await service.addFiles(files);

    expect(service.state.files).toHaveLength(1);
    expect(service.state.files[0].name).toBe('valid.png');
  });

  it('should respect maximum file count', async () => {
    const files = Array.from(
      { length: 60 },
      (_, i) => new File([`test${i}`], `test${i}.png`, { type: 'image/png' })
    );

    await service.addFiles(files);

    expect(service.state.files).toHaveLength(50);
  });

  it('should filter files exceeding size limit', async () => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const smallFile = new File(['x'], 'small.png', { type: 'image/png' });
    const largeFile = new File(['x'.repeat(maxSize + 1)], 'large.png', {
      type: 'image/png',
    });

    await service.addFiles([smallFile, largeFile]);

    expect(service.state.files).toHaveLength(1);
    expect(service.state.files[0].name).toBe('small.png');
  });

  it('should not start processing when already processing', async () => {
    const files = [new File(['test'], 'test.png', { type: 'image/png' })];
    await service.addFiles(files);

    service.state.processing = true;
    const fileCountBefore = service.state.files.length;

    await service.runBatch({ width: 1080, height: 1080 }, 90);

    expect(service.state.files[0].status).toBe('pending');
    expect(service.state.files.length).toBe(fileCountBefore);
  });

  it('should not start processing when no files', async () => {
    await service.runBatch({ width: 1080, height: 1080 }, 90);

    expect(service.state.processing).toBe(false);
    expect(service.state.processed).toHaveLength(0);
  });

  it('should handle processing errors gracefully', async () => {
    const files = [new File(['test'], 'test.png', { type: 'image/png' })];
    await service.addFiles(files);

    // Mock processing error
    service.processImage = vi.fn().mockRejectedValue(new Error('Processing failed'));

    await service.runBatch({ width: 1080, height: 1080 }, 90);

    expect(service.state.files[0].status).toBe('failed');
    expect(service.state.files[0].progress).toBe(0);
    expect(service.state.processed).toHaveLength(0);
  });

  it('should skip already processed files', async () => {
    const files = [
      new File(['test1'], 'test1.png', { type: 'image/png' }),
      new File(['test2'], 'test2.png', { type: 'image/png' }),
    ];
    await service.addFiles(files);

    // Complete first batch
    await service.runBatch({ width: 1080, height: 1080 }, 90);
    expect(service.state.processed).toHaveLength(2);

    // Try processing again
    const processedCountBefore = service.state.processed.length;
    await service.runBatch({ width: 1080, height: 1080 }, 90);

    expect(service.state.processed.length).toBe(processedCountBefore);
  });

  it('should clear all state', async () => {
    const files = [new File(['test'], 'test.png', { type: 'image/png' })];
    await service.addFiles(files);
    await service.runBatch({ width: 1080, height: 1080 }, 90);

    service.clear();

    expect(service.state.files).toHaveLength(0);
    expect(service.state.processed).toHaveLength(0);
    expect(service.state.processing).toBe(false);
  });

  it('should update progress during processing', async () => {
    const files = [new File(['test'], 'test.png', { type: 'image/png' })];
    await service.addFiles(files);

    const progressValues: number[] = [];
    const originalProcessImage = service.processImage.bind(service);

    service.processImage = async function (
      this: ImageProcessingService,
      file,
      targetSize,
      quality
    ) {
      progressValues.push(file.progress);
      return originalProcessImage(file, targetSize, quality);
    };

    await service.runBatch({ width: 1080, height: 1080 }, 90);

    // 進捗が記録されていることを確認（具体的な値は実装依存）
    expect(progressValues.length).toBeGreaterThan(0);
    expect(service.state.files[0].progress).toBe(100);
  });

  it('should rename processed files correctly', async () => {
    const files = [
      new File(['test'], 'photo.png', { type: 'image/png' }),
      new File(['test'], 'image.jpg', { type: 'image/jpeg' }),
    ];
    await service.addFiles(files);

    await service.runBatch({ width: 1080, height: 1080 }, 90);

    expect(service.state.processed[0].name).toBe('photo_resized.jpg');
    expect(service.state.processed[1].name).toBe('image_resized.jpg');
  });
});
