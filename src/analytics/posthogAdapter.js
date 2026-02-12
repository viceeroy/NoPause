/**
 * PostHog Analytics Adapter
 * 
 * Acts as cloud analytics layer on top of existing local analytics system.
 * Only runs when internet is available, queues events when offline.
 * 
 * Privacy-focused: No PII, no transcripts, only aggregated metrics.
 */

import posthog from 'posthog-js';

class PostHogAdapter {
  constructor() {
    this.isInitialized = false;
    this.eventQueue = [];
    this.isOnline = navigator.onLine;
    
    // Initialize PostHog if environment variable is available
    if (import.meta.env.VITE_POSTHOG_KEY) {
      try {
        posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
          api_host: 'https://app.posthog.com',
          autocapture: false,
          capture_pageview: false,
        });
        this.isInitialized = true;
        
        // Dev verification
        if (import.meta.env.DEV) {
          posthog.capture('dev_integration_test', { version: 1 });
        }
      } catch (error) {
        console.warn('PostHog initialization failed:', error);
      }
    }

    // Listen for online/offline events
    this.setupNetworkListeners();
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueuedEvents();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Queue event if offline, send immediately if online
   */
  track(eventName, properties = {}) {
    if (!this.isInitialized) {
      return; // Silently fail if PostHog not available
    }

    const event = {
      name: eventName,
      properties: this.sanitizeProperties(properties),
      timestamp: Date.now()
    };

    if (this.isOnline) {
      this.sendEvent(event);
    } else {
      this.queueEvent(event);
    }
  }

  /**
   * Sanitize properties to ensure privacy compliance
   */
  sanitizeProperties(properties) {
    const sanitized = { ...properties };
    
    // Remove any potential PII
    delete sanitized.email;
    delete sanitized.name;
    delete sanitized.userId;
    delete sanitized.sessionId;
    
    // Ensure no transcript data
    delete sanitized.transcript;
    delete sanitized.audioData;
    delete sanitized.rawSpeech;
    
    return sanitized;
  }

  /**
   * Send event to PostHog immediately
   */
  sendEvent(event) {
    try {
      posthog.capture(event.name, event.properties);
    } catch (error) {
      console.warn('Failed to send event to PostHog:', error);
      // Queue for retry
      this.queueEvent(event);
    }
  }

  /**
   * Queue event for later sending when online
   */
  queueEvent(event) {
    this.eventQueue.push(event);
    
    // Limit queue size to prevent memory issues
    if (this.eventQueue.length > 100) {
      this.eventQueue = this.eventQueue.slice(-50);
    }
  }

  /**
   * Flush all queued events to PostHog
   */
  async flushQueuedEvents() {
    if (!this.isOnline || this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    for (const event of events) {
      try {
        posthog.capture(event.name, event.properties);
        // Small delay between events to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn('Failed to send queued event:', error);
        // Re-queue failed events
        this.eventQueue.unshift(event);
      }
    }
  }

  /**
   * Track session completion with aggregated metrics
   */
  trackSessionCompleted(sessionData) {
    const {
      mode,
      flowScore,
      hesitationCount,
      speakingRatio,
      micQuality,
      duration
    } = sessionData;

    this.track('session_completed', {
      mode,
      flowScore,
      hesitationCount,
      speakingRatio,
      micQuality,
      duration,
      deviceType: this.getDeviceType(),
      timestamp: Date.now()
    });
  }

  /**
   * Track navigation events
   */
  trackNavigation(mode, source = 'unknown') {
    this.track('nav_mode_selected', {
      mode,
      source,
      deviceType: this.getDeviceType()
    });
  }

  /**
   * Track technical events
   */
  trackMicDenied() {
    this.track('tech_mic_denied', {
      deviceType: this.getDeviceType()
    });
  }

  /**
   * Track aggregated speech metrics (not per-frame)
   */
  trackSpeechMetrics(aggregatedMetrics) {
    const {
      averageVolume,
      speechDetected,
      clarityScore,
      backgroundNoise
    } = aggregatedMetrics;

    this.track('speech_metrics_aggregated', {
      averageVolume,
      speechDetected,
      clarityScore,
      backgroundNoise,
      deviceType: this.getDeviceType()
    });
  }

  /**
   * Get device type for analytics
   */
  getDeviceType() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  /**
   * Check if PostHog is available
   */
  isAvailable() {
    return this.isInitialized && this.isOnline;
  }

  /**
   * Get queue status for debugging
   */
  getQueueStatus() {
    return {
      queueLength: this.eventQueue.length,
      isOnline: this.isOnline,
      isInitialized: this.isInitialized
    };
  }
}

// Singleton instance
let postHogAdapter = null;

export function getPostHogAdapter() {
  if (!postHogAdapter) {
    postHogAdapter = new PostHogAdapter();
  }
  return postHogAdapter;
}

export default PostHogAdapter;
