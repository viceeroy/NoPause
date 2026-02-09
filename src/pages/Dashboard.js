import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Flame, Target, Clock, TrendingUp, Shield, Zap, Sparkles, Timer } from 'lucide-react';
import { storage } from '@/lib/storage';
import { SPEAKING_PROMPTS, RANDOM_WORDS } from '@/lib/prompts';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

const StatCard = ({ icon: Icon, label, value, sub, className, testId }) => (
  <div data-testid={testId} className={`card-hover rounded-3xl p-6 ${className}`}>
    <div className="flex items-start justify-between mb-4">
      <div className="p-2.5 rounded-2xl bg-white/60">
        <Icon size={20} className="text-sage-600" />
      </div>
    </div>
    <p className="text-3xl font-serif font-medium text-foreground">{value}</p>
    <p className="text-sm text-muted-foreground mt-1 font-sans">{label}</p>
    {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  // Content for Practice page
  const [lemonWord, setLemonWord] = useState('');
  const [topicPrompt, setTopicPrompt] = useState(null);

  useEffect(() => {
    setStats(storage.getStats());

    // Initialize random content for display
    setLemonWord(RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)]);
    setTopicPrompt(SPEAKING_PROMPTS[Math.floor(Math.random() * SPEAKING_PROMPTS.length)]);
  }, []);

  // Navigation handlers
  const startFreeSpeak = () => {
    navigate('/practice/free-speaking');
  };

  const startLemon = () => {
    navigate(`/practice?mode=lemon&word=${encodeURIComponent(lemonWord)}`);
  };

  const startTopic = () => {
    navigate(`/practice?mode=topic&prompt=${encodeURIComponent(topicPrompt.id)}`);
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
      <div className="mb-16">
        {/* Free Speaking Block */}
        <div className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-2xl bg-sage-100">
              <Mic size={20} className="text-sage-600" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-foreground mb-1">Free Speaking</h3>
              <p className="text-sm text-muted-foreground font-sans">Talk about anything, no timer</p>
            </div>
          </div>

          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="relative w-24 h-24 rounded-full flex items-center justify-center bg-sage-100">
                <div className="absolute inset-0 rounded-full animate-pulse bg-sage-400 opacity-20"></div>
                <Mic size={40} className="text-sage-600 relative z-10" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-sans">Practice speaking freely without time limits</p>
          </div>

          <button
            onClick={startFreeSpeak}
            className="w-full py-3 rounded-full font-sans font-semibold text-sm btn-press transition-colors bg-sage-500 hover:bg-sage-600 text-white"
          >
            Start Free Speak
          </button>
        </div>

        {/* Side-by-side blocks */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Lemon Technique */}
          <div className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-2xl bg-yellow-100">
                <Timer size={20} className="text-yellow-600" />
              </div>
              <div>
                <h3 className="text-xl font-serif text-foreground mb-1">Lemon Technique</h3>
                <p className="text-sm text-muted-foreground font-sans">1 minute speaking</p>
              </div>
            </div>

            <div className="text-center mb-6">
              <div className="text-3xl font-serif font-medium text-foreground mb-2">
                {lemonWord}
              </div>
              <p className="text-sm text-muted-foreground font-sans">Random word</p>
            </div>

            <div className="text-center mb-4">
              <div className="text-2xl font-serif font-medium text-foreground mb-2">
                1:00
              </div>
              <p className="text-sm text-muted-foreground font-sans">Timer</p>
            </div>

            <button
              onClick={startLemon}
              className="w-full py-3 rounded-full font-sans font-semibold text-sm btn-press transition-colors bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              Start Lemon
            </button>
          </div>

          {/* Topic Score */}
          <div className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-2xl bg-blue-100">
                <Target size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-serif text-foreground mb-1">Topic Score</h3>
                <p className="text-sm text-muted-foreground font-sans">2 minute speaking</p>
              </div>
            </div>

            <div className="text-center mb-6">
              <div className="text-lg font-serif text-foreground mb-2">
                {topicPrompt?.text}
              </div>
              <div className="text-xs text-muted-foreground font-sans">
                {topicPrompt?.category} • {topicPrompt?.difficulty}
              </div>
            </div>

            <div className="text-center mb-4">
              <div className="text-2xl font-serif font-medium text-foreground mb-2">
                2:00
              </div>
              <p className="text-sm text-muted-foreground font-sans">Timer</p>
            </div>

            <button
              onClick={startTopic}
              className="w-full py-3 rounded-full font-sans font-semibold text-sm btn-press transition-colors bg-blue-500 hover:bg-blue-600 text-white"
            >
              Start Topic
            </button>
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
      <div className="grid grid-cols-2 gap-4">
        <button
          data-testid="view-prompts-btn"
          onClick={() => navigate('/prompts')}
          className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-5 text-left card-hover btn-press"
        >
          <p className="font-serif text-lg text-foreground mb-1">Speaking Prompts</p>
          <p className="text-sm text-muted-foreground font-sans">Get topic ideas</p>
        </button>
        <button
          data-testid="view-history-btn"
          onClick={() => navigate('/stats')}
          className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-5 text-left card-hover btn-press"
        >
          <p className="font-serif text-lg text-foreground mb-1">View Stats</p>
          <p className="text-sm text-muted-foreground font-sans">Track your progress</p>
        </button>
      </div>
    </div>
  );
}
