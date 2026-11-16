// LadyTube: 画像の拡大表示と切り取りを開く (部品は components/ExtImageDialogs.jsx。v3.2.1 までは拡張の WL.lightbox / WL.cropDialog と同じ呼び方)
import { ExtCropDialog, ExtLightbox } from '../components/ExtImageDialogs';
import { openExtDialog } from './extDialog';

export const lightbox = (src, opts) => openExtDialog(ExtLightbox, { src, ...opts });
export const cropDialog = (src, onDone, opts) => openExtDialog(ExtCropDialog, { src, onDone, ...opts });
