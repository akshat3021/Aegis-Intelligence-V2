# Aegis Intelligence — 3D AI Companions & Productivity

[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen.svg)](https://aegis-intelligence-v2.vercel.app/)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2016-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-blue)](https://supabase.com/)

Aegis Intelligence replaces boring chat boxes with living, breathing 3D digital companions that have distinct personalities, track your objectives, remember your life, and adapt to your mood. Built at the intersection of productivity software, gamification, and premium emotional design.

🔗 **Live Link:** [https://aegis-intelligence-v2.vercel.app/](https://aegis-intelligence-v2.vercel.app/)

---

## 🎯 Key Features

- **3D Digital Companions:** Interact with companions rendered directly in your browser using Three.js/React Three Fiber.
  - **Squish:** Warm, supportive, and cheerful.
  - **Eva:** Calm, precise, analytical, and data-driven.
  - **Spark:** Hyper-energetic, ultimate hype-companion.
- **Voice Interaction:** Speak directly to your companion (Web Speech API) and hear them respond in high-quality speech (ElevenLabs TTS with dual-key failover).
- **Gamified Productivity:**
  - Earn Experience Points (XP) for chatting and completing goals.
  - Level up with animations and sounds.
  - Maintain your check-in streak.
- **Tools Built-in:**
  - **Pomodoro Timer:** Custom intervals with companion motivation cards.
  - **Objectives Tracker:** Organize your daily and long-term targets.
  - **Share Progress:** Canvas-based progress card generator to share stats.
- **PWA Ready:** Native-like experience with mobile-optimized drawer navigation, local notifications, and offline access support.

---

## 🏗️ Architecture & Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Vanilla CSS (strictly inline styling for fast mobile rendering).
- **3D Engine:** Three.js / React Three Fiber (R3F) for interactive 3D companion rendering.
- **Database & Auth:** Supabase (Auth, RLS, Realtime & PostgreSQL).
- **AI Model:** Groq Llama 3.1 (fast chat completions).
- **Text-to-Speech:** ElevenLabs (dual-API key automatic failover system).

---

## 🛠️ Getting Started & Setup

### 1. Database Schema
First, run the database schema inside your Supabase SQL Editor. The schema can be found in `supabase/schema.sql` which sets up:
* `profiles` (User metadata)
* `messages` (Chat logs with RLS)
* `tasks` (Goal tracker items)
* Automatically triggers profile creation on Google OAuth or Email signup.

### 2. Environment Variables
Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROQ_API_KEY=your_groq_api_key
ELEVENLABS_API_KEY_1=your_first_elevenlabs_key
ELEVENLABS_API_KEY_2=your_fallback_elevenlabs_key
```

### 3. Run Locally

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚀 Deployment

This project is configured to deploy seamlessly to **Vercel**:
1. Push your code to your GitHub repository.
2. Link the repository to your Vercel account.
3. Configure the environment variables in the Vercel Dashboard.
4. Vercel will automatically build and deploy the app.
