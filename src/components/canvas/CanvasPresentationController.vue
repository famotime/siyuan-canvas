<script setup lang="ts">
import { computed } from "vue"
import { CanvasIcon } from "@/components/canvas/canvas-icon"

const props = defineProps<{
  editor: any
}>()

const presentation = computed(() => props.editor.presentation)

const handlePrev = () => presentation.value.prev()
const handleNext = () => presentation.value.next()
const handleTogglePlay = () => presentation.value.togglePlay()
const handleExit = () => presentation.value.stop()
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
.b3-menu__separator {
  width: 1px;
  height: 20px;
  background-color: var(--b3-theme-surface-lighter);
  margin: 0 8px;
}
</style>
