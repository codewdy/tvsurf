import { useEffect, useLayoutEffect, useRef } from "react";
import Player from "xgplayer";
import "xgplayer/dist/index.min.css";

/** 播放器向外抛出的事件（不含业务语义） */
export type VideoPlayerEvent =
  | { type: "ready" }
  | { type: "pause"; currentTime: number }
  | { type: "timeupdate"; currentTime: number; duration: number }
  | { type: "ended" };

export type VideoPlayerProps = {
  url: string | null | undefined;
  autoplay?: boolean;
  initialTime?: number;
  onEvent?: (event: VideoPlayerEvent) => void;
};

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** xgplayer 固定配置（不在调用方重复传入） */
const PLAYER_OPTIONS = {
  volume: 0.6,
  playbackRate: PLAYBACK_RATES,
  defaultPlaybackRate: 1,
  fluid: true,
  lang: "zh-cn",
  seekedStatus: "auto" as const,
};

/**
 * 视频播放器：实例在挂载时创建一次；切换 URL 时改 src，不因 url/autoplay 重建实例。
 */
export default function VideoPlayer({
  url,
  autoplay = false,
  initialTime = 0,
  onEvent,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  const initialTimeRef = useRef(initialTime ?? 0);
  initialTimeRef.current = initialTime ?? 0;

  /** 每轮渲染与 props 对齐，保证异步回调 / canplay 中读到最新 autoplay */
  const autoplayRef = useRef(autoplay);
  autoplayRef.current = autoplay;

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  /** 挂载时创建 Player（依赖为空；仅首次渲染的 url 用于构造，自动播放见 autoplayRef） */
  useLayoutEffect(() => {
    if (!containerRef.current || !url) return;

    const player = new Player({
      el: containerRef.current,
      url,
      /* 实例只建一次；是否自动播放统一看 autoplayRef（含后续 props 变更） */
      autoplay: false,
      ...PLAYER_OPTIONS,
    });
    playerRef.current = player;

    player.on("pause", () => {
      onEventRef.current?.({
        type: "pause",
        currentTime: player.currentTime,
      });
    });

    player.on("timeupdate", () => {
      onEventRef.current?.({
        type: "timeupdate",
        currentTime: player.currentTime,
        duration: Number.isFinite(player.duration) ? player.duration : 0,
      });
    });

    player.on("ended", () => {
      onEventRef.current?.({ type: "ended" });
    });

    player.once("canplay", () => {
      const seekSeconds =
        initialTimeRef.current > 0 ? initialTimeRef.current : 0;
      if (seekSeconds > 0) {
        player.currentTime = seekSeconds;
      }
      onEventRef.current?.({ type: "ready" });
      if (autoplayRef.current) {
        void player.play();
      }
    });

    return () => {
      player.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 刻意仅在挂载时创建实例
  }, []);

  /** url 变更时换片源；url 不变且 autoplay 变为 true 时尝试播放（不销毁 Player） */
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !url) return;

    player.src = url;

    player.once("canplay", () => {
      const seekSeconds =
        initialTimeRef.current > 0 ? initialTimeRef.current : 0;
      if (seekSeconds > 0) {
        player.currentTime = seekSeconds;
      }
      onEventRef.current?.({ type: "ready" });
      if (autoplayRef.current) {
        void player.play();
      }
    });
  }, [url]);

  if (!url) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative z-0 size-full min-h-0 overflow-hidden [&_.xgplayer]:bg-black"
    />
  );
}
