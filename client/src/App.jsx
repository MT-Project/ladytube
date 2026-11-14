import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import WatchPage from './pages/WatchPage';
import SettingsPage from './pages/SettingsPage';
import ScreenshotGalleryPage from './pages/ScreenshotGalleryPage';
import CalendarPage from './pages/CalendarPage';
import ExtPage from './components/ExtPage';
import SeriesPage from './pages/SeriesPage';
import TagsPage from './pages/TagsPage';
import PerformersPage from './pages/PerformersPage';
import MakersPage from './pages/MakersPage';
import { UIProvider } from './contexts/UIContext';

function App() {
  return (
    <BrowserRouter>
      <UIProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/screenshots" element={<ScreenshotGalleryPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          {/* LadyTube: 公開カレンダー (公開日で年月別。v3.2.1 までは拡張のページ。key でカレンダーとは別のものとして置く) */}
          <Route path="/release-calendar" element={<CalendarPage key="release" release />} />
          {/* LadyTube: シリーズ一覧・タグ一覧・出演者一覧・メーカー一覧 (v3.2.1 までは拡張のページ) */}
          <Route path="/series" element={<SeriesPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/performers" element={<PerformersPage />} />
          <Route path="/makers" element={<MakersPage />} />
          {/* LadyTube: 拡張のページ (/performer/:id・/bookmarks など。中身は server/ext/public の各ファイル) */}
          <Route path="*" element={<ExtPage />} />
        </Routes>
      </UIProvider>
    </BrowserRouter>
  );
}

export default App;
