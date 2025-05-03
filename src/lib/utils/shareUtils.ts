import { tick } from 'svelte';
import { toBlob } from 'html-to-image';
import QRCode from 'qrcode';

interface ShareOptions {
    qrCodeSize?: number;
    qrCodeMargin?: number;
    spaceAboveQr?: number;
    backgroundColor?: string;
    pixelRatio?: number;
    qrCodeData?: string;
    excludeSelector?: string;
    qrCodePosition?: 'center' | 'bottom-right';
}

/**
 * Captures an HTML element as an image by creating a clone off-screen.
 * Prevents page flicker and maintains original element intact.
 * 
 * @param elementToCapture The main HTML element to screenshot.
 * @param contentElement Optional scrollable content element within elementToCapture.
 * @param options Configuration options for sharing.
 * @returns A promise resolving to 'copied' on success or 'error' on failure.
 */
export async function shareElementAsImage(
    elementToCapture: HTMLElement,
    contentElement: HTMLElement | null,
    options: ShareOptions = {}
): Promise<'copied' | 'error'> {
    const {
        qrCodeSize = 150,
        qrCodeMargin = 20,
        spaceAboveQr = 5,
        backgroundColor,
        pixelRatio = window.devicePixelRatio || 1.5,
        qrCodeData,
        excludeSelector = '.share-exclude',
        qrCodePosition = 'center',
    } = options;

    // Create a container to hold our clone
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = `${elementToCapture.offsetWidth}px`;
    container.style.height = `${elementToCapture.offsetHeight * 2}px`; // Extra height for expanded content
    container.style.overflow = 'hidden';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '-9999';

    // Need to add to body to calculate styles
    document.body.appendChild(container);

    try {
        // Clone the element with all its styles
        const clone = elementToCapture.cloneNode(true) as HTMLElement;

        // Important: Copy computed styles to maintain appearance
        const originalStyles = window.getComputedStyle(elementToCapture);
        clone.style.width = `${elementToCapture.offsetWidth}px`;

        // Ensure all fonts and images load in the clone
        clone.querySelectorAll('img').forEach(img => {
            // Force any lazy-loaded images to load
            if (img.loading === 'lazy') {
                img.loading = 'eager';
            }
            // Make sure src is set (in case of data-src pattern)
            if (img.dataset.src && !img.src) {
                img.src = img.dataset.src;
            }
        });

        // Add the clone to our offscreen container
        container.appendChild(clone);

        // Find the content element in the clone
        let clonedContentElement = null;
        if (contentElement) {
            // Try to find equivalent element in clone by matching path
            const path = getNodePath(contentElement, elementToCapture);
            clonedContentElement = findNodeByPath(clone, path);

            if (clonedContentElement) {
                // Remove max-height constraint and show all content
                clonedContentElement.style.maxHeight = 'none';
                clonedContentElement.style.overflow = 'visible';
            }
        }

        // Find the card body in the clone for padding adjustment
        const clonedCardBody = clone.querySelector('.card-body') as HTMLElement | null;

        if (clonedCardBody && qrCodeData) {
            const extraPadding = qrCodePosition === 'center' ? 50 : 0;
            const requiredPadding = qrCodeSize + qrCodeMargin + spaceAboveQr + extraPadding;
            clonedCardBody.style.paddingBottom = `${requiredPadding}px`;
        }

        // Hide elements that should be excluded
        if (excludeSelector) {
            clone.querySelectorAll(excludeSelector).forEach(el => {
                (el as HTMLElement).style.display = 'none';
            });
        }

        // Add QR code if needed
        if (qrCodeData) {
            try {
                const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, {
                    errorCorrectionLevel: 'M',
                    margin: 2,
                    width: qrCodeSize,
                    color: { dark: "#000000", light: "#FFFFFF" },
                });

                const qrContainer = document.createElement('div');
                qrContainer.style.position = 'absolute';

                if (qrCodePosition === 'center') {
                    qrContainer.style.left = '50%';
                    qrContainer.style.bottom = `${qrCodeMargin}px`;
                    qrContainer.style.transform = 'translateX(-50%)';
                    qrContainer.style.textAlign = 'center';
                    qrContainer.style.width = '90%';
                    qrContainer.style.padding = '15px 30px 10px 30px';
                    qrContainer.style.backgroundColor = 'rgba(248, 249, 250, 0.8)';
                    qrContainer.style.borderRadius = '12px';
                    qrContainer.style.boxSizing = 'border-box';
                    qrContainer.style.position = 'absolute';
                } else {
                    qrContainer.style.right = `${qrCodeMargin}px`;
                    qrContainer.style.bottom = `${qrCodeMargin}px`;
                }

                qrContainer.style.zIndex = '10';

                const qrCodeImg = document.createElement('img');
                qrCodeImg.src = qrCodeDataUrl;
                qrCodeImg.alt = 'QR Code';
                qrCodeImg.style.width = `${qrCodeSize}px`;
                qrCodeImg.style.height = `${qrCodeSize}px`;
                qrCodeImg.style.backgroundColor = 'white';
                qrCodeImg.style.padding = '8px';
                qrCodeImg.style.border = '1px solid #eee';
                qrCodeImg.style.borderRadius = '8px';
                qrCodeImg.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                qrCodeImg.style.display = 'block';
                qrCodeImg.style.margin = '0 auto 8px auto';

                qrContainer.appendChild(qrCodeImg);

                if (qrCodePosition === 'center') {
                    const qrText = document.createElement('span');
                    qrText.style.fontSize = '11px';
                    qrText.style.color = '#6c757d';
                    qrText.style.display = 'block';
                    qrContainer.appendChild(qrText);

                    const lineStyle = {
                        position: 'absolute',
                        top: '15px',
                        bottom: '10px',
                        width: '1px',
                        backgroundColor: '#dee2e6'
                    };

                    const leftLine = document.createElement('div');
                    Object.assign(leftLine.style, lineStyle);
                    leftLine.style.left = '15px';

                    const rightLine = document.createElement('div');
                    Object.assign(rightLine.style, lineStyle);
                    rightLine.style.right = '15px';

                    qrContainer.appendChild(leftLine);
                    qrContainer.appendChild(rightLine);
                }

                clone.style.position = 'relative';

                clone.appendChild(qrContainer);
            } catch (qrErr) {
                console.error("Failed to generate QR code:", qrErr);
            }
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        const blob = await toBlob(clone, {
            pixelRatio,
            backgroundColor: backgroundColor || originalStyles.backgroundColor || '#ffffff',
        });

        if (!blob) {
            throw new Error("Failed to generate image blob");
        }

        await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
        ]);

        return 'copied';
    } catch (err) {
        console.error("Failed to copy element as image:", err);
        return 'error';
    } finally {
        container.remove();
    }
}

/**
 * Get the DOM path from a child node to its ancestor
 */
function getNodePath(node: Node, ancestor: Node): number[] {
    const path: number[] = [];
    let current = node;

    while (current && current !== ancestor) {
        const parent = current.parentNode;
        if (!parent) break;

        const index = Array.from(parent.childNodes).indexOf(current as ChildNode);
        path.unshift(index);
        current = parent;
    }

    return path;
}

/**
 * Find a node in the DOM by following a path from an ancestor
 */
function findNodeByPath(ancestor: Node, path: number[]): HTMLElement | null {
    let current = ancestor;

    for (const index of path) {
        if (!current.childNodes || index >= current.childNodes.length) {
            return null;
        }
        current = current.childNodes[index];
    }

    return current as HTMLElement;
}
