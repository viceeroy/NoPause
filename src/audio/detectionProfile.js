// Detection Profile — Adaptive per-user speech detection model
// Persisted in localStorage. Learns from each session.
// Supports mode switching (forgiving → strict) without global hardcoding.

const PROFILE_KEY = 'nopause_detection_profile';

// ── Detection Modes ──
// Each mode defines detection behavior. Thresholds are NOT hardcoded —
// they're multipliers applied to the user's learned baseline.

export const DETECTION_MODES = {
    forgiving: {
        label: 'Standard',
        description: 'Generous detection — prioritizes catching speech over catching silence',
        speechMultiplier: 1.8,       // noiseFloor × this = speech threshold (lower = more forgiving)
        minSpeechThreshold: 0.008,   // absolute floor — never threshold below this
        hesitationMinDuration: 1800, // 1.8s — only sustained pauses count
        microPauseFilter: 300,       // ignore silence gaps < 300ms (breathing, natural rhythm)
        hysteresisRatio: 0.65,       // off-threshold = on-threshold × this (prevents flickering)
        smoothingWindow: 12,         // samples (~400ms at 30fps — more stability)
        calibrationDuration: 1500,
    },
    strict: {
        label: 'Advanced',
        description: 'Strict detection — suitable for IELTS/presentation training',
        speechMultiplier: 3.0,
        minSpeechThreshold: 0.012,
        hesitationMinDuration: 1200, // 1.2s
        microPauseFilter: 0,         // no filtering — every silence counts
        hysteresisRatio: 1.0,        // no hysteresis
        smoothingWindow: 8,
        calibrationDuration: 1500,
    },
};

// ── Default Profile ──

function createDefaultProfile() {
    return {
        version: 2,
        mode: 'forgiving',

        // Learned user baselines (updated after each session via EMA)
        learnedSpeechVolume: 0,     // avg RMS when user is speaking
        learnedNoiseFloor: 0,       // avg ambient noise from calibrations
        sessionsAnalyzed: 0,        // how many sessions have contributed to learning
        lastUpdated: null,

        // Adaptive thresholds (computed from learned data + mode)
        adaptiveSpeechThreshold: null,  // null = use calibration-based
        adaptiveHesitationMs: null,     // null = use mode default
    };
}

// ── Profile Management ──

export function loadProfile() {
    try {
        const stored = localStorage.getItem(PROFILE_KEY);
        if (stored) {
            const profile = JSON.parse(stored);
            if (profile.version === 2) return profile;
        }
    } catch (e) {
        // Corrupted — reset
    }
    return createDefaultProfile();
}

export function saveProfile(profile) {
    try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
        console.warn('Failed to save detection profile:', e);
    }
}

export function setDetectionMode(mode) {
    if (!DETECTION_MODES[mode]) return;
    const profile = loadProfile();
    profile.mode = mode;
    saveProfile(profile);
}

export function getDetectionMode() {
    return loadProfile().mode;
}

// ── Threshold Computation ──
// Combines mode settings + learned user data to produce session thresholds

export function computeThresholds(profile, calibratedNoiseFloor = 0) {
    const mode = DETECTION_MODES[profile.mode] || DETECTION_MODES.forgiving;

    // Base noise: prefer calibration, fall back to learned, then 0
    const noiseFloor = calibratedNoiseFloor || profile.learnedNoiseFloor || 0;

    // Speech-on threshold
    let speechOnThreshold;
    if (profile.adaptiveSpeechThreshold && profile.sessionsAnalyzed >= 3) {
        // Adaptive: use learned speech volume × 0.35 (threshold at 35% of speaking level)
        // This is much more accurate than noise-based after a few sessions
        speechOnThreshold = Math.max(mode.minSpeechThreshold, profile.adaptiveSpeechThreshold);
    } else {
        // Calibration-based: noise floor × mode multiplier
        speechOnThreshold = Math.max(mode.minSpeechThreshold, noiseFloor * mode.speechMultiplier);
    }

    // Speech-off threshold (hysteresis)
    // Once speaking is detected, volume must drop to this level to become "silence"
    // Prevents rapid flickering at threshold boundary
    const speechOffThreshold = speechOnThreshold * mode.hysteresisRatio;

    return {
        speechOnThreshold,
        speechOffThreshold,
        hesitationMinDuration: profile.adaptiveHesitationMs || mode.hesitationMinDuration,
        microPauseFilter: mode.microPauseFilter,
        smoothingWindow: mode.smoothingWindow,
        calibrationDuration: mode.calibrationDuration,
        modeName: profile.mode,
    };
}

// ── Post-Session Learning ──
// Updates profile with data from the completed session.
// Uses Exponential Moving Average (EMA) — recent sessions weighted 30%, history 70%.

export function updateProfileFromSession(sessionData) {
    const profile = loadProfile();
    const mode = DETECTION_MODES[profile.mode] || DETECTION_MODES.forgiving;

    const {
        avgSpeakingVolume = 0,  // avg RMS during speaking-classified frames
        noiseFloor = 0,
        speakingRatio = 0,
        sessionDurationMs = 0,
    } = sessionData;

    // Skip learning if session was too short or user barely spoke
    if (sessionDurationMs < 5000 || speakingRatio < 0.1) {
        return profile;
    }

    // Skip if avgSpeakingVolume is suspiciously low (possible tech issue)
    if (avgSpeakingVolume < 0.005) {
        return profile;
    }

    const alpha = 0.3; // EMA weight for new data

    if (profile.sessionsAnalyzed === 0) {
        // First session — initialize directly
        profile.learnedSpeechVolume = avgSpeakingVolume;
        profile.learnedNoiseFloor = noiseFloor;
    } else {
        // EMA update
        profile.learnedSpeechVolume = profile.learnedSpeechVolume * (1 - alpha) + avgSpeakingVolume * alpha;
        profile.learnedNoiseFloor = profile.learnedNoiseFloor * (1 - alpha) + noiseFloor * alpha;
    }

    profile.sessionsAnalyzed++;
    profile.lastUpdated = new Date().toISOString();

    // Recompute adaptive thresholds from learned data
    // Speech threshold = 35% of learned speaking volume
    // This means: "if volume is at least 35% of how loud you normally speak, you're speaking"
    if (profile.sessionsAnalyzed >= 3 && profile.learnedSpeechVolume > 0) {
        profile.adaptiveSpeechThreshold = Math.max(
            mode.minSpeechThreshold,
            profile.learnedSpeechVolume * 0.35
        );
    }

    saveProfile(profile);
    return profile;
}

// ── Debug / Inspection ──

export function getProfileSummary() {
    const profile = loadProfile();
    const mode = DETECTION_MODES[profile.mode];
    const thresholds = computeThresholds(profile);

    return {
        mode: profile.mode,
        modeLabel: mode?.label,
        sessionsAnalyzed: profile.sessionsAnalyzed,
        isAdaptive: profile.sessionsAnalyzed >= 3,
        learnedSpeechVolume: Math.round(profile.learnedSpeechVolume * 10000) / 10000,
        learnedNoiseFloor: Math.round(profile.learnedNoiseFloor * 10000) / 10000,
        currentThresholds: {
            speechOn: Math.round(thresholds.speechOnThreshold * 10000) / 10000,
            speechOff: Math.round(thresholds.speechOffThreshold * 10000) / 10000,
            hesitationMs: thresholds.hesitationMinDuration,
            microPauseMs: thresholds.microPauseFilter,
        },
        lastUpdated: profile.lastUpdated,
    };
}
