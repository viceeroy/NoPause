// No Pause — Analytics API
// Three-layer system: Events → Aggregates → Insights

import { analyticsStore } from './store';
import { computeSessionMetrics, computeDailyRollup, computeWeeklyRollup } from './metricsEngine';
import { computeImprovementVelocity, computeBehavioralPatterns, generateInsights } from './insightsEngine';
import { buildCoachingContext, formatCoachingPrompt } from './coachingContext';
import { computeBenchmarkSnapshot, getBenchmarkConsent, setBenchmarkConsent, getCachedBenchmark, BENCHMARK_PRIVACY_SUMMARY } from './benchmarkEngine';
import { getPostHogAdapter } from './posthogAdapter';

const { STORES } = analyticsStore;

// ── Persistent identity (anonymous, no PII) ──

function getDeviceId() {
    let id = localStorage.getItem('nopause_device_id');
    if (!id) {
        id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('nopause_device_id', id);
    }
    return id;
}

function getSessionNumber() {
    return parseInt(localStorage.getItem('nopause_session_count') || '0', 10);
}

function incrementSessionNumber() {
    const n = getSessionNumber() + 1;
    localStorage.setItem('nopause_session_count', String(n));
    return n;
}

function getDaysSinceInstall() {
    let d = localStorage.getItem('nopause_install_date');
    if (!d) {
        d = new Date().toISOString().split('T')[0];
        localStorage.setItem('nopause_install_date', d);
    }
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

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

function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// ── Public API ──

export const analytics = {

    // ═══════════════════════════════════════════
    // Layer 1: Events (ephemeral, 7-day retention)
    // ═══════════════════════════════════════════

    async _logEvent(eventName, data = {}, sessionId = null) {
        try {
            await analyticsStore.write(STORES.events, {
                id: makeId(),
                event: eventName,
                timestamp: new Date().toISOString(),
                sessionId,
                context: {
                    platform: detectPlatform(),
                    sessionNumber: getSessionNumber(),
                    daysSinceInstall: getDaysSinceInstall(),
                },
                data,
            });
        } catch (e) {
            // Silently fail — analytics should never break the app
        }
    },

    // Session lifecycle
    async sessionSetupViewed(mode) {
        await this._logEvent('session.setup_viewed', { mode });
    },

    async sessionInitiated(mode, sessionId) {
        await this._logEvent('session.initiated', { mode }, sessionId);
    },

    async recordingStarted(mode, sessionId) {
        incrementSessionNumber();
        await this._logEvent('session.recording_active', { mode }, sessionId);
    },

    async recordingStopped(mode, sessionId) {
        await this._logEvent('session.completed', { mode }, sessionId);
        
        // Send to PostHog (cloud analytics)
        const postHogAdapter = getPostHogAdapter();
        if (postHogAdapter.isAvailable()) {
            // Get session metrics for PostHog
            const sessionMetrics = await analyticsStore.getAll(STORES.sessionMetrics);
            const latestMetrics = sessionMetrics
                .filter(m => m.sessionId === sessionId)
                .pop();
            
            if (latestMetrics) {
                postHogAdapter.trackSessionCompleted({
                    mode,
                    flowScore: latestMetrics.flowScore,
                    hesitationCount: latestMetrics.hesitationCount,
                    speakingRatio: latestMetrics.speakingRatio,
                    micQuality: latestMetrics.micQuality,
                    duration: latestMetrics.duration
                });
            }
        }
    },

    async sessionAbandoned(mode, sessionId, durationSeconds) {
        await this._logEvent('session.abandoned', { mode, durationSeconds }, sessionId);
    },

    // Speech events
    async hesitationDetected(duration, count, timeSinceStart, sessionId) {
        await this._logEvent('speech.hesitation', {
            duration, count, timeSinceStart,
        }, sessionId);
    },

    // Tech events
    async micDenied() {
        await this._logEvent('tech.mic_denied');
        
        // Send to PostHog (cloud analytics)
        const postHogAdapter = getPostHogAdapter();
        if (postHogAdapter.isAvailable()) {
            postHogAdapter.trackMicDenied();
        }
    },

    async calibrationCompleted(ambientNoise, thresholdSet) {
        await this._logEvent('tech.calibration_result', { ambientNoise, thresholdSet });
    },

    // Navigation
    async pageViewed(page) {
        await this._logEvent('nav.page_viewed', { page });
    },

    async statsViewed() {
        await this._logEvent('nav.stats_viewed');
    },

    async modeSelected(mode) {
        await this._logEvent('nav.mode_selected', { mode });
        
        // Send to PostHog (cloud analytics)
        const postHogAdapter = getPostHogAdapter();
        if (postHogAdapter.isAvailable()) {
            postHogAdapter.trackNavigation(mode, 'analytics_nav');
        }
    },

    // Legacy compatibility
    async flowScoreCalculated(score, mode) {
        await this._logEvent('flow_score_calculated', { score, mode });
    },

    async sessionDeleted(mode) {
        await this._logEvent('session_deleted', { mode });
    },

    // ═══════════════════════════════════════════
    // Layer 2: Session Metrics + Rollups
    // ═══════════════════════════════════════════

    async processSessionEnd(rawResults, context = {}) {
        try {
            const sessionNumber = getSessionNumber();
            const metrics = computeSessionMetrics(rawResults, {
                ...context,
                sessionNumber,
            });

            await analyticsStore.write(STORES.sessionMetrics, metrics);

            await this._logEvent('session.metrics_computed', {
                flowScore: metrics.flowScore,
                hesitationCount: metrics.hesitationCount,
                speakingRatio: metrics.speakingRatio,
                micQuality: metrics.micQuality,
                isLikelyTechIssue: metrics.isLikelyTechIssue,
                hesitationsPerMinute: metrics.hesitationsPerMinute,
                wordsPerMinute: metrics.wordsPerMinute,
            }, metrics.sessionId);

            // Send to PostHog (cloud analytics)
            const postHogAdapter = getPostHogAdapter();
            if (postHogAdapter.isAvailable()) {
                postHogAdapter.trackSessionCompleted({
                    mode: metrics.mode,
                    flowScore: metrics.flowScore,
                    hesitationCount: metrics.hesitationCount,
                    speakingRatio: metrics.speakingRatio,
                    micQuality: metrics.micQuality,
                    duration: metrics.duration
                });
            }

            return metrics;
        } catch (e) {
            console.warn('processSessionEnd failed:', e);
            return null;
        }
    },

    async runDailyRollup() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const allMetrics = await analyticsStore.getAll(STORES.sessionMetrics);
            const existingRollups = await analyticsStore.getAll(STORES.dailyRollups);
            const existingDates = new Set(existingRollups.map(r => r.date));

            // Group metrics by date, skip today (not finished)
            const byDate = {};
            allMetrics.forEach(m => {
                if (m.date && m.date !== today) {
                    if (!byDate[m.date]) byDate[m.date] = [];
                    byDate[m.date].push(m);
                }
            });

            let created = 0;
            for (const [date, metrics] of Object.entries(byDate)) {
                if (!existingDates.has(date)) {
                    const rollup = computeDailyRollup(date, metrics);
                    if (rollup) {
                        await analyticsStore.write(STORES.dailyRollups, rollup);
                        created++;
                    }
                }
            }

            // Weekly rollups for completed weeks
            await this._buildWeeklyRollups();

            // Prune old events (> 7 days)
            const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
            await analyticsStore.deleteOlderThan(STORES.events, 'timestamp', cutoff);

            // Prune old session metrics (> 90 days)
            const metricCutoff = new Date(Date.now() - 90 * 86400000).toISOString();
            await analyticsStore.deleteOlderThan(STORES.sessionMetrics, 'timestamp', metricCutoff);

            return created;
        } catch (e) {
            console.warn('runDailyRollup failed:', e);
            return 0;
        }
    },

    async _buildWeeklyRollups() {
        const dailyRollups = await analyticsStore.getAll(STORES.dailyRollups);
        const weeklyRollups = await analyticsStore.getAll(STORES.weeklyRollups);
        const existingWeeks = new Set(weeklyRollups.map(r => r.weekStart));

        // Group dailies by ISO week (Monday start)
        const byWeek = {};
        dailyRollups.forEach(d => {
            const date = new Date(d.date);
            const day = date.getDay();
            const offset = day === 0 ? -6 : 1 - day;
            const monday = new Date(date);
            monday.setDate(date.getDate() + offset);
            const weekStart = monday.toISOString().split('T')[0];

            // Only completed weeks
            const weekEnd = new Date(monday);
            weekEnd.setDate(weekEnd.getDate() + 7);
            if (weekEnd > new Date()) return;

            if (!byWeek[weekStart]) byWeek[weekStart] = [];
            byWeek[weekStart].push(d);
        });

        for (const [weekStart, rollups] of Object.entries(byWeek)) {
            if (!existingWeeks.has(weekStart)) {
                const weekly = computeWeeklyRollup(weekStart, rollups);
                if (weekly) {
                    await analyticsStore.write(STORES.weeklyRollups, weekly);
                }
            }
        }
    },

    // ═══════════════════════════════════════════
    // Queries & Intelligence
    // ═══════════════════════════════════════════

    async getSessionMetrics(limit = 10) {
        const all = await analyticsStore.getAll(STORES.sessionMetrics);
        return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
    },

    async getDailyRollups(limit = 30) {
        const all = await analyticsStore.getAll(STORES.dailyRollups);
        return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
    },

    async getWeeklyRollups(limit = 12) {
        const all = await analyticsStore.getAll(STORES.weeklyRollups);
        return all.sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, limit);
    },

    async getRecentEvents(limit = 50) {
        const all = await analyticsStore.getAll(STORES.events);
        return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
    },

    // ── Phase 2: Intelligence Layer ──

    async getInsights() {
        try {
            const sessionMetrics = await analyticsStore.getAll(STORES.sessionMetrics);
            const events = await analyticsStore.getAll(STORES.events);
            const weeklyRollups = await analyticsStore.getAll(STORES.weeklyRollups);

            const sorted = sessionMetrics.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
            const velocity = computeImprovementVelocity(sorted);
            const behavioral = computeBehavioralPatterns(sorted, events);
            const sortedWeekly = weeklyRollups.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
            const insights = generateInsights(sorted, behavioral, velocity, sortedWeekly);

            return { velocity, behavioral, insights };
        } catch (e) {
            console.warn('getInsights failed:', e);
            return { velocity: null, behavioral: null, insights: [] };
        }
    },

    async getImprovementVelocity() {
        const sessionMetrics = await analyticsStore.getAll(STORES.sessionMetrics);
        const sorted = sessionMetrics.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        return computeImprovementVelocity(sorted);
    },

    async getBehavioralPatterns() {
        const sessionMetrics = await analyticsStore.getAll(STORES.sessionMetrics);
        const events = await analyticsStore.getAll(STORES.events);
        const sorted = sessionMetrics.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        return computeBehavioralPatterns(sorted, events);
    },

    // ── Phase 3: Coaching & Benchmarks ──

    async getCoachingContext() {
        const sessionMetrics = await analyticsStore.getAll(STORES.sessionMetrics);
        const sorted = sessionMetrics.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        const insightsData = await this.getInsights();
        return buildCoachingContext(sorted, insightsData);
    },

    async getCoachingPrompt() {
        const ctx = await this.getCoachingContext();
        return formatCoachingPrompt(ctx);
    },

    async getBenchmark() {
        try {
            const sessionMetrics = await analyticsStore.getAll(STORES.sessionMetrics);
            const sorted = sessionMetrics.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
            return computeBenchmarkSnapshot(sorted, getDeviceId());
        } catch (e) {
            console.warn('getBenchmark failed:', e);
            return { status: 'error' };
        }
    },

    getCachedBenchmark() {
        return getCachedBenchmark();
    },

    getBenchmarkConsent() {
        return getBenchmarkConsent();
    },

    setBenchmarkConsent(consented) {
        setBenchmarkConsent(consented);
    },

    get BENCHMARK_PRIVACY_SUMMARY() {
        return BENCHMARK_PRIVACY_SUMMARY;
    },

    // Cloud sync (no-op until adapter is set)
    async sync() {
        return analyticsStore.sync();
    },

    setSyncAdapter(adapter) {
        analyticsStore.setSyncAdapter(adapter);
    },
};
