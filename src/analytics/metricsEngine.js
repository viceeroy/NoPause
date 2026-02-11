// Session metrics computation, tech health classification, rollup engine

export function computeSessionMetrics(rawResults, context = {}) {
    const {
        totalSpeakingTime = 0,     // seconds
        totalSilenceTime = 0,      // seconds
        hesitationSilenceTime = 0, // ms
        hesitationCount = 0,
        hesitationTimings = [],    // [{ startOffset, duration }]
        longestFlowStreak = 0,     // ms
        totalTime = 0,             // ms
        avgVolume = 0,
        noiseFloor = 0,
        frameCount = 0,
        transcript = '',
    } = rawResults;

    const durationSeconds = Math.round(totalTime / 1000);
    const speakingMinutes = totalSpeakingTime / 60;

    // Word count from transcript
    const wordCount = transcript.trim()
        ? transcript.trim().split(/\s+/).length
        : 0;

    // Hesitation analysis
    const hesitationsPerMinute = speakingMinutes > 0
        ? Math.round((hesitationCount / speakingMinutes) * 10) / 10
        : 0;

    const avgHesitationDuration = hesitationCount > 0 && hesitationTimings.length > 0
        ? Math.round(
            hesitationTimings.reduce((sum, h) => sum + h.duration, 0) /
            hesitationTimings.length / 100
        ) / 10 // seconds, 1 decimal
        : 0;

    // Hesitation distribution (early/mid/late)
    const hesitationDistribution = { early: 0, middle: 0, late: 0 };
    if (totalTime > 0 && hesitationTimings.length > 0) {
        hesitationTimings.forEach(h => {
            const pos = h.startOffset / totalTime;
            if (pos < 0.2) hesitationDistribution.early++;
            else if (pos < 0.8) hesitationDistribution.middle++;
            else hesitationDistribution.late++;
        });
    }

    // Flow score
    const flowScore = calculateFlowScore(hesitationSilenceTime, hesitationCount);

    // Speaking ratio
    const speakingRatio = durationSeconds > 0
        ? Math.round((totalSpeakingTime / durationSeconds) * 100) / 100
        : 0;

    // Pacing
    const wordsPerMinute = speakingMinutes > 0
        ? Math.round(wordCount / speakingMinutes)
        : 0;

    // Tech health classification
    const micQuality = classifyMicQuality(avgVolume, noiseFloor);
    const expectedFrames = Math.round(totalTime / 33); // ~30fps
    const frameDropRatio = expectedFrames > 0
        ? Math.round((frameCount / expectedFrames) * 100) / 100
        : 1;
    const isLikelyTechIssue =
        frameDropRatio < 0.7 || micQuality === 'noisy' || micQuality === 'quiet';

    return {
        sessionId: context.sessionId || generateId(),
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        mode: context.mode || 'free',

        // Time (delta-time guaranteed)
        totalDuration: durationSeconds,
        speakingTime: totalSpeakingTime,
        silenceTime: totalSilenceTime,
        speakingRatio,

        // Fluency
        flowScore,
        hesitationCount,
        hesitationsPerMinute,
        avgHesitationDuration,
        longestFlowStreak: Math.round(longestFlowStreak / 1000), // seconds
        hesitationDistribution,

        // Pacing
        wordCount,
        wordsPerMinute,

        // Technical
        micQuality,
        frameDropRatio,
        isLikelyTechIssue,
        transcriptAvailable: wordCount > 0,

        // Context
        platform: detectPlatform(),
        sessionNumber: context.sessionNumber || 0,

        // Sync readiness
        _syncStatus: 'local',
        _version: 1,
    };
}

function calculateFlowScore(hesitationSilenceTimeMs, hesitationCount) {
    const silenceSeconds = hesitationSilenceTimeMs / 1000;
    const score = 100 - (hesitationCount * 5) - (silenceSeconds * 10);
    return Math.max(0, Math.min(100, Math.round(score)));
}

export function classifyMicQuality(avgVolume, noiseFloor) {
    if (avgVolume > 0.5) return 'clipping';
    if (noiseFloor > 0.02) return 'noisy';
    if (avgVolume < 0.008) return 'quiet';
    return 'good';
}

// ── Daily Rollup ──

export function computeDailyRollup(date, sessionMetrics) {
    if (!sessionMetrics.length) return null;

    const totalPracticeTime = sessionMetrics.reduce((s, m) => s + m.totalDuration, 0);
    const flowScores = sessionMetrics.map(m => m.flowScore);
    const avgFlowScore = Math.round(flowScores.reduce((a, b) => a + b, 0) / flowScores.length);
    const bestFlowScore = Math.max(...flowScores);
    const totalHesitations = sessionMetrics.reduce((s, m) => s + m.hesitationCount, 0);
    const speakingMinutes = sessionMetrics.reduce((s, m) => s + m.speakingTime, 0) / 60;
    const modesUsed = [...new Set(sessionMetrics.map(m => m.mode))];

    // Debug annotation: clean scores exclude tech-issue sessions
    const cleanMetrics = sessionMetrics.filter(m => !m.isLikelyTechIssue);
    const cleanFlowScores = cleanMetrics.map(m => m.flowScore);
    const cleanAvgFlowScore = cleanFlowScores.length > 0
        ? Math.round(cleanFlowScores.reduce((a, b) => a + b, 0) / cleanFlowScores.length)
        : avgFlowScore;

    return {
        date,
        sessionsCompleted: sessionMetrics.length,
        cleanSessionCount: cleanMetrics.length,
        totalPracticeTime,
        avgFlowScore,
        cleanAvgFlowScore,  // Use this for trends — excludes noisy sessions
        bestFlowScore,
        totalHesitations,
        hesitationsPerMinute: speakingMinutes > 0
            ? Math.round((totalHesitations / speakingMinutes) * 10) / 10
            : 0,
        modesUsed,
        avgSpeakingRatio: Math.round(
            sessionMetrics.reduce((s, m) => s + m.speakingRatio, 0) / sessionMetrics.length * 100
        ) / 100,
        longestFlowStreak: Math.max(...sessionMetrics.map(m => m.longestFlowStreak || 0)),
        techIssueCount: sessionMetrics.filter(m => m.isLikelyTechIssue).length,
        _syncStatus: 'local',
        _version: 1,
    };
}

// ── Weekly Rollup ──

export function computeWeeklyRollup(weekStart, dailyRollups) {
    if (!dailyRollups.length) return null;

    const daysActive = dailyRollups.length;
    const totalSessions = dailyRollups.reduce((s, d) => s + d.sessionsCompleted, 0);
    const totalPracticeTime = dailyRollups.reduce((s, d) => s + d.totalPracticeTime, 0);
    const flowScores = dailyRollups.map(d => d.avgFlowScore);
    const avgFlowScore = Math.round(flowScores.reduce((a, b) => a + b, 0) / flowScores.length);
    // Use clean scores (tech-issue-free) for trend analysis
    const cleanScores = dailyRollups.map(d => d.cleanAvgFlowScore ?? d.avgFlowScore);

    // Trend via simple linear regression slope (using clean scores)
    let flowScoreTrend = 'stable';
    if (cleanScores.length >= 3) {
        const n = cleanScores.length;
        const xMean = (n - 1) / 2;
        const yMean = cleanScores.reduce((a, b) => a + b, 0) / n;
        let num = 0, den = 0;
        cleanScores.forEach((y, x) => {
            num += (x - xMean) * (y - yMean);
            den += (x - xMean) * (x - xMean);
        });
        const slope = den !== 0 ? num / den : 0;
        if (slope > 1) flowScoreTrend = 'improving';
        else if (slope < -1) flowScoreTrend = 'declining';
    }

    // Consistency score (1 - coefficient of variation, using clean scores)
    let consistencyScore = 1;
    if (cleanScores.length > 1) {
        const cleanAvg = cleanScores.reduce((a, b) => a + b, 0) / cleanScores.length;
        const variance = cleanScores.reduce((s, v) => s + Math.pow(v - cleanAvg, 2), 0) / cleanScores.length;
        const stdDev = Math.sqrt(variance);
        consistencyScore = cleanAvg > 0
            ? Math.max(0, Math.min(1, Math.round((1 - stdDev / cleanAvg) * 100) / 100))
            : 0;
    }

    // Mode preference
    const modeCounts = {};
    dailyRollups.forEach(d => (d.modesUsed || []).forEach(m => {
        modeCounts[m] = (modeCounts[m] || 0) + 1;
    }));
    const topMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'free';

    return {
        weekStart,
        daysActive,
        sessionsCompleted: totalSessions,
        totalPracticeTime,
        avgFlowScore,
        flowScoreTrend,
        consistencyScore,
        topMode,
        longestFlowStreak: Math.max(...dailyRollups.map(d => d.longestFlowStreak || 0)),
        _syncStatus: 'local',
        _version: 1,
    };
}

// ── Helpers ──

function detectPlatform() {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios_safari';
    if (/Android/.test(ua) && /Chrome/.test(ua)) return 'android_chrome';
    if (/Android/.test(ua)) return 'android_other';
    if (/Chrome/.test(ua)) return 'desktop_chrome';
    if (/Firefox/.test(ua)) return 'desktop_firefox';
    if (/Safari/.test(ua)) return 'desktop_safari';
    return 'other';
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
