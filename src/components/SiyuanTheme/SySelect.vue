<template>
  <select
    :class="selectClassName"
    :disabled="disabled"
    :value="modelValue"
    @change="onChange"
  >
    <option
      v-for="item of options"
      :key="item.value"
      :value="item.value"
      :disabled="item.disabled"
    >
      {{ item.text }}
    </option>
  </select>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SySize = 'sm' | 'md' | 'lg'

interface SySelectOption {
  value: string
  text: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: SySelectOption[]
  size?: SySize
  disabled?: boolean
}>(), {
  size: 'md',
  disabled: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

function onChange(event: Event): void {
  emit('update:modelValue', (event.target as HTMLSelectElement).value)
}

const sizeClassMap: Record<SySize, string> = {
  sm: 'fn__size100',
  md: 'fn__size200',
  lg: '',
}

const selectClassName = computed(() => [
  'b3-select',
  'fn__flex-center',
  sizeClassMap[props.size],
].filter(Boolean).join(' '))
</script>
