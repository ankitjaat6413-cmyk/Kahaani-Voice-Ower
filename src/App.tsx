/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { BookOpen, Mic, Loader2, Play, Download, Volume2, RefreshCw } from 'lucide-react';

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const VOICES = [
  { id: 'Charon', name: 'Charon', description: 'Deep, resonant, and grounded' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Smooth, breezy, and relaxed' },
  { id: 'Puck', name: 'Puck', description: 'Energetic, bright, and engaging' },
  { id: 'Kore', name: 'Kore', description: 'Calm, clear, and soothing' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Strong, commanding, and bold' },
];

// Helper to convert raw PCM to a playable WAV Blob
function createWavBlob(base64Data: string, sampleRate: number = 24000): Blob {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Check if it's already a WAV file (starts with 'RIFF')
  const isWav = bytes.length > 4 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70;
  if (isWav) {
    return new Blob([bytes], { type: 'audio/wav' });
  }

  // Otherwise, assume raw PCM 16-bit and wrap it in a WAV container
  const pcmData = new Int16Array(bytes.buffer);
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

export default function App() {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('Charon');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Cleanup object URL on unmount or when audioUrl changes
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError('Please enter some text for the story.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      // Instruct the model to read the text expressively like a storyteller
      const prompt = `Narrate this expressively like a storyteller reading a novel:\n\n${text}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!base64Audio) {
        throw new Error('No audio data received from the model.');
      }

      const wavBlob = createWavBlob(base64Audio);
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);
      
    } catch (err: any) {
      console.error('TTS Generation Error:', err);
      setError(err.message || 'Failed to generate voiceover. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#2c2c24] font-sans selection:bg-[#5A5A40] selection:text-white pb-24">
      {/* Header */}
      <header className="pt-16 pb-10 px-6 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center justify-center p-4 bg-[#e8e8e0] rounded-full mb-6 shadow-sm">
          <BookOpen className="w-8 h-8 text-[#5A5A40]" />
        </div>
        <h1 className="text-5xl md:text-6xl font-serif font-medium tracking-tight mb-4 text-[#1a1a15]">
          Kahaani Voiceover
        </h1>
        <p className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto font-serif italic">
          Transform your text into an immersive, expressive voiceover. Perfect for stories, novels, and narration.
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-6">
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 md:p-10 border border-[#e5e5e0]">
          
          {/* Text Input */}
          <div className="mb-8">
            <label htmlFor="story-text" className="block text-sm font-semibold uppercase tracking-wider text-[#5A5A40] mb-3">
              Your Story
            </label>
            <textarea
              id="story-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ek samay ki baat hai... (Once upon a time...)"
              className="w-full h-48 p-4 bg-[#fafaf8] border border-[#e5e5e0] rounded-2xl focus:ring-2 focus:ring-[#5A5A40] focus:border-transparent transition-all resize-none font-serif text-lg leading-relaxed"
            />
          </div>

          {/* Voice Selection */}
          <div className="mb-10">
            <label className="block text-sm font-semibold uppercase tracking-wider text-[#5A5A40] mb-3">
              Select Narrator
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={`text-left p-4 rounded-2xl border transition-all ${
                    voice === v.id
                      ? 'bg-[#5A5A40] border-[#5A5A40] text-white shadow-md'
                      : 'bg-white border-[#e5e5e0] hover:border-[#5A5A40] hover:bg-[#fafaf8]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{v.name}</span>
                    {voice === v.id && <Mic className="w-4 h-4 opacity-80" />}
                  </div>
                  <div className={`text-xs ${voice === v.id ? 'text-white/80' : 'text-[#8e8e80]'}`}>
                    {v.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim()}
            className="w-full py-4 px-6 bg-[#5A5A40] hover:bg-[#4a4a35] disabled:bg-[#d1d1c7] disabled:cursor-not-allowed text-white rounded-full font-medium text-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Narrating Story...
              </>
            ) : (
              <>
                <Volume2 className="w-5 h-5" />
                Generate Voiceover
              </>
            )}
          </button>

          {/* Audio Player Result */}
          {audioUrl && !isGenerating && (
            <div className="mt-8 p-6 bg-[#fafaf8] rounded-2xl border border-[#e5e5e0] animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5A5A40] mb-4 flex items-center gap-2">
                <Play className="w-4 h-4" />
                Your Voiceover is Ready
              </h3>
              <audio
                ref={audioRef}
                src={audioUrl}
                controls
                autoPlay
                className="w-full mb-4"
              />
              <div className="flex justify-end">
                <a
                  href={audioUrl}
                  download="kahaani-voiceover.wav"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#5A5A40] bg-white border border-[#e5e5e0] rounded-full hover:bg-[#f5f5f0] transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Audio
                </a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
