<template>
  <textarea
    class="b3-text-field fn__block"
    :rows="rows"
    :placeholder="placeholder"
    :value="modelValue"
    :disabled="disabled"
    :readonly="readonly"
    v-bind="$attrs"
    @input="onInput"
  />
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: string
  rows?: number
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
}>(), {
  modelValue: '',
  rows: 4,
  placeholder: '',
  disabled: false,
  readonly: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>
