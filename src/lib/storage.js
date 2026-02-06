// Local storage wrapper for sessions & preferences

const SESSIONS_KEY = 'fluencyflow_sessions';
const PREFS_KEY = 'fluencyflow_preferences';
const STREAK_KEY = 'fluencyflow_streak';

export const storage = {
  // Sessions
  getSessions() {
    try {
      const data = localStorage.getItem(SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveSession(session) {
    const sessions = this.getSessions();
    sessions.unshift(session);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    this.updateStreak();
    return session;
  },

  deleteSession(sessionId) {
    const sessions = this.getSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
  },

  clearSessions() {
    localStorage.removeItem(SESSIONS_KEY);
  },

  // Streak tracking
  getStreak() {
    try {
      const data = localStorage.getItem(STREAK_KEY);
      if (!data) return { current: 0, best: 0, lastDate: null };
      return JSON.parse(data);
    } catch {
      return { current: 0, best: 0, lastDate: null };
    }
  },

  updateStreak() {
    const streak = this.getStreak();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (streak.lastDate === today) {
      return streak; // Already practiced today
    }

    if (streak.lastDate === yesterday) {
      streak.current += 1;
    } else if (streak.lastDate !== today) {
      streak.current = 1;
    }

    streak.best = Math.max(streak.best, streak.current);
    streak.lastDate = today;
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
    return streak;
  },

  // Preferences
  getPreferences() {
    try {
      const data = localStorage.getItem(PREFS_KEY);
      return data ? JSON.parse(data) : {
        defaultTimer: 60,
        silenceThreshold: 0.015,
        hesitationMinDuration: 400,
      };
    } catch {
      return { defaultTimer: 60, silenceThreshold: 0.015, hesitationMinDuration: 400 };
    }
  },

  savePreferences(prefs) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  },

  // Stats
  getStats() {
    const sessions = this.getSessions();
    const streak = this.getStreak();

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalPracticeTime: 0,
        avgScore: 0,
        bestScore: 0,
        currentStreak: streak.current,
        bestStreak: streak.best,
        recentTrend: [],
      };
    }

    const totalPracticeTime = sessions.reduce((sum, s) => sum + s.duration, 0);
    const avgScore = Math.round(sessions.reduce((sum, s) => sum + s.hesitation_score, 0) / sessions.length);
    const bestScore = Math.max(...sessions.map(s => s.hesitation_score));
    const recentTrend = sessions.slice(0, 10).reverse().map(s => ({
      score: s.hesitation_score,
      date: s.created_at,
    }));

    return {
      totalSessions: sessions.length,
      totalPracticeTime,
      avgScore,
      bestScore,
      currentStreak: streak.current,
      bestStreak: streak.best,
      recentTrend,
    };
  },

  // Export
  exportData() {
    return {
      sessions: this.getSessions(),
      preferences: this.getPreferences(),
      streak: this.getStreak(),
      exportedAt: new Date().toISOString(),
    };
  },
};
