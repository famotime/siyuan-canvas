<template>
  <CanvasWorkspace
    :bootstrap="bootstrap"
    :plugin="plugin"
    :set-title="setTitle"
  />
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"

import type { CanvasTabBootstrap } from "@/main"
import CanvasWorkspace from "@/components/canvas/CanvasWorkspace.vue"

defineProps<{
  bootstrap: CanvasTabBootstrap
  plugin: Plugin
  setTitle: (title: string) => void
}>()
</script>
