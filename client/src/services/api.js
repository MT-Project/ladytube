export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}

async function handleResponse(res) {
    if (!res.ok) {
        if (res.status === 499) throw new ApiError('Cancelled', 499);

        let errorMsg = res.statusText;
        try {
            const text = await res.text();
            const data = JSON.parse(text);
            if (data.error) errorMsg = data.error;
        } catch (e) {
            // ignore JSON parse error
        }
        throw new ApiError(errorMsg, res.status);
    }
    // Return json if content-type is json, otherwise text or null
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        try {
            return await res.json();
        } catch (e) {
            console.error('[API] JSON parse error:', e);
            return res.text();
        }
    }
    return res.text();
}

const COMMUNICATION_ERROR = 'サーバーに接続できません。サーバーが起動しているか、ネットワーク接続を確認してください。';

async function wrapFetch(fetchPromise) {
    try {
        return await fetchPromise;
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        if (err.name === 'ApiError') {
            // 502, 503, 504 はプロキシ環境などでのサーバーダウンの可能性があるため通信エラー扱いにする
            if (err.status === 502 || err.status === 503 || err.status === 504) {
                // fall through
            } else {
                throw err;
            }
        }
        console.error('[API] Communication error:', err);
        throw new ApiError(COMMUNICATION_ERROR, 0);
    }
}

export const api = {
    getVideo: (id) => wrapFetch(fetch(`/api/video/${id}`).then(handleResponse)),
    getVideoProbeInfo: (id) => wrapFetch(fetch(`/api/video/${id}/probe`).then(handleResponse)),
    getTags: () => wrapFetch(fetch('/api/tags').then(handleResponse)),
    getScreenshots: (id) => wrapFetch(fetch(`/api/video/${id}/screenshots`).then(handleResponse)),
    getScreenshotGallery: (params) => wrapFetch(fetch(`/api/screenshots/gallery?${new URLSearchParams(params).toString()}`).then(handleResponse)),
    incrementPlayCount: (id) => wrapFetch(fetch(`/api/video/${id}/play`, { method: 'POST' }).then(handleResponse)),
    getVideos: (params) => wrapFetch(fetch(`/api/videos?${new URLSearchParams(params).toString()}`).then(handleResponse)),
    getVideoCount: (params) => wrapFetch(fetch(`/api/videos/count?${new URLSearchParams(params).toString()}`).then(handleResponse)),
    getFolders: (path) => wrapFetch(fetch(`/api/folders?${new URLSearchParams(path ? { path } : {}).toString()}`).then(handleResponse)),
    getSettings: () => wrapFetch(fetch('/api/settings').then(handleResponse)),
    updateScanSettings: (settings) => wrapFetch(fetch('/api/settings/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    }).then(handleResponse)),
    updateNetworkSettings: (settings) => wrapFetch(fetch('/api/settings/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    }).then(handleResponse)),
    getVideoImageList: (id, maxCount, force = false) => wrapFetch(fetch(`/api/video/${id}/imagelist?max_count=${maxCount}&force=${force}`).then(handleResponse)),
    getVideoImageListProgress: (id) => wrapFetch(fetch(`/api/video/${id}/imagelist/progress`).then(handleResponse)),
    cancelVideoImageList: (id) => wrapFetch(fetch(`/api/video/${id}/imagelist/cancel`, { method: 'POST' }).then(handleResponse)),
    openVideoFolder: (id) => wrapFetch(fetch(`/api/video/${id}/open-folder`, { method: 'POST' }).then(handleResponse)),
    openVideoApp: (id) => wrapFetch(fetch(`/api/video/${id}/open-app`, { method: 'POST' }).then(handleResponse)),
    updateVideoLastPos: (id, pos) => wrapFetch(fetch(`/api/video/${id}/pos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pos })
    }).then(handleResponse)),

    captureScreenshot: (id, timestamp) => wrapFetch(fetch(`/api/video/${id}/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp })
    }).then(handleResponse)),

    setThumbnail: (id, screenshotId) => wrapFetch(fetch(`/api/video/${id}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenshot_id: screenshotId })
    }).then(handleResponse)),
    setThumbnailFromTimestamp: (id, timestamp) => wrapFetch(fetch(`/api/video/${id}/thumbnail/timestamp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp })
    }).then(handleResponse)),

    deleteScreenshot: (id) => wrapFetch(fetch(`/api/video/screenshot/${id}`, {
        method: 'DELETE'
    }).then(handleResponse)),

    updateTranscodeSettings: (id, useTranscode) => wrapFetch(fetch(`/api/video/${id}/transcode_settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ use_transcode: useTranscode })
    }).then(handleResponse)),

    scan: (repair = false, signal) => wrapFetch(fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repair }),
        signal
    }).then(handleResponse)),
    getScanProgress: () => wrapFetch(fetch('/api/scan/progress').then(handleResponse)),
    cancelScan: () => wrapFetch(fetch('/api/scan/cancel', { method: 'POST' }).then(handleResponse)),
    getUnreferencedMetadataCount: () => wrapFetch(fetch('/api/maintenance/metadata/count').then(handleResponse)),
    cleanupMetadata: () => wrapFetch(fetch('/api/maintenance/metadata', { method: 'DELETE' }).then(handleResponse)),
    renameTag: (oldTag, newTag) => wrapFetch(fetch('/api/maintenance/tags/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldTag, newTag })
    }).then(handleResponse)),
    addTag: (id, tag) => wrapFetch(fetch(`/api/video/${id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
    }).then(handleResponse)),
    removeTag: (id, tag) => wrapFetch(fetch(`/api/video/${id}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag })
    }).then(handleResponse)),
    updateDisplayName: (id, displayName) => wrapFetch(fetch(`/api/video/${id}/display_name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName })
    }).then(handleResponse)),
    bulkUpdateTags: (tags) => wrapFetch(fetch('/api/tags/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
    }).then(handleResponse)),
    getServerInfo: () => wrapFetch(fetch('/api/server-info').then(handleResponse)),
    saveSearchHistory: (q) => Promise.resolve() // Noop
};
