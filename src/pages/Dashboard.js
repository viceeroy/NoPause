import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Flame, Target, Clock, TrendingUp, Shield, Zap, Sparkles, Timer } from 'lucide-react';
import { storage } from '@/lib/storage';
import { SPEAKING_PROMPTS, RANDOM_WORDS } from '@/lib/prompts';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

const StatCard = ({ icon: Icon, label, value, sub, className, testId }) => (
  <div data-testid={testId} className={`card-hover rounded-3xl p-3 md:p-6 ${className}`}>
    <div className="flex items-start justify-between mb-3 md:mb-4">
      <div className="p-1.5 md:p-2.5 rounded-2xl bg-white/60">
        <Icon size={16} className="text-sage-600 md:hidden" />
        <Icon size={20} className="text-sage-600 hidden md:block" />
      </div>
    </div>
    <p className="text-xl md:text-3xl font-serif font-medium text-foreground">{value}</p>
    <p className="text-xs md:text-sm text-muted-foreground mt-1 font-sans">{label}</p>
    {sub && <p className="text-[10px] md:text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [lemonWord, setLemonWord] = useState('');
  const [topicPrompt, setTopicPrompt] = useState(null);

  useEffect(() => {
    setStats(storage.getStats());

    // Initialize random content for display
    setLemonWord(RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)]);
    setTopicPrompt(SPEAKING_PROMPTS[Math.floor(Math.random() * SPEAKING_PROMPTS.length)]);
  }, []);

  // Navigation handlers
  const handleCardClick = (mode) => {
    if (mode === 'free') {
      navigate('/practice/free-speaking');
    } else if (mode === 'lemon') {
      navigate('/practice?mode=lemon');
    } else if (mode === 'topic') {
      navigate('/practice?mode=topic');
    }
  };

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  if (!stats) return null;

  return (
    <div data-testid="dashboard-page" className="min-h-screen pb-28 px-6 md:px-12 lg:px-20 pt-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-16">
        <div className="text-left">
          <h1 className="text-5xl md:text-6xl font-serif font-medium text-foreground mb-4">
            No Pause
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mt-3 font-sans leading-relaxed max-w-lg">
            Practice speaking with confidence. Your voice stays on your device.
          </p>
        </div>
        <div className="flex justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-sage-100 text-sage-600 rounded-full text-sm font-sans font-semibold">
            <Shield size={14} />
            Offline & Private
          </div>
        </div>
      </div>

      {/* Speaking Area */}
      <div className="flex flex-col mb-16">
        {/* Free Speaking Block - Always on top */}
        <div
          data-testid="free-speak-card"
          onClick={() => handleCardClick('free')}
          className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-8 md:p-12 mb-6 md:mb-8 text-center cursor-pointer card-hover btn-press relative overflow-hidden group"
        >
          <div className="flex justify-center mb-6">
            <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center bg-sage-50 transition-transform duration-300 group-hover:scale-110">
              <div className="absolute inset-0 rounded-full animate-pulse bg-sage-400 opacity-20"></div>
              <Mic size={40} className="md:size-[56px] text-sage-600 relative z-10" />
            </div>
          </div>

          <h3 className="text-xl md:text-2xl font-serif text-foreground mb-1">Free Speaking</h3>
          <p className="text-sm md:text-base text-muted-foreground font-sans">Practice continuous speaking without time limits</p>
        </div>

        {/* Lemon and Topic Cards Grid - Always below */}
        <div className="grid grid-cols-2 gap-4 md:gap-8">
          {/* Lemon Technique */}
          <div
            onClick={() => handleCardClick('lemon')}
            className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-4 md:p-8 text-center cursor-pointer card-hover btn-press relative overflow-hidden group"
          >
            <div className="flex flex-col md:flex-row items-center md:items-start gap-3 mb-4 md:mb-6 text-center md:text-left">
              <div className="p-2 md:p-2.5 rounded-2xl bg-yellow-100">
                <Timer size={18} className="text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-serif text-foreground mb-0.5 md:mb-1">Lemon Technique</h3>
                <p className="text-[10px] md:text-sm text-muted-foreground font-sans">1m pressure speak</p>
              </div>
            </div>

            <div className="py-4 md:py-8 bg-yellow-50/50 rounded-2xl mb-4 border border-yellow-100 flex items-center justify-center gap-2">
              <Sparkles size={16} className="text-yellow-500 opacity-60" />
              <p className="text-[11px] md:text-sm text-yellow-800 font-sans font-medium italic">Random word</p>
            </div>

            <div className="text-center">
              <div className="text-xl md:text-2xl font-serif font-medium text-foreground mb-0.5 md:mb-1">1:00</div>
              <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-widest">Time Limit</p>
            </div>
          </div>

          {/* Topic Speaking */}
          <div
            onClick={() => handleCardClick('topic')}
            className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-4 md:p-8 text-center cursor-pointer card-hover btn-press relative overflow-hidden group"
          >
            <div className="flex flex-col md:flex-row items-center md:items-start gap-3 mb-4 md:mb-6 text-center md:text-left">
              <div className="p-2 md:p-2.5 rounded-2xl bg-blue-100">
                <Target size={18} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-serif text-foreground mb-0.5 md:mb-1">Topic Score</h3>
                <p className="text-[10px] md:text-sm text-muted-foreground font-sans">2m critical thinking</p>
              </div>
            </div>

            <div className="py-4 md:py-8 bg-blue-50/50 rounded-2xl mb-4 border border-blue-100 flex items-center justify-center gap-2">
              <Sparkles size={16} className="text-blue-500 opacity-60" />
              <p className="text-[11px] md:text-sm text-blue-800 font-sans font-medium italic">Random topic</p>
            </div>

            <div className="text-center">
              <div className="text-xl md:text-2xl font-serif font-medium text-foreground mb-0.5 md:mb-1">2:00</div>
              <p className="text-[10px] text-muted-foreground font-sans uppercase tracking-widest">Time Limit</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Blocks - Moved Below Speaking Area */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Streak */}
        <StatCard
          testId="streak-card"
          icon={Flame}
          label="Day Streak"
          value={stats.currentStreak}
          sub={`Best: ${stats.bestStreak}`}
          className="bg-sand-100 border border-sand-300/50"
        />

        {/* Total Sessions */}
        <StatCard
          testId="sessions-card"
          icon={Target}
          label="Sessions"
          value={stats.totalSessions}
          className="bg-white border border-sand-300/50 shadow-card"
        />

        {/* Practice Time */}
        <StatCard
          testId="practice-time-card"
          icon={Clock}
          label="Practice Time"
          value={formatTime(stats.totalPracticeTime)}
          className="bg-white border border-sand-300/50 shadow-card"
        />

        {/* Flow Score */}
        <StatCard
          testId="avg-score-card"
          icon={Zap}
          label="Flow Score"
          value={`${stats.avgScore}%`}
          sub={stats.bestScore > 0 ? `Best: ${stats.bestScore}%` : ''}
          className="bg-terracotta-50 border border-terracotta-200/50"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <button
          data-testid="view-prompts-btn"
          onClick={() => navigate('/prompts')}
          className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-3 md:p-5 text-left card-hover btn-press"
        >
          <p className="text-sm md:text-lg font-serif text-foreground mb-1">Speaking Prompts</p>
          <p className="text-xs md:text-sm text-muted-foreground font-sans">Get topic ideas</p>
        </button>
        <button
          data-testid="view-history-btn"
          onClick={() => navigate('/stats')}
          className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-3 md:p-5 text-left card-hover btn-press"
        >
          <p className="text-sm md:text-lg font-serif text-foreground mb-1">View Stats</p>
          <p className="text-xs md:text-sm text-muted-foreground font-sans">Track your progress</p>
        </button>
      </div>
    </div>
  );
}
