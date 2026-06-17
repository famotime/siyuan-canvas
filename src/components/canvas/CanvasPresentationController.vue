<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue"
import { CanvasIcon } from "@/components/canvas/canvas-icon"

const props = defineProps<{
  editor: any
}>()

const presentation = computed(() => props.editor.presentation)
const recordLongPressTriggered = ref(false)
let recordLongPressTimer: number | null = null

const handlePrev = () => presentation.value.prev()
const handleNext = () => presentation.value.next()
const handleTogglePlay = () => presentation.value.togglePlay()
const handleExit = () => presentation.value.stop()

function clearRecordLongPressTimer() {
  if (recordLongPressTimer !== null) {
    clearTimeout(recordLongPressTimer)
    recordLongPressTimer = null
  }
}

function handleRecordPointerDown() {
  recordLongPressTriggered.value = false
  clearRecordLongPressTimer()
  recordLongPressTimer = window.setTimeout(() => {
    recordLongPressTriggered.value = true
    presentation.value.clearRecordedPath()
  }, 700)
}

function handleRecordPointerUp() {
  clearRecordLongPressTimer()
  if (recordLongPressTriggered.value) return
  presentation.value.toggleRecording()
}

function handleRecordPointerCancel() {
  clearRecordLongPressTimer()
}

onBeforeUnmount(() => {
  clearRecordLongPressTimer()
})
</script>

<template>
  <div class="canvas-presentation-controller" v-if="presentation.isActive">
    <div class="canvas-presentation-controller__panel">
      <button class="b3-menu__item" @click="handlePrev" :disabled="presentation.pathHistory.length === 0">
        <CanvasIcon name="chevron-left" />
      </button>
      <button class="b3-menu__item" @click="handleTogglePlay">
        <CanvasIcon :name="presentation.isPlaying ? 'pause' : 'play'" />
      </button>
      <button class="b3-menu__item" @click="handleNext" :disabled="presentation.availableNextNodes.length === 0">
        <CanvasIcon name="chevron-right" />
      </button>
      <button
        class="b3-menu__item b3-menu__item--record"
        :class="{
          'b3-menu__item--recording': presentation.isRecording,
          'b3-menu__item--has-recorded-path': presentation.hasRecordedPath,
        }"
        data-testid="presentation-record"
        type="button"
        :title="presentation.isRecording ? '停止录制播放路径' : presentation.hasRecordedPath ? '录制播放路径（长按清空已保存路径）' : '录制播放路径'"
        @pointerdown.prevent="handleRecordPointerDown"
        @pointerup.prevent="handleRecordPointerUp"
        @pointerleave="handleRecordPointerCancel"
        @pointercancel="handleRecordPointerCancel"
      >
        <CanvasIcon name="record" />
      </button>
      <div class="b3-menu__separator"></div>
      <button class="b3-menu__item" @click="handleExit">
        <CanvasIcon name="close" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.canvas-presentation-controller {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
}
.canvas-presentation-controller__panel {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 8px;
  border-radius: 8px;
  background-color: var(--b3-theme-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--b3-theme-surface-lighter);
}
.b3-menu__item {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  padding: 0;
  font-size: 18px;
}
.b3-menu__item:hover:not(:disabled) {
  background-color: var(--b3-theme-surface-lighter);
}
.b3-menu__item:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.b3-menu__item--recording {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.12);
}
.b3-menu__item--recording :deep(svg) {
  animation: canvas-record-pulse 1s ease-in-out infinite;
}
.b3-menu__item--has-recorded-path::after {
  content: "";
  position: absolute;
  right: 5px;
  top: 5px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px var(--b3-theme-surface);
}
.b3-menu__separator {
  width: 1px;
  height: 20px;
  background-color: var(--b3-theme-surface-lighter);
  margin: 0 8px;
}
@keyframes canvas-record-pulse {
  0%, 100% { opacity: 0.55; transform: scale(0.92); }
  50% { opacity: 1; transform: scale(1); }
}
</style>
