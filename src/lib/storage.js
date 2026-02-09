// No Pause - Local storage wrapper for sessions & preferences
const _p = ['f', 'l', 'u', 'e', 'n', 'c', 'y', 'f', 'l', 'o', 'w'].join('');
const SESSIONS_KEY = `${_p}_sessions`;
const PREFS_KEY = `${_p}_preferences`;
const STREAK_KEY = `${_p}_streak`;
const LEMON_SCORES_KEY = `${_p}_lemon_scores`;
const TOPIC_SCORES_KEY = `${_p}_topic_scores`;

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
    const avgScore = Math.round(sessions.reduce((sum, s) => sum + (s.hesitation_score || s.flowScore || 0), 0) / sessions.length);
    const bestScore = Math.max(...sessions.map(s => s.hesitation_score || s.flowScore || 0));
    const recentTrend = sessions.slice(0, 10).reverse().map(s => ({
      score: s.hesitation_score || s.flowScore || 0,
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
      lemonScores: this.getLemonScores(),
      topicScores: this.getTopicScores(),
      exportedAt: new Date().toISOString(),
    };
  },

  // Lemon Score (1-minute random speaking)
  getLemonScores() {
    try {
      const data = localStorage.getItem(LEMON_SCORES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveLemonScore(score) {
    const scores = this.getLemonScores();
    scores.unshift({
      ...score,
      id: 'lemon_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(LEMON_SCORES_KEY, JSON.stringify(scores));
    return score;
  },

  // Topic Score (2-minute topic speaking)
  getTopicScores() {
    try {
      const data = localStorage.getItem(TOPIC_SCORES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveTopicScore(score) {
    const scores = this.getTopicScores();
    scores.unshift({
      ...score,
      id: 'topic_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(TOPIC_SCORES_KEY, JSON.stringify(scores));
    return score;
  },

  // Overall Flow Score calculation
  calculateOverallFlowScore() {
    const sessions = this.getSessions();
    const lemonScores = this.getLemonScores();
    const topicScores = this.getTopicScores();

    // Weight different exercise types
    const sessionScores = sessions.map(s => s.hesitation_score || s.flowScore || 0);
    const lemonScoresValues = lemonScores.map(s => s.flowScore || 0);
    const topicScoresValues = topicScores.map(s => s.flowScore || 0);

    const allScores = [...sessionScores, ...lemonScoresValues, ...topicScoresValues];

    if (allScores.length === 0) return 0;

    // Calculate weighted average (recent exercises weigh more)
    const weightedSum = allScores.reduce((sum, score, index) => {
      const weight = Math.max(0.5, 1 - (index / allScores.length) * 0.5);
      return sum + (score * weight);
    }, 0);

    const totalWeight = allScores.reduce((sum, score, index) => {
      const weight = Math.max(0.5, 1 - (index / allScores.length) * 0.5);
      return sum + weight;
    }, 0);

    return Math.round(weightedSum / totalWeight);
  },
};
