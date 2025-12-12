import { writable } from "svelte/store";
import { browser } from "$app/environment";

// Pinned articles store
function createPinnedStore() {
  const storageKey = "zenfeed-pinned-articles";

  // Load from localStorage
  const initialPinned = browser
    ? new Set<string>(JSON.parse(localStorage.getItem(storageKey) || "[]"))
    : new Set<string>();

  const { subscribe, set, update } = writable<Set<string>>(initialPinned);

  return {
    subscribe,
    pin: (articleId: string) => {
      update((pinned) => {
        pinned.add(articleId);
        if (browser) {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(pinned)));
        }
        return pinned;
      });
    },
    unpin: (articleId: string) => {
      update((pinned) => {
        pinned.delete(articleId);
        if (browser) {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(pinned)));
        }
        return pinned;
      });
    },
    toggle: (articleId: string) => {
      update((pinned) => {
        if (pinned.has(articleId)) {
          pinned.delete(articleId);
        } else {
          pinned.add(articleId);
        }
        if (browser) {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(pinned)));
        }
        return pinned;
      });
    },
    isPinned: (articleId: string, pinnedSet: Set<string>) =>
      pinnedSet.has(articleId),
  };
}

// Starred (favorite) articles store
function createStarredStore() {
  const storageKey = "zenfeed-starred-articles";

  // Load from localStorage
  const initialStarred = browser
    ? new Set<string>(JSON.parse(localStorage.getItem(storageKey) || "[]"))
    : new Set<string>();

  const { subscribe, set, update } = writable<Set<string>>(initialStarred);

  return {
    subscribe,
    star: (articleId: string) => {
      update((starred) => {
        starred.add(articleId);
        if (browser) {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(starred)));
        }
        return starred;
      });
    },
    unstar: (articleId: string) => {
      update((starred) => {
        starred.delete(articleId);
        if (browser) {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(starred)));
        }
        return starred;
      });
    },
    toggle: (articleId: string) => {
      update((starred) => {
        if (starred.has(articleId)) {
          starred.delete(articleId);
        } else {
          starred.add(articleId);
        }
        if (browser) {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(starred)));
        }
        return starred;
      });
    },
    isStarred: (articleId: string, starredSet: Set<string>) =>
      starredSet.has(articleId),
  };
}

export const pinnedArticlesStore = createPinnedStore();
export const starredArticlesStore = createStarredStore();
