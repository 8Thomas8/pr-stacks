<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

defineProps<{ text?: string, side?: 'top' | 'bottom' | 'left' | 'right' }>()
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <slot></slot>
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent class="tip" :side="side ?? 'top'" :side-offset="8" :collision-padding="8">
        <slot name="content">{{ text }}</slot>
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
