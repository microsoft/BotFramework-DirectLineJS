/**
 * Utilities for detecting iframe context and microphone permission.
 *
 * Used by DirectLine to auto-detect whether voice mode should be enabled
 * when running inside an iframe with `allow="microphone"` attribute.
 */

/**
 * Checks if the current context is running inside an iframe.
 */
export const isInIframe = (): boolean => {
    try {
        return typeof window !== 'undefined' && window.self !== window.top;
    } catch (e) {
        // If accessing window.top throws (cross-origin), we're definitely in an iframe
        return true;
    }
};

/**
 * Checks if the iframe has microphone permission via the allow attribute.
 *
 * Tries (in order):
 *   1. Permissions Policy API (Chrome 88+, Edge 88+)
 *   2. Feature Policy API (Chrome 60-87, Edge 79-87) — deprecated
 *   3. Permissions API (Chrome 43+, Firefox 46+, Safari 16+)
 */
export const hasIframeMicrophonePermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return false;
    }

    try {
        // Try using the Permissions Policy API (Chrome 88+, Edge 88+)
        const doc = document as any;
        if (doc.permissionsPolicy && typeof doc.permissionsPolicy.allowsFeature === 'function') {
            return doc.permissionsPolicy.allowsFeature('microphone');
        }

        // Fallback to deprecated Feature Policy API (Chrome 60-87, Edge 79-87)
        if (doc.featurePolicy && typeof doc.featurePolicy.allowsFeature === 'function') {
            return doc.featurePolicy.allowsFeature('microphone');
        }

        // Fallback to Permissions API (broader support: Chrome 43+, Firefox 46+, Safari 16+)
        if (typeof navigator !== 'undefined' && navigator.permissions) {
            const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            // 'granted' or 'prompt' means microphone is allowed by iframe policy
            // 'denied' means either user denied or iframe policy blocks it
            return result.state !== 'denied';
        }
    } catch (e) {
        // If permissions check fails, assume microphone is not allowed in iframe
    }

    return false;
};
