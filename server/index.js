const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const routes = require('./routes');
const db = require('./db');
const logger = require('./logger');
const app = express();
const port = 19190;

app.use(cors());
app.use(express.json());

app.post('/api/scan', routes.scanVideos);
app.get('/api/scan/progress', routes.getScanProgress);
app.post('/api/scan/cancel', routes.cancelScan);
app.get('/api/videos', routes.getVideos);
app.get('/api/videos/count', routes.getVideoCount);
app.get('/api/video/:id', routes.getVideo);
app.get('/api/video/:id/probe', routes.getVideoProbeInfo);
app.get('/api/video/:id/thumbnail', routes.getThumbnail);
app.get('/api/server-info', routes.getServerInfo);
app.get('/api/stream/:id', routes.streamVideo);

// Settings
app.get('/api/settings', routes.getSettings);
app.post('/api/settings/scan', routes.updateScanSettings);
app.post('/api/settings/network', routes.updateNetworkSettings);
app.get('/api/fs/list', routes.listDirectory);
app.get('/api/fs/resolve', routes.resolvePath);

// Tags & Comments
app.get('/api/tags', routes.getTags);
app.post('/api/tags', routes.createTag);
app.post('/api/video/:id/tags', routes.addTagToVideo);
app.delete('/api/video/:id/tags', routes.removeTagFromVideo);

app.get('/api/calendar/months', routes.getVideoCountsByMonth);
app.get('/api/folder-tree', routes.getFolderTree);
app.get('/api/folders', routes.getFolders);

app.post('/api/video/:id/display_name', routes.updateVideoDisplayName);
app.post('/api/video/:id/transcode_settings', routes.updateTranscodeSettings);
app.post('/api/video/:id/play', routes.incrementPlayCount);
app.post('/api/video/:id/pos', routes.updateVideoLastPos);


// Maintenance
app.get('/api/maintenance/metadata/count', routes.getUnreferencedMetadataCount);
app.delete('/api/maintenance/metadata', routes.cleanupMetadata);
app.put('/api/tags/bulk', routes.updateTags);
app.post('/api/maintenance/tags/rename', routes.renameTag);

// Screenshots
app.post('/api/video/:id/screenshot', routes.captureScreenshot);
app.get('/api/video/:id/screenshots', routes.getScreenshots);
app.get('/api/screenshot/:id/image', routes.getScreenshotImage);
app.get('/api/video/:id/preview', routes.getPreviewFrame);
app.delete('/api/video/screenshot/:id', routes.deleteScreenshot);
app.post('/api/video/:id/thumbnail', routes.setThumbnailFromScreenshot);
app.post('/api/video/:id/thumbnail/timestamp', routes.setThumbnailFromTimestamp);
app.get('/api/screenshots/gallery', routes.getScreenshotGallery);

// Image List
app.get('/api/video/:id/imagelist', routes.getVideoImageList);
app.get('/api/video/:id/imagelist/progress', routes.getVideoImageListProgress);
app.post('/api/video/:id/imagelist/cancel', routes.cancelVideoImageList);
app.get('/api/video/:id/imagelist/image', routes.getVideoImageFromList);

// Local Operations
app.post('/api/video/:id/open-folder', routes.openVideoFolder);
app.post('/api/video/:id/open-app', routes.openVideoApp);
app.get('/api/video/:id/subtitle', routes.getSubtitle);

// Serve static files from the client/dist directory
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    // Serve index.html for any unknown routes (for React Router)
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next();
        }
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

const openBrowser = process.argv.includes('-browser') || process.argv.includes('--browser');

function openInBrowser(url) {
    const { exec } = require('child_process');
    const startCmd = process.platform === 'win32' ? `start "" "${url}"` :
        process.platform === 'darwin' ? `open "${url}"` :
            `xdg-open "${url}"`;
    exec(startCmd, (err) => {
        if (err) {
            logger.error('ブラウザ起動エラー', err);
        }
    });
}

const hostSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('allow_public');
const allowPublic = hostSetting ? JSON.parse(hostSetting.value) : false;
const host = allowPublic ? '0.0.0.0' : '127.0.0.1';

const server = app.listen(port, host, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Allow public: ${allowPublic ? 'Yes' : 'No'}`);
    if (openBrowser) {
        openInBrowser(`http://localhost:${port}`);
    }
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        logger.error('サーバー起動エラー', new Error('サーバーはすでにポート ' + port + ' で起動しています。多重起動はできません。'));
        process.exit(1);
    }
    logger.error('サーバー起動エラー', e);
});

