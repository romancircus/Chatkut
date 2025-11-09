/**
 * HLS Video Component for Remotion Preview
 *
 * Uses hls.js to play HLS streams (.m3u8) in the browser preview.
 * Based on Remotion documentation:
 * https://www.remotion.dev/docs/miscellaneous/snippets/hls
 *
 * Note: This component is for PREVIEW ONLY.
 * For rendering, use OffthreadVideo with MP4 URLs.
 */

import Hls from 'hls.js';
import React, { useEffect, useRef } from 'react';
import { Video, RemotionVideoProps } from 'remotion';

export const HlsVideo: React.FC<RemotionVideoProps> = ({ src, ...props }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!src) {
      throw new Error('src is required for HlsVideo');
    }

    // Only use hls.js for .m3u8 URLs
    if (!src.includes('.m3u8')) {
      // If not HLS, let the Video component handle it natively
      return;
    }

    if (!Hls.isSupported()) {
      console.warn('[HlsVideo] HLS is not supported in this browser');
      return;
    }

    const hls = new Hls({
      startLevel: 4, // Start with high quality
      maxBufferLength: 5,
      maxMaxBufferLength: 5,
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hls.startLoad(0);
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      // Ignore non-fatal level switch errors (common with Cloudflare Stream)
      if (data.details === 'levelSwitchError' && !data.fatal) {
        return;
      }

      console.error('[HlsVideo] HLS error:', data);
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.error('[HlsVideo] Fatal network error, trying to recover');
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.error('[HlsVideo] Fatal media error, trying to recover');
            hls.recoverMediaError();
            break;
          default:
            console.error('[HlsVideo] Fatal error, cannot recover');
            hls.destroy();
            break;
        }
      }
    });

    hls.loadSource(src);
    hls.attachMedia(videoRef.current!);

    return () => {
      hls.destroy();
    };
  }, [src]);

  return <Video ref={videoRef} src={src} {...props} />;
};
