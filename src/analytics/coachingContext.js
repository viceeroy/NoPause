// Phase 3: Coaching Context Builder
// Formats analytics data for LLM consumption — structured, concise, prompt-ready
// Pure functions — no circular imports. Receives data from analytics.js.

// Skill tier based on session count and performance
function classifyTier(totalSessions, avgFlowScore) {
    if (totalSessions < 5) return 'beginner';
    if (totalSessions < 20) {
        return avgFlowScore >= 70 ? 'progressing' : 'developing';
    }
    if (totalSessions < 50) {
        return avgFlowScore >= 80 ? 'intermediate' : 'progressing';
    }
    return avgFlowScore >= 85 ? 'advanced' : 'intermediate';
}

// Identify top improvement areas from metrics
function identifyWeakAreas(recentMetrics, behavioral) {
    const areas = [];

    // High hesitation rate
    const avgHPM = recentMetrics.reduce((s, m) => s + (m.hesitationsPerMinute || 0), 0) / recentMetrics.length;
    if (avgHPM > 2) {
        areas.push({
            area: 'fluency',
            severity: avgHPM > 4 ? 'high' : 'medium',
            detail: `${Math.round(avgHPM * 10) / 10} hesitations per minute (target: < 2)`,
        });
    }

    // Low speaking ratio
    const avgSR = recentMetrics.reduce((s, m) => s + (m.speakingRatio || 0), 0) / recentMetrics.length;
    if (avgSR < 0.6) {
        areas.push({
            area: 'fill_rate',
            severity: avgSR < 0.4 ? 'high' : 'medium',
            detail: `Speaking ${Math.round(avgSR * 100)}% of session time (target: > 60%)`,
        });
    }

    // Warmup issues
    if (behavioral?.hesitationPattern?.dominantPhase === 'warmup_issues') {
        areas.push({
            area: 'warmup',
            severity: 'medium',
            detail: 'Hesitations concentrate in the first 20% of sessions',
        });
    }

    // Fatigue
    if (behavioral?.hesitationPattern?.dominantPhase === 'fatigue') {
        areas.push({
            area: 'endurance',
            severity: 'medium',
            detail: 'Hesitations increase toward session end',
        });
    }

    // Short flow streaks
    const avgStreak = recentMetrics.reduce((s, m) => s + (m.longestFlowStreak || 0), 0) / recentMetrics.length;
    if (avgStreak < 15 && recentMetrics.length >= 3) {
        areas.push({
            area: 'sustained_flow',
            severity: avgStreak < 8 ? 'high' : 'medium',
            detail: `Avg longest uninterrupted flow: ${Math.round(avgStreak)}s (target: > 15s)`,
        });
    }

    return areas;
}

// Identify strengths
function identifyStrengths(recentMetrics, velocity) {
    const strengths = [];

    const avgFlow = recentMetrics.reduce((s, m) => s + m.flowScore, 0) / recentMetrics.length;
    if (avgFlow >= 75) {
        strengths.push({ area: 'flow', detail: `Avg flow score: ${Math.round(avgFlow)}` });
    }

    const avgSR = recentMetrics.reduce((s, m) => s + (m.speakingRatio || 0), 0) / recentMetrics.length;
    if (avgSR >= 0.75) {
        strengths.push({ area: 'engagement', detail: `Speaking ${Math.round(avgSR * 100)}% of the time` });
    }

    if (velocity?.trend === 'improving') {
        strengths.push({ area: 'progression', detail: `Improving ${Math.round(velocity.velocity * 100)}% across recent sessions` });
    }

    const avgStreak = recentMetrics.reduce((s, m) => s + (m.longestFlowStreak || 0), 0) / recentMetrics.length;
    if (avgStreak >= 20) {
        strengths.push({ area: 'sustained_flow', detail: `Avg longest flow: ${Math.round(avgStreak)}s` });
    }

    return strengths;
}

// Build coaching context from pre-fetched data (no imports needed)
// Called by analytics.js which passes sessionMetrics & insights data
export function buildCoachingContext(sessionMetrics, insightsData) {
    const { velocity, behavioral, insights } = insightsData;

    // Recent clean sessions (no tech issues)
    const clean = sessionMetrics
        .filter(m => !m.isLikelyTechIssue)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    if (clean.length === 0) {
        return {
            status: 'no_data',
            message: 'Not enough session data for coaching context.',
        };
    }

    const recent5 = clean.slice(-5);
    const avgFlowScore = Math.round(recent5.reduce((s, m) => s + m.flowScore, 0) / recent5.length);
    const tier = classifyTier(behavioral?.totalSessions || clean.length, avgFlowScore);
    const weakAreas = identifyWeakAreas(recent5, behavioral);
    const strengths = identifyStrengths(recent5, velocity);

    // Session history (compact, last 10)
    const sessionSummaries = clean.slice(-10).map(m => ({
        date: m.date,
        mode: m.mode,
        flowScore: m.flowScore,
        hesitations: m.hesitationCount,
        speakingRatio: m.speakingRatio,
        durationSec: m.totalDuration,
        wpm: m.wordsPerMinute || 0,
    }));

    // Suggested focus (highest-severity weakness, or general)
    let suggestedFocus = 'Keep practicing consistently to build confidence.';
    if (weakAreas.length > 0) {
        const top = weakAreas.sort((a, b) =>
            (b.severity === 'high' ? 2 : 1) - (a.severity === 'high' ? 2 : 1)
        )[0];
        const focusMap = {
            fluency: 'Focus on reducing hesitations. Try slower, deliberate speaking.',
            fill_rate: 'Work on filling more of the session with speech. Stream of consciousness helps.',
            warmup: 'Do a short verbal warmup before starting. Read a passage aloud first.',
            endurance: 'Try slightly shorter sessions and build duration gradually.',
            sustained_flow: 'Practice maintaining uninterrupted speech for 15+ seconds.',
        };
        suggestedFocus = focusMap[top.area] || suggestedFocus;
    }

    // Top insights (priority 3+)
    const actionableInsights = (insights || [])
        .filter(i => i.priority >= 3)
        .slice(0, 3)
        .map(i => ({ type: i.type, title: i.title, message: i.message }));

    return {
        status: 'ready',
        generatedAt: new Date().toISOString(),

        // User profile
        profile: {
            tier,
            totalSessions: behavioral?.totalSessions || clean.length,
            currentStreak: behavioral?.currentStreak || 0,
            daysSinceLastSession: behavioral?.lastSessionGap ?? 0,
            preferredMode: behavioral?.topMode || 'free',
        },

        // Current performance snapshot
        currentPerformance: {
            avgFlowScore,
            avgHesitationsPerMinute: Math.round(
                recent5.reduce((s, m) => s + (m.hesitationsPerMinute || 0), 0) / recent5.length * 10
            ) / 10,
            avgSpeakingRatio: Math.round(
                recent5.reduce((s, m) => s + (m.speakingRatio || 0), 0) / recent5.length * 100
            ),
            avgWordsPerMinute: Math.round(
                recent5.reduce((s, m) => s + (m.wordsPerMinute || 0), 0) / recent5.length
            ),
        },

        // Trajectory
        improvement: velocity ? {
            trend: velocity.trend,
            velocityPercent: Math.round(velocity.velocity * 100),
            delta: velocity.delta,
        } : null,

        // Analysis
        strengths,
        weakAreas,
        suggestedFocus,
        actionableInsights,

        // Session history (for pattern context)
        recentSessions: sessionSummaries,
    };
}

// Format coaching context into a concise text prompt section
export function formatCoachingPrompt(ctx) {
    if (ctx.status !== 'ready') return '';

    const lines = [
        '## User Speaking Profile',
        `- Skill tier: ${ctx.profile.tier}`,
        `- Total sessions: ${ctx.profile.totalSessions}`,
        `- Current streak: ${ctx.profile.currentStreak} days`,
        `- Preferred mode: ${ctx.profile.preferredMode}`,
        '',
        '## Current Performance (last 5 sessions)',
        `- Avg flow score: ${ctx.currentPerformance.avgFlowScore}/100`,
        `- Hesitations/min: ${ctx.currentPerformance.avgHesitationsPerMinute}`,
        `- Speaking ratio: ${ctx.currentPerformance.avgSpeakingRatio}%`,
        `- Words/min: ${ctx.currentPerformance.avgWordsPerMinute}`,
    ];

    if (ctx.improvement) {
        lines.push('', '## Improvement Trend');
        lines.push(`- Direction: ${ctx.improvement.trend}`);
        lines.push(`- Change: ${ctx.improvement.delta > 0 ? '+' : ''}${ctx.improvement.delta} points`);
    }

    if (ctx.strengths.length > 0) {
        lines.push('', '## Strengths');
        ctx.strengths.forEach(s => lines.push(`- ${s.area}: ${s.detail}`));
    }

    if (ctx.weakAreas.length > 0) {
        lines.push('', '## Areas for Improvement');
        ctx.weakAreas.forEach(w => lines.push(`- [${w.severity}] ${w.area}: ${w.detail}`));
    }

    lines.push('', `## Suggested Focus: ${ctx.suggestedFocus}`);

    if (ctx.recentSessions.length > 0) {
        lines.push('', '## Recent Session History');
        ctx.recentSessions.forEach(s => {
            lines.push(`- ${s.date} | ${s.mode} | flow:${s.flowScore} | hes:${s.hesitations} | ${s.durationSec}s`);
        });
    }

    return lines.join('\n');
}
