# PostHog Integration

## Overview
PostHog has been integrated as an optional cloud analytics layer on top of the existing local analytics system.

## Architecture
```
Local Analytics (IndexedDB) → PostHog Adapter → PostHog Cloud
```

## Files Added/Modified

### 1. New Files
- `src/analytics/posthogAdapter.js` - PostHog integration adapter
- `src/test/posthogTest.js` - Integration test file

### 2. Modified Files
- `src/analytics/index.js` - Added PostHog event sending
- `package.json` - Added posthog-js dependency

## Events Sent to PostHog

### Core Events
- `session_completed` - When a practice session ends
- `nav_mode_selected` - When user selects practice mode
- `tech_mic_denied` - When microphone access is denied

### Event Properties
```javascript
// Session Completed
{
  mode: 'free' | 'lemon' | 'topic',
  flowScore: number,
  hesitationCount: number,
  speakingRatio: number,
  micQuality: string,
  duration: number,
  deviceType: 'mobile' | 'tablet' | 'desktop'
}

// Navigation
{
  mode: string,
  source: string,
  deviceType: string
}

// Tech Events
{
  deviceType: string
}
```

## Privacy Compliance
✅ **No PII sent** - Personal identifiers removed
✅ **No transcripts** - Raw speech data excluded
✅ **Aggregated metrics only** - No per-frame data
✅ **Anonymous device ID** - Uses existing hashed ID

## Offline-First Design
- Events queue when `navigator.onLine === false`
- Auto-flush when connection restored
- IndexedDB remains source of truth
- App functions 100% without PostHog

## Environment Setup

### Development
Add to `.env` file:
```bash
VITE_POSTHOG_KEY=phc_your_project_key_here
```

### Production
Set environment variable in your hosting platform.

## Testing

### Run Integration Test
```javascript
// Import and run test file
import { getPostHogAdapter } from '../analytics/posthogAdapter.js';

// Check console for test results
// Events should appear in PostHog dashboard
```

### Verification Steps
1. Open browser console
2. Navigate to app
3. Check for "✅ PostHog is available" message
4. Verify events in PostHog dashboard

## Key Features

### 🔄 Automatic Queue Management
- Offline events queued automatically
- Flush on connection restore
- Rate limiting protection
- Memory usage optimization

### 📱 Device Detection
- Mobile: < 768px
- Tablet: 768px - 1024px  
- Desktop: > 1024px

### 🛡️ Privacy Protection
- Sanitizes all event properties
- Removes PII before sending
- No raw audio or transcripts
- Anonymous device hashing

### 🧪 Development Support
- Dev verification events
- Queue status monitoring
- Error handling and logging
- Graceful fallbacks

## Troubleshooting

### PostHog Not Available
- Check `VITE_POSTHOG_KEY` environment variable
- Verify internet connection
- Check browser console for errors

### Events Not Appearing
- Verify PostHog project key
- Check network connectivity
- Review PostHog dashboard filters
- Run integration test

### Performance Issues
- Event queue limited to 100 items
- Automatic pruning of old events
- Batch sending with delays

## Migration Notes
- Existing analytics system unchanged
- No breaking changes to local storage
- PostHog is additive only
- Full backward compatibility

## Support
- Check browser console for debug information
- Review PostHog dashboard for event verification
- Monitor network tab for failed requests
