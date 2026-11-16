import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import WatchPage from './pages/WatchPage';
import ScreenshotGalleryPage from './pages/ScreenshotGalleryPage';
import CalendarPage from './pages/CalendarPage';
import ExtPage from './components/ExtPage';
import { UIProvider } from './contexts/UIContext';
import { ExtDialogHost } from './components/ExtDialog';

// LadyTube: 拡張から移したページは、開いたときに読む (最初に読む JS を軽くする。vite が別のファイルに分ける)
const SeriesPage = lazy(() => import('./pages/SeriesPage'));
const TagsPage = lazy(() => import('./pages/TagsPage'));
const PerformersPage = lazy(() => import('./pages/PerformersPage'));
const MakersPage = lazy(() => import('./pages/MakersPage'));
const BookmarksPage = lazy(() => import('./pages/BookmarksPage'));
const PerformerPage = lazy(() => import('./pages/PerformerPage'));
// LadyTube: 管理画面も開いたときに読む (拡張機能の項目を足して大きくなったため)
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function App() {
  return (
    <BrowserRouter>
      <UIProvider>
        <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/screenshots" element={<ScreenshotGalleryPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          {/* LadyTube: 公開カレンダー (公開日で年月別。v3.2.1 までは拡張のページ。key でカレンダーとは別のものとして置く) */}
          <Route path="/release-calendar" element={<CalendarPage key="release" release />} />
          {/* LadyTube: シリーズ一覧・タグ一覧・出演者一覧・メーカー一覧・ブックマーク・出演者 (v3.2.1 までは拡張のページ) */}
          <Route path="/series" element={<SeriesPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/performers" element={<PerformersPage />} />
          <Route path="/makers" element={<MakersPage />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/performer/:id" element={<PerformerPage />} />
          {/* LadyTube: 拡張・個人用モジュールのページ (WLExt.extPages。中身は拡張・個人用モジュールの各ファイル) */}
          <Route path="*" element={<ExtPage />} />
        </Routes>
        </Suspense>
        {/* LadyTube: 本体の画面のどこからでも開けるダイアログ (utils/extDialog.js の openExtDialog) */}
        <ExtDialogHost />
      </UIProvider>
    </BrowserRouter>
  );
}

export default App;
