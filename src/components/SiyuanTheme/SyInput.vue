<template>
  <input
    :class="inputClassName"
    :type="type"
    :placeholder="placeholder"
    :value="modelValue"
    :disabled="disabled"
    :readonly="readonly"
    v-bind="$attrs"
    @input="onInput"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SySize = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  modelValue?: string | number
  type?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  size?: SySize
}>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  disabled: false,
  readonly: false,
  size: 'md',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

const sizeClassMap: Record<SySize, string> = {
  sm: 'fn__size100',
  md: 'fn__size200',
  lg: '',
}

const inputClassName = computed(() => [
  'b3-text-field',
  'fn__flex-center',
  sizeClassMap[props.size],
].filter(Boolean).join(' '))
</script>
