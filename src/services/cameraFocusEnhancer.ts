/**
 * Web Camera Focus & Resolution Enhancer for KEA-Verify
 *
 * Solves blurry camera feed issues on mobile phone browsers:
 * 1. Overrides low-res 640x480 default with Full HD / HD resolution (1080p / 720p).
 * 2. Enforces rear-facing camera ('environment') with continuous autofocus ('continuous').
 * 3. Supports Tap-to-Focus with visual focus ring and hardware actuator pulse.
 * 4. Supports hardware digital/optical zoom (1x / 1.5x / 2x) so invigilators can hold
 *    the phone 20-30 cm away at the lens sweet spot instead of the blurry macro blindspot.
 * 5. Periodically triggers focus keepalive so the lens never stays locked out of focus.
 */

import { Platform } from 'react-native';
import { useEffect, useRef, useState, useCallback } from 'react';

let isInterceptorInstalled = false;
let activeVideoTrack: any = null;
let activeCapabilities: any = null;

/**
 * Installs a global interceptor on navigator.mediaDevices.getUserMedia
 * so that when expo-camera (or any scanner) requests a camera stream,
 * it automatically gets 1080p/720p crisp resolution and continuous autofocus.
 */
export function initCameraFocusEnhancer() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof navigator === 'undefined') {
    return;
  }

  if (isInterceptorInstalled) return;
  isInterceptorInstalled = true;

  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices || !mediaDevices.getUserMedia) return;

  const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);

  mediaDevices.getUserMedia = async function (constraints?: MediaStreamConstraints): Promise<MediaStream> {
    if (!constraints || !constraints.video) {
      return originalGetUserMedia(constraints);
    }

    const baseVideo = typeof constraints.video === 'object' ? constraints.video : {};

    // 1st tier: High-definition 1080p + continuous autofocus
    const fullHdConstraints: MediaStreamConstraints = {
      ...constraints,
      video: {
        ...baseVideo,
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        advanced: [
          { focusMode: 'continuous' },
          { exposureMode: 'continuous' },
          { whiteBalanceMode: 'continuous' },
        ],
      } as any,
    };

    // 2nd tier: 720p fallback if 1080p rejected by hardware
    const hdConstraints: MediaStreamConstraints = {
      ...constraints,
      video: {
        ...baseVideo,
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        advanced: [{ focusMode: 'continuous' }],
      } as any,
    };

    let stream: MediaStream;
    try {
      stream = await originalGetUserMedia(fullHdConstraints);
    } catch {
      try {
        stream = await originalGetUserMedia(hdConstraints);
      } catch {
        stream = await originalGetUserMedia(constraints);
      }
    }

    // Capture and configure track
    try {
      const tracks = stream.getVideoTracks();
      if (tracks.length > 0) {
        const track = tracks[0];
        activeVideoTrack = track;
        applyOptimalTrackConstraints(track);
      }
    } catch (e) {
      console.warn('[CameraFocus] Track configuration notice:', e);
    }

    return stream;
  };
}

/**
 * Apply continuous focus and check capabilities on an active track
 */
async function applyOptimalTrackConstraints(track: any) {
  if (!track || typeof track.getCapabilities !== 'function') return;

  try {
    const caps = track.getCapabilities();
    activeCapabilities = caps;

    const advancedRules: any = {};
    if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
      advancedRules.focusMode = 'continuous';
    }
    if (caps.exposureMode && Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
      advancedRules.exposureMode = 'continuous';
    }

    if (Object.keys(advancedRules).length > 0 && typeof track.applyConstraints === 'function') {
      await track.applyConstraints({ advanced: [advancedRules] });
    }
  } catch (err) {
    console.warn('[CameraFocus] applyOptimalTrackConstraints warning:', err);
  }
}

/**
 * Force the camera lens actuator to refocus immediately (Tap-to-Focus).
 * Cycles focus mode or applies single-shot then continuous to force recalculation.
 */
export async function triggerHardwareRefocus(): Promise<boolean> {
  const track = getActiveVideoTrack();
  if (!track || typeof track.applyConstraints !== 'function') return false;

  try {
    const caps = track.getCapabilities ? track.getCapabilities() : activeCapabilities;
    if (caps && caps.focusMode && Array.isArray(caps.focusMode)) {
      if (caps.focusMode.includes('single-shot')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
        setTimeout(async () => {
          try {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          } catch {}
        }, 400);
        return true;
      } else if (caps.focusMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        return true;
      }
    }
  } catch (err) {
    console.warn('[CameraFocus] triggerHardwareRefocus notice:', err);
  }
  return false;
}

/**
 * Sets optical / digital zoom on the rear camera (e.g. 1.0, 1.5, 2.0).
 */
export async function setHardwareZoom(zoomLevel: number): Promise<boolean> {
  const track = getActiveVideoTrack();
  if (!track || typeof track.applyConstraints !== 'function') return false;

  try {
    const caps = track.getCapabilities ? track.getCapabilities() : activeCapabilities;
    if (caps && caps.zoom) {
      const min = caps.zoom.min ?? 1;
      const max = caps.zoom.max ?? 5;
      const clamped = Math.max(min, Math.min(max, zoomLevel));
      await track.applyConstraints({ advanced: [{ zoom: clamped }] });
      return true;
    }
  } catch (err) {
    console.warn('[CameraFocus] setHardwareZoom notice:', err);
  }
  return false;
}

/**
 * Returns the currently active video track from global state or from the DOM video element.
 */
export function getActiveVideoTrack(): any {
  if (activeVideoTrack && activeVideoTrack.readyState === 'live') {
    return activeVideoTrack;
  }

  if (typeof document !== 'undefined') {
    const video = document.querySelector('video') as HTMLVideoElement | null;
    if (video && video.srcObject instanceof MediaStream) {
      const tracks = video.srcObject.getVideoTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') {
        activeVideoTrack = tracks[0];
        return activeVideoTrack;
      }
    }
  }
  return null;
}

/**
 * React hook to manage camera focus, zoom, and tap-to-focus animations
 */
export function useCameraFocus() {
  const [zoom, setZoomState] = useState<number>(1.0);
  const [supportsZoom, setSupportsZoom] = useState<boolean>(false);
  const [maxZoom, setMaxZoom] = useState<number>(3.0);
  const [focusing, setFocusing] = useState<boolean>(false);
  const [focusTarget, setFocusTarget] = useState<{ x: number; y: number } | null>(null);
  const focusTimeoutRef = useRef<any>(null);

  // Initialize enhancer and check track capabilities
  useEffect(() => {
    initCameraFocusEnhancer();

    const checkTrack = () => {
      const track = getActiveVideoTrack();
      if (track && typeof track.getCapabilities === 'function') {
        const caps = track.getCapabilities();
        if (caps.zoom) {
          setSupportsZoom(true);
          setMaxZoom(caps.zoom.max ?? 3.0);
        }
        applyOptimalTrackConstraints(track);
      }
    };

    checkTrack();
    const interval = setInterval(checkTrack, 1500);

    return () => clearInterval(interval);
  }, []);

  const triggerFocus = useCallback(async (coords?: { x: number; y: number }) => {
    if (coords) {
      setFocusTarget(coords);
    }
    setFocusing(true);

    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }

    await triggerHardwareRefocus();

    focusTimeoutRef.current = setTimeout(() => {
      setFocusing(false);
      setFocusTarget(null);
    }, 1200);
  }, []);

  const changeZoom = useCallback(async (newZoom: number) => {
    setZoomState(newZoom);
    await setHardwareZoom(newZoom);
  }, []);

  return {
    zoom,
    changeZoom,
    supportsZoom,
    maxZoom,
    focusing,
    focusTarget,
    triggerFocus,
  };
}
