import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Flame, Target, Clock, TrendingUp, Shield, Zap } from 'lucide-react';
import { storage } from '@/lib/storage';
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

  useEffect(() => {
    setStats(storage.getStats());
  }, []);

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
      <div className="flex items-start justify-between mb-12">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-sage-100 text-sage-600 rounded-full text-xs font-sans font-semibold">
              <Shield size={12} />
              Offline & Private
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-medium tracking-tight text-foreground">
            FluencyFlow
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mt-3 font-sans leading-relaxed max-w-lg">
            Practice speaking with confidence. Your voice stays on your device.
          </p>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Quick Start - Large Card */}
        <button
          data-testid="quick-start-btn"
          onClick={() => navigate('/practice')}
          className="col-span-2 row-span-2 relative overflow-hidden rounded-3xl bg-sage-500 text-white p-8 md:p-10 card-hover btn-press group"
        >
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-6 group-hover:scale-110" style={{ transition: 'transform 0.3s ease' }}>
              <Mic size={28} className="text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-medium mb-2 text-left">Start Speaking</h2>
            <p className="text-sage-100 text-left font-sans text-sm">Begin a new practice session</p>
          </div>
          <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/10 animate-breathe" />
          <div className="absolute right-12 bottom-12 w-20 h-20 rounded-full bg-white/5 animate-breathe" style={{ animationDelay: '1s' }} />
        </button>

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

        {/* Avg Score */}
        <StatCard
          testId="avg-score-card"
          icon={Zap}
          label="Avg Fluency"
          value={`${stats.avgScore}%`}
          sub={stats.bestScore > 0 ? `Best: ${stats.bestScore}%` : ''}
          className="bg-terracotta-50 border border-terracotta-200/50"
        />
      </div>

      {/* Trend Chart */}
      {stats.recentTrend.length > 1 && (
        <div data-testid="trend-chart" className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-sage-500" />
            <h3 className="font-serif text-lg text-foreground">Recent Progress</h3>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={stats.recentTrend}>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E5E3DC',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontFamily: 'Nunito',
                }}
                formatter={(value) => [`${value}%`, 'Fluency']}
                labelFormatter={() => ''}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#5A7D7C"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#5A7D7C', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#D97C5F', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

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
          onClick={() => navigate('/history')}
          className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-5 text-left card-hover btn-press"
        >
          <p className="font-serif text-lg text-foreground mb-1">View History</p>
          <p className="text-sm text-muted-foreground font-sans">Track your progress</p>
        </button>
      </div>
    </div>
  );
}
