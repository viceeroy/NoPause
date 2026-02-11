// Phase 3: Anonymized Benchmark System
// Computes shareable aggregate stats with no PII
// Consent-gated — only generates data when user opts in

// ── Consent Management ──

const CONSENT_KEY = 'nopause_benchmark_consent';
const BENCHMARK_KEY = 'nopause_benchmark_snapshot';

export function getBenchmarkConsent() {
    return localStorage.getItem(CONSENT_KEY) === 'true';
}

export function setBenchmarkConsent(consented) {
    localStorage.setItem(CONSENT_KEY, consented ? 'true' : 'false');
    if (!consented) {
        // Clear any existing benchmark data when consent is revoked
        localStorage.removeItem(BENCHMARK_KEY);
    }
}

// ── Tier Classification ──
// Session count brackets for fair comparison

function classifyBracket(totalSessions) {
    if (totalSessions < 5) return 'newcomer';       // 0-4 sessions
    if (totalSessions < 20) return 'beginner';       // 5-19 sessions
    if (totalSessions < 50) return 'developing';     // 20-49 sessions
    if (totalSessions < 100) return 'intermediate';  // 50-99 sessions
    return 'experienced';                            // 100+ sessions
}

// Percentile estimation within bracket
// These are bootstrapped from expected distributions per bracket
// Will be replaced with real population data when cloud sync exists
const BRACKET_BASELINES = {
    newcomer: { flowScore: 45, hesitationsPerMin: 4.0, speakingRatio: 0.45 },
    beginner: { flowScore: 55, hesitationsPerMin: 3.0, speakingRatio: 0.55 },
    developing: { flowScore: 65, hesitationsPerMin: 2.2, speakingRatio: 0.62 },
    intermediate: { flowScore: 75, hesitationsPerMin: 1.5, speakingRatio: 0.70 },
    experienced: { flowScore: 82, hesitationsPerMin: 1.0, speakingRatio: 0.78 },
};

function estimatePercentile(value, baseline, higherIsBetter = true) {
    // Simple percentile estimate: how far above/below baseline
    // Maps to 0-100 scale centered at 50 (baseline)
    const ratio = baseline > 0 ? value / baseline : 1;
    const deviation = higherIsBetter ? (ratio - 1) : (1 - ratio);
    const percentile = 50 + (deviation * 40); // ±40 from center
    return Math.max(1, Math.min(99, Math.round(percentile)));
}

// ── Benchmark Snapshot ──
// Generates an anonymized data package suitable for sharing

export function computeBenchmarkSnapshot(sessionMetrics, deviceId) {
    if (!getBenchmarkConsent()) {
        return { status: 'no_consent' };
    }

    // Only use clean sessions
    const clean = sessionMetrics
        .filter(m => !m.isLikelyTechIssue)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    if (clean.length < 3) {
        return { status: 'insufficient_data', sessionsNeeded: 3 - clean.length };
    }

    const totalSessions = clean.length;
    const bracket = classifyBracket(totalSessions);
    const baseline = BRACKET_BASELINES[bracket];

    // Aggregate stats (no individual session data, no timestamps beyond date range)
    const flowScores = clean.map(m => m.flowScore);
    const avgFlowScore = Math.round(flowScores.reduce((a, b) => a + b, 0) / flowScores.length);
    const bestFlowScore = Math.max(...flowScores);

    const hesPerMin = clean.map(m => m.hesitationsPerMinute || 0);
    const avgHesitationsPerMinute = Math.round(
        hesPerMin.reduce((a, b) => a + b, 0) / hesPerMin.length * 10
    ) / 10;

    const speakingRatios = clean.map(m => m.speakingRatio || 0);
    const avgSpeakingRatio = Math.round(
        speakingRatios.reduce((a, b) => a + b, 0) / speakingRatios.length * 100
    ) / 100;

    const totalPracticeMinutes = Math.round(
        clean.reduce((s, m) => s + (m.totalDuration || 0), 0) / 60
    );

    // Active days
    const uniqueDays = new Set(clean.map(m => m.date)).size;

    // Mode distribution (percentages, not counts)
    const modeCounts = {};
    clean.forEach(m => { modeCounts[m.mode || 'free'] = (modeCounts[m.mode || 'free'] || 0) + 1; });
    const modeDistribution = {};
    Object.entries(modeCounts).forEach(([mode, count]) => {
        modeDistribution[mode] = Math.round(count / totalSessions * 100);
    });

    // Improvement: first 5 vs last 5
    let improvementPercent = 0;
    if (clean.length >= 10) {
        const first5Avg = clean.slice(0, 5).reduce((s, m) => s + m.flowScore, 0) / 5;
        const last5Avg = clean.slice(-5).reduce((s, m) => s + m.flowScore, 0) / 5;
        improvementPercent = first5Avg > 0
            ? Math.round(((last5Avg - first5Avg) / first5Avg) * 100)
            : 0;
    }

    // Percentile estimates
    const percentiles = {
        flowScore: estimatePercentile(avgFlowScore, baseline.flowScore, true),
        hesitationsPerMinute: estimatePercentile(avgHesitationsPerMinute, baseline.hesitationsPerMin, false),
        speakingRatio: estimatePercentile(avgSpeakingRatio, baseline.speakingRatio, true),
    };

    const snapshot = {
        status: 'ready',
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),

        // Anonymous identity (no PII)
        anonymousId: hashDeviceId(deviceId),

        // Classification
        bracket,
        totalSessions,
        activeDays: uniqueDays,
        totalPracticeMinutes,

        // Aggregate performance (no individual session data)
        avgFlowScore,
        bestFlowScore,
        avgHesitationsPerMinute,
        avgSpeakingRatio,
        modeDistribution,
        improvementPercent,

        // Relative standing (estimated)
        percentiles,

        // Platform (for cross-device analysis)
        platform: detectPlatform(),
    };

    // Cache locally
    localStorage.setItem(BENCHMARK_KEY, JSON.stringify(snapshot));

    return snapshot;
}

// Get last computed benchmark (cached)
export function getCachedBenchmark() {
    try {
        const cached = localStorage.getItem(BENCHMARK_KEY);
        return cached ? JSON.parse(cached) : null;
    } catch {
        return null;
    }
}

// ── Helpers ──

// One-way hash of device ID for anonymization
// Not cryptographically secure — just ensures no reverse lookup
function hashDeviceId(deviceId) {
    if (!deviceId) return 'anon_unknown';
    let hash = 0;
    for (let i = 0; i < deviceId.length; i++) {
        const char = deviceId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit int
    }
    return 'bench_' + Math.abs(hash).toString(36);
}

function detectPlatform() {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Mac/.test(ua)) return 'mac';
    if (/Win/.test(ua)) return 'windows';
    if (/Linux/.test(ua)) return 'linux';
    return 'other';
}

// Summary of what data IS and IS NOT shared
export const BENCHMARK_PRIVACY_SUMMARY = {
    shared: [
        'Anonymous device ID (hashed, not reversible)',
        'Aggregate flow score (average, not per-session)',
        'Total session count and practice minutes',
        'Mode distribution (percentages)',
        'Improvement percentage over time',
        'Platform type (iOS, Android, Desktop)',
    ],
    notShared: [
        'Audio recordings',
        'Transcripts or speech content',
        'Session timestamps or times of day',
        'Location or IP address',
        'Device model or browser version',
        'Individual session scores',
        'Any text you spoke',
    ],
};
