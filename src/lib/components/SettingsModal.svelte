<script lang="ts">
    import { locale } from "svelte-i18n";
    import { apiUrl } from "$lib/stores/apiUrl";
    import { _ } from "svelte-i18n";

    let { show = $bindable() } = $props<{ show: boolean }>();

    let tempApiUrl = $state($apiUrl);

    function changeLocale(newLocale: string) {
        locale.set(newLocale);
    }

    function saveSettings() {
        $apiUrl = tempApiUrl;
        closeModal();
    }

    function closeModal() {
        show = false;
    }
</script>

<dialog class="modal modal-open modal-bottom sm:modal-middle" open={show}>
    <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">{$_("settingsModal.title")}</h3>

        <!-- Language Settings -->
        <div class="form-control mb-4">
            <label class="label">
                <span class="label-text">{$_("settingsModal.language")}</span>
            </label>
            <div class="join">
                <button
                    class="btn join-item flex-1 {$locale === 'en'
                        ? 'btn-active'
                        : ''}"
                    onclick={() => changeLocale("en")}
                >
                    English
                </button>
                <button
                    class="btn join-item flex-1 {$locale === 'zh'
                        ? 'btn-active'
                        : ''}"
                    onclick={() => changeLocale("zh")}
                >
                    中文
                </button>
                <!-- Add more languages here if needed -->
            </div>
        </div>

        <!-- Backend API Address -->
        <div class="form-control mb-6">
            <label class="label" for="apiUrlInput">
                <span class="label-text">{$_("settingsModal.backendUrl")}</span>
            </label>
            <input
                id="apiUrlInput"
                type="url"
                placeholder="e.g., http://localhost:1300"
                class="input input-bordered w-full"
                bind:value={tempApiUrl}
            />
            <label class="label">
                <span class="label-text-alt"
                    >{$_("settingsModal.backendUrlHint")}</span
                >
            </label>
        </div>

        <div class="modal-action">
            <button class="btn btn-primary" onclick={saveSettings}
                >{$_("settingsModal.save")}</button
            >
            <button class="btn" onclick={closeModal}
                >{$_("settingsModal.cancel")}</button
            >
        </div>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button onclick={closeModal}>close</button>
    </form>
</dialog>
