<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'

defineProps<{ pr: PullRequest }>()
</script>

<template>
  <Tip>
    <a class="lnk" :href="pr.url" target="_blank" rel="noopener" @click.stop><slot>#{{ pr.num }}</slot></a>
    <template #content>
      <i18n-t keypath="link.pr" scope="global"><template #id><b>{{ pr.id }}</b></template></i18n-t><br />{{ pr.title }}
    </template>
  </Tip>
</template>
