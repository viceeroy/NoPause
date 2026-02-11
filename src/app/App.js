// No Pause — Application Root
// Routing, providers, global initialization

import '@/app/App.css';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Navbar } from '@/ui/Navbar';
import Dashboard from '@/pages/DashboardPage';
import Practice from '@/pages/PracticePage';
import Prompts from '@/pages/PromptsPage';
import Stats from '@/pages/StatsPage';
import { analytics } from '@/analytics';

function App() {
    // Run daily rollup engine on app open (async, fire-and-forget)
    useEffect(() => {
        analytics.runDailyRollup();
    }, []);
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
