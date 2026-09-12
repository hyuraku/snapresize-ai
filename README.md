# SnapResize AI

**AI-Powered Image Resizing & Background Removal Tool**

A fully browser-based AI image processing tool. Transform images for multiple social media platforms while protecting your privacy.

## Features

- **AI Background Removal**: Uses BRIA's RMBG-1.4 via Transformers.js. The model is downloaded from the Hugging Face Hub on first use and is licensed separately from this code (see [License](#license)).
- **SNS Batch Conversion**: Supports Instagram, Twitter, LinkedIn, Facebook formats
- **Complete Local Processing**: Images are never sent to external servers
- **Batch Processing**: Up to 50 images per batch, processed one at a time
- **Watermark**: Add customizable watermarks
- **PWA Support**: Installable. Offline use works only after the app shell, the ONNX Runtime and the model weights have been fetched and cached once; the first run needs network access.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **AI/ML**: Transformers.js v4 (WebGPU/WASM)
- **State**: Zustand
- **UI**: Tailwind CSS + Headless UI
- **Workers**: Web Workers + OffscreenCanvas
- **Storage**: Cache Storage API (model / runtime assets)

## Project Structure

```
/snapresize-ai
├── /public                      # PWA assets
├── /src
│   ├── /components              # React components
│   ├── /workers                 # Web Workers
│   ├── /lib                     # Core logic
│   ├── /store                   # Zustand stores
│   ├── /hooks                   # Custom hooks
│   └── /constants               # SNS presets
└── /tests                       # Unit/Integration/E2E
```

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run E2E tests
npm run test:e2e
```

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| React | 19.2.3 | UI Framework |
| TypeScript | 6.0.3 | Type Safety |
| Vite | 8.1.5 | Build Tool |
| Zustand | 5.0.14 | State Management |
| Transformers.js | 4.2.0 | AI/ML (Background Removal) |
| Tailwind CSS | 4.3.1 | Styling |
| JSZip | 3.10.1 | ZIP Export |
| Lucide React | 1.21.0 | Icon Library |
| File Saver | 2.0.5 | File Download |

## SNS Format Support

### Instagram
- Square: 1080x1080px
- Portrait: 1080x1350px
- Story: 1080x1920px

### Twitter/X
- Square: 1080x1080px
- Landscape: 1600x900px
- Header: 1500x500px

### LinkedIn
- Post: 1200x627px
- Banner: 1584x396px

### Facebook
- Post: 1200x630px
- Cover: 820x312px

## Performance Optimization

### Key Risks and Mitigations

1. **Model Download** (HIGH)
   - Quantization selected per environment (see table below)
   - Progressive loading with download progress
   - Cache Storage persistence (model weights)
   - Weights are fetched from the Hugging Face Hub (Brotli compression)

   | Environment | dtype | Approx. size |
   |---|---|---|
   | WebGPU with `shader-f16` | fp16 | 88MB |
   | WebGPU without `shader-f16` | fp32 | 176MB |
   | WASM fallback | q8 | 44MB |

   Weights for a dtype that is no longer in use are deleted from Cache Storage after a
   successful model load, so switching dtype does not leave stale files behind.

2. **ONNX Runtime WASM Assets** (MEDIUM)
   - The ONNX Runtime runtime (22.5MB) is bundled and served from our own origin
   - `env.backends.onnx.wasm.wasmPaths` is pinned to those assets, so nothing is fetched
     from the jsdelivr CDN at runtime. This keeps the app self-contained and avoids
     downloading the same binary twice (once via PWA precache, once from the CDN)

3. **WebGPU Unsupported Browsers** (MEDIUM-HIGH)
   - Auto-detection with WASM fallback
   - User warning display
   - Backend detection reports a recommended chunk size, but processing is sequential today

4. **Heavy Canvas API Processing** (HIGH)
   - Web Workers + OffscreenCanvas
   - Chunked processing (50ms delay)
   - A single background-removal Web Worker; images are processed one at a time

5. **Memory Management** (MEDIUM-HIGH)
   - Pixel budget enforced before allocation, with the reason shown in the UI
   - Blob URL tracking and release
   - Per file: 50MB; per batch: 50 files and 800MB total
   - Input resolution: 8192px per edge and 40MP in total
   - Output (custom size): clamped to 100-4096px

## Security & Privacy

- **Complete Local Processing**: Images are never uploaded
- **No Tracking**: No analytics or cookies
- **No accounts, no server-side storage**: Images stay in memory and are discarded on clear or reload; the cached model can be removed via the browser's site data
- **CSP Configured**: Content Security Policy applied
- **Privacy Notice**: Transparent information disclosure

### Network access

Images are never sent anywhere. On first use, the app fetches the background-removal model
from Hugging Face, which issues GET requests to `huggingface.co` and Hugging Face's CDN hosts.
The ONNX Runtime WASM assets are served from this app's own origin, not from a third-party CDN.
After the app shell, ONNX Runtime and model weights have been fetched and cached once, the app
works offline; the first run needs network access to complete the initial download.

## Testing

```bash
# Run all tests (Watch mode)
npm test

# Unit tests with coverage
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests (Playwright)
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

### Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all unit tests (Watch mode) |
| `npm run test:unit` | Run unit tests with coverage report |
| `npm run test:integration` | Run integration tests |
| `npm run test:e2e` | Run E2E tests with Playwright |
| `npm run test:coverage` | Generate and display coverage report |

### Test File Structure

```
/snapresize-ai
├── /src
│   ├── /test
│   │   └── setup.ts                      # Test environment setup
│   ├── /utils
│   │   └── imageProcessing.test.ts       # Utility function tests
│   ├── /components
│   │   ├── FileUpload.test.tsx           # File upload component tests
│   │   └── ProcessingQueue.test.tsx      # Processing queue component tests
│   └── /integration
│       └── imageProcessingFlow.test.ts   # Integration tests
├── /e2e
│   └── imageProcessing.spec.ts           # E2E tests
├── vitest.config.ts                      # Vitest configuration
└── playwright.config.ts                  # Playwright configuration
```

**Target Coverage**: >80% (Lines/Functions/Branches/Statements)

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 113+ | Full (WebGPU) | Recommended |
| Edge 113+ | Full (WebGPU) | Recommended |
| Opera 99+ | Full (WebGPU) | Recommended |
| Safari 26+ | Full (WebGPU) | Enabled by default on macOS 26 / iOS 26 / iPadOS 26 / visionOS 26 |
| Firefox 141+ | Full (WebGPU) | Windows. macOS ARM64 from Firefox 145. Linux planned for 2026 |

**When WebGPU is unavailable**: WASM fallback (up to 100x slower)

Support is decided by feature detection at runtime (`navigator.gpu` and `shader-f16`), never by
user agent strings. The versions above are for reference only: the same browser version can
still fall back to WASM depending on the OS, GPU, or user settings.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project has two separate licenses: the code in this repository, and the AI model it
downloads at runtime.

### Code

MIT License. See [LICENSE](./LICENSE).

### Background removal model

This app uses [BRIA's RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) for background
removal. The model is fetched from Hugging Face at runtime and is not bundled or
redistributed by this repository; the version used is whatever revision Hugging Face serves
for that model ID at request time, since this project does not currently pin a specific
revision.

RMBG-1.4 is licensed separately from this repository's code. Quoting the model card verbatim:

> The model is released under a Creative Commons license for non-commercial use.
>
> Commercial use is subject to a commercial agreement with BRIA.

- Model card / license field: `license: bria-rmbg-1.4`
- Full license terms: https://bria.ai/bria-huggingface-model-license-agreement/
- Commercial licensing: "To purchase a commercial license simply click [Here](https://go.bria.ai/3B4Asxv)."

Whether a given deployment or use of this app is commercial, and obtaining any required
agreement with BRIA for that use, is the responsibility of whoever deploys or uses the app.
This README makes no claim about whether any particular deployment holds such an agreement.

## Links

- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [RMBG-1.4 Model](https://huggingface.co/briaai/RMBG-1.4)
- [WebGPU Spec](https://www.w3.org/TR/webgpu/)
- [Vite Documentation](https://vitejs.dev/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
