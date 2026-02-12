/**
 * PostHog Integration Test
 * 
 * Run this file to verify PostHog events are being sent correctly.
 * Open browser console to see test results.
 */

import { getPostHogAdapter } from '../analytics/posthogAdapter.js';

// Test PostHog integration
console.log('🧪 Testing PostHog Integration...');

const postHogAdapter = getPostHogAdapter();

// Test 1: Check availability
console.log('📊 PostHog Available:', postHogAdapter.isAvailable());
console.log('📊 Queue Status:', postHogAdapter.getQueueStatus());

// Test 2: Send test events
if (postHogAdapter.isAvailable()) {
    console.log('✅ PostHog is available - sending test events...');
    
    // Test session completed event
    postHogAdapter.trackSessionCompleted({
        mode: 'test',
        flowScore: 85,
        hesitationCount: 3,
        speakingRatio: 0.92,
        micQuality: 'good',
        duration: 120
    });
    
    // Test navigation event
    postHogAdapter.trackNavigation('free', 'test_integration');
    
    // Test mic denied event
    postHogAdapter.trackMicDenied();
    
    console.log('✅ Test events sent to PostHog');
    console.log('🌐 Check your PostHog dashboard for events:');
    console.log('   - session_completed');
    console.log('   - nav_mode_selected');
    console.log('   - tech_mic_denied');
    
} else {
    console.log('❌ PostHog not available - check VITE_POSTHOG_KEY environment variable');
    console.log('💡 To enable PostHog:');
    console.log('   1. Add VITE_POSTHOG_KEY to your .env file');
    console.log('   2. Ensure internet connection is available');
}

export { postHogAdapter };
