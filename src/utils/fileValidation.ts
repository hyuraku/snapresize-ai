/**
 * ファイルバリデーションユーティリティ
 * マジックバイト検証によるファイル内容の確認
 */

export interface ValidationResult {
  isValid: boolean;
  detectedType: string | null;
  error?: string;
}

/**
 * 画像ファイルのマジックバイトを検証する
 * 拡張子だけでなく、ファイルの実際の内容を確認
 */
export async function validateImageFile(file: File): Promise<ValidationResult> {
  try {
    // ファイルの先頭12バイトを読み取る
    const buffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPNG =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;

    // JPEG: FF D8 FF
    const isJPEG =
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

    // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF....WEBP)
    const isWebP =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;

    // 検出されたタイプを判定
    let detectedType: string | null = null;
    if (isPNG) {
      detectedType = 'image/png';
    } else if (isJPEG) {
      detectedType = 'image/jpeg';
    } else if (isWebP) {
      detectedType = 'image/webp';
    }

    // マジックバイトの検証結果
    if (!detectedType) {
      return {
        isValid: false,
        detectedType: null,
        error: 'Invalid image file format. Only PNG, JPEG, and WebP are supported.',
      };
    }

    // MIMEタイプの整合性チェック（JPEGはimage/jpegとimage/jpg両方許容）
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const fileMimeType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    
    if (!validMimeTypes.includes(fileMimeType)) {
      return {
        isValid: false,
        detectedType,
        error: `Invalid MIME type: ${file.type}. Expected ${validMimeTypes.join(', ')}.`,
      };
    }

    // MIMEタイプとマジックバイトの一致確認
    if (fileMimeType !== detectedType) {
      // JPEG/JPG の場合は許容
      if (!(fileMimeType === 'image/jpeg' && detectedType === 'image/jpeg')) {
        return {
          isValid: false,
          detectedType,
          error: `File content mismatch: declared as ${file.type} but detected as ${detectedType}.`,
        };
      }
    }

    return {
      isValid: true,
      detectedType,
    };
  } catch (error) {
    return {
      isValid: false,
      detectedType: null,
      error: `Failed to validate file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * 複数のファイルを検証し、有効なファイルのみを返す
 */
export async function validateImageFiles(
  files: File[]
): Promise<{ validFiles: File[]; invalidFiles: Array<{ file: File; error: string }> }> {
  const validFiles: File[] = [];
  const invalidFiles: Array<{ file: File; error: string }> = [];

  await Promise.all(
    files.map(async (file) => {
      const result = await validateImageFile(file);
      if (result.isValid) {
        validFiles.push(file);
      } else {
        invalidFiles.push({ file, error: result.error || 'Unknown validation error' });
      }
    })
  );

  return { validFiles, invalidFiles };
}
