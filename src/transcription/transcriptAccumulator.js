function normalizeText(value) {
  return (value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function dedupeKey(segment) {
  const text = normalizeText(segment.text);
  const start = segment.startMs == null ? 'na' : Math.round(segment.startMs);
  const end = segment.endMs == null ? 'na' : Math.round(segment.endMs);
  return `${segment.source}|${start}|${end}|${text}`;
}

export function createTranscriptAccumulator() {
  const finalSegments = [];
  const finalKeys = new Set();
  let partialSegment = null;

  const addSegment = (segment) => {
    if (!segment || !segment.text || !segment.text.trim()) return false;

    if (segment.isFinal) {
      const key = dedupeKey(segment);
      if (finalKeys.has(key)) return false;
      finalKeys.add(key);
      finalSegments.push({
        ...segment,
        text: segment.text.trim(),
      });
      partialSegment = null;
      return true;
    }

    partialSegment = {
      ...segment,
      text: segment.text.trim(),
    };
    return true;
  };

  const getFinalText = () => finalSegments.map((seg) => seg.text).join(' ').trim();
  const getPartialText = () => (partialSegment ? partialSegment.text : '');

  const getDisplayText = () => {
    const finalText = getFinalText();
    const partial = getPartialText();
    if (!finalText) return partial;
    if (!partial) return finalText;
    return `${finalText} ${partial}`.trim();
  };

  const getSegments = () => finalSegments.slice();

  const reset = () => {
    finalSegments.length = 0;
    finalKeys.clear();
    partialSegment = null;
  };

  return {
    addSegment,
    getFinalText,
    getPartialText,
    getDisplayText,
    getSegments,
    reset,
  };
}

