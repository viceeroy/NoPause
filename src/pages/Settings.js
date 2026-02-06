import { useState, useEffect } from 'react';
import { storage } from '@/lib/storage';
import { TIMER_PRESETS } from '@/lib/prompts';
import { Download, Trash2, Shield, Sliders, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Settings() {
  const [prefs, setPrefs] = useState(storage.getPreferences());
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    setSessionCount(storage.getSessions().length);
  }, []);

  const handleTimerChange = (value) => {
    const updated = { ...prefs, defaultTimer: value };
    setPrefs(updated);
    storage.savePreferences(updated);
    toast.success('Default timer updated');
  };

  const handleSensitivityChange = (e) => {
    const value = parseFloat(e.target.value);
    const updated = { ...prefs, silenceThreshold: value };
    setPrefs(updated);
    storage.savePreferences(updated);
  };

  const handleExport = () => {
    const data = storage.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluencyflow-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported successfully');
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure? This will delete all your session history and preferences.')) {
      storage.clearSessions();
      localStorage.removeItem('fluencyflow_preferences');
      localStorage.removeItem('fluencyflow_streak');
      setSessionCount(0);
      setPrefs(storage.getPreferences());
      toast.success('All data cleared');
    }
  };

  return (
    <div data-testid="settings-page" className="min-h-screen pb-28 px-6 md:px-12 lg:px-20 pt-8 max-w-3xl mx-auto">
      <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-2">Settings</h1>
      <p className="text-base text-muted-foreground font-sans mb-10">Customize your practice experience.</p>

      {/* Default Timer */}
      <div className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-sage-100">
            <Clock size={18} className="text-sage-600" />
          </div>
          <div>
            <p className="font-sans font-semibold text-foreground">Default Timer</p>
            <p className="text-xs text-muted-foreground font-sans">Set your preferred session length</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {TIMER_PRESETS.map((preset) => (
            <button
              key={preset.value}
              data-testid={`setting-timer-${preset.value}`}
              onClick={() => handleTimerChange(preset.value)}
              className={cn(
                'px-5 py-2.5 rounded-full font-sans font-semibold text-sm btn-press',
                'transition-colors duration-200',
                prefs.defaultTimer === preset.value
                  ? 'bg-sage-500 text-white'
                  : 'bg-sand-200 text-foreground hover:bg-sand-300'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sensitivity */}
      <div className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-sage-100">
            <Sliders size={18} className="text-sage-600" />
          </div>
          <div>
            <p className="font-sans font-semibold text-foreground">Silence Sensitivity</p>
            <p className="text-xs text-muted-foreground font-sans">Adjust how sensitive silence detection is</p>
          </div>
        </div>
        <div className="space-y-3">
          <input
            data-testid="sensitivity-slider"
            type="range"
            min="0.005"
            max="0.05"
            step="0.005"
            value={prefs.silenceThreshold}
            onChange={handleSensitivityChange}
            className="w-full h-2 rounded-full appearance-none bg-sand-300 accent-sage-500"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-sans">
            <span>More sensitive</span>
            <span>Less sensitive</span>
          </div>
        </div>
      </div>

      {/* Privacy */}
      <div className="rounded-3xl bg-sage-50 border border-sage-200/50 p-6 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-sage-100">
            <Shield size={18} className="text-sage-600" />
          </div>
          <div>
            <p className="font-sans font-semibold text-foreground">Privacy First</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground font-sans leading-relaxed">
          Your audio never leaves your device. All speech analysis happens locally in your browser.
          Session results are stored only on your device and can be exported or deleted at any time.
        </p>
      </div>

      {/* Data Management */}
      <div className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-sage-100">
            <Download size={18} className="text-sage-600" />
          </div>
          <div>
            <p className="font-sans font-semibold text-foreground">Data Management</p>
            <p className="text-xs text-muted-foreground font-sans">{sessionCount} session{sessionCount !== 1 ? 's' : ''} stored locally</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            data-testid="export-data-btn"
            onClick={handleExport}
            disabled={sessionCount === 0}
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-full font-sans font-semibold text-sm btn-press',
              'transition-colors duration-200',
              sessionCount > 0
                ? 'bg-sage-500 text-white hover:bg-sage-600'
                : 'bg-sand-300 text-muted-foreground cursor-not-allowed'
            )}
          >
            <Download size={16} />
            Export JSON
          </button>
          <button
            data-testid="clear-data-btn"
            onClick={handleClearData}
            disabled={sessionCount === 0}
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-full font-sans font-semibold text-sm btn-press',
              'transition-colors duration-200',
              sessionCount > 0
                ? 'bg-terracotta-50 text-terracotta-500 hover:bg-terracotta-100 border border-terracotta-200'
                : 'bg-sand-200 text-muted-foreground cursor-not-allowed'
            )}
          >
            <Trash2 size={16} />
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
}
