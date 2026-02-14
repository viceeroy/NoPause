import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Flame, Target, Clock, Shield, Zap, Timer } from 'lucide-react';
import { storage } from '@/storage/localStore';
import { SPEAKING_PROMPTS, RANDOM_WORDS } from '@/data/speakingPrompts';
import { analytics } from '@/analytics';
import { cn } from '@/utils/cn';

const StatCard = ({ icon: Icon, label, value, sub, className, testId }) => (
  <div data-testid={testId} className={`card-hover rounded-3xl p-3.5 md:p-5 ${className}`}>
    <div className="flex items-start justify-between mb-2 md:mb-3">
      <div className="p-1.5 md:p-2.5 rounded-2xl bg-surface-elevated border border-border">
        <Icon size={16} className="text-primary md:hidden" />
        <Icon size={20} className="text-primary hidden md:block" />
      </div>
    </div>
    <p className="text-2xl md:text-4xl font-serif font-medium text-foreground drop-shadow-[0_1px_0_rgba(0,0,0,0.3)]">{value}</p>
    <p className="text-[11px] md:text-sm text-muted-foreground/90 mt-0.5 font-sans">{label}</p>
    {sub && <p className="text-[10px] md:text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
  </div>
);

const CompactModeCard = ({
  title,
  subtitle,
  actionLabel,
  timeLabel,
  onClick,
  icon: Icon,
  className,
  iconWrapClass,
  iconClass,
  actionClass,
}) => (
  <button
    onClick={onClick}
    className={cn(
      'rounded-[22px] p-4 md:p-6 text-center cursor-pointer card-hover btn-press relative overflow-hidden',
      'min-h-[220px] flex flex-col items-center justify-between',
      className
    )}
  >
    <div className={cn('p-2.5 rounded-2xl border', iconWrapClass)}>
      <Icon size={18} className={iconClass} />
    </div>

    <div className="mt-3">
      <h3 className="text-sm md:text-lg font-serif text-foreground leading-tight">{title}</h3>
      <p className="text-[11px] md:text-sm text-muted-foreground font-sans leading-tight mt-1">{subtitle}</p>
    </div>

    <div className={cn(
      'mt-3 px-3 py-1.5 rounded-full text-[11px] md:text-xs font-sans font-semibold border',
      actionClass
    )}>
      {actionLabel}
    </div>

    <div className="mt-3">
      <p className="text-lg md:text-xl font-serif font-semibold text-foreground leading-none">{timeLabel}</p>
      <p className="text-[9px] md:text-[10px] text-muted-foreground font-sans uppercase tracking-[0.14em] mt-1">Time Limit</p>
    </div>
  </button>
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
    analytics.modeSelected(mode);
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
    <div data-testid="dashboard-page" className="min-h-screen pb-32 px-5 md:px-12 lg:px-20 pt-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-12">
        <div className="text-left">
          <h1 className="text-4xl md:text-6xl font-serif font-medium text-foreground mb-4 tracking-tight">
            No Pause
          </h1>
          <p className="text-sm md:text-lg text-muted-foreground mt-3 font-sans leading-relaxed max-w-lg">
            Practice speaking with confidence. Your voice stays on your device.
          </p>
        </div>
        <div className="flex justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-border/80 text-primary rounded-full text-xs md:text-sm font-sans font-semibold">
            <Shield size={12} className="md:hidden" />
            <Shield size={14} className="hidden md:block" />
            Offline & Private
          </div>
        </div>
      </div>

      {/* Speaking Area */}
      <div className="flex flex-col mb-14">
        {/* Free Speaking Block - Always on top */}
        <div
          data-testid="free-speak-card"
          onClick={() => handleCardClick('free')}
          className="rounded-[24px] bg-gradient-to-b from-surface-card to-surface-elevated border border-border/80 shadow-card p-8 md:p-12 mb-4 md:mb-6 text-center cursor-pointer card-hover btn-press relative overflow-hidden group"
        >
          <div className="flex justify-center mb-6">
            <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center bg-secondary transition-transform duration-300 group-hover:scale-110 night-glow">
              <div className="absolute inset-0 rounded-full animate-pulse bg-primary opacity-30"></div>
              <Mic size={40} className="md:size-[56px] text-primary relative z-10" />
            </div>
          </div>

          <h3 className="text-xl md:text-2xl font-serif text-foreground mb-1">Free Speaking</h3>
          <p className="text-sm md:text-base text-muted-foreground font-sans">Practice continuous speaking without time limits</p>
        </div>

        {/* Lemon and Topic Cards Grid - Always below */}
        <div className="grid grid-cols-2 gap-3 md:gap-6">
          {/* Lemon Technique */}
          <CompactModeCard
            onClick={() => handleCardClick('lemon')}
            icon={Timer}
            title="Lemon Technique"
            subtitle="1m pressure speak"
            actionLabel="Random word"
            timeLabel="1:00"
            className="bg-gradient-to-b from-ember-200/14 to-surface-primary border border-ember-500/40 shadow-card"
            iconWrapClass="bg-ember-200/35 border-ember-500/35"
            iconClass="text-ember-600"
            actionClass="bg-surface-interactive border-ember-500/35 text-ember-600"
          />

          {/* Topic Speaking */}
          <CompactModeCard
            onClick={() => handleCardClick('topic')}
            icon={Target}
            title="Topic Score"
            subtitle="2m critical thinking"
            actionLabel="Random topic"
            timeLabel="2:00"
            className="bg-gradient-to-b from-cyan-500/12 to-surface-primary border border-cyan-400/40 shadow-card"
            iconWrapClass="bg-cyan-500/18 border-cyan-400/35"
            iconClass="text-cyan-300"
            actionClass="bg-surface-interactive border-cyan-400/35 text-cyan-300"
          />
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
          className="elevation-card"
        />

        {/* Total Sessions */}
        <StatCard
          testId="sessions-card"
          icon={Target}
          label="Sessions"
          value={stats.totalSessions}
          className="elevation-card"
        />

        {/* Practice Time */}
        <StatCard
          testId="practice-time-card"
          icon={Clock}
          label="Practice Time"
          value={formatTime(stats.totalPracticeTime)}
          className="elevation-card"
        />

        {/* Flow Score */}
        <StatCard
          testId="avg-score-card"
          icon={Zap}
          label="Flow Score"
          value={`${stats.avgScore}%`}
          sub={stats.bestScore > 0 ? `Best: ${stats.bestScore}%` : ''}
          className="elevation-card-elevated border border-ember-500/35"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <button
          data-testid="view-prompts-btn"
          onClick={() => navigate('/prompts')}
          className="rounded-2xl night-panel p-4 md:p-5 text-left card-hover btn-press min-h-[82px]"
        >
          <p className="text-sm md:text-lg font-serif text-foreground mb-1">Speaking Prompts</p>
          <p className="text-xs md:text-sm text-muted-foreground font-sans">Get topic ideas</p>
        </button>
        <button
          data-testid="view-history-btn"
          onClick={() => navigate('/stats')}
          className="rounded-2xl night-panel p-4 md:p-5 text-left card-hover btn-press min-h-[82px]"
        >
          <p className="text-sm md:text-lg font-serif text-foreground mb-1">View Stats</p>
          <p className="text-xs md:text-sm text-muted-foreground font-sans">Track your progress</p>
        </button>
      </div>
    </div>
  );
}
