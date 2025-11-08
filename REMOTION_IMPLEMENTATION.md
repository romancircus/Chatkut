# Remotion Implementation Guide

**Created:** 2025-11-08
**Source:** Context7 `/remotion-dev/remotion`
**Purpose:** Complete reference for Remotion video rendering implementation

---

## Core Concepts

### Composition Registration

```tsx
import { Composition } from "remotion";
import { HelloWorld, myCompSchema } from "./HelloWorld";
import { registerRoot } from "remotion";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={myCompSchema}
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
```

**Key Props:**
- `id`: Unique composition identifier
- `component`: React component to render
- `durationInFrames`: Total video length in frames
- `fps`: Frame rate (30 recommended)
- `width/height`: Video dimensions
- `schema`: Zod schema for prop validation
- `defaultProps`: Default values for component props

---

## Animation Patterns

### Frame-Based Animation

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const MyComponent: React.FC = () => {
  const frame = useCurrentFrame(); // Current frame number
  const { fps, durationInFrames } = useVideoConfig();

  // Linear interpolation
  const opacity = interpolate(
    frame,
    [0, 30],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Spring animation (after 25 frames)
  const scale = spring({
    frame: frame - 25,
    fps,
    config: { damping: 100 },
  });

  // Fade out at end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 25, durationInFrames - 15],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div style={{
      opacity: opacity * fadeOut,
      transform: `scale(${scale})`
    }}>
      Content
    </div>
  );
};
```

**Animation Helpers:**
- `useCurrentFrame()`: Get current frame number (relative to sequence)
- `interpolate()`: Map frame ranges to value ranges
- `spring()`: Physics-based spring animation
- `useVideoConfig()`: Get composition metadata (fps, duration, dimensions)

---

## Sequencing & Timing

### Basic Sequences

```tsx
import { Sequence } from 'remotion';

export const MultiScene = () => {
  return (
    <>
      {/* Start at frame 30, last 60 frames */}
      <Sequence from={30} durationInFrames={60}>
        <Scene1 />
      </Sequence>

      {/* Overlapping sequences */}
      <Sequence from={60} durationInFrames={90}>
        <Scene2 />
      </Sequence>

      {/* Nested sequences for complex timing */}
      <Sequence from={180}>
        <Sequence from={10} durationInFrames={40}>
          <FadeIn>
            <Scene4 />
          </FadeIn>
        </Sequence>
      </Sequence>
    </>
  );
};
```

### Automatic Sequencing with Series

```tsx
import { Series } from 'remotion';

export const SeriesExample = () => {
  return (
    <Series>
      {/* Each plays after the previous */}
      <Series.Sequence durationInFrames={50}>
        <Scene1 />
      </Series.Sequence>

      <Series.Sequence durationInFrames={75}>
        <Scene2 />
      </Series.Sequence>

      {/* Offset: starts 8 frames before previous ends */}
      <Series.Sequence durationInFrames={60} offset={-8}>
        <Scene3 />
      </Series.Sequence>
    </Series>
  );
};
```

**Key Differences:**
- `Sequence`: Manual timing with `from` prop
- `Series.Sequence`: Automatic sequential timing with optional `offset`

---

## Media Components

### Video

```tsx
import { Video, OffthreadVideo, staticFile } from 'remotion';

// Standard video (uses main thread)
<Video
  src={staticFile('video.mp4')}
  volume={0.5}
  playbackRate={2} // 2x speed
  muted={false}
  trimBefore={60} // Remove first 60 frames
  trimAfter={120} // Remove frames after 120
  audioStreamIndex={1} // Select audio track (multi-language)
  style={{ width: 1280, height: 720 }}
/>

// Offthread video (better performance, rendering only)
<OffthreadVideo
  src={staticFile('video.mp4')}
  volume={(frame) => interpolate(frame, [0, 100], [0, 1])} // Dynamic volume
/>
```

**Performance:**
- `<Video>`: Use for preview in Remotion Studio
- `<OffthreadVideo>`: Use for rendering (better performance, no preview)

### Audio

```tsx
import { Audio } from 'remotion';

<Audio
  src={staticFile('audio.mp3')}
  volume={0.5} // Static volume
  volume={(frame) => interpolate(frame, [0, 100], [0, 1])} // Dynamic volume
  playbackRate={1.5}
  muted={false}
  trimBefore={30}
  trimAfter={90}
  loopVolumeCurveBehavior="repeat" // How volume behaves in loops
  name="Background Music" // Display name in timeline
/>
```

---

## Remotion Player (Browser Preview)

```tsx
import { Player } from '@remotion/player';
import { MyVideo } from './remotion/MyVideo';

export const App: React.FC = () => {
  return (
    <Player
      component={MyVideo}
      durationInFrames={120}
      compositionWidth={1920}
      compositionHeight={1080}
      fps={30}
      loop
      autoPlay
      controls
      showVolumeControls
      allowFullscreen
      clickToPlay
      doubleClickToFullscreen={false}
      spaceKeyToPlayOrPause
      moveToBeginningWhenEnded
      initialFrame={0}
      inputProps={{
        titleText: 'Hello World',
      }}
      style={{ width: 800 }}
      className="video-player"
    />
  );
};
```

**Key Props:**
- `component`: React component to render
- `lazyComponent`: Lazy-loaded component (use with `useCallback`)
- `controls`: Show seek bar and play/pause
- `loop`: Auto-restart when finished
- `autoPlay`: Start playing immediately
- `inputProps`: Props passed to component

---

## Thumbnail Component

```tsx
import { Thumbnail } from '@remotion/player';

<Thumbnail
  component={MyVideo}
  compositionWidth={600}
  compositionHeight={600}
  frameToDisplay={30} // Show frame 30
  durationInFrames={120}
  fps={30}
  inputProps={{
    title: 'Preview',
  }}
/>
```

---

## Server-Side Rendering (SSR)

### Bundle and Render

```tsx
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';

// 1. Bundle Remotion project
const bundleLocation = await bundle({
  entryPoint: path.resolve('./src/index.ts'),
  webpackOverride: (config) => config,
});

// 2. Select composition with input props
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: 'HelloWorld',
  inputProps: { titleText: 'Server Rendered' },
});

// 3. Render media
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation: `out/video.mp4`,
  inputProps: { titleText: 'Server Rendered' },
  onProgress: ({ progress, renderedFrames, totalFrames }) => {
    console.log(`${Math.round(progress * 100)}% (${renderedFrames}/${totalFrames})`);
  },
  onDownload: ({ totalSize, downloaded }) => {
    console.log(`Downloaded: ${downloaded}/${totalSize} bytes`);
  },
});
```

### Dataset Rendering (Batch)

```tsx
const data = [
  { name: 'React', repo: 'facebook/react', logo: 'https://...' },
  { name: 'Remotion', repo: 'remotion-dev/remotion', logo: 'https://...' },
];

for (const entry of data) {
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'MyComp',
    inputProps: entry,
  });

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: `out/${entry.name}.mp4`,
    inputProps: entry,
  });
}
```

---

## Remotion Lambda (AWS)

### Setup and Deployment

```bash
# Deploy Lambda function
npx remotion lambda functions deploy --memory=3009

# Create site for hosting recordings
npx remotion lambda sites create --site-name=remotion-recorder --enable-folder-expiry
```

### Render on Lambda (CLI)

```bash
# Render with props
npx remotion lambda render https://remotion-site.vercel.app HelloWorld \
  --props='{"titleText":"Hello World"}'

# Render for specific platform
npx remotion lambda render --props='{"platform": "youtube", "layout": "landscape"}' \
  remotion-recorder my-composition
```

### Render on Lambda (Node.js)

```tsx
import { renderMediaOnLambda } from '@remotion/lambda/client';

const { bucketName, renderId } = await renderMediaOnLambda({
  region: 'us-east-1',
  functionName: 'remotion-render-bds9aab',
  serveUrl: 'https://remotion-site.s3.eu-central-1.amazonaws.com/sites/bf2jrbfkw',
  composition: 'HelloWorld',
  inputProps: { titleText: 'Hello from Lambda' },
  codec: 'h264',
  imageFormat: 'jpeg',
  maxRetries: 1,
  framesPerLambda: 20,
  privacy: 'public',
});

console.log(`Render ID: ${renderId}`);
console.log(`Bucket: ${bucketName}`);
```

### Check Render Progress

```tsx
import { getRenderProgress } from '@remotion/lambda/client';

const progress = await getRenderProgress({
  region: 'us-east-1',
  functionName: 'remotion-render-bds9aab',
  bucketName,
  renderId,
});

console.log(`Overall progress: ${progress.overallProgress * 100}%`);
console.log(`Done: ${progress.done}`);
console.log(`Errors: ${progress.fatalErrorEncountered}`);

if (progress.done) {
  console.log(`Output file: ${progress.outputFile}`);
}
```

### Download Rendered Media

```tsx
import { downloadMedia } from '@remotion/lambda';

const { outputPath, sizeInBytes } = await downloadMedia({
  bucketName: 'remotionlambda-r42fs9fk',
  region: 'us-east-1',
  renderId: '8hfxlw',
  outPath: 'out.mp4',
  onProgress: ({ totalSize, downloaded, percent }) => {
    console.log(`Download: ${totalSize}/${downloaded} bytes (${(percent * 100).toFixed(0)}%)`);
  },
});
```

### Delete Render

```tsx
import { deleteRender } from '@remotion/lambda';

const { freedBytes } = await deleteRender({
  region: 'us-east-1',
  bucketName: 'remotionlambda-r42fs9fk',
  renderId: '8hfxlw',
});

console.log(`Freed ${freedBytes} bytes`);
```

### Cloudflare R2 Integration

```tsx
await renderMediaOnLambda({
  serveUrl: 'https://remotion-helloworld.vercel.app',
  functionName: speculateFunctionName({
    diskSizeInMb: 2048,
    memorySizeInMb: 2048,
    timeoutInSeconds: 120,
  }),
  composition: 'HelloWorld',
  region: 'eu-central-1',
  codec: 'h264',
  outName: {
    bucketName: 'remotion-test-bucket',
    key: 'out.mp4',
    s3OutputProvider: {
      endpoint: 'https://2fe488b3b0f4deee223aef7464784c46.r2.cloudflarestorage.com',
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  },
});
```

---

## Cost Estimation (Lambda)

```tsx
import { estimatePrice } from "@remotion/lambda/client";

// Before render: show estimate
const estimate = await estimatePrice({
  region: "us-east-1",
  durationInFrames: 900, // 30 seconds at 30fps
  memorySizeInMb: 2048,
  diskSizeInMb: 2048,
  lambdaEfficiencyLevel: 0.8,
});

console.log(`Estimated cost: $${estimate.estimatedCost}`);
console.log(`Estimated duration: ${estimate.estimatedDuration}ms`);

// After render: record actual cost
await recordActualCost({
  renderId,
  actualCost: estimate.actualCost,
  renderTime: estimate.renderTime
});
```

**Cost Optimization Tips:**
- Use `framesPerLambda: 20` for optimal parallelization
- Higher `memorySizeInMb` = faster but more expensive
- `lambdaEfficiencyLevel: 0.8` is realistic for complex compositions

---

## Dynamic Metadata Calculation

```tsx
import { CalculateMetadataFunction } from 'remotion';

export const calculateMetadata: CalculateMetadataFunction<{ src: string }> = async ({ props }) => {
  // Fetch video metadata dynamically
  const metadata = await getVideoMetadata(props.src);

  return {
    durationInFrames: metadata.durationInFrames,
    fps: metadata.fps,
    width: metadata.width,
    height: metadata.height,
  };
};

export const DynamicVideo: React.FC<{ src: string }> = ({ src }) => {
  return <OffthreadVideo src={src} />;
};
```

---

## Passing Props to Compositions

### CLI

```bash
# Inline JSON
npx remotion render HelloWorld out/video.mp4 --props='{"titleText": "Hello", "color": "red"}'

# JSON file
npx remotion render HelloWorld out/video.mp4 --props=./path/to/props.json
```

### SSR API

```tsx
const inputProps = { titleText: 'Hello World' };

const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: 'my-video',
  inputProps, // Pass to selectComposition
});

await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation: 'out.mp4',
  inputProps, // Pass to renderMedia
});
```

### Player

```tsx
<Player
  component={MyVideo}
  durationInFrames={120}
  compositionWidth={1920}
  compositionHeight={1080}
  fps={30}
  inputProps={{ titleText: 'Hello' }}
/>
```

---

## Critical Implementation Rules

### 1. Element Tracking with `data-element-id`

For deterministic editing, **ALWAYS** add stable IDs to elements:

```tsx
import { nanoid } from 'nanoid';

const elementId = nanoid(); // Generate stable ID

<div data-element-id={elementId} style={{ opacity }}>
  {text}
</div>
```

**Why?** Allows AST patching to target specific elements for edits.

### 2. Use `OffthreadVideo` for Rendering

```tsx
// ❌ DON'T: Use <Video> for rendering (slower)
<Video src={staticFile('video.mp4')} />

// ✅ DO: Use <OffthreadVideo> for rendering (faster)
<OffthreadVideo src={staticFile('video.mp4')} />
```

### 3. Dynamic Volume Control

```tsx
// Static volume
<Audio src={staticFile('audio.mp3')} volume={0.5} />

// Dynamic volume (fade in)
<Audio
  src={staticFile('audio.mp3')}
  volume={(frame) => interpolate(frame, [0, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })}
/>
```

### 4. Trimming vs. Duration

```tsx
// ❌ DON'T: Change durationInFrames to trim
<Sequence from={0} durationInFrames={60}>
  <Video src={staticFile('long-video.mp4')} />
</Sequence>

// ✅ DO: Use trimBefore/trimAfter
<Video
  src={staticFile('long-video.mp4')}
  trimBefore={60}  // Remove first 60 frames
  trimAfter={180}  // Remove frames after 180
/>
```

### 5. Multi-Language Audio Streams

```tsx
// Select audio track 1 (e.g., Spanish)
<Video
  src={staticFile('multilang-video.mp4')}
  audioStreamIndex={1}
/>
```

---

## Common Patterns

### Reusable Fade In Component

```tsx
const FadeIn: React.FC<{ children: React.ReactNode; duration?: number }> = ({
  children,
  duration = 30
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, duration],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  return <div style={{ opacity }}>{children}</div>;
};

// Usage
<Sequence from={35}>
  <FadeIn duration={40}>
    <Subtitle text="Powered by React" />
  </FadeIn>
</Sequence>
```

### Animated Text Scroll

```tsx
const ScrollingText: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const x = interpolate(frame, [0, 150], [width, -1000]);

  return (
    <div style={{
      position: 'absolute',
      transform: `translateX(${x}px)`,
      fontSize: 60,
      fontWeight: 'bold',
    }}>
      {text}
    </div>
  );
};
```

### Video with Dynamic Playback Speed

```tsx
<Video
  src={staticFile('video.mp4')}
  playbackRate={4} // 4x timelapse
/>

<Video
  src={staticFile('video.mp4')}
  playbackRate={0.5} // 0.5x slow motion
/>
```

---

## GitHub Actions Integration

```yaml
name: Render video
on:
  workflow_dispatch:
    inputs:
      titleText:
        description: 'Which text should it say?'
        required: true
        default: 'Welcome to Remotion'
jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main
      - uses: actions/setup-node@main
      - run: npm i
      - run: echo $WORKFLOW_INPUT > input-props.json
        env:
          WORKFLOW_INPUT: ${{ toJson(github.event.inputs) }}
      - run: npx remotion render MyComp out/video.mp4 --props="./input-props.json"
      - uses: actions/upload-artifact@v4
        with:
          name: out.mp4
          path: out/video.mp4
```

---

## Troubleshooting

### "Could not get video duration"

```tsx
// ❌ Composition without metadata
<Composition
  id="MyVideo"
  component={MyVideo}
/>

// ✅ Provide metadata or calculateMetadata
<Composition
  id="MyVideo"
  component={MyVideo}
  durationInFrames={150}
  fps={30}
  width={1920}
  height={1080}
  calculateMetadata={calculateMetadata}
/>
```

### "Cannot read property 'fps' of null"

```tsx
// ❌ useVideoConfig outside composition
const MyComponent = () => {
  const { fps } = useVideoConfig(); // Error!
  return <div>FPS: {fps}</div>;
};

// ✅ Use inside Composition component
const MyComposition = () => {
  const { fps } = useVideoConfig(); // Works!
  return <div>FPS: {fps}</div>;
};
```

### Nested Composition Error

```tsx
// ❌ DON'T nest <Composition> inside Player
<Player
  component={() => (
    <Composition
      id="test"
      component={MyVideo}
      durationInFrames={100}
      fps={30}
      width={1920}
      height={1080}
    />
  )}
/>

// ✅ Pass component directly
<Player
  component={MyVideo}
  durationInFrames={100}
  fps={30}
  compositionWidth={1920}
  compositionHeight={1080}
/>
```

---

## Performance Optimization

1. **Use OffthreadVideo for rendering:**
   - `<Video>` for preview
   - `<OffthreadVideo>` for final render

2. **Lazy load components:**
   ```tsx
   <Player
     lazyComponent={() => import('./MyVideo')}
     durationInFrames={120}
     compositionWidth={1920}
     compositionHeight={1080}
     fps={30}
   />
   ```

3. **Optimize Lambda settings:**
   - `framesPerLambda: 20` (balanced parallelization)
   - `memorySizeInMb: 2048` (good for most cases)
   - `diskSizeInMb: 2048` (sufficient for most videos)

4. **Cache bundled projects:**
   - Bundle once, render multiple times with different `inputProps`

---

## License Compliance

**Free:**
- Individuals
- Organizations with ≤3 employees

**Company License Required:**
- Organizations with 4+ employees

**Enforcement:**
```tsx
const orgSize = await getOrgSize();
if (orgSize >= 4 && !hasCompanyLicense) {
  throw new Error('Company license required. Visit https://remotion.dev/pricing');
}
```

---

## References

- [Remotion Docs](https://remotion.dev/docs)
- [Remotion Lambda](https://remotion.dev/docs/lambda)
- [Remotion Player](https://remotion.dev/docs/player)
- [Cost Estimation](https://remotion.dev/docs/lambda/pricing)
