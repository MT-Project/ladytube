import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import WatchPage from './pages/WatchPage';
import SettingsPage from './pages/SettingsPage';
import ScreenshotGalleryPage from './pages/ScreenshotGalleryPage';
import CalendarPage from './pages/CalendarPage';
import ExtPage from './components/ExtPage';
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
          {/* LadyTube: 拡張のページ (/makers・/performer/:id など。中身は server/ext/public の各ファイル) */}
          <Route path="*" element={<ExtPage />} />
        </Routes>
      </UIProvider>
    </BrowserRouter>
  );
}

export default App;
