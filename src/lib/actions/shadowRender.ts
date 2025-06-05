export function shadowRender(node: HTMLElement, html: string | null | undefined) {
    let shadowRoot: ShadowRoot;

    const _update = (content: string | null | undefined) => {
        if (!shadowRoot) {
            shadowRoot = node.attachShadow({ mode: 'open' });
        }

        // TODO(hack): better way to do this
        const internalStyles = `
<style>
    @media (prefers-color-scheme: dark) {
        img {
            filter: invert(1) hue-rotate(180deg);
        }
    }
</style>
`;
        shadowRoot.innerHTML = internalStyles + (content || "");
    };

    _update(html);

    return {
        update(newHtml: string | null | undefined) {
            _update(newHtml);
        }
    };
} 