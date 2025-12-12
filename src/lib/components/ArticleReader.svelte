<script lang="ts">
  import { selectedFeedStore } from '$lib/stores/feedStore';
  import { readItemsStore } from '$lib/stores/readStateStore';
  import { starredArticlesStore } from '$lib/stores/articleActionsStore';
  import { onMount } from 'svelte';
  
  // Reactive data from store
  $: title = $selectedFeedStore?.title || '';
  $: content = $selectedFeedStore?.summaryHtmlSnippet || '';
  $: link = $selectedFeedStore?.link || '';
  $: currentArticleId = $selectedFeedStore?.id || '';
  
  // Get date from readItemsStore or use current time
  let date = '';
  $: {
    if ($selectedFeedStore?.id) {
      const itemId = $selectedFeedStore.id;
      const timestamp = $readItemsStore.get(itemId);
      if (timestamp) {
        date = new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
      } else {
        date = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
      }
    }
  }
  
  // Star (favorite) state - now from store
  $: isStarred = currentArticleId ? $starredArticlesStore.has(currentArticleId) : false;
  
  // Focus mode state
  let focusMode = false;
  let focusedParagraph: HTMLElement | null = null;
  
  function toggleStar() {
    if (currentArticleId) {
      starredArticlesStore.toggle(currentArticleId);
    }
  }
  
  function toggleFocusMode() {
    focusMode = !focusMode;
    if (!focusMode) {
      focusedParagraph = null;
      // Remove all focus classes when exiting focus mode
      document.querySelectorAll('.focused-paragraph, .dimmed-paragraph').forEach(el => {
        el.classList.remove('focused-paragraph', 'dimmed-paragraph');
      });
    } else {
      // When entering focus mode, dim all paragraphs initially
      const articleContent = document.querySelector('.article-content');
      if (articleContent) {
        const paragraphs = articleContent.querySelectorAll('p');
        paragraphs.forEach(p => p.classList.add('dimmed-paragraph'));
      }
    }
  }
  
  function handleParagraphClick(e: MouseEvent) {
    if (!focusMode) return;
    
    const target = e.target as HTMLElement;
    const paragraph = target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
    
    if (paragraph && paragraph instanceof HTMLElement) {
      // Remove previous focus
      document.querySelectorAll('.focused-paragraph, .dimmed-paragraph').forEach(el => {
        el.classList.remove('focused-paragraph', 'dimmed-paragraph');
      });
      
      // Add focus to clicked paragraph
      paragraph.classList.add('focused-paragraph');
      focusedParagraph = paragraph;
      
      // Dim all other paragraphs
      const article = paragraph.closest('article');
      if (article) {
        article.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote').forEach(el => {
          if (el !== paragraph && el instanceof HTMLElement) {
            el.classList.add('dimmed-paragraph');
          }
        });
      }
    }
  }
</script>

<div class="h-full bg-background-primary flex flex-col relative w-full overflow-hidden">
   <!-- Ambient glow background -->
   <div class="absolute inset-0 bg-gradient-emerald pointer-events-none"></div>
   <div class="absolute top-[-15%] right-[-15%] w-[600px] h-[600px] bg-accent-emerald/8 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>

   {#if $selectedFeedStore}
      <!-- Toolbar - Glassmorphic -->
      <div class="h-16 px-8 border-b border-ghost flex items-center justify-between sticky top-0 bg-background-primary/70 backdrop-blur-md z-20">
         <div class="flex items-center space-x-3">
             <!-- Star button -->
             <button 
               onclick={toggleStar}
               class="group flex items-center justify-center w-10 h-10 rounded-lg transition-linear border border-ghost
                     {isStarred ? 'bg-accent-emerald/15 text-accent-mint shadow-glow-sm border-accent-mint/30' : 'text-text-secondary hover:text-accent-mint hover:bg-accent-emerald/10 hover:border-accent-emerald/20'}"
               title={isStarred ? 'Unstar' : 'Star'}
               aria-label={isStarred ? 'Remove from favorites' : 'Add to favorites'}
             >
                {#if isStarred}
                  <svg class="w-5 h-5 transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                {:else}
                  <svg class="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                {/if}
             </button>
             
             <!-- Share button -->
             <button class="group flex items-center justify-center w-10 h-10 rounded-lg transition-linear border border-ghost
                           text-text-secondary hover:text-accent-mint hover:bg-accent-emerald/10 hover:border-accent-emerald/20 hover:shadow-glow-sm" 
                     title="Share article" aria-label="Share article">
                <svg class="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
             </button>
         </div>

         <div class="flex items-center space-x-3">
             <!-- Focus Mode button -->
             <button 
               onclick={toggleFocusMode}
               class="group flex items-center justify-center w-10 h-10 rounded-lg transition-linear border border-ghost
                     {focusMode ? 'bg-accent-emerald/15 text-accent-mint shadow-glow-sm border-accent-mint/30' : 'text-text-secondary hover:text-accent-mint hover:bg-accent-emerald/10 hover:border-accent-emerald/20'}"
               title={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
               aria-label="Toggle focus mode"
             >
                <svg class="w-5 h-5 transition-transform group-hover:scale-110" fill={focusMode ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                </svg>
             </button>

             <!-- Source Code button -->
             <button 
               class="group flex items-center justify-center w-10 h-10 rounded-lg transition-linear border border-ghost
                      text-text-secondary hover:text-accent-mint hover:bg-accent-emerald/10 hover:border-accent-emerald/20 hover:shadow-glow-sm" 
               title="View Source" aria-label="View source code"
             >
                <svg class="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
             </button>

             <!-- Fullscreen button -->
             <button 
               class="group flex items-center justify-center w-10 h-10 rounded-lg transition-linear border border-ghost
                      text-text-secondary hover:text-accent-mint hover:bg-accent-emerald/10 hover:border-accent-emerald/20 hover:shadow-glow-sm"
               title="Fullscreen" aria-label="Fullscreen"
             >
                 <svg class="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
             </button>
         </div>
      </div>

      <!-- Article Content -->
      <div 
        class="flex-1 overflow-y-auto px-8 py-12 scroller relative z-10" 
        onclick={focusMode ? handleParagraphClick : undefined}
        role={focusMode ? "button" : undefined}
        tabindex={focusMode ? 0 : undefined}
      >
         <div class="max-w-3xl mx-auto animate-fade-in-scale">
            <!-- Header -->
            <header class="mb-12 border-b border-ghost/50 pb-8">
               <h1 class="text-4xl font-bold text-text-primary mb-6 leading-tight tracking-tight">
                  {title}
               </h1>
               <div class="flex items-center text-sm font-medium text-text-secondary space-x-4">
                  {#if $selectedFeedStore.link}
                    <a href={$selectedFeedStore.link} target="_blank" rel="noopener noreferrer" 
                       class="group flex items-center px-3.5 py-2 rounded-lg transition-linear border border-ghost
                              hover:bg-accent-emerald/15 hover:text-accent-mint hover:border-accent-mint/30 hover:shadow-glow-sm">
                       <img class="w-4 h-4 mr-2 rounded-sm" src={`https://www.google.com/s2/favicons?domain=${new URL($selectedFeedStore.link).hostname}`} alt="Favicon"/>
                       <span class="truncate max-w-[180px]">{new URL($selectedFeedStore.link).hostname}</span>
                    </a>
                  {/if}
                  {#if $selectedFeedStore.link}
                    <div class="w-1 h-1 rounded-full bg-text-muted/50"></div>
                  {/if}
                  <span class="text-text-muted text-xs">{date}</span>
               </div>
            </header>

            <!-- Body - Optimized typography -->
            <article class="prose prose-invert max-w-none article-content {focusMode ? 'focus-mode' : ''}
               prose-headings:text-text-primary prose-headings:font-semibold prose-headings:tracking-tight prose-headings:leading-tight
               prose-h1:text-3xl prose-h1:mt-10 prose-h1:mb-6
               prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-5
               prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-4
               prose-p:text-text-primary prose-p:leading-relaxed prose-p:font-light prose-p:text-base prose-p:my-6 prose-p:opacity-90
               prose-a:text-accent-mint prose-a:no-underline prose-a:font-medium prose-a:transition-colors hover:prose-a:text-accent-emerald hover:prose-a:underline
               prose-strong:text-text-primary prose-strong:font-semibold prose-strong:bg-gradient-emerald-dark prose-strong:px-1 prose-strong:rounded
               prose-em:text-accent-mint prose-em:not-italic prose-em:font-medium
               prose-img:rounded-xl prose-img:shadow-lg prose-img:border prose-img:border-ghost prose-img:my-8 prose-img:max-w-full
               prose-blockquote:border-l-4 prose-blockquote:border-accent-mint prose-blockquote:bg-accent-emerald/8 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-lg prose-blockquote:not-italic prose-blockquote:my-6 prose-blockquote:text-text-secondary
               prose-code:text-accent-mint prose-code:bg-background-secondary/60 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-code:text-sm prose-code:border prose-code:border-ghost/50
               prose-pre:bg-background-secondary/40 prose-pre:border prose-pre:border-ghost prose-pre:rounded-lg prose-pre:my-6 prose-pre:shadow-inner
               prose-ul:my-6 prose-li:text-text-primary prose-li:my-2.5 prose-li:leading-relaxed
               prose-ol:my-6">
               {@html content}
            </article>
            
            <!-- Footer CTA -->
            <div class="mt-16 pt-10 border-t border-ghost flex justify-center pb-12">
                 <a href={link} target="_blank" rel="noopener noreferrer"
                    class="group relative inline-flex items-center px-8 py-3 rounded-lg bg-accent-emerald/15 
                           border border-accent-mint/30 hover:border-accent-mint/60 
                           text-accent-mint font-semibold tracking-wider
                           transition-all duration-300 hover:shadow-glow-md hover:-translate-y-1">
                    <div class="absolute inset-0 rounded-lg bg-gradient-to-r from-accent-emerald to-accent-mint opacity-5 group-hover:opacity-10 transition-opacity"></div>
                    <span class="relative flex items-center">
                       View Original Article
                       <svg class="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </span>
                 </a>
            </div>
         </div>
      </div>
   {:else}
      <!-- Enhanced Empty State -->
      <div class="flex-1 flex flex-col items-center justify-center text-text-muted/60 relative overflow-hidden">
         <!-- Orbital animation background -->
         <div class="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
            <div class="w-[500px] h-[500px] border border-ghost rounded-full flex items-center justify-center animate-[spin_45s_linear_infinite]">
               <div class="w-[350px] h-[350px] border border-ghost/60 rounded-full flex items-center justify-center animate-[spin_30s_linear_infinite_reverse]">
                   <div class="w-[200px] h-[200px] border border-accent-mint/20 rounded-full"></div>
               </div>
            </div>
         </div>

         <div class="relative z-10 flex flex-col items-center">
            <div class="w-20 h-20 rounded-xl card-elevated mb-6 flex items-center justify-center">
                <svg class="w-10 h-10 text-text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
            </div>
            <h2 class="text-2xl font-semibold text-text-primary mb-2">Ready to Read</h2>
            <p class="text-text-muted/70 max-w-xs text-center text-sm leading-relaxed">
              Select an article from the list to enter immersive reading mode
            </p>
         </div>
      </div>
   {/if}
</div>

<style>
	:global(.article-content) {
		/* Optimize typography rendering */
		font-feature-settings: 'kern' 1;
		text-rendering: optimizeLegibility;
		-webkit-font-smoothing: antialiased;
	}

	:global(.article-content code) {
		border: 1px solid rgba(16, 163, 127, 0.2);
		background-color: rgba(26, 47, 26, 0.6);
		transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	:global(.article-content a code),
	:global(.article-content code:hover) {
		border-color: rgba(110, 231, 183, 0.4);
		background-color: rgba(16, 163, 127, 0.15);
	}

	:global(.article-content pre) {
		position: relative;
		overflow: hidden;
		transition: box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	:global(.article-content pre:hover) {
		box-shadow: 0 0 20px -5px rgba(16, 163, 127, 0.3), inset 0 0 0 1px rgba(16, 163, 127, 0.15);
	}

	:global(.article-content pre::before) {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, rgba(16, 163, 127, 0.05), rgba(16, 163, 127, 0.02), transparent);
		pointer-events: none;
		border-radius: 0.5rem;
	}

	:global(.article-content blockquote) {
		position: relative;
		transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	:global(.article-content blockquote:hover) {
		border-left-color: rgba(110, 231, 183, 0.6);
		background-color: rgba(16, 163, 127, 0.12);
		box-shadow: 0 0 0 1px rgba(16, 163, 127, 0.2), 0 0 15px -3px rgba(16, 163, 127, 0.15);
	}

	:global(.article-content blockquote p) {
		margin: 0;
	}

	:global(.focused-paragraph) {
		transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
		background-color: rgba(16, 163, 127, 0.12);
		border-left: 3px solid var(--accent-mint);
		border-radius: 0.375rem;
		box-shadow: 
			0 0 0 1px rgba(110, 231, 183, 0.25),
			0 0 25px -5px rgba(110, 231, 183, 0.2),
			inset 0 0 0 1px rgba(110, 231, 183, 0.1);
		opacity: 1;
		padding: 0.75rem 1rem;
		transform: scale(1.01);
		color: #ffffff !important;
	}

	:global(.focused-paragraph *) {
		color: inherit !important;
	}

	:global(.focused-paragraph strong) {
		color: #ffffff !important;
		font-weight: 700;
	}

	:global(.focused-paragraph em) {
		color: var(--accent-mint) !important;
	}

	:global(.focused-paragraph code) {
		color: var(--accent-mint) !important;
		background-color: rgba(16, 163, 127, 0.15) !important;
	}

	:global(.dimmed-paragraph) {
		transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
		opacity: 1;
		color: #ffffff;
	}

	:global(.focus-mode .dimmed-paragraph) {
		opacity: 0.12;
		filter: blur(0.8px);
	}

	:global(.focus-mode .dimmed-paragraph:hover) {
		opacity: 0.35;
		filter: blur(0px);
	}

	.scroller {
		scrollbar-width: thin;
		scrollbar-color: rgba(16, 163, 127, 0.4) transparent;
	}

	.scroller::-webkit-scrollbar {
		width: 8px;
	}

	.scroller::-webkit-scrollbar-track {
		background: transparent;
	}

	.scroller::-webkit-scrollbar-thumb {
		background-color: rgba(16, 163, 127, 0.4);
		border-radius: 4px;
		border: 2px solid transparent;
		background-clip: content-box;
		transition: background-color 200ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.scroller::-webkit-scrollbar-thumb:hover {
		background-color: rgba(110, 231, 183, 0.6);
	}
</style>
