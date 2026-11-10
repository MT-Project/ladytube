import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import WatchPage from './pages/WatchPage';
import SettingsPage from './pages/SettingsPage';
import ScreenshotGalleryPage from './pages/ScreenshotGalleryPage';
import CalendarPage from './pages/CalendarPage';
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
        </Routes>
      </UIProvider>
    </BrowserRouter>
  );
}

export default App;
