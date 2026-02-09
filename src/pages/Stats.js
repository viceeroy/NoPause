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

  const handleDelete = (id, mode) => {
    if (mode === 'lemon') {
      storage.deleteLemonScore(id);
    } else if (mode === 'topic') {
      storage.deleteTopicScore(id);
    } else {
      storage.deleteSession(id);
    }

    // Refresh all data
    setSessions(storage.getSessions());
    setLemonScores(storage.getLemonScores());
    setTopicScores(storage.getTopicScores());
    setStats(storage.getStats());
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

  // Prepare multi-line chart data (oldest first)
  const allSessionsCombined = [...sessions, ...lemonScores, ...topicScores]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const multiLineData = allSessionsCombined.slice(-10).map((s, i) => {
    const score = s.flowScore || s.hesitation_score || 0;

    // Calculate rolling overall average
    const slice = allSessionsCombined.slice(0, i + 1);
    const overallAvg = Math.round(slice.reduce((sum, curr) => sum + (curr.flowScore || curr.hesitation_score || 0), 0) / slice.length);

    return {
      name: `S${i + 1}`,
      overall: overallAvg,
      fullDate: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
  });

  return (
    <div data-testid="history-page" className="min-h-screen pb-28 px-6 md:px-12 lg:px-20 pt-8 max-w-6xl mx-auto">
      <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-2">Stats</h1>
      <p className="text-base text-muted-foreground font-sans mb-10">Your speaking performance metrics.</p>

      {/* New Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-12">
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
            <div className="text-4xl font-serif font-bold text-white mb-1">
              {storage.calculateOverallFlowScore()}%
            </div>
            <div className="text-sm text-sage-100 font-sans font-medium uppercase tracking-widest opacity-80">
              Overall Flow
            </div>
          </div>
        </div>

        {/* Free Speaking Score */}
        <div className="rounded-2xl bg-gradient-to-br from-terracotta-500 to-terracotta-600 text-white border border-terracotta-400/50 shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-white/20">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-white mb-1">Free Speaking — Flow Score</h3>
              <p className="text-sm text-terracotta-100 font-sans">Untimed exploration</p>
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-serif font-bold text-white mb-1">
              {stats?.totalSessions > 0 ? `${stats.avgScore}%` : '-'}
            </div>
            <div className="text-sm text-terracotta-100 font-sans font-medium uppercase tracking-widest opacity-80">
              Free Speak
            </div>
          </div>
        </div>

        {/* Lemon Score */}
        <div className="rounded-2xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white border border-yellow-400/50 shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-white/20">
              <Timer size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-white mb-1">Lemon Flow Score</h3>
              <p className="text-sm text-yellow-100 font-sans">1-minute random speaking</p>
            </div>
          </div>
          <div className="text-center">
            {(() => {
              const avg = lemonScores.length > 0 ? Math.round(lemonScores.reduce((sum, s) => sum + (s.flowScore || 0), 0) / lemonScores.length) : null;
              return (
                <>
                  <div className="text-4xl font-serif font-bold text-white mb-1">
                    {avg !== null ? `${avg}%` : '-'}
                  </div>
                  <div className="text-sm text-yellow-100 font-sans font-medium uppercase tracking-widest opacity-80">
                    Lemon Average
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Topic Score */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white border border-blue-400/50 shadow-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-2xl bg-white/20">
              <Target size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-serif text-white mb-1">Topic Flow Score</h3>
              <p className="text-sm text-blue-100 font-sans">2-minute topic speaking</p>
            </div>
          </div>
          <div className="text-center">
            {(() => {
              const avg = topicScores.length > 0 ? Math.round(topicScores.reduce((sum, s) => sum + (s.flowScore || 0), 0) / topicScores.length) : null;
              return (
                <>
                  <div className="text-4xl font-serif font-bold text-white mb-1">
                    {avg !== null ? `${avg}%` : '-'}
                  </div>
                  <div className="text-sm text-blue-100 font-sans font-medium uppercase tracking-widest opacity-80">
                    Topic Average
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {/* Streak */}
          <StatCard
            icon={Flame}
            label="Day Streak"
            value={stats.currentStreak}
            sub={`Best: ${stats.bestStreak}`}
            className="bg-sand-100 border border-sand-300/50"
          />

          {/* Sessions */}
          <StatCard
            icon={Target}
            label="Total Sessions"
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
        </div>
      )}

      {/* Trend Chart Section */}
      {allSessionsCombined.length > 1 && (
        <div data-testid="multi-line-chart" className="rounded-3xl bg-white border border-sand-300/50 shadow-card p-8 mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-2xl bg-sage-50 text-sage-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-xl font-serif text-foreground mb-1">Performance Trends</h3>
              <p className="text-sm text-muted-foreground font-sans">Flow Score progress across all modes</p>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={multiLineData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0EFEA" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#949181', fontSize: 12, fontFamily: 'Nunito' }}
                  dy={10}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#949181', fontSize: 12, fontFamily: 'Nunito' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #E5E3DC',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
                    padding: '12px'
                  }}
                  itemStyle={{ fontSize: '12px', fontFamily: 'Nunito', padding: '2px 0' }}
                  labelStyle={{ display: 'none' }}
                  cursor={{ stroke: '#E5E3DC', strokeWidth: 1 }}
                />

                {/* Overall - Red */}
                <Line
                  type="monotone"
                  dataKey="overall"
                  name="Overall Flow Score"
                  stroke="#D97C5F"
                  strokeWidth={4}
                  dot={{ r: 4, fill: '#D97C5F', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#D97C5F', strokeWidth: 2, stroke: '#fff' }}
                  animationDuration={1800}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {allSessionsCombined.length === 0 ? (
        <div data-testid="empty-history" className="text-center py-20">
          <Clock size={48} className="text-sand-400 mx-auto mb-4" />
          <p className="text-lg font-serif text-foreground mb-2">No sessions yet</p>
          <p className="text-sm text-muted-foreground font-sans mb-6">Complete your first practice session to see results here.</p>
          <button
            data-testid="start-first-session-btn"
            onClick={() => navigate('/')}
            className="px-8 py-3 rounded-full bg-sage-500 text-white font-sans font-semibold text-sm btn-press hover:bg-sage-600" style={{ transition: 'background-color 0.2s ease' }}
          >
            Start Practicing
          </button>
        </div>
      ) : (
        <>
          {/* Sessions List */}
          <div className="stagger-children space-y-3">
            {[...allSessionsCombined].reverse().map((session) => {
              const score = session.flowScore || session.hesitation_score || 0;
              const displayMode = session.mode === 'free-speak' || session.mode === 'free' ? 'Free' : (session.mode === 'lemon' ? 'Lemon' : 'Topic');
              const sessionTitle = session.word || session.topic || (session.mode === 'free-speak' || session.mode === 'free' ? 'Continuous Talk' : 'Speaking Practice');

              return (
                <div
                  key={session.id || session.created_at}
                  data-testid={`session-${session.id}`}
                  className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-5 flex items-center gap-5 card-hover"
                >
                  {/* Score Badge */}
                  <div className={cn(
                    "flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center",
                    session.mode === 'lemon' ? "bg-yellow-50" : (session.mode === 'topic' ? "bg-blue-50" : "bg-sand-100")
                  )}>
                    <span className="text-lg font-serif font-medium text-foreground">{score}</span>
                    <span className="text-[9px] font-sans font-semibold uppercase text-muted-foreground">%</span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-md",
                        session.mode === 'lemon' ? "bg-yellow-100 text-yellow-700" :
                          (session.mode === 'topic' ? "bg-blue-100 text-blue-700" : "bg-sand-200 text-sand-700")
                      )}>
                        {displayMode}
                      </span>
                      <span className="text-sm font-sans font-semibold text-foreground truncate">{sessionTitle}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-sans">
                      <span>{formatTime(session.totalSessionTime || session.duration || 0)} duration</span>
                      <span>{session.hesitationCount || session.hesitation_count || 0} pauses</span>
                    </div>
                  </div>

                  {/* Date & Actions */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <span className="text-xs text-muted-foreground font-sans">{formatDate(session.created_at)}</span>
                    <button
                      data-testid={`delete-session-${session.id}`}
                      onClick={() => handleDelete(session.id, session.mode)}
                      className="p-1.5 rounded-lg hover:bg-sand-200 text-muted-foreground/50 hover:text-terracotta-400 btn-press"
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
