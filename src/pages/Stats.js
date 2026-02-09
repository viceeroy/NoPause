import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Trash2, TrendingUp, Calendar, Timer, Target, BarChart3, Flame, Zap } from 'lucide-react';
import { storage } from '@/lib/storage';
import { AudioAnalyzer } from '@/lib/audioAnalyzer';
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';

export default function Stats() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [lemonScores, setLemonScores] = useState([]);
  const [topicScores, setTopicScores] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setSessions(storage.getSessions());
    setLemonScores(storage.getLemonScores());
    setTopicScores(storage.getTopicScores());
    setStats(storage.getStats());
  }, []);

  const handleDelete = (id) => {
    storage.deleteSession(id);
    setSessions(storage.getSessions());
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const StatCard = ({ icon: Icon, label, value, sub, className }) => (
    <div className={`rounded-3xl p-6 ${className}`}>
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

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Prepare chart data (oldest first)
  const chartData = [...sessions].reverse().map((s, i) => ({
    index: i + 1,
    score: s.hesitation_score,
    date: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div data-testid="history-page" className="min-h-screen pb-28 px-6 md:px-12 lg:px-20 pt-8 max-w-6xl mx-auto">
      <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-2">Stats</h1>
      <p className="text-base text-muted-foreground font-sans mb-10">Your speaking performance metrics.</p>

      {/* New Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Lemon Score */}
        <div className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-yellow-100">
              <Timer size={20} className="text-yellow-600" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-foreground mb-1">Lemon Score</h3>
              <p className="text-sm text-muted-foreground font-sans">1-minute random speaking</p>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-serif font-medium text-foreground mb-2">
              {lemonScores.length > 0 ? Math.round(lemonScores.reduce((sum, s) => sum + (s.flowScore || 0), 0) / lemonScores.length) : '-'}
            </div>
            <div className="text-sm text-muted-foreground font-sans">
              {lemonScores.length > 0 ? `Average of ${lemonScores.length} sessions` : 'No sessions yet'}
            </div>
          </div>
        </div>

        {/* Topic Score */}
        <div className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-blue-100">
              <Target size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-foreground mb-1">Topic Score</h3>
              <p className="text-sm text-muted-foreground font-sans">2-minute topic speaking</p>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-serif font-medium text-foreground mb-2">
              {topicScores.length > 0 ? Math.round(topicScores.reduce((sum, s) => sum + (s.flowScore || 0), 0) / topicScores.length) : '-'}
            </div>
            <div className="text-sm text-muted-foreground font-sans">
              {topicScores.length > 0 ? `Average of ${topicScores.length} sessions` : 'No sessions yet'}
            </div>
          </div>
        </div>

        {/* Overall Flow Score */}
        <div className="rounded-2xl bg-gradient-to-br from-sage-500 to-sage-600 text-white border border-sage-400/50 shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-white/20">
              <BarChart3 size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-white mb-1">Overall Flow Score</h3>
              <p className="text-sm text-sage-100 font-sans">Aggregate across all exercises</p>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-serif font-medium text-white mb-2">
              {storage.calculateOverallFlowScore()}%
            </div>
            <div className="text-sm text-sage-100 font-sans">
              Weighted average of all exercises
            </div>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {/* Streak */}
          <StatCard
            icon={Flame}
            label="Day Streak"
            value={stats.currentStreak}
            sub={`Best: ${stats.bestStreak}`}
            className="bg-sand-100 border border-sand-300/50"
          />

          {/* Total Sessions */}
          <StatCard
            icon={Target}
            label="Sessions"
            value={stats.totalSessions}
            className="bg-white border border-sand-300/50 shadow-card"
          />

          {/* Practice Time */}
          <StatCard
            icon={Clock}
            label="Practice Time"
            value={formatDuration(stats.totalPracticeTime)}
            className="bg-white border border-sand-300/50 shadow-card"
          />

          {/* Avg Score */}
          <StatCard
            icon={Zap}
            label="Avg Fluency"
            value={`${stats.avgScore}%`}
            sub={stats.bestScore > 0 ? `Best: ${stats.bestScore}%` : ''}
            className="bg-terracotta-50 border border-terracotta-200/50"
          />
        </div>
      )}

      {sessions.length === 0 ? (
        <div data-testid="empty-history" className="text-center py-20">
          <Clock size={48} className="text-sand-400 mx-auto mb-4" />
          <p className="text-lg font-serif text-foreground mb-2">No sessions yet</p>
          <p className="text-sm text-muted-foreground font-sans mb-6">Complete your first practice session to see results here.</p>
          <button
            data-testid="start-first-session-btn"
            onClick={() => navigate('/practice')}
            className="px-8 py-3 rounded-full bg-sage-500 text-white font-sans font-semibold text-sm btn-press hover:bg-sage-600" style={{ transition: 'background-color 0.2s ease' }}
          >
            Start Practicing
          </button>
        </div>
      ) : (
        <>
          {/* Progress Chart */}
          {chartData.length > 1 && (
            <div data-testid="progress-chart" className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-sage-500" />
                <h3 className="font-serif text-lg text-foreground">Fluency Over Time</h3>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5A7D7C" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#5A7D7C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontFamily: 'Nunito', fill: '#6B7280' }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontFamily: 'Nunito', fill: '#6B7280' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E3DC', borderRadius: '12px', fontSize: '13px', fontFamily: 'Nunito' }}
                    formatter={(value) => [`${value}%`, 'Fluency']}
                  />
                  <Area type="monotone" dataKey="score" stroke="#5A7D7C" strokeWidth={2.5} fill="url(#scoreGradient)" dot={{ r: 3, fill: '#5A7D7C', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#D97C5F', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Sessions List */}
          <div className="stagger-children space-y-3">
            {sessions.map((session) => {
              const scoreColor = AudioAnalyzer.getScoreColor(session.hesitation_score);
              const scoreLabel = AudioAnalyzer.getScoreLabel(session.hesitation_score);
              return (
                <div
                  key={session.id}
                  data-testid={`session-${session.id}`}
                  className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-5 flex items-center gap-5 card-hover"
                >
                  {/* Score Badge */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center" style={{ backgroundColor: scoreColor + '15' }}>
                    <span className="text-lg font-serif font-medium" style={{ color: scoreColor }}>{session.hesitation_score}</span>
                    <span className="text-[9px] font-sans font-semibold uppercase" style={{ color: scoreColor }}>%</span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-sans font-semibold text-foreground">{scoreLabel}</span>
                      <span className="text-xs text-muted-foreground font-sans">{formatTime(session.duration)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-sans">
                      <span>{session.hesitation_count} hesitation{session.hesitation_count !== 1 ? 's' : ''}</span>
                      <span>{session.silence_time}s silence</span>
                    </div>
                    {session.prompt && (
                      <p className="text-xs text-muted-foreground/70 font-sans mt-1 truncate">{session.prompt}</p>
                    )}
                  </div>

                  {/* Date & Actions */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <span className="text-xs text-muted-foreground font-sans">{formatDate(session.created_at)}</span>
                    <button
                      data-testid={`delete-session-${session.id}`}
                      onClick={() => handleDelete(session.id)}
                      className="p-1.5 rounded-lg hover:bg-sand-200 text-muted-foreground/50 hover:text-terracotta-400 btn-press" style={{ transition: 'color 0.2s ease, background-color 0.2s ease' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
