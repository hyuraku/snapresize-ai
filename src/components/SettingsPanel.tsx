import {
  ChevronDown,
  Sparkles,
  Type,
  SlidersHorizontal,
  Wand2,
  Smartphone,
  Palette,
} from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useImageStore } from '../store/imageStore';
import { useCapabilityDetection } from '../hooks/useCapabilityDetection';
import { capabilityDetector } from '../lib/capabilityDetector';
import { getTranslation } from '../constants/translations';
import { SNS_PRESETS, PRESET_GROUPS } from '../constants/presets';
import { MAX_OUTPUT_PX, MIN_OUTPUT_PX, clampOutputSize } from '../constants/limits';
import type { SNSPresetKey, WatermarkPosition } from '../types';

interface SettingsPanelProps {
  lang?: 'ja' | 'en';
}

export const SettingsPanel = ({ lang = 'ja' }: SettingsPanelProps) => {
  const t = (key: string) => getTranslation(key, lang);
  const [isOpen, setIsOpen] = useState(true);
  const { capabilityInfo } = useCapabilityDetection();

  const settings = useImageStore((state) => state.settings);
  const customSizeClamped = useImageStore((state) => state.customSizeClamped);
  const modelState = useImageStore((state) => state.modelState);
  const setPreset = useImageStore((state) => state.setPreset);
  const setCustomSize = useImageStore((state) => state.setCustomSize);
  const setQuality = useImageStore((state) => state.setQuality);
  const setWatermark = useImageStore((state) => state.setWatermark);
  const setBackgroundRemoval = useImageStore((state) => state.setBackgroundRemoval);

  const getPresetLabel = (): string => {
    const preset = SNS_PRESETS[settings.preset];
    return lang === 'ja' ? preset.label : preset.labelEn;
  };

  const getSummary = (): string => {
    const parts = [getPresetLabel(), `${settings.quality}%`];
    if (settings.enableBackgroundRemoval) parts.push(lang === 'ja' ? '背景除去' : 'BG Removal');
    if (settings.enableWatermark) parts.push(t('watermarkWith'));
    return parts.join(' / ');
  };

  // 入力中は下書き（文字列）を保持し、確定時だけ store に渡す。
  // 1 文字ごとにクランプすると「2000」と打つ途中の "2" が 100 に書き換わり、
  // キーボードでは目的の値を入力できなくなるため。
  const [widthDraft, setWidthDraft] = useState(String(settings.customWidth));
  const [heightDraft, setHeightDraft] = useState(String(settings.customHeight));

  // プリセット切り替えなど、外から寸法が変わったときは下書きを同期する。
  // 「前回の値と比べてレンダー中に調整する」React 公式の書き方
  // （https://react.dev/learn/you-might-not-need-an-effect）。
  const [appliedSize, setAppliedSize] = useState({
    width: settings.customWidth,
    height: settings.customHeight,
  });
  if (appliedSize.width !== settings.customWidth || appliedSize.height !== settings.customHeight) {
    setAppliedSize({ width: settings.customWidth, height: settings.customHeight });
    setWidthDraft(String(settings.customWidth));
    setHeightDraft(String(settings.customHeight));
  }

  /**
   * 下書きを確定する（blur / Enter）。
   * 空欄や数値にならない入力は「直前に確定していた値」に戻す
   * （1080 に固定すると、ユーザーが設定済みの値を黙って捨ててしまうため）。
   */
  const commitCustomSize = (): void => {
    const parsedWidth = parseInt(widthDraft, 10);
    const parsedHeight = parseInt(heightDraft, 10);
    const width = Number.isNaN(parsedWidth) ? settings.customWidth : parsedWidth;
    const height = Number.isNaN(parsedHeight) ? settings.customHeight : parsedHeight;

    // クランプの実体は store 側（ここは表示を実際に適用された値へ合わせるだけ）
    setCustomSize(width, height);
    setWidthDraft(String(clampOutputSize(width)));
    setHeightDraft(String(clampOutputSize(height)));
  };

  const handleCustomSizeKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCustomSize();
    }
  };

  return (
    <div className="rounded-2xl border-2 border-(--color-sand) bg-gradient-to-br from-white to-(--color-cream) p-6">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left group"
        data-testid="settingsToggle"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-(--color-coral) to-(--color-coral-dark) shadow-lg shadow-(--color-coral)/20">
            <SlidersHorizontal className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-(--color-navy)">{t('settingsTitle')}</h2>
            <p className="text-xs text-(--color-navy-light)" data-testid="settingsSummary">
              {getSummary()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 tag tag-coral">
            <Wand2 className="w-3 h-3" />
            {t('settingsHint')}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-sand) group-hover:bg-(--color-cream-dark) transition-colors">
            <ChevronDown
              className={`h-5 w-5 text-(--color-navy-light) transition-transform duration-300 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
            />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="mt-6 space-y-6" data-testid="settingsPanel">
          {/* SNS Presets */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-(--color-coral)" />
              <p className="text-sm font-bold text-(--color-navy)">{t('presetLabel')}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(PRESET_GROUPS).map(([, presets]) =>
                presets.map((presetKey) => {
                  const preset = SNS_PRESETS[presetKey as SNSPresetKey];
                  const isSelected = settings.preset === presetKey;
                  return (
                    <label
                      key={presetKey}
                      data-testid={`preset-${presetKey}`}
                      className={`relative flex cursor-pointer flex-col rounded-xl border-2 p-3 transition-all duration-200 ${
                        isSelected
                          ? 'border-(--color-coral) bg-(--color-coral)/5 shadow-md shadow-(--color-coral)/10'
                          : 'border-(--color-sand) bg-white hover:border-(--color-coral)/30 hover:shadow-sm'
                      }`}
                    >
                      <input
                        type="radio"
                        name="preset"
                        value={presetKey}
                        checked={isSelected}
                        onChange={() => setPreset(presetKey as SNSPresetKey)}
                        className="sr-only"
                        aria-label={`${lang === 'ja' ? preset.label : preset.labelEn}${presetKey !== 'custom' ? ` ${preset.width} × ${preset.height}` : ''}`}
                      />
                      <span
                        className={`text-sm font-medium ${isSelected ? 'text-(--color-coral)' : 'text-(--color-navy)'}`}
                      >
                        {lang === 'ja' ? preset.label : preset.labelEn}
                      </span>
                      {presetKey !== 'custom' && (
                        <span
                          className={`text-xs mt-0.5 ${isSelected ? 'text-(--color-coral)/70' : 'text-(--color-navy-light)'}`}
                        >
                          {preset.width} × {preset.height}
                        </span>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-(--color-coral)" />
                      )}
                    </label>
                  );
                })
              )}
            </div>
            {settings.preset === 'custom' && (
              <>
                <div className="flex gap-3 mt-3" data-testid="customSizeInputs">
                  <div className="flex-1">
                    <label className="text-xs text-(--color-navy-light) mb-1 block font-medium">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      min={MIN_OUTPUT_PX}
                      max={MAX_OUTPUT_PX}
                      value={widthDraft}
                      onChange={(e) => setWidthDraft(e.target.value)}
                      onBlur={commitCustomSize}
                      onKeyDown={handleCustomSizeKeyDown}
                      className="input-field"
                      data-testid="customWidth"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-(--color-navy-light) mb-1 block font-medium">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      min={MIN_OUTPUT_PX}
                      max={MAX_OUTPUT_PX}
                      value={heightDraft}
                      onChange={(e) => setHeightDraft(e.target.value)}
                      onBlur={commitCustomSize}
                      onKeyDown={handleCustomSizeKeyDown}
                      className="input-field"
                      data-testid="customHeight"
                    />
                  </div>
                </div>
                {customSizeClamped && (
                  <p
                    className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
                    data-testid="customSizeNote"
                  >
                    {t('customSizeClampedNote')
                      .replace('{min}', String(MIN_OUTPUT_PX))
                      .replace('{max}', String(MAX_OUTPUT_PX))}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Options - 2 columns */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Background Removal */}
            <div className="rounded-xl border-2 border-(--color-sand) bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-(--color-coral)" />
                <p className="text-sm font-bold text-(--color-navy)">{t('bgRemovalLabel')}</p>
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-(--color-sand) bg-(--color-cream)/50 px-4 py-3 transition hover:bg-(--color-cream) group">
                <span className="text-sm text-(--color-navy)">{t('bgRemovalToggle')}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.enableBackgroundRemoval}
                  aria-label={t('bgRemovalToggle')}
                  data-testid="bgRemovalToggle"
                  className={`toggle-switch ${settings.enableBackgroundRemoval ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setBackgroundRemoval(!settings.enableBackgroundRemoval);
                  }}
                />
              </label>
              {settings.enableBackgroundRemoval && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {t('bgRemovalNote').replace(
                    '{size}',
                    capabilityDetector.getModelSizeLabel(capabilityInfo?.dtype)
                  )}
                </p>
              )}
              {modelState.status === 'loading' && (
                <div className="space-y-2" data-testid="modelStatus">
                  <div className="flex items-center gap-2 text-xs text-(--color-coral)">
                    <div className="h-2 w-2 rounded-full bg-(--color-coral) animate-pulse-soft" />
                    {modelState.message}
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${modelState.progress}%` }} />
                  </div>
                </div>
              )}
              {modelState.status === 'ready' && (
                <p
                  className="text-xs text-(--color-sage) flex items-center gap-1.5 font-medium"
                  data-testid="modelReady"
                >
                  <span className="h-2 w-2 rounded-full bg-(--color-sage)" />
                  {t('modelReady')}
                </p>
              )}
              {modelState.status === 'error' && (
                <p className="text-xs text-red-500">{modelState.message}</p>
              )}
            </div>

            {/* Watermark */}
            <div className="rounded-xl border-2 border-(--color-sand) bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-(--color-sage)" />
                <p className="text-sm font-bold text-(--color-navy)">{t('watermarkLabel')}</p>
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-(--color-sand) bg-(--color-cream)/50 px-4 py-3 transition hover:bg-(--color-cream) group">
                <span className="text-sm text-(--color-navy)">{t('watermarkToggle')}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.enableWatermark}
                  aria-label={t('watermarkToggle')}
                  data-testid="watermarkToggle"
                  className={`toggle-switch ${settings.enableWatermark ? 'active' : ''}`}
                  style={
                    settings.enableWatermark
                      ? {
                          background:
                            'linear-gradient(90deg, var(--color-sage), var(--color-sage-light))',
                        }
                      : {}
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    setWatermark(!settings.enableWatermark);
                  }}
                />
              </label>
              {settings.enableWatermark && (
                <div className="space-y-3" data-testid="watermarkOptions">
                  <input
                    type="text"
                    value={settings.watermarkText}
                    onChange={(e) => setWatermark(true, e.target.value)}
                    placeholder={t('placeholderWatermark')}
                    className="input-field"
                    data-testid="watermarkText"
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        'topLeft',
                        'center',
                        'topRight',
                        'bottomLeft',
                        'center',
                        'bottomRight',
                      ] as WatermarkPosition[]
                    ).map((pos, idx) => {
                      if (idx === 4) return null;
                      return (
                        <label
                          key={pos + idx}
                          className={`flex cursor-pointer items-center justify-center rounded-lg border-2 py-1.5 text-xs font-medium transition-all ${
                            settings.watermarkPosition === pos
                              ? 'border-(--color-sage) bg-(--color-sage)/10 text-(--color-sage)'
                              : 'border-(--color-sand) text-(--color-navy-light) hover:border-(--color-sage)/30'
                          }`}
                        >
                          <input
                            type="radio"
                            name="watermarkPos"
                            value={pos}
                            checked={settings.watermarkPosition === pos}
                            onChange={() => setWatermark(true, undefined, pos)}
                            className="sr-only"
                            aria-label={t(`pos${pos.charAt(0).toUpperCase() + pos.slice(1)}`)}
                          />
                          {t(`pos${pos.charAt(0).toUpperCase() + pos.slice(1)}`)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quality */}
          <div className="rounded-xl border-2 border-(--color-sand) bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-(--color-coral)" />
                <p className="text-sm font-bold text-(--color-navy)">{t('qualityLabel')}</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-(--color-coral)/10 to-(--color-sage)/10 px-4 py-1.5 border border-(--color-coral)/20">
                <span
                  className="text-2xl font-bold text-(--color-coral)"
                  data-testid="qualityValue"
                >
                  {settings.quality}
                </span>
                <span className="text-sm text-(--color-navy-light)">%</span>
              </div>
            </div>
            <div className="relative pt-2">
              <input
                type="range"
                min="60"
                max="100"
                value={settings.quality}
                onChange={(e) => setQuality(parseInt(e.target.value))}
                aria-label={`${t('qualityLabel')} ${settings.quality}%`}
                aria-valuemin={60}
                aria-valuemax={100}
                aria-valuenow={settings.quality}
                aria-valuetext={`${settings.quality}%`}
                data-testid="quality"
                className="w-full h-3 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-(--color-coral) [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                style={{
                  background: `linear-gradient(to right, var(--color-coral) 0%, var(--color-coral-light) ${((settings.quality - 60) / 40) * 100}%, var(--color-sand) ${((settings.quality - 60) / 40) * 100}%)`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-(--color-navy-light) font-medium">
              <span>{t('qualityLight')}</span>
              <span>{t('qualityHigh')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
