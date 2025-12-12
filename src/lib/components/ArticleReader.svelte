<script lang="ts">
  import { selectedFeedStore } from '$lib/stores/feedStore';
  import { isReadStore, readItemsStore } from '$lib/stores/readStateStore';
  import dayjs from 'dayjs';
  import { afterUpdate } from 'svelte';

  // Auto mark as read when opened
  afterUpdate(() => {
    if ($selectedFeedStore && $selectedFeedStore.id) {
       readItemsStore.markRead($selectedFeedStore.id);
    }
  });

  // Helper to safely get content
  $: content = $selectedFeedStore?.summaryHtmlSnippet || '';
  $: title = $selectedFeedStore?.title || '';
  $: link = $selectedFeedStore?.link || '';
  $: tags = $selectedFeedStore?.tags || '';
  
  // Try to get the date from readItemsStore (when it was marked as read) or use current time
  let date = '';
  $: {
    const readTime = $selectedFeedStore?.id ? $readItemsStore.get($selectedFeedStore.id) : null;
    date = readTime ? dayjs(readTime).format('MMMM D, YYYY h:mm A') : dayjs().format('MMMM D, YYYY h:mm A');
  }
</script>

<div class="h-full bg-background-primary/0 flex flex-col relative w-full overflow-hidden">
   <!-- Background ambient glow - green -->
   <div class="absolute top-[-20%] right-[-20%] w-[500px] h-[500px] bg-accent-emerald/5 rounded-full blur-[100px] pointer-events-none"></div>

   {#if $selectedFeedStore}
      <!-- Toolbar -->
      <div class="h-14 px-8 border-b border-white/5 flex items-center justify-between sticky top-0 bg-background-primary/80 backdrop-blur-xl z-20">
         <div class="flex items-center space-x-4">
             <button class="text-text-secondary hover:text-accent-emerald transition-colors hover:scale-110 active:scale-95 glow-hover p-1 rounded-lg">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
             </button>
             <button class="text-text-secondary hover:text-accent-mint transition-colors hover:scale-110 active:scale-95 glow-hover p-1 rounded-lg">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
             </button>
         </div>
         <div class="flex items-center space-x-4">
             <button class="text-text-secondary hover:text-text-primary transition-colors hover:bg-white/5 p-1.5 rounded-md">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
             </button>
             <button class="text-text-secondary hover:text-text-primary transition-colors hover:bg-white/5 p-1.5 rounded-md">
                 <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
             </button>
         </div>
      </div>

      <!-- Article Content -->
      <div class="flex-1 overflow-y-auto px-12 py-10 scroller relative z-10">
         <div class="max-w-3xl mx-auto animation-fade-in-up">
            <!-- Header -->
            <header class="mb-10 border-b border-white/5 pb-8">
               <h1 class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-gray-400 mb-6 leading-tight tracking-tight shadow-md">
                  {title}
               </h1>
               <div class="flex items-center text-sm font-medium text-text-secondary space-x-4">
                  {#if $selectedFeedStore.link}
                    <a href={$selectedFeedStore.link} target="_blank" rel="noopener noreferrer" 
                       class="flex items-center px-3 py-1.5 rounded-full bg-white/5 hover:bg-accent-emerald/10 hover:text-accent-emerald border border-transparent hover:border-accent-emerald/30 transition-all duration-300">
                       <img class="w-4 h-4 mr-2 rounded-sm" src={`https://www.google.com/s2/favicons?domain=${new URL($selectedFeedStore.link).hostname}`} alt="Favicon"/>
                       {new URL($selectedFeedStore.link).hostname}
                    </a>
                  {/if}
                  <div class="w-1 h-1 rounded-full bg-text-muted"></div>
                  <span class="text-text-muted">{date}</span>
               </div>
            </header>

            <!-- Body -->
            <article class="prose prose-invert prose-lg max-w-none 
               prose-headings:text-text-primary prose-headings:font-bold prose-headings:tracking-tight
               prose-p:text-text-secondary prose-p:leading-relaxed prose-p:font-light
               prose-a:text-accent-emerald prose-a:no-underline hover:prose-a:text-accent-mint hover:prose-a:underline prose-a:transition-colors
               prose-strong:text-white prose-strong:font-semibold
               prose-img:rounded-2xl prose-img:shadow-2xl prose-img:border prose-img:border-white/5
               prose-blockquote:border-l-accent-emerald prose-blockquote:bg-white/5 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
               prose-code:text-accent-mint prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none font-sans">
               {@html content}
            </article>
            
            <!-- Footer Action -->
            <div class="mt-20 pt-10 border-t border-white/5 flex justify-center pb-20">
                 <a href={link} target="_blank" rel="noopener noreferrer"
                    class="group relative px-8 py-3 bg-background-tertiary rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-lg hover:shadow-accent-emerald/20">
                    <div class="absolute inset-0 w-full h-full bg-gradient-to-r from-accent-emerald via-accent-mint to-accent-lime opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <div class="absolute inset-0 w-full h-full blur-xl bg-accent-emerald/20 opacity-0 group-hover:opacity-50 transition-opacity"></div>
                    <span class="relative font-semibold text-white tracking-wide flex items-center">
                       View Original Article
                       <svg class="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </span>
                 </a>
            </div>
         </div>
      </div>
   {:else}
      <!-- Enhanced Empty State -->
      <div class="flex-1 flex flex-col items-center justify-center text-text-muted relative overflow-hidden">
         <!-- Empty state background effect -->
         <div class="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
            <div class="w-[600px] h-[600px] border border-white/5 rounded-full flex items-center justify-center animate-[spin_60s_linear_infinite]">
               <div class="w-[400px] h-[400px] border border-white/5 rounded-full flex items-center justify-center animate-[spin_40s_linear_infinite_reverse]">
                   <div class="w-[200px] h-[200px] border border-white/10 rounded-full"></div>
               </div>
            </div>
         </div>

         <div class="relative z-10 flex flex-col items-center">
            <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-background-tertiary to-background-secondary border border-white/10 flex items-center justify-center mb-6 shadow-2xl shadow-black/50">
                <svg class="w-10 h-10 text-text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            </div>
            <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-text-primary to-text-muted mb-2">Ready to Read</h2>
            <p class="text-text-secondary/60 max-w-xs text-center leading-relaxed">Select an article from the list to enter immersive reading mode.</p>
         </div>
      </div>
   {/if}
</div>

<style>
 .animation-fade-in-up {
    animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
 }
 
 @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(20px); filter: blur(5px); }
    to { opacity: 1; transform: translateY(0); filter: blur(0); }
 }
</style>
