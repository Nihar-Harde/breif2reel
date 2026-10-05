import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Film,
  Music,
  Headphones,
  Subtitles,
} from "lucide-react";

/**
 * Builds natural phrase chunks (3-5 words each) from script text.
 * Each phrase remains visually static during playback so words never jump or jitter.
 */
function buildPhrases(scriptText) {
  if (!scriptText) return [];
  const clean = scriptText
    .replace(/\[.*?\]|\(.*?\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return [];

  // Split by natural sentence and clause pauses
  const clauses = clean.split(/(?<=[.?!,;—\n])\s+/).filter(Boolean);
  const phrases = [];
  let globalWordIndex = 0;

  for (const clause of clauses) {
    const rawWords = clause.split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) continue;

    // Segment into balanced groups of 3 to 5 words
    const chunkSize = rawWords.length <= 5 ? rawWords.length : Math.ceil(rawWords.length / 2);
    for (let i = 0; i < rawWords.length; i += chunkSize) {
      const chunkWords = rawWords.slice(i, i + chunkSize);
      const startIndex = globalWordIndex;
      const endIndex = globalWordIndex + chunkWords.length - 1;
      phrases.push({
        id: `phrase-${startIndex}`,
        words: chunkWords.map((w, wIdx) => ({
          text: w,
          globalIndex: startIndex + wIdx,
        })),
        startIndex,
        endIndex,
      });
      globalWordIndex += chunkWords.length;
    }
  }

  const totalWords = Math.max(1, globalWordIndex);
  return phrases.map((p) => ({
    ...p,
    startRatio: p.startIndex / totalWords,
    endRatio: (p.endIndex + 1) / totalWords,
  }));
}

export function VideoPlayer916({
  videoUrl,
  audioUrl,
  caption = "",
  script = "",
  productName = "",
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(12);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [showCaptions, setShowCaptions] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const speechRef = useRef(null);

  // Clean script text for voiceover & subtitle rendering
  const textSource =
    script?.trim() ||
    caption?.trim() ||
    "Autonomous high-converting short-form reel crafted by Brief2Reel";
  const cleanScript = textSource.replace(/\[.*?\]|\(.*?\)/g, "").trim();

  // Pre-calculate phrase segments once per script change
  const phrases = useMemo(() => buildPhrases(cleanScript), [cleanScript]);
  const totalWords = useMemo(
    () => phrases.reduce((sum, p) => sum + p.words.length, 0) || 1,
    [phrases]
  );

  // 1. Audio Element sync & event handling
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        setAudioReady(true);
        setAudioError(false);
      }
    };

    const handleEnded = () => {
      if (isLooping) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {});
        }
      } else {
        setIsPlaying(false);
      }
    };

    const handleError = () => {
      setAudioError(true);
      setAudioReady(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [audioUrl, isLooping]);

  // 2. High-precision 60fps loop using requestAnimationFrame for smooth subtitle progress
  useEffect(() => {
    let animId;
    if (isPlaying) {
      const updateFrame = () => {
        if (audioRef.current && !audioError) {
          setCurrentTime(audioRef.current.currentTime || 0);
          if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        } else if (videoRef.current && videoUrl) {
          setCurrentTime(videoRef.current.currentTime || 0);
          if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
            setDuration(videoRef.current.duration);
          }
        }
        animId = requestAnimationFrame(updateFrame);
      };
      animId = requestAnimationFrame(updateFrame);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, audioError, videoUrl]);

  // 3. Fallback interval when no media element is driving time
  useEffect(() => {
    let interval;
    const isUsingFallback = (!audioUrl || audioError) && (!videoUrl || !videoRef.current);

    if (isUsingFallback && isPlaying) {
      const estimatedDuration = Math.max(6, Math.round(totalWords / 2.4));
      setDuration(estimatedDuration);

      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= estimatedDuration) {
            if (isLooping) {
              if (window.speechSynthesis && !isMuted) {
                playWebSpeech();
              }
              return 0;
            }
            setIsPlaying(false);
            return prev;
          }
          return Math.min(estimatedDuration, prev + 0.1);
        });
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, audioUrl, audioError, videoUrl, totalWords, isLooping, isMuted]);

  // 4. Web Speech API fallback
  const playWebSpeech = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanScript);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = isMuted ? 0 : 1;

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Natural") ||
          v.name.includes("Google") ||
          v.name.includes("Samantha") ||
          v.name.includes("Jenny"))
    );
    if (naturalVoice) utterance.voice = naturalVoice;

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopWebSpeech = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  // 5. Active Word and Active Phrase Calculation (Jitter-Free)
  const currentRatio = Math.min(1, Math.max(0, currentTime / (duration || 1)));
  const activeWordGlobalIndex = Math.min(
    totalWords - 1,
    Math.floor(currentRatio * totalWords)
  );

  const activePhrase =
    phrases.find(
      (p) =>
        p.startIndex <= activeWordGlobalIndex &&
        activeWordGlobalIndex <= p.endIndex
    ) || phrases[0];

  // 6. Unified Play / Pause toggle
  const togglePlay = () => {
    const nextPlayState = !isPlaying;

    if (nextPlayState) {
      if (videoUrl && videoRef.current) {
        videoRef.current.currentTime = currentTime;
        videoRef.current.play().catch(() => {});
      }

      if (audioUrl && audioRef.current && !audioError) {
        audioRef.current.currentTime = currentTime;
        audioRef.current.muted = isMuted;
        audioRef.current.play().catch(() => {
          if (!isMuted) playWebSpeech();
        });
      } else if (!isMuted) {
        playWebSpeech();
      }
      setIsPlaying(true);
    } else {
      if (videoUrl && videoRef.current) {
        videoRef.current.pause();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      stopWebSpeech();
      setIsPlaying(false);
    }
  };

  // 7. Seek / Scrub handler
  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);

    if (audioRef.current && !audioError) {
      audioRef.current.currentTime = newTime;
    }
    if (videoUrl && videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if ((!audioUrl || audioError) && isPlaying && !isMuted) {
      playWebSpeech();
    }
  };

  // 8. Mute toggle
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    if (nextMuted) {
      stopWebSpeech();
    } else if (isPlaying && (!audioUrl || audioError)) {
      playWebSpeech();
    }
  };

  useEffect(() => {
    return () => {
      stopWebSpeech();
    };
  }, []);

  const formatTime = (secs) => {
    const safe = Math.max(0, isNaN(secs) ? 0 : secs);
    const m = Math.floor(safe / 60);
    const s = Math.floor(safe % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          playsInline
        />
      )}

      {/* 9:16 Vertical Chassis */}
      <div className="relative w-[260px] sm:w-[280px] aspect-[9/16] bg-[#1c1917] rounded-xl overflow-hidden border border-[#d6d0c4] shadow-2xl flex flex-col justify-between group select-none">
        {/* Real Video Element if videoUrl exists */}
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            loop={isLooping}
            muted={isMuted}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          /* High-Fidelity Reel Visualizer Engine */
          <div className="absolute inset-0 bg-gradient-to-b from-[#292524] via-[#1c1917] to-[#0c0a09] flex flex-col items-center justify-between p-6 text-center">
            {/* Dynamic Mesh Visualizer */}
            <div className="absolute inset-0 opacity-25 pointer-events-none">
              <div
                className="w-full h-full"
                style={{
                  backgroundImage: `radial-gradient(circle at 50% ${
                    isPlaying ? (currentTime * 12) % 100 : 50
                  }%, rgba(194, 65, 12, 0.45) 0%, transparent 70%)`,
                  transition: "background-position 0.2s ease",
                }}
              />
            </div>

            {/* Top Branding Section */}
            <div className="relative z-10 pt-6 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-[#c2410c]/20 border border-[#c2410c]/40 flex items-center justify-center text-[#ea580c] mb-3 shadow-lg">
                <Film className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#ea580c] font-semibold">
                9:16 Vertical Preview
              </span>
              <h4 className="text-sm font-semibold text-[#fbf9f5] line-clamp-1 mt-1">
                {productName || "Autonomous Campaign Reel"}
              </h4>
            </div>

            {/* Spacer so subtitles stay centered in visualizer mode */}
            <div className="flex-1" />

            {/* Audio Mode Badge */}
            <div className="relative z-10 pb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-mono text-stone-300 shadow-sm">
                <Music className="w-3 h-3 text-[#ea580c]" />
                <span>{audioReady ? "Edge-TTS Voiceover" : "Live Script Audio"}</span>
              </span>
            </div>
          </div>
        )}

        {/* Stable Phrase-Based Karaoke Subtitles Card (Appears in both visualizer and video overlay) */}
        {showCaptions && activePhrase && (
          <div className="absolute inset-x-3 bottom-16 z-20 pointer-events-none flex flex-col items-center">
            <div className="w-full max-w-[250px] px-3.5 py-3 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 shadow-2xl text-center transition-all duration-200">
              <div className="flex items-center justify-between mb-1.5 px-0.5 opacity-80">
                <span className="text-[9px] font-mono uppercase tracking-wider text-[#ea580c] flex items-center gap-1 font-semibold">
                  <Headphones className="w-2.5 h-2.5" />
                  Voiceover Subtitles
                </span>
                <span className="text-[9px] font-mono text-stone-300">
                  {activeWordGlobalIndex + 1}/{totalWords}
                </span>
              </div>

              {/* Jitter-Free Static Phrase Words Container */}
              <div className="min-h-[48px] flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 py-1">
                {activePhrase.words.map((w) => {
                  const isCurrent = w.globalIndex === activeWordGlobalIndex;
                  const isPast = w.globalIndex < activeWordGlobalIndex;

                  return (
                    <span
                      key={w.globalIndex}
                      className={`inline-block text-xs transition-all duration-150 rounded ${
                        isCurrent
                          ? "bg-[#c2410c] text-[#fef08a] font-extrabold px-1.5 py-0.5 scale-105 shadow-md ring-1 ring-amber-400/60"
                          : isPast
                          ? "text-white font-semibold opacity-95"
                          : "text-stone-400 font-normal opacity-50"
                      }`}
                    >
                      {w.text}
                    </span>
                  );
                })}
              </div>

              {/* Smooth Phrase Completion Progress Bar */}
              <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-[#ea580c] transition-all duration-150 ease-out"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        ((activeWordGlobalIndex - activePhrase.startIndex + 1) /
                          activePhrase.words.length) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Top Header Overlay in Video */}
        <div className="relative z-30 p-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-stone-200">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPlaying ? "bg-[#16a34a] animate-pulse" : "bg-stone-500"
              }`}
            />
            <span>{videoUrl ? "9:16 Video" : "Audio Preview"}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Subtitle Toggle */}
            <button
              onClick={() => setShowCaptions(!showCaptions)}
              className={`p-1 rounded-full border transition-colors ${
                showCaptions
                  ? "bg-[#c2410c]/30 border-[#c2410c] text-[#ea580c]"
                  : "bg-black/60 border-white/10 text-stone-400"
              }`}
              title={showCaptions ? "Hide subtitles" : "Show subtitles"}
            >
              <Subtitles className="w-3 h-3" />
            </button>

            {/* Dynamic Audio Waveform Indicator */}
            <div className="flex items-center gap-0.5 h-4 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
              {[40, 75, 55, 90, 60, 45, 80].map((h, i) => (
                <span
                  key={i}
                  className="w-[2px] bg-[#ea580c] rounded-full transition-all duration-150"
                  style={{
                    height: isPlaying
                      ? `${Math.max(3, (h * ((currentTime * 8 + i) % 10)) / 10)}px`
                      : "3px",
                    opacity: isMuted ? 0.2 : 0.9,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Center Big Play/Pause Toggle on Click */}
        <div
          onClick={togglePlay}
          className="relative z-20 flex-1 flex items-center justify-center cursor-pointer"
        >
          <div
            className={`w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all transform ${
              isPlaying
                ? "opacity-0 group-hover:opacity-100 scale-95"
                : "opacity-100 scale-100 shadow-xl"
            }`}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" />
            )}
          </div>
        </div>

        {/* Bottom Custom Playback Bar Overlay */}
        <div className="relative z-30 p-3 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex flex-col gap-2">
          {/* Scrubber Progress Slider */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max={duration || 12}
              step="0.05"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/25 rounded-lg appearance-none cursor-pointer accent-[#ea580c] hover:accent-[#f97316]"
            />
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between text-stone-300">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-1 hover:text-white transition-colors"
                title={isPlaying ? "Pause voiceover" : "Play voiceover"}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => {
                  setCurrentTime(0);
                  if (audioRef.current) audioRef.current.currentTime = 0;
                  if (videoUrl && videoRef.current) videoRef.current.currentTime = 0;
                  if (isPlaying && (!audioUrl || audioError)) playWebSpeech();
                }}
                className="p-1 hover:text-white transition-colors"
                title="Restart"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <button
                onClick={toggleMute}
                className="p-1 hover:text-white transition-colors"
                title={isMuted ? "Unmute audio" : "Mute audio"}
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-stone-500" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-[#ea580c]" />
                )}
              </button>
            </div>

            {/* Timecode */}
            <span className="text-[10px] font-mono tabular-nums text-stone-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
