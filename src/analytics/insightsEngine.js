// Phase 2: Behavioral patterns, improvement velocity, insight generation

// ── Improvement Velocity ──
// Compares recent performance to previous performance

export function computeImprovementVelocity(sessionMetrics) {
    // Filter out tech-issue sessions for clean signal
    const clean = sessionMetrics
        .filter(m => !m.isLikelyTechIssue)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    if (clean.length < 6) {
        return {
            velocity: 0,
            trend: 'insufficient_data',
            recent5Avg: 0,
            previous5Avg: 0,
            delta: 0,
        };
    }

    const recent5 = clean.slice(-5);
    const previous5 = clean.slice(-10, -5);

    const recent5Avg = recent5.reduce((s, m) => s + m.flowScore, 0) / recent5.length;
    const previous5Avg = previous5.reduce((s, m) => s + m.flowScore, 0) / previous5.length;

    const velocity = previous5Avg > 0
        ? Math.round(((recent5Avg - previous5Avg) / previous5Avg) * 100) / 100
        : 0;

    let trend = 'stable';
    if (velocity > 0.05) trend = 'improving';
    else if (velocity < -0.05) trend = 'declining';

    return {
        velocity,
        trend,
        recent5Avg: Math.round(recent5Avg),
        previous5Avg: Math.round(previous5Avg),
        delta: Math.round(recent5Avg - previous5Avg),
    };
}

// ── Behavioral Patterns ──
// Detects usage patterns that inform product decisions

export function computeBehavioralPatterns(sessionMetrics, events = []) {
    const sorted = [...sessionMetrics].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const patterns = {};

    // 1. Mode preference distribution
    const modeCounts = {};
    sorted.forEach(m => {
        const mode = m.mode || 'free';
        modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    });
    patterns.modePreference = modeCounts;
    patterns.topMode = Object.entries(modeCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'free';
    patterns.modesUsedCount = Object.keys(modeCounts).length;

    // 2. Return gaps (days between practice days)
    const dates = [...new Set(sorted.map(m => m.date))].sort();
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
        const gap = Math.round((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000);
        gaps.push(gap);
    }
    patterns.avgReturnGap = gaps.length > 0
        ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length * 10) / 10
        : 0;
    patterns.lastSessionGap = dates.length > 0
        ? Math.round((Date.now() - new Date(dates[dates.length - 1]).getTime()) / 86400000)
        : null;

    // 3. Session frequency (last 4 weeks)
    const fourWeeksAgo = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0];
    const recentSessions = sorted.filter(m => m.date >= fourWeeksAgo);
    patterns.sessionsPerWeek = recentSessions.length > 0
        ? Math.round(recentSessions.length / 4 * 10) / 10
        : 0;
    patterns.totalSessions = sorted.length;

    // 4. Abandonment rate (from events, 7-day window)
    const startedEvents = events.filter(e => e.event === 'session.recording_active');
    const completedEvents = events.filter(e => e.event === 'session.completed');
    patterns.abandonmentRate = startedEvents.length > 0
        ? Math.round((1 - completedEvents.length / startedEvents.length) * 100) / 100
        : 0;

    // 5. Active streak (consecutive days with practice)
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const dateSet = new Set(dates);
    let streak = 0;
    let checkDate = dateSet.has(today)
        ? new Date(today)
        : (dateSet.has(yesterday) ? new Date(yesterday) : null);
    if (checkDate) {
        while (dateSet.has(checkDate.toISOString().split('T')[0])) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
    }
    patterns.currentStreak = streak;

    // 6. Hesitation distribution trend (last 10 clean sessions)
    const recentClean = sorted
        .filter(m => !m.isLikelyTechIssue && m.hesitationDistribution)
        .slice(-10);

    if (recentClean.length >= 3) {
        const earlyTotal = recentClean.reduce((s, m) => s + (m.hesitationDistribution.early || 0), 0);
        const middleTotal = recentClean.reduce((s, m) => s + (m.hesitationDistribution.middle || 0), 0);
        const lateTotal = recentClean.reduce((s, m) => s + (m.hesitationDistribution.late || 0), 0);
        const n = recentClean.length;
        const earlyAvg = Math.round(earlyTotal / n * 10) / 10;
        const lateAvg = Math.round(lateTotal / n * 10) / 10;

        let dominantPhase = 'balanced';
        if (earlyAvg > lateAvg * 1.5 && earlyAvg > 0.5) dominantPhase = 'warmup_issues';
        else if (lateAvg > earlyAvg * 1.5 && lateAvg > 0.5) dominantPhase = 'fatigue';

        patterns.hesitationPattern = {
            earlyAvg,
            middleAvg: Math.round(middleTotal / n * 10) / 10,
            lateAvg,
            dominantPhase,
        };
    } else {
        patterns.hesitationPattern = null;
    }

    // 7. Tech issue frequency (last 10 sessions)
    const last10 = sorted.slice(-10);
    const techIssueCount = last10.filter(m => m.isLikelyTechIssue).length;
    patterns.techIssueRate = last10.length > 0
        ? Math.round(techIssueCount / last10.length * 100) / 100
        : 0;

    // 8. Average session duration trend
    if (recentClean.length >= 6) {
        const firstHalf = recentClean.slice(0, Math.floor(recentClean.length / 2));
        const secondHalf = recentClean.slice(Math.floor(recentClean.length / 2));
        const firstAvgDuration = firstHalf.reduce((s, m) => s + m.totalDuration, 0) / firstHalf.length;
        const secondAvgDuration = secondHalf.reduce((s, m) => s + m.totalDuration, 0) / secondHalf.length;
        patterns.durationTrend = secondAvgDuration > firstAvgDuration * 1.2 ? 'increasing'
            : secondAvgDuration < firstAvgDuration * 0.8 ? 'decreasing'
                : 'stable';
    } else {
        patterns.durationTrend = 'insufficient_data';
    }

    return patterns;
}

// ── Insight Generation ──
// Rule-based insights derived from patterns and metrics

export function generateInsights(sessionMetrics, behavioral, velocity, weeklyRollups = []) {
    const insights = [];

    // Helper: only add if not already present
    const add = (insight) => insights.push(insight);

    // 1. Improvement celebration
    if (velocity.trend === 'improving' && velocity.delta > 0) {
        add({
            id: 'improving',
            type: 'positive',
            priority: 5,
            title: 'You\'re improving!',
            message: `Your flow score went up ${velocity.delta} points over your last 10 sessions. Keep it up.`,
            data: velocity,
        });
    }

    // 2. Score declining
    if (velocity.trend === 'declining' && velocity.delta < -3) {
        add({
            id: 'score_declining',
            type: 'warning',
            priority: 4,
            title: 'Scores dipping',
            message: 'Your recent scores are lower than before. Try shorter sessions or switch to a different mode for variety.',
            data: velocity,
        });
    }

    // 3. Warmup issues
    if (behavioral.hesitationPattern?.dominantPhase === 'warmup_issues') {
        add({
            id: 'warmup_hesitations',
            type: 'tip',
            priority: 3,
            title: 'Slow starts detected',
            message: 'Most of your hesitations happen early in sessions. Try a 10-second breathing warmup before starting.',
            data: behavioral.hesitationPattern,
        });
    }

    // 4. Fatigue detection
    if (behavioral.hesitationPattern?.dominantPhase === 'fatigue') {
        add({
            id: 'fatigue_detected',
            type: 'tip',
            priority: 3,
            title: 'End-of-session fatigue',
            message: 'Your hesitations increase toward the end. Consider shorter practice sessions for better focus.',
            data: behavioral.hesitationPattern,
        });
    }

    // 5. Frequent tech issues
    if (behavioral.techIssueRate > 0.3) {
        add({
            id: 'tech_issues',
            type: 'warning',
            priority: 4,
            title: 'Audio quality issues',
            message: `${Math.round(behavioral.techIssueRate * 100)}% of recent sessions had mic problems. Try a quieter space or check your microphone.`,
            data: { rate: behavioral.techIssueRate },
        });
    }

    // 6. Mode diversification
    if (behavioral.modesUsedCount === 1 && behavioral.totalSessions > 10) {
        const modeLabel = behavioral.topMode === 'free-speak' ? 'Free Speaking'
            : behavioral.topMode === 'lemon' ? 'Lemon Technique'
                : behavioral.topMode === 'topic' ? 'Topic'
                    : behavioral.topMode;
        add({
            id: 'try_other_modes',
            type: 'suggestion',
            priority: 2,
            title: 'Try other modes',
            message: `You've been using ${modeLabel} exclusively. Different modes challenge different skills.`,
        });
    }

    // 7. Streak celebration
    if (behavioral.currentStreak >= 3) {
        add({
            id: 'streak_active',
            type: 'positive',
            priority: 3,
            title: `${behavioral.currentStreak}-day streak!`,
            message: 'Consistency is the biggest driver of improvement. Keep going.',
        });
    }

    // 8. Welcome back (churn risk)
    if (behavioral.lastSessionGap !== null && behavioral.lastSessionGap >= 3) {
        add({
            id: 'welcome_back',
            type: 'encouragement',
            priority: 4,
            title: 'Welcome back!',
            message: `It's been ${behavioral.lastSessionGap} days. Even a quick 30-second session helps maintain progress.`,
        });
    }

    // 9. High abandonment
    if (behavioral.abandonmentRate > 0.3 && behavioral.totalSessions > 5) {
        add({
            id: 'high_abandonment',
            type: 'warning',
            priority: 3,
            title: 'Sessions not finishing',
            message: `${Math.round(behavioral.abandonmentRate * 100)}% of recent sessions weren't completed. Consider using timer mode for structured practice.`,
        });
    }

    // 10. Consistency feedback from weekly rollups
    const recentWeekly = weeklyRollups[0];
    if (recentWeekly && recentWeekly.consistencyScore < 0.6) {
        add({
            id: 'inconsistent_scores',
            type: 'tip',
            priority: 2,
            title: 'Scores vary a lot',
            message: 'Your flow scores swing between sessions. Warming up and practicing in the same environment can help stabilize results.',
        });
    }

    // 11. Increasing session duration (positive engagement)
    if (behavioral.durationTrend === 'increasing') {
        add({
            id: 'longer_sessions',
            type: 'positive',
            priority: 2,
            title: 'Longer sessions',
            message: 'You\'re naturally practicing longer. This is a strong sign of building confidence.',
        });
    }

    // Sort by priority descending
    insights.sort((a, b) => b.priority - a.priority);

    return insights;
}
