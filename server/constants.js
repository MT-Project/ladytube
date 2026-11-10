const VIDEO_EXTENSIONS = {
    // Native Browser Support
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
};

const NATIVE_EXTENSIONS = {
    // Video
    '.mp4': true,
    '.webm': true,
    // Audio
    '.mp3': true,
    '.wav': true,
    '.flac': true,
    '.m4a': true,
};

module.exports = {
    VIDEO_EXTENSIONS,
    NATIVE_EXTENSIONS
};
