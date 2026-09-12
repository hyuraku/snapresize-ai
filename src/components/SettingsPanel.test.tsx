import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from './SettingsPanel';
import { useImageStore } from '../store/imageStore';
import { MAX_OUTPUT_PX } from '../constants/limits';

const initialSettings = {
  preset: 'custom' as const,
  customWidth: 1080,
  customHeight: 1080,
  quality: 90,
  enableWatermark: false,
  watermarkText: '',
  watermarkPosition: 'bottomRight' as const,
  enableBackgroundRemoval: false,
};

describe('SettingsPanel - custom output size', () => {
  beforeEach(() => {
    useImageStore.setState({ settings: { ...initialSettings }, customSizeClamped: false });
  });

  const widthInput = (): HTMLInputElement => screen.getByTestId('customWidth');
  const heightInput = (): HTMLInputElement => screen.getByTestId('customHeight');

  it('lets the user type a multi-digit value without clamping each keystroke', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel lang="ja" />);

    await user.clear(widthInput());
    await user.type(widthInput(), '2000');

    // 入力途中は store に書かれない（"2" が 100 にクランプされて消えない）
    expect(useImageStore.getState().settings.customWidth).toBe(1080);
    expect(widthInput()).toHaveValue(2000);

    await user.tab(); // blur で確定

    expect(useImageStore.getState().settings.customWidth).toBe(2000);
    expect(useImageStore.getState().customSizeClamped).toBe(false);
    expect(screen.queryByTestId('customSizeNote')).not.toBeInTheDocument();
    expect(widthInput()).toHaveValue(2000);
  });

  it('clamps on commit and shows the note with the applied value', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel lang="ja" />);

    await user.clear(widthInput());
    await user.type(widthInput(), '99999');
    await user.tab();

    expect(useImageStore.getState().settings.customWidth).toBe(MAX_OUTPUT_PX);
    expect(useImageStore.getState().customSizeClamped).toBe(true);
    // 実際に適用された値が表示される
    expect(widthInput()).toHaveValue(MAX_OUTPUT_PX);

    const note = screen.getByTestId('customSizeNote');
    expect(note).toHaveTextContent(String(MAX_OUTPUT_PX));
  });

  it('commits on Enter as well as on blur', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel lang="ja" />);

    await user.clear(heightInput());
    await user.type(heightInput(), '1500{Enter}');

    expect(useImageStore.getState().settings.customHeight).toBe(1500);
    expect(useImageStore.getState().customSizeClamped).toBe(false);
    expect(heightInput()).toHaveValue(1500);
  });

  it('falls back to the previous value when the field is left empty', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel lang="ja" />);

    await user.clear(widthInput());
    await user.tab();

    expect(useImageStore.getState().settings.customWidth).toBe(1080);
    expect(widthInput()).toHaveValue(1080);
    expect(screen.queryByTestId('customSizeNote')).not.toBeInTheDocument();
  });

  it('clears the note once a valid size is entered again', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel lang="ja" />);

    await user.clear(widthInput());
    await user.type(widthInput(), '99999');
    await user.tab();
    expect(screen.getByTestId('customSizeNote')).toBeInTheDocument();

    await user.clear(widthInput());
    await user.type(widthInput(), '1200');
    await user.tab();

    expect(useImageStore.getState().settings.customWidth).toBe(1200);
    expect(screen.queryByTestId('customSizeNote')).not.toBeInTheDocument();
  });

  it('resyncs the drafts when the size changes from outside the panel', async () => {
    const user = userEvent.setup();
    render(<SettingsPanel lang="ja" />);

    // 未確定の下書きがある状態で外から寸法が変わる
    await user.clear(widthInput());
    await user.type(widthInput(), '333');

    act(() => {
      useImageStore.getState().setCustomSize(640, 480);
    });

    expect(widthInput()).toHaveValue(640);
    expect(heightInput()).toHaveValue(480);
  });
});
