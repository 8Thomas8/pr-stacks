<script setup lang="ts">
defineProps<{ repo: string }>()
const { repoSlug } = useStacks()
</script>

<template>
  <Tip>
    <a class="lnk" :href="`https://github.com/${repoSlug(repo)}`" target="_blank" rel="noopener" @click.stop><slot>{{ repo }}</slot></a>
    <template #content>
      <i18n-t keypath="link.repo" scope="global"><template #slug><b>{{ repoSlug(repo) }}</b></template></i18n-t>
    </template>
  </Tip>
</template>
