// src/lib/i18n.ts
import { register, init, getLocaleFromNavigator } from 'svelte-i18n';

// Register locales
register('en', () => import('$lib/locales/en.json'));
register('zh', () => import('$lib/locales/zh.json'));
// Add more locales if needed

// Initialize the library
init({
    fallbackLocale: 'en',
    initialLocale: getLocaleFromNavigator(), // Detect browser language or load preference
});
