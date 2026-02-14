import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Trash2, TrendingUp, Calendar, Timer, Target, BarChart3, Flame, Zap } from 'lucide-react';
import { storage } from '@/storage/localStore';
import { AudioAnalyzer } from '@/audio/speechAnalyzer';
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { cn } from '@/utils/cn';
import { analytics } from '@/analytics';

export default function Stats() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [lemonScores, setLemonScores] = useState([]);
  const [topicScores, setTopicScores] = useState([]);
  const [stats, setStats] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    setSessions(storage.getSessions());
    setLemonScores(storage.getLemonScores());
    setTopicScores(storage.getTopicScores());
    setStats(storage.getStats());
    analytics.statsViewed();

    // Handle window resize for responsive chart
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  const StatCard = ({ icon: Icon, label, value, sub, footnote, className, variant = 'default' }) => (
    <div className={cn(
      'rounded-[22px] min-h-[124px] p-3.5 md:p-4 border shadow-card flex flex-col justify-between',
      variant === 'gradient' ? 'text-white border-border' : 'elevation-card text-[#E6EAF2]',
      className
    )}>
      <div className="flex items-start gap-2.5">
        <div className={cn(
          'p-2 rounded-xl border',
          variant === 'gradient'
            ? 'bg-surface-interactive/70 border-border'
            : 'bg-surface-interactive border-border'
        )}>
          <Icon size={16} className={variant === 'gradient' ? 'text-white' : 'text-primary'} />
        </div>
        <div className="min-w-0">
          <p className={cn(
            'font-serif leading-tight text-sm md:text-base',
            variant === 'gradient' ? 'text-white' : 'text-[#E6EAF2]'
          )}>
            {label}
          </p>
          {sub && (
            <p className={cn(
              'font-sans mt-0.5 text-[11px] leading-tight',
              variant === 'gradient' ? 'text-white/80' : 'text-[#7C859A]'
            )}>
              {sub}
            </p>
          )}
        </div>
      </div>

      <div className="text-center pt-1">
        <p className={cn(
          'text-[36px] leading-none font-serif font-bold',
          variant === 'gradient' ? 'text-white' : 'text-[#E6EAF2]'
        )}>
          {value}
        </p>
        {footnote && (
          <p className={cn(
            'text-[10px] mt-1 font-sans font-semibold uppercase tracking-[0.15em]',
            variant === 'gradient' ? 'text-white/75' : 'text-[#7C859A]'
          )}>
            {footnote}
          </p>
        )}
      </div>
    </div>
  );

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Prepare multi-line chart data (oldest first)
  const allSessionsCombined = [...sessions, ...lemonScores, ...topicScores]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Responsive chart data: 5 on mobile, 10 on desktop
  const chartSessionCount = isMobile ? 5 : 10;
  const multiLineData = allSessionsCombined.slice(-chartSessionCount).map((s, i) => {
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

  const lemonAverage = lemonScores.length > 0
    ? `${Math.round(lemonScores.reduce((sum, s) => sum + (s.flowScore || 0), 0) / lemonScores.length)}%`
    : '-';

  const topicAverage = topicScores.length > 0
    ? `${Math.round(topicScores.reduce((sum, s) => sum + (s.flowScore || 0), 0) / topicScores.length)}%`
    : '-';

  return (
    <div data-testid="history-page" className="min-h-screen bg-surface-base pb-32 px-6 md:px-12 lg:px-20 pt-8 max-w-6xl mx-auto">
      <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-2">Stats</h1>
      <p className="text-base text-muted-foreground font-sans mb-10">Your speaking performance metrics.</p>

      {/* New Metrics Section */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8">
        <StatCard
          icon={BarChart3}
          label="Overall Flow"
          sub="All exercises"
          value={`${storage.calculateOverallFlowScore()}%`}
          footnote="Overall"
          variant="gradient"
          className="bg-gradient-to-br from-sage-500 to-sage-600 border-sage-300/55"
        />
        <StatCard
          icon={Zap}
          label="Free Speaking"
          sub="Untimed"
          value={stats?.totalSessions > 0 ? `${stats.avgScore}%` : '-'}
          footnote="Free Speak"
          variant="gradient"
          className="bg-gradient-to-br from-terracotta-500 to-terracotta-600 border-terracotta-300/55"
        />
        <StatCard
          icon={Timer}
          label="Lemon Flow"
          sub="1 minute"
          value={lemonAverage}
          footnote="Lemon Avg"
          variant="gradient"
          className="bg-gradient-to-br from-yellow-500 to-yellow-600 border-yellow-300/55"
        />
        <StatCard
          icon={Target}
          label="Topic Flow"
          sub="2 minutes"
          value={topicAverage}
          footnote="Topic Avg"
          variant="gradient"
          className="bg-gradient-to-br from-blue-500 to-blue-600 border-blue-300/55"
        />
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-10">
          {/* Streak */}
          <StatCard
            icon={Flame}
            label="Day Streak"
            value={stats.currentStreak}
            sub={`Best: ${stats.bestStreak}`}
            className="elevation-card-elevated"
          />

          {/* Sessions */}
          <StatCard
            icon={Target}
            label="Total Sessions"
            value={stats.totalSessions}
            className="elevation-card"
          />

          {/* Practice Time */}
          <StatCard
            icon={Clock}
            label="Practice Time"
            value={formatDuration(stats.totalPracticeTime)}
            className="elevation-card"
          />
        </div>
      )}

      {/* Trend Chart Section */}
      {allSessionsCombined.length > 1 && (
        <div data-testid="multi-line-chart" className="rounded-3xl bg-surface-secondary border border-border shadow-card p-8 mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-2xl bg-surface-interactive border border-border text-primary">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-xl font-serif text-[#E6EAF2] mb-1">Performance Trends</h3>
              <p className="text-sm text-[#7C859A] font-sans">Flow Score progress across all modes</p>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={multiLineData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#7C859A', fontSize: 12, fontFamily: 'Nunito' }}
                  dy={10}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#7C859A', fontSize: 12, fontFamily: 'Nunito' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1B2238',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '16px',
                    boxShadow: '0 12px 30px -18px rgba(0, 0, 0, 0.75)',
                    padding: '12px'
                  }}
                  itemStyle={{ fontSize: '12px', fontFamily: 'Nunito', padding: '2px 0', color: '#AAB2C5' }}
                  labelStyle={{ display: 'none' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }}
                />

                {/* Overall - Red */}
                <Line
                  type="monotone"
                  dataKey="overall"
                  name="Overall Flow Score"
                  stroke="#D97C5F"
                  strokeWidth={4}
                  dot={{ r: 4, fill: '#D97C5F', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#D97C5F', strokeWidth: 2, stroke: '#1B2238' }}
                  animationDuration={1800}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {allSessionsCombined.length === 0 ? (
        <div data-testid="empty-history" className="text-center py-20">
          <Clock size={48} className="text-[#7C859A] mx-auto mb-4" />
          <p className="text-lg font-serif text-foreground mb-2">No sessions yet</p>
          <p className="text-sm text-[#AAB2C5] font-sans mb-6">Complete your first practice session to see results here.</p>
          <button
            data-testid="start-first-session-btn"
            onClick={() => navigate('/')}
            className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-sans font-semibold text-sm btn-press hover:brightness-110 night-glow" style={{ transition: 'filter 0.2s ease' }}
          >
            Start Practicing
          </button>
        </div>
      ) : (
        <>
          {/* Sessions List */}
          <div className="stagger-children space-y-3">
            {[...allSessionsCombined].reverse().map((session, index) => {
              const uniqueKey = session.id || session.created_at || `session-${index}`;
              const score = session.flowScore || session.hesitation_score || 0;
              const displayMode = session.mode === 'free-speak' || session.mode === 'free' ? 'Free' : (session.mode === 'lemon' ? 'Lemon' : 'Topic');
              const sessionTitle = session.word || session.topic || (session.mode === 'free-speak' || session.mode === 'free' ? 'Continuous Talk' : 'Speaking Practice');

              return (
                <div
                  key={uniqueKey}
                  data-testid={`session-${session.id}`}
                  className="rounded-2xl bg-surface-elevated border border-border shadow-card p-5 flex items-center gap-5 card-hover hover:border-ember-500/30"
                >
                  {/* Score Badge */}
                  <div className={cn(
                    "flex-shrink-0 w-14 h-14 rounded-2xl flex flex-col items-center justify-center",
                    session.mode === 'lemon' ? "bg-yellow-500/15 border border-yellow-400/30" : (session.mode === 'topic' ? "bg-blue-500/15 border border-blue-400/30" : "bg-surface-interactive border border-border")
                  )}>
                    <span className="text-lg font-serif font-medium text-[#E6EAF2]">{score}</span>
                    <span className="text-[9px] font-sans font-semibold uppercase text-[#7C859A]">%</span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-md",
                        session.mode === 'lemon' ? "bg-yellow-500/20 text-yellow-200 border border-yellow-400/25" :
                          (session.mode === 'topic' ? "bg-blue-500/20 text-blue-200 border border-blue-400/25" : "bg-surface-interactive text-[#AAB2C5] border border-border")
                      )}>
                        {displayMode}
                      </span>
                      <span className="text-sm font-sans font-semibold text-[#E6EAF2] truncate">{sessionTitle}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#AAB2C5] font-sans">
                      <span>{formatTime(session.totalSessionTime || session.duration || 0)} duration</span>
                      <span>{session.hesitationCount || session.hesitation_count || 0} pauses</span>
                    </div>
                  </div>

                  {/* Date & Actions */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <span className="text-xs text-[#7C859A] font-sans">{formatDate(session.created_at)}</span>
                    <button
                      data-testid={`delete-session-${session.id}`}
                      onClick={() => handleDelete(session.id, session.mode)}
                      className="p-1.5 rounded-lg hover:bg-surface-interactive text-muted-foreground/50 hover:text-terracotta-400 btn-press"
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
