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
    <div data-testid="prompts-page" className="min-h-screen pb-28 px-6 md:px-12 lg:px-20 pt-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-medium text-foreground mb-2">Speaking Prompts</h1>
          <p className="text-base text-muted-foreground font-sans">Pick a topic and start practicing.</p>
        </div>
        <button
          data-testid="random-prompt-btn"
          onClick={handlePickRandom}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-sage-500 text-white font-sans font-semibold text-sm btn-press hover:bg-sage-600 flex-shrink-0" style={{ transition: 'background-color 0.2s ease' }}
        >
          <Shuffle size={16} />
          Random
        </button>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            data-testid={`filter-${cat.toLowerCase().replace(/\s/g, '-')}`}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              'px-4 py-2 rounded-full font-sans text-sm font-medium btn-press',
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
      <div className="stagger-children space-y-4">
        {filtered.map((prompt) => {
          const diff = DIFFICULTY_COLORS[prompt.difficulty];
          return (
            <div
              key={prompt.id}
              data-testid={`prompt-card-${prompt.id}`}
              className="rounded-2xl bg-white border border-sand-300/50 shadow-card p-6 card-hover"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-sans font-semibold', diff.bg, diff.text)}>
                      {diff.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-sans">{prompt.category}</span>
                  </div>
                  <p className="text-base text-foreground font-sans leading-relaxed">{prompt.text}</p>
                </div>
                <button
                  data-testid={`use-prompt-${prompt.id}`}
                  onClick={() => navigate(`/practice?prompt=${prompt.id}`)}
                  className="flex-shrink-0 w-10 h-10 rounded-full bg-sage-100 text-sage-600 flex items-center justify-center btn-press hover:bg-sage-500 hover:text-white" style={{ transition: 'background-color 0.2s ease, color 0.2s ease' }}
                >
                  <Play size={16} fill="currentColor" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
