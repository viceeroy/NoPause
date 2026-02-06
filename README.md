# FluencyFlow - Offline Version

**100% Offline Speaking Practice App**

Practice speaking fluently without hesitation. Real-time audio analysis, all running in your browser.

---

## ✨ Features

- 🎤 **Real-time hesitation detection** - AI tracks every pause
- 📊 **Fluency scoring** - Get instant feedback (0-100 score)
- ⏱️ **Flexible timers** - 30s, 1min, 2min, 5min, or custom
- 💬 **Speaking prompts** - Categorized topics to practice
- 📈 **Progress tracking** - Charts, streaks, session history
- 🔒 **100% Private** - All data stays on your device
- ⚡ **Fully Offline** - No server, no API, works without internet

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
# or
yarn install
```

### 2. Run Development Server
```bash
npm start
# App opens at http://localhost:3000
```

### 3. Build for Production
```bash
npm run build
# Creates /build folder with static files
# Deploy anywhere - Netlify, Vercel, GitHub Pages
```

---

## 📁 Project Structure

```
fluencyflow-offline/
├── public/
│   ├── index.html          # Main HTML
│   └── manifest.json       # PWA manifest
├── src/
│   ├── components/ui/      # UI components
│   ├── pages/              # Page components
│   ├── lib/                # Core logic
│   ├── App.js              # Main app
│   └── index.js            # Entry point
├── package.json
├── tailwind.config.js
└── craco.config.js
```

---

## 🔧 Tech Stack

- **React** - UI framework
- **React Router** - Navigation
- **Tailwind CSS** - Styling
- **Web Audio API** - Audio analysis (native browser)
- **localStorage** - Data persistence (native browser)
- **Recharts** - Progress charts
- **Lucide Icons** - Icons

---

## 💾 How It Works

### Audio Analysis
- Uses browser's **Web Audio API**
- Analyzes audio in real-time
- Detects silence > 400ms as hesitations
- Calculates fluency score based on speaking time vs silence

### Data Storage
- All sessions saved to **localStorage**
- No backend, no database
- Data never leaves your device
- Export to JSON anytime

### Scoring System
- **100-90**: Excellent (minimal hesitation)
- **89-75**: Great (confident speaker)
- **74-60**: Good (improving)
- **59-40**: Fair (needs practice)
- **<40**: Keep Practicing

---

## 🎯 Usage

1. **Start Practice** - Choose timer duration
2. **Speak Continuously** - App tracks hesitations
3. **Get Feedback** - See score, stats, charts
4. **Track Progress** - View history, maintain streaks

---

## 📱 PWA Support

Install as a Progressive Web App:
- Works offline after first load
- Add to home screen on mobile
- Native app-like experience

---

## 🔒 Privacy

- ✅ No tracking
- ✅ No analytics
- ✅ No data collection
- ✅ Audio never uploaded
- ✅ 100% local processing

---

## 🛠️ Development

### Path Aliases
Uses `@/` for imports:
```javascript
import { storage } from '@/lib/storage';
```

### Custom Scripts
```bash
npm start      # Development server
npm run build  # Production build
npm test       # Run tests
```

---

## 📦 Deployment

After `npm run build`:

1. Upload `/build` folder to any static host
2. Or use: `npx serve build` for local testing
3. No server configuration needed!

---

## 🤝 Contributing

This is a clean, offline-only version with:
- ✅ No backend dependencies
- ✅ No cloud sync
- ✅ Pure browser APIs

---

## 📄 License

Open source - feel free to use and modify!

---

**Built with ❤️ for language learners and public speakers**
