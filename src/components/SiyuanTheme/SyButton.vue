<template>
  <button
    :class="buttonClassName"
    :type="type"
    :disabled="disabled"
    @click="handleClick"
  >
    <span
      v-if="$slots.icon"
      class="sy-button__icon"
    >
      <slot name="icon" />
    </span>
    <slot>{{ label }}</slot>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SyButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type SyButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  variant?: SyButtonVariant
  size?: SyButtonSize
  iconOnly?: boolean
  disabled?: boolean
  label?: string
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'outline',
  size: 'md',
  iconOnly: false,
  disabled: false,
  label: '',
  type: 'button',
})

const emit = defineEmits<{
  (event: 'click', payload: MouseEvent): void
}>()

function handleClick(event: MouseEvent): void {
  if (props.disabled) {
    return
  }
  emit('click', event)
}

/**
 * 与思源 b3-button 的视觉规范对齐：
 * - primary  → b3-button（实心）
 * - outline  → b3-button--outline（默认值，保持向后兼容）
 * - secondary → b3-button--cancel
 * - ghost     → b3-button--text
 * - danger    → b3-button--remove
 */
const variantClassMap: Record<SyButtonVariant, string> = {
  primary: '',
  outline: 'b3-button--outline',
  secondary: 'b3-button--cancel',
  ghost: 'b3-button--text',
  danger: 'b3-button--remove',
}

const sizeClassMap: Record<SyButtonSize, string> = {
  sm: 'fn__size100',
  md: 'fn__size200',
  lg: '',
}

const buttonClassName = computed(() => [
  'b3-button',
  'fn__flex-center',
  variantClassMap[props.variant],
  sizeClassMap[props.size],
  props.iconOnly ? 'sy-button--icon-only' : '',
].filter(Boolean).join(' '))
</script>

<style lang="scss" scoped>
.sy-button__icon {
  display: inline-flex;
  align-items: center;
  margin-right: 6px;
  line-height: 0;
}

.sy-button--icon-only .sy-button__icon {
  margin-right: 0;
}

.sy-button--icon-only {
  width: var(--sy-button-icon-size, 32px);
  height: var(--sy-button-icon-size, 32px);
  padding: 0;
}
</style>
