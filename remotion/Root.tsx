/**
 * Remotion Root Component
 *
 * This is the entry point for all Remotion compositions.
 * Compositions are registered here and can be previewed or rendered.
 */

import { Composition } from "remotion";
import { DynamicComposition, type DynamicCompositionProps } from "./DynamicComposition";

/**
 * Default composition settings
 */
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_FPS = 30;
const DEFAULT_DURATION = 300; // 10 seconds in frames

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Dynamic composition that renders from IR */}
      <Composition
        id="DynamicComposition"
        component={DynamicComposition}
        durationInFrames={DEFAULT_DURATION}
        fps={DEFAULT_FPS}
        width={DEFAULT_WIDTH}
        height={DEFAULT_HEIGHT}
        defaultProps={{
          compositionIR: null,
        }}
      />
    </>
  );
};
