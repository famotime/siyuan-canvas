<template>
  <Transition name="png-dialog">
    <div
      v-if="visible"
      class="png-export-backdrop"
      data-testid="png-export-dialog"
      @click.self="!loading && $emit('close')"
    >
      <div class="png-export-dialog" @wheel.passive.stop>
        <div class="png-export-dialog__header">
          <h2>{{ t("pngExportDialogTitle") }}</h2>
        </div>

        <div class="png-export-dialog__body">
          <fieldset class="png-export-fieldset" :disabled="loading">
            <legend class="png-export-fieldset__legend">{{ t("pngExportRange") }}</legend>
            <div class="png-export-options">
              <label
                class="png-export-option"
                :class="{ 'png-export-option--active': pngExportRange === 'full' }"
              >
                <input
                  v-model="pngExportRange"
                  data-testid="png-export-range-full"
                  name="png-export-range"
                  type="radio"
                  value="full"
                >
                <!-- full canvas: large rectangle filling the card -->
                <svg class="png-export-option__preview-icon" viewBox="0 0 48 32" fill="none">
                  <rect x="2" y="2" width="44" height="28" rx="3" stroke="currentColor" stroke-width="2" fill="var(--canvas-surface, #fafafa)"/>
                  <rect x="8" y="8" width="10" height="6" rx="1" fill="currentColor" opacity="0.15"/>
                  <rect x="22" y="10" width="8" height="4" rx="1" fill="currentColor" opacity="0.15"/>
                  <rect x="12" y="18" width="14" height="6" rx="1" fill="currentColor" opacity="0.15"/>
                </svg>
                <span class="png-export-option__label">{{ t("pngExportRangeFull") }}</span>
              </label>
              <label
                class="png-export-option"
                :class="{ 'png-export-option--active': pngExportRange === 'viewport' }"
              >
                <input
                  v-model="pngExportRange"
                  data-testid="png-export-range-viewport"
                  name="png-export-range"
                  type="radio"
                  value="viewport"
                >
                <!-- viewport: framed crop of the canvas -->
                <svg class="png-export-option__preview-icon" viewBox="0 0 48 32" fill="none">
                  <rect x="2" y="2" width="44" height="28" rx="3" stroke="currentColor" stroke-width="2" fill="var(--canvas-surface, #fafafa)"/>
                  <rect x="8" y="8" width="10" height="6" rx="1" fill="currentColor" opacity="0.1"/>
                  <rect x="22" y="10" width="8" height="4" rx="1" fill="currentColor" opacity="0.1"/>
                  <rect x="12" y="18" width="14" height="6" rx="1" fill="currentColor" opacity="0.1"/>
                  <rect x="14" y="4" width="20" height="24" rx="2" stroke="currentColor" stroke-width="2.5" fill="none"/>
                </svg>
                <span class="png-export-option__label">{{ t("pngExportRangeViewport") }}</span>
              </label>
            </div>
          </fieldset>

          <fieldset class="png-export-fieldset" :disabled="loading">
            <legend class="png-export-fieldset__legend">{{ t("pngExportBackground") }}</legend>
            <div class="png-export-options png-export-options--3col">
              <label
                class="png-export-option"
                :class="{ 'png-export-option--active': pngExportBackgroundMode === 'white' }"
              >
                <input
                  v-model="pngExportBackgroundMode"
                  data-testid="png-export-background-white"
                  name="png-export-background"
                  type="radio"
                  value="white"
                >
                <span class="png-export-option__swatch png-export-option__swatch--white" aria-hidden="true" />
                <span class="png-export-option__label">{{ t("pngExportBackgroundWhite") }}</span>
              </label>
              <label
                class="png-export-option"
                :class="{ 'png-export-option--active': pngExportBackgroundMode === 'transparent' }"
              >
                <input
                  v-model="pngExportBackgroundMode"
                  data-testid="png-export-background-transparent"
                  name="png-export-background"
                  type="radio"
                  value="transparent"
                >
                <span class="png-export-option__swatch png-export-option__swatch--checker" aria-hidden="true" />
                <span class="png-export-option__label">{{ t("pngExportBackgroundTransparent") }}</span>
              </label>
              <label
                ref="customColorLabelRef"
                class="png-export-option"
                :class="{ 'png-export-option--active': pngExportBackgroundMode === 'custom' }"
                @click="onCustomColorClick"
              >
                <input
                  v-model="pngExportBackgroundMode"
                  data-testid="png-export-background-custom"
                  name="png-export-background"
                  type="radio"
                  value="custom"
                >
                <span
                  class="png-export-option__swatch png-export-option__swatch--custom"
                  :style="{ backgroundColor: pngExportCustomColor }"
                  aria-hidden="true"
                />
                <span class="png-export-option__label">{{ t("pngExportBackgroundCustom") }}</span>
                <input
                  ref="colorInputRef"
                  v-model="pngExportCustomColor"
                  class="png-export-color-input-hidden"
                  data-testid="png-export-custom-color"
                  type="color"
                >
              </label>
            </div>
          </fieldset>
        </div>

        <div class="png-export-dialog__actions">
          <button
            class="png-export-btn png-export-btn--cancel"
            data-testid="png-export-cancel"
            type="button"
            :disabled="loading"
            @click="$emit('close')"
          >
            {{ t("dialogCancel") }}
          </button>
          <button
            class="png-export-btn png-export-btn--confirm"
            data-testid="png-export-confirm"
            type="button"
            :disabled="loading"
            @click="$emit('confirm')"
          >
            <span v-if="loading" class="png-export-btn__spinner" aria-hidden="true" />
            <span>{{ loading ? t("pngExportExporting") : t("pngExportConfirm") }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts">
export default { name: "CanvasPngExportDialog" }
</script>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import type {
  CanvasPngExportBackgroundMode,
  CanvasPngExportRange,
} from "@/canvas/png-export"

const props = defineProps<{
  visible: boolean
  loading: boolean
  t: (key: string) => string
  pngExportRange: CanvasPngExportRange
  pngExportBackgroundMode: CanvasPngExportBackgroundMode
  pngExportCustomColor: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
  (e: 'update:pngExportRange', value: CanvasPngExportRange): void
  (e: 'update:pngExportBackgroundMode', value: CanvasPngExportBackgroundMode): void
  (e: 'update:pngExportCustomColor', value: string): void
}>()

const colorInputRef = ref<HTMLInputElement>()
const customColorLabelRef = ref<HTMLElement>()

const pngExportRange = computed({
  get: () => props.pngExportRange,
  set: (val) => emit('update:pngExportRange', val),
})
const pngExportBackgroundMode = computed({
  get: () => props.pngExportBackgroundMode,
  set: (val) => emit('update:pngExportBackgroundMode', val),
})
const pngExportCustomColor = computed({
  get: () => props.pngExportCustomColor,
  set: (val) => emit('update:pngExportCustomColor', val),
})

// 选择自定义颜色时自动弹出取色器
function onCustomColorClick() {
  if (pngExportBackgroundMode.value === 'custom') {
    // 已经选中，直接弹取色器
    nextTick(() => colorInputRef.value?.click())
  } else {
    pngExportBackgroundMode.value = 'custom'
    nextTick(() => colorInputRef.value?.click())
  }
}
</script>

<style scoped>
.png-export-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 30%);
  backdrop-filter: blur(2px);
}

.png-export-dialog {
  width: 400px;
  max-width: calc(100vw - 32px);
  background: var(--canvas-surface-elevated, #fff);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 12%), 0 2px 8px rgb(0 0 0 / 6%);
  overflow: hidden;
}

.png-export-dialog__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 24px 0;
}

.png-export-dialog__icon {
  display: flex;
  color: var(--b3-theme-primary, #3575f0);
  flex-shrink: 0;
}

.png-export-dialog__header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-surface, #1a1a1a);
}

.png-export-dialog__body {
  padding: 20px 24px;
}

.png-export-fieldset {
  border: none;
  padding: 0;
  margin: 0 0 16px;
}

.png-export-fieldset:last-child {
  margin-bottom: 0;
}

.png-export-fieldset__legend {
  display: block;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface-variant, #5a5a5a);
}

.png-export-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.png-export-options--3col {
  grid-template-columns: 1fr 1fr 1fr;
}

.png-export-option {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 10px;
  border: 2px solid var(--canvas-border, #e0e0e0);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
  user-select: none;
}

.png-export-option:hover {
  border-color: var(--b3-theme-primary-light, #a0c4ff);
}

.png-export-option--active {
  border-color: var(--b3-theme-primary, #3575f0);
  background: var(--b3-theme-primary-lightest, #ebf2ff);
}

.png-export-option input[type="radio"] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.png-export-option__preview-icon {
  width: 100%;
  height: 36px;
  color: var(--b3-theme-on-surface-variant, #5a5a5a);
}

.png-export-option--active .png-export-option__preview-icon {
  color: var(--b3-theme-primary, #3575f0);
}

.png-export-option__swatch {
  width: 40px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--canvas-border, #d0d0d0);
}

.png-export-option__swatch--white {
  background: #fff;
}

.png-export-option__swatch--checker {
  background-image:
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 10px 10px;
  background-position: 0 0, 0 5px, 5px -5px, -5px 0;
}

.png-export-option__swatch--custom {
  border-color: var(--canvas-border, #d0d0d0);
}

.png-export-option__label {
  font-size: 12px;
  color: var(--b3-theme-on-surface, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.png-export-color-input-hidden {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
}

.png-export-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--canvas-border, #eee);
}

.png-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 20px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s, opacity 0.15s;
}

.png-export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.png-export-btn--cancel {
  color: var(--b3-theme-on-surface, #333);
  background: var(--canvas-surface, #f5f5f5);
}

.png-export-btn--cancel:hover:not(:disabled) {
  background: var(--canvas-border, #e0e0e0);
}

.png-export-btn--confirm {
  color: #fff;
  background: var(--b3-theme-primary, #3575f0);
  min-width: 100px;
  justify-content: center;
}

.png-export-btn--confirm:hover:not(:disabled) {
  background: var(--b3-theme-primary-hover, #2a62d4);
}

.png-export-btn__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgb(255 255 255 / 30%);
  border-top-color: #fff;
  border-radius: 50%;
  animation: png-spin 0.6s linear infinite;
}

@keyframes png-spin {
  to { transform: rotate(360deg); }
}

/* Transition */
.png-dialog-enter-active {
  transition: opacity 0.2s ease;
}
.png-dialog-enter-active .png-export-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.png-dialog-leave-active {
  transition: opacity 0.15s ease;
}
.png-dialog-leave-active .png-export-dialog {
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.png-dialog-enter-from {
  opacity: 0;
}
.png-dialog-enter-from .png-export-dialog {
  transform: scale(0.95);
  opacity: 0;
}
.png-dialog-leave-to {
  opacity: 0;
}
.png-dialog-leave-to .png-export-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
