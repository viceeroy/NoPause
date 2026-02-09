export const SPEAKING_PROMPTS = [
  { id: '1', category: 'Daily Life', text: 'Describe your morning routine in detail. What do you do from the moment you wake up?', difficulty: 'easy' },
  { id: '2', category: 'Daily Life', text: 'Talk about your favorite meal to cook. What ingredients do you need and how do you prepare it?', difficulty: 'easy' },
  { id: '3', category: 'Daily Life', text: 'Describe your ideal weekend. What activities would you do?', difficulty: 'easy' },
  { id: '4', category: 'Opinion', text: 'Do you think social media has more positive or negative effects on society? Explain your reasoning.', difficulty: 'medium' },
  { id: '5', category: 'Opinion', text: 'What is the most important skill everyone should learn? Why?', difficulty: 'medium' },
  { id: '6', category: 'Opinion', text: 'Should schools teach financial literacy as a core subject? Share your thoughts.', difficulty: 'medium' },
  { id: '7', category: 'Storytelling', text: 'Tell a story about a time you overcame a challenge. What did you learn from it?', difficulty: 'medium' },
  { id: '8', category: 'Storytelling', text: 'Describe a memorable travel experience. Where did you go and what happened?', difficulty: 'medium' },
  { id: '9', category: 'Abstract', text: 'If you could change one thing about how the world works, what would it be and why?', difficulty: 'hard' },
  { id: '10', category: 'Abstract', text: 'Explain the concept of time to someone who has never experienced it. How would you describe it?', difficulty: 'hard' },
  { id: '11', category: 'Professional', text: 'Give a two-minute pitch about a product or service you believe in. Convince the listener to try it.', difficulty: 'hard' },
  { id: '12', category: 'Professional', text: 'Describe a project you worked on that you\'re proud of. What was your role and what was the outcome?', difficulty: 'medium' },
  { id: '13', category: 'Creative', text: 'Imagine you woke up with a superpower. What is it and how would your day change?', difficulty: 'easy' },
  { id: '14', category: 'Creative', text: 'Describe a world where technology doesn\'t exist. How do people live and communicate?', difficulty: 'hard' },
  { id: '15', category: 'Daily Life', text: 'Talk about a hobby you enjoy. How did you get started and why do you love it?', difficulty: 'easy' },
];

// Random words for Lemon Score exercise
export const RANDOM_WORDS = [
  'serendipity', 'quintessential', 'ephemeral', 'ubiquitous', 'paradigm', 'ambiguous', 'meticulous', 'resilient', 'pragmatic',
  'eloquent', 'articulate', 'coherent', 'fluent', 'spontaneous', 'versatile', 'nuanced', 'perceptive', 'insightful',
  'analytical', 'methodical', 'strategic', 'innovative', 'adaptable', 'proficient', 'competent', 'confident', 'expressive',
  'charismatic', 'engaging', 'persuasive', 'diplomatic', 'tactful', 'empathetic', 'intuitive', 'creative', 'visionary'
];

export const CATEGORIES = ['All', 'Daily Life', 'Opinion', 'Storytelling', 'Abstract', 'Professional', 'Creative'];

export const DIFFICULTY_COLORS = {
  easy: { bg: 'bg-sage-100', text: 'text-sage-600', label: 'Easy' },
  medium: { bg: 'bg-sand-300', text: 'text-sand-500', label: 'Medium' },
  hard: { bg: 'bg-terracotta-100', text: 'text-terracotta-500', label: 'Hard' },
};

export const TIMER_PRESETS = [
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
];
