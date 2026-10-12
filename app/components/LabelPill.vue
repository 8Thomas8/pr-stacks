<script setup lang="ts">
const props = defineProps<{ name: string }>()
const { label } = useStacks()
const l = computed(() => label(props.name))
</script>

<template>
  <Tip>
    <span class="lbl" :style="{ '--c': l.c }">{{ name }}</span>
    <template #content>
      <i18n-t keypath="link.label" scope="global"><template #name><b>{{ name }}</b></template></i18n-t>
      <template v-if="l.d"><br />{{ l.d }}</template>
    </template>
  </Tip>
</template>
