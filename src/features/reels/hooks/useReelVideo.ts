import { useCallback, useEffect, useRef, useState } from "react";
import { useMotionValue } from "framer-motion";
import { readReelMutedPreference, writeReelMutedPreference } from "../reel-preference.mjs";
import { REEL_DEACTIVATE_EVENT } from "../reel-video-events.mjs";

export function useReelVideo(isActive: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progress = useMotionValue(0);
  const manuallyPaused = useRef(false);
  const activeRef = useRef(isActive);
  activeRef.current = isActive;
  const playRequest = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(() => readReelMutedPreference());
  const [mutePreferenceError, setMutePreferenceError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasMediaError, setHasMediaError] = useState(false);
  const requestPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || document.hidden) return;
    const request = ++playRequest.current;
    void video.play().catch(() => {
      if (request === playRequest.current) {
        setIsBuffering(false);
        setIsPlaying(false);
      }
    });
  }, []);
  const pauseVideo = useCallback(() => {
    playRequest.current += 1;
    videoRef.current?.pause();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (Number.isFinite(video.duration) && video.duration > 0)
        progress.set(video.currentTime / video.duration);
    };
    const onWaiting = () => {
      if (activeRef.current && !document.hidden) setIsBuffering(true);
    };
    const onCanPlay = () => {
      if (activeRef.current && !document.hidden) setIsBuffering(false);
    };
    const onLoadStart = () => {
      progress.set(0);
      setIsPlaying(false);
      setIsBuffering(true);
      setHasMediaError(false);
    };
    const onLoadedData = () => {
      if (activeRef.current && !document.hidden) {
        setIsBuffering(false);
        setHasMediaError(false);
      }
    };
    const onPlaying = () => {
      if (!activeRef.current || document.hidden || manuallyPaused.current) {
        video.pause();
        return;
      }
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
    const onDeactivate = () => {
      manuallyPaused.current = true;
      pauseVideo();
      setIsBuffering(false);
      setIsPlaying(false);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadstart", onLoadStart);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("error", onError);
    video.addEventListener(REEL_DEACTIVATE_EVENT, onDeactivate);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadstart", onLoadStart);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("error", onError);
      video.removeEventListener(REEL_DEACTIVATE_EVENT, onDeactivate);
    };
  }, [pauseVideo, progress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive && !manuallyPaused.current && !document.hidden) {
      setIsBuffering(video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
      requestPlay();
    } else {
      pauseVideo();
      setIsBuffering(false);
      setIsPlaying(false);
    }
    return pauseVideo;
  }, [isActive, pauseVideo, requestPlay]);

  useEffect(() => {
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) pauseVideo();
      else if (isActive && !manuallyPaused.current) requestPlay();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isActive, pauseVideo, requestPlay]);
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      manuallyPaused.current = false;
      setIsBuffering(video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
      requestPlay();
    } else {
      manuallyPaused.current = true;
      pauseVideo();
    }
  }, [pauseVideo, requestPlay]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const muted = !video.muted;
    video.muted = muted;
    setIsMuted(muted);
    setMutePreferenceError(!writeReelMutedPreference(muted));
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
    setIsPlaying(false);
    setIsBuffering(true);
    video.load();
    if (isActive && !manuallyPaused.current) requestPlay();
  }, [isActive, requestPlay]);

  return {
    videoRef,
    progress,
    isPlaying,
    isMuted,
    mutePreferenceError,
    isBuffering,
    hasMediaError,
    togglePlay,
    toggleMute,
    seekTo,
    retry,
  };
}
