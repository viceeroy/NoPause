import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SPEAKING_PROMPTS, CATEGORIES, DIFFICULTY_COLORS } from '@/lib/prompts';
import { Play, Shuffle, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Prompts() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filtered = selectedCategory === 'All'
    ? SPEAKING_PROMPTS
    : SPEAKING_PROMPTS.filter(p => p.category === selectedCategory);

  const handlePickRandom = () => {
    const pool = selectedCategory === 'All' ? SPEAKING_PROMPTS : filtered;
    const random = pool[Math.floor(Math.random() * pool.length)];
    navigate(`/practice?prompt=${random.id}`);
  };

  return (
    <div data-testid="prompts-page" className="min-h-screen pb-28 px-3 sm:px-6 md:px-12 lg:px-20 pt-4 sm:pt-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-medium text-foreground mb-1 sm:mb-2">Speaking Prompts</h1>
          <p className="text-sm sm:text-base text-muted-foreground font-sans">Pick a topic and start practicing.</p>
        </div>
        <button
          data-testid="random-prompt-btn"
          onClick={handlePickRandom}
          className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-3 rounded-full bg-sage-500 text-white font-sans font-semibold text-xs sm:text-sm btn-press hover:bg-sage-600 flex-shrink-0" style={{ transition: 'background-color 0.2s ease' }}
        >
          <Shuffle size={14} className="sm:hidden" />
          <Shuffle size={16} className="hidden sm:block" />
          Random
        </button>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-6 sm:mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            data-testid={`filter-${cat.toLowerCase().replace(/\s/g, '-')}`}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-sans text-xs sm:text-sm font-medium btn-press',
              'transition-colors duration-200',
              selectedCategory === cat
                ? 'bg-sage-500 text-white'
                : 'bg-sand-200 text-foreground hover:bg-sand-300'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Prompt Cards */}
      <div className="stagger-children space-y-3 sm:space-y-4">
        {filtered.map((prompt) => {
          const diff = DIFFICULTY_COLORS[prompt.difficulty];
          return (
            <div
              key={prompt.id}
              data-testid={`prompt-card-${prompt.id}`}
              className="rounded-xl sm:rounded-2xl bg-white border border-sand-300/50 shadow-card p-3 sm:p-6 card-hover"
            >
              <div className="flex items-start justify-between gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 flex-wrap">
                    <span className={cn('px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-sans font-semibold', diff.bg, diff.text)}>
                      {diff.label}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground font-sans">{prompt.category}</span>
                  </div>
                  <p className="text-sm sm:text-base text-foreground font-sans leading-relaxed">{prompt.text}</p>
                </div>
                <button
                  data-testid={`use-prompt-${prompt.id}`}
                  onClick={() => navigate(`/practice?prompt=${prompt.id}`)}
                  className="flex-shrink-0 w-8 sm:w-10 h-8 sm:h-10 rounded-full bg-sage-100 text-sage-600 flex items-center justify-center btn-press hover:bg-sage-500 hover:text-white" style={{ transition: 'background-color 0.2s ease, color 0.2s ease' }}
                >
                  <Play size={14} className="sm:hidden" fill="currentColor" />
                  <Play size={16} className="hidden sm:block" fill="currentColor" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
