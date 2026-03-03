import { useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

export function useVideoSync(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const rafRef = useRef<number>(0);
  const {
    setCurrentTime,
    setDuration,
    setIsPlaying,
    deletedRanges,
  } = useEditorStore();

  const seekTo = useCallback(
    (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
    },
    [videoRef, setCurrentTime],
  );

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const t = video.currentTime;
        for (const range of deletedRanges) {
          if (t >= range.start && t < range.end) {
            video.currentTime = range.end;
            return;
          }
        }
        setCurrentTime(t);
      });
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoadedMetadata = () => setDuration(video.duration);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef, deletedRanges, setCurrentTime, setIsPlaying, setDuration]);

  return { seekTo, togglePlay };
}
