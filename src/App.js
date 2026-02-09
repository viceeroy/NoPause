import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Navbar } from '@/components/ui/Navbar';
import Dashboard from '@/pages/Dashboard';
import Practice from '@/pages/Practice';
import Prompts from '@/pages/Prompts';
import Stats from '@/pages/Stats';

function App() {
  return (
    <div className="relative min-h-screen bg-background">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/practice/free-speaking" element={<Practice />} />
          <Route path="/prompts" element={<Prompts />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/history" element={<Navigate to="/stats" replace />} />
        </Routes>
        <Navbar />
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </div>
  );
}

export default App;
