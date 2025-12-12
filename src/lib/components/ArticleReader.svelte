<script lang="ts">
  import { selectedFeedStore } from '$lib/stores/feedStore';
  import { isReadStore, readItemsStore } from '$lib/stores/readStateStore';
  import dayjs from 'dayjs';
  import { afterUpdate } from 'svelte';

  // Auto mark as read when opened?
  // Let's do it on afterUpdate if we have a selected feed
  afterUpdate(() => {
    if ($selectedFeedStore && $selectedFeedStore.id) {
       readItemsStore.markRead($selectedFeedStore.id);
    }
  });

  // Helper to safely get content
  $: content = $selectedFeedStore?.summaryHtmlSnippet || ''; // Using snippet as full content for now based on store definition
  $: title = $selectedFeedStore?.title || '';
  $: date = $selectedFeedStore ? dayjs().format('MMMM D, YYYY h:mm A') : ''; // We lack time in SelectedFeedData, need to check that.
  
  // The store interface `SelectedFeedData` in `feedStore.ts` seemed to lack `time`. 
  // But `FeedVO` has it. `selectedFeedStore` definition sets it to `SelectedFeedData`.
  // I might need to cast or fix store types later. For now just mock date if missing.
</script>

<div class="h-full bg-background-primary flex flex-col relative w-full">
   {#if $selectedFeedStore}
      <!-- Toolbar -->
      <div class="h-14 px-8 border-b border-border-subtle flex items-center justify-between sticky top-0 bg-background-primary/95 backdrop-blur z-20">
         <div class="flex items-center space-x-4">
             <button class="text-text-muted hover:text-text-primary transition-colors hover:scale-105 active:scale-95">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
             </button>
             <button class="text-text-muted hover:text-text-primary transition-colors hover:scale-105 active:scale-95">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
             </button>
         </div>
         <div class="flex items-center space-x-4">
             <button class="text-text-muted hover:text-text-primary transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
             </button>
             <button class="text-text-muted hover:text-text-primary transition-colors">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
             </button>
         </div>
      </div>

      <!-- Article Content -->
      <div class="flex-1 overflow-y-auto px-12 py-10 scroller">
         <div class="max-w-3xl mx-auto animation-fade-in-up">
            <!-- Header -->
            <header class="mb-10">
               <h1 class="text-3xl font-bold text-text-primary mb-4 leading-tight">{title}</h1>
               <div class="flex items-center text-sm text-text-secondary space-x-4">
                  {#if $selectedFeedStore.link}
                    <a href={$selectedFeedStore.link} target="_blank" rel="noopener noreferrer" class="flex items-center hover:text-accent transition-colors">
                       <img class="w-4 h-4 mr-2" src={`https://www.google.com/s2/favicons?domain=${new URL($selectedFeedStore.link).hostname}`} alt="Favicon"/>
                       {new URL($selectedFeedStore.link).hostname}
                    </a>
                  {/if}
                  <span>&bull;</span>
                  <span>{date}</span>
               </div>
            </header>

            <!-- Body -->
            <article class="prose prose-invert prose-lg max-w-none text-text-secondary marker:text-accent prose-headings:text-text-primary prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-img:shadow-lg">
               {@html content}
            </article>
            
            <!-- Footer -->
            <div class="mt-20 pt-10 border-t border-border-subtle flex justify-center">
                 <button class="px-6 py-2 bg-background-tertiary hover:bg-background-secondary text-text-primary rounded-full border border-border-highlight transition-all">
                    View Original Article
                 </button>
            </div>
         </div>
      </div>
   {:else}
      <!-- Empty State -->
      <div class="flex-1 flex flex-col items-center justify-center text-text-muted">
         <div class="w-16 h-16 rounded-full bg-background-tertiary flex items-center justify-center mb-4">
             <svg class="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
         </div>
         <p class="text-lg font-medium">No Article Selected</p>
         <p class="text-sm opacity-60">Select an item from the list to start reading</p>
      </div>
   {/if}
</div>

<style>
 .animation-fade-in-up {
    animation: fade-in-up 0.4s ease-out forwards;
 }
 
 @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
 }
</style>
