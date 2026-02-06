import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Trash2, TrendingUp, Calendar } from 'lucide-react';
import { storage } from '@/lib/storage';
import { AudioAnalyzer } from '@/lib/audioAnalyzer';
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    setSessions(storage.getSessions());
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
    <div data-testid="history-page" className="min-h-screen pb-28 px-6 md:px-12 lg:px-20 pt-8 max-w-4xl mx-auto">
      <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-2">History</h1>
      <p className="text-base text-muted-foreground font-sans mb-10">Your speaking practice journey.</p>

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
