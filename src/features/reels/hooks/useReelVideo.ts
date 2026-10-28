import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue } from "framer-motion";

export function useReelVideo(isActive: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progress = useMotionValue(0);
  const manuallyPaused = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasMediaError, setHasMediaError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (video.duration > 0) progress.set(video.currentTime / video.duration);
    };
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onPlaying = () => {
      setIsBuffering(false);
      setHasMediaError(false);
      setIsPlaying(true);
    };
    const onPause = () => {
      setIsBuffering(false);
      setIsPlaying(false);
    };
    const onError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      setHasMediaError(true);
    };
    const onEnded = () => {
      video.currentTime = 0;
      if (isActive) void video.play().catch(() => setIsPlaying(false));
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
      video.removeEventListener("ended", onEnded);
    };
  }, [isActive, progress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive && !manuallyPaused.current && !document.hidden) {
      setIsBuffering(video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
      void video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
    return () => video.pause();
  }, [isActive, progress]);

  useEffect(() => {
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) video.pause();
      else if (isActive && !manuallyPaused.current)
        void video.play().catch(() => setIsPlaying(false));
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isActive]);
  useEffect(() => {
    const resume = () => {
      const video = videoRef.current;
      if (!video || !isActive || document.hidden || manuallyPaused.current || !video.paused) return;
      void video.play().catch(() => setIsPlaying(false));
    };
    document.addEventListener("click", resume);
    document.addEventListener("keydown", resume);
    return () => {
      document.removeEventListener("click", resume);
      document.removeEventListener("keydown", resume);
    };
  }, [isActive]);
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    manuallyPaused.current = !video.paused;
    if (video.paused) void video.play().catch(() => setIsPlaying(false));
    else video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const seekTo = useCallback((fraction: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(1, fraction)) * video.duration;
  }, []);

  const retry = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setHasMediaError(false);
    setIsBuffering(true);
    video.load();
    if (isActive) void video.play().catch(() => setIsPlaying(false));
  }, [isActive]);

  return {
    videoRef,
    progress,
    isPlaying,
    isMuted,
    isBuffering,
    hasMediaError,
    togglePlay,
    toggleMute,
    seekTo,
    retry,
  };
}
