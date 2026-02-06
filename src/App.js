import '@/App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Navbar } from '@/components/ui/Navbar';
import Dashboard from '@/pages/Dashboard';
import Practice from '@/pages/Practice';
import History from '@/pages/History';
import Prompts from '@/pages/Prompts';
import Settings from '@/pages/Settings';

function App() {
  return (
    <div className="relative min-h-screen bg-background">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/history" element={<History />} />
          <Route path="/prompts" element={<Prompts />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <Navbar />
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </div>
  );
}

export default App;
