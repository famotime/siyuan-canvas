<template>
  <div
    v-if="visible"
    class="canvas-dialog-backdrop"
    data-testid="png-export-dialog"
    @click.self="$emit('close')"
  >
    <div
      class="canvas-dialog"
      @wheel.passive.stop
    >
      <div class="canvas-dialog__header">
        <h2>{{ t("pngExportDialogTitle") }}</h2>
      </div>
      <div class="canvas-dialog__grid">
        <fieldset class="canvas-dialog__fieldset">
          <legend>{{ t("pngExportRange") }}</legend>
          <label class="canvas-dialog__option canvas-dialog__option--card">
            <input
              v-model="pngExportRange"
              data-testid="png-export-range-full"
              name="png-export-range"
              type="radio"
              value="full"
            >
            <span>{{ t("pngExportRangeFull") }}</span>
          </label>
          <label class="canvas-dialog__option canvas-dialog__option--card">
            <input
              v-model="pngExportRange"
              data-testid="png-export-range-viewport"
              name="png-export-range"
              type="radio"
              value="viewport"
            >
            <span>{{ t("pngExportRangeViewport") }}</span>
          </label>
        </fieldset>
        <fieldset class="canvas-dialog__fieldset">
          <legend>{{ t("pngExportBackground") }}</legend>
          <div class="canvas-dialog__choice-grid">
            <label class="canvas-dialog__option canvas-dialog__option--card">
              <input
                v-model="pngExportBackgroundMode"
                data-testid="png-export-background-white"
                name="png-export-background"
                type="radio"
                value="white"
              >
              <span>{{ t("pngExportBackgroundWhite") }}</span>
            </label>
            <label class="canvas-dialog__option canvas-dialog__option--card">
              <input
                v-model="pngExportBackgroundMode"
                data-testid="png-export-background-transparent"
                name="png-export-background"
                type="radio"
                value="transparent"
              >
              <span>{{ t("pngExportBackgroundTransparent") }}</span>
            </label>
            <label class="canvas-dialog__option canvas-dialog__option--card">
              <input
                v-model="pngExportBackgroundMode"
                data-testid="png-export-background-custom"
                name="png-export-background"
                type="radio"
                value="custom"
              >
              <span>{{ t("pngExportBackgroundCustom") }}</span>
            </label>
          </div>
          <label class="canvas-dialog__field canvas-dialog__field--compact">
            <span>{{ t("pngExportCustomColor") }}</span>
            <input
              v-model="pngExportCustomColor"
              class="canvas-dialog__control canvas-dialog__control--color"
              data-testid="png-export-custom-color"
              type="color"
              :disabled="pngExportBackgroundMode !== 'custom'"
            >
          </label>
        </fieldset>
      </div>
      <div class="canvas-dialog__actions">
        <button
          class="b3-button b3-button--outline"
          data-testid="png-export-cancel"
          type="button"
          @click="$emit('close')"
        >
          {{ t("dialogCancel") }}
        </button>
        <button
          class="b3-button"
          data-testid="png-export-confirm"
          type="button"
          @click="$emit('confirm')"
        >
          {{ t("pngExportConfirm") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default { name: "CanvasPngExportDialog" }
</script>

<script setup lang="ts">
import { computed } from "vue"
import type {
  CanvasPngExportBackgroundMode,
  CanvasPngExportRange,
} from "@/canvas/png-export"

const props = defineProps<{
  visible: boolean
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

const t = props.t

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
</script>
