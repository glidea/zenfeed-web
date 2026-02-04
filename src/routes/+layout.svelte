<script lang="ts">
  import "../app.css";
  import "$lib/i18n";
  import { locale, waitLocale } from "svelte-i18n";
  import { browser } from "$app/environment";
  import AudioPlayer from "$lib/components/AudioPlayer.svelte";
  
  // Use $state in Svelte 5 (runes) or standard variable in Svelte 4
  // The existing code used `let isLocaleLoading = $state(true);` implying Svelte 5 runes.
  let isLocaleLoading = $state(true);
  
  if (browser) {
    locale.set(window.navigator.language || "en");
  } else {
    locale.set("en");
  }

  $effect(() => {
    isLocaleLoading = true;
    waitLocale().then(() => {
      isLocaleLoading = false;
    });
  });
</script>

{#if !isLocaleLoading}
  <!-- Main App Shell -->
  <div class="flex h-screen w-screen overflow-hidden bg-background-primary text-text-primary">
     <slot />
     <AudioPlayer />
  </div>
{/if}
