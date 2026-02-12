/**
 * @typedef {Object} TranscriptSegment
 * @property {string} id
 * @property {string} text
 * @property {number|null} startMs
 * @property {number|null} endMs
 * @property {boolean} isFinal
 * @property {'browser'|'server'} source
 */

/**
 * @typedef {Object} ProviderCallbacks
 * @property {(segment: TranscriptSegment) => void} [onSegment]
 * @property {(event: string, data?: Record<string, unknown>) => void} [onLog]
 * @property {(error: { code: string, message?: string, recoverable?: boolean }) => void} [onError]
 * @property {() => void} [onEnd]
 * @property {() => void} [onStart]
 */

/**
 * Contract used by browser/server transcription providers.
 * Providers are stateful and should be created per listening session.
 */
export class TranscriptionProvider {
  /**
   * @param {ProviderCallbacks} _callbacks
   */
  constructor(_callbacks = {}) {}

  /**
   * @param {{ stream?: MediaStream|null, language?: string, sessionId?: string }} _options
   * @returns {Promise<boolean>}
   */
  async start(_options = {}) {
    return false;
  }

  /**
   * Stop provider and release all resources.
   * @returns {Promise<void>}
   */
  async stop() {}

  /**
   * @returns {boolean}
   */
  isActive() {
    return false;
  }
}

