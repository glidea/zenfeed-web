<script lang="ts">
    import { locale } from "svelte-i18n";

    function changeLocale(newLocale: string) {
        locale.set(newLocale);
        // Optionally, save the preference to localStorage
        // localStorage.setItem('locale', newLocale);
    }
</script>

<div class="dropdown dropdown-end">
    <div tabindex="0" role="button" class="btn btn-ghost">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-5 h-5"
            ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C13.18 7.061 14.12 7.5 15 7.5h3.75m-7.5-4.5V4.879m0 0a3.75 3.75 0 013.75 3.75M9 15l3 3m3 0l3-3m-6 0V7.5"
            /></svg
        >
        <span class="uppercase">{$locale}</span>
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-4 h-4 ml-1"
            ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            /></svg
        >
    </div>
    <ul
        tabindex="0"
        class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32"
    >
        <li>
            <button
                class="w-full text-left"
                class:font-bold={$locale === "en"}
                on:click={() => changeLocale("en")}>English</button
            >
        </li>
        <li>
            <button
                class="w-full text-left"
                class:font-bold={$locale === "zh"}
                on:click={() => changeLocale("zh")}>中文</button
            >
        </li>
        <!-- Add more languages here -->
    </ul>
</div>
