/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CustomMotionFxItem {
  id: string;
  name: string;
  type: 'animation' | 'transition' | '3d_motion' | 'cinematic';
  variant: 'original' | 'normal' | 'reverse';
  code: string;
  validatorStatus: 'passed' | 'failed';
  errorMsg?: string;
  createdAt: number;
}

import { TimelineSlot, TransitionType } from '../types/timeline';
import {
  getRandomMotionFxAnimation,
  getRandomMotionFxTransition,
  REMOTION_TRANSITION_TYPES,
  REMOTION_MOTION_FX_ANIMATION_IDS
} from './animationLibrary';

const STORAGE_KEY = 'motion_fx_studio_custom_effects_v6';
const CLEAN_BG_STORAGE_KEY = 'motion_fx_studio_clean_bg_v1';

export const DEFAULT_CUSTOM_FX_ITEMS: CustomMotionFxItem[] = [
  // 1. Remotion Slide
  {
    id: 'fx_remotion_slide_orig',
    name: 'Remotion Slide (Original: linearTiming 30f)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide()}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 25
  },
  {
    id: 'fx_remotion_slide_rev',
    name: 'Remotion Slide (Reverse)',
    type: 'transition',
    variant: 'reverse',
    code: `presentation={slide({ direction: 'from-right' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 24
  },

  // 2. Remotion Fade
  {
    id: 'fx_remotion_fade_orig',
    name: 'Remotion Fade (Original: linearTiming 30f)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 23
  },

  // 3. Remotion Wipe
  {
    id: 'fx_remotion_wipe_orig',
    name: 'Remotion Wipe (Original: linearTiming 30f)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={wipe()}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 22
  },

  // 4. Remotion Cube 3D
  {
    id: 'fx_remotion_cube_orig',
    name: 'Remotion Cube 3D (cube direction: from-left)',
    type: '3d_motion',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { cube } from "@remotion-dev/cube-presentation";

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={cube({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 21
  },

  // 5. Remotion Flip
  {
    id: 'fx_remotion_flip_orig',
    name: 'Remotion Flip (Original: linearTiming 30f)',
    type: '3d_motion',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { flip } from "@remotion/transitions/flip";

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={flip()}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 20
  },
  {
    id: 'fx_remotion_flip_rev',
    name: 'Remotion Flip (Reverse: 3D Opposite)',
    type: '3d_motion',
    variant: 'reverse',
    code: `// Remotion Flip (Reverse: 3D Horizontal Flip Opposite)
presentation={flip({ direction: 'from-right' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 19
  },

  // 6. Remotion Clock Wipe
  {
    id: 'fx_remotion_clockwipe_orig',
    name: 'Remotion Clock Wipe (Original: linearTiming 30f)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { useVideoConfig } from "remotion";

const BasicTransition = () => {
  const { width, height } = useVideoConfig();
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={clockWipe({ width, height })}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 18
  },
  {
    id: 'fx_remotion_clockwipe_rev',
    name: 'Remotion Clock Wipe (Reverse: Counter-Clockwise)',
    type: 'transition',
    variant: 'reverse',
    code: `// Remotion Clock Wipe (Reverse: Counter-Clockwise Sweep)
presentation={clockWipe({ width, height, direction: 'counter-clockwise' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 17
  },

  // 7. Remotion Iris
  {
    id: 'fx_remotion_iris_orig',
    name: 'Remotion Iris (Original: linearTiming 30f)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { iris } from '@remotion/transitions/iris';
import { useVideoConfig } from 'remotion';

const BasicTransition = () => {
  const { width, height } = useVideoConfig();
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={iris({ width, height })}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 16
  },
  {
    id: 'fx_remotion_iris_rev',
    name: 'Remotion Iris (Reverse: Closing Iris)',
    type: 'transition',
    variant: 'reverse',
    code: `// Remotion Iris (Reverse: Center Aperture Inward Close)
presentation={iris({ width, height, direction: 'inward' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 15
  },

  // 8. Remotion Zoom Blur
  {
    id: 'fx_remotion_zoomblur_orig',
    name: 'Remotion Zoom Blur (Original: linearTiming 30f)',
    type: 'cinematic',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { zoomBlur } from '@remotion/transitions/zoom-blur';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={zoomBlur({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 14
  },

  // 9. Remotion Dreamy Zoom
  {
    id: 'fx_remotion_dreamyzoom_orig',
    name: 'Remotion Dreamy Zoom (rotation: 6, scale: 1.2)',
    type: 'cinematic',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { dreamyZoom } from '@remotion/transitions/dreamy-zoom';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={dreamyZoom({ rotation: 6, scale: 1.2 })}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 12
  },

  // 10. Remotion Film Burn
  {
    id: 'fx_remotion_filmburn_orig',
    name: 'Remotion Film Burn (seed: 2.31)',
    type: 'cinematic',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { filmBurn } from '@remotion/transitions/film-burn';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={filmBurn({ seed: 2.31 })}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 10
  },

  // 11. Remotion Linear Blur
  {
    id: 'fx_remotion_linearblur_orig',
    name: 'Remotion Linear Blur (intensity: 0.1)',
    type: 'cinematic',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { linearBlur } from '@remotion/transitions/linear-blur';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={linearBlur({ intensity: 0.1 })}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 9
  },

  // 12. Remotion Book Flip
  {
    id: 'fx_remotion_bookflip_orig',
    name: 'Remotion Book Flip',
    type: '3d_motion',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { bookFlip } from '@remotion/transitions/book-flip';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={bookFlip({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 8
  },

  // 13. Remotion Zoom In-Out
  {
    id: 'fx_remotion_zoominout_orig',
    name: 'Remotion Zoom In-Out',
    type: 'cinematic',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { zoomInOut } from '@remotion/transitions/zoom-in-out';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={zoomInOut({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 7
  },

  // 14. Remotion Dissolve
  {
    id: 'fx_remotion_dissolve_orig',
    name: 'Remotion Dissolve',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { dissolve } from '@remotion/transitions/dissolve';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={dissolve({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 6
  },

  // 15. Remotion Ripple
  {
    id: 'fx_remotion_ripple_orig',
    name: 'Remotion Ripple',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { ripple } from '@remotion/transitions/ripple';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={ripple({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 5
  },

  // 16. Remotion Crosswarp
  {
    id: 'fx_remotion_crosswarp_orig',
    name: 'Remotion Crosswarp',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { crosswarp } from '@remotion/transitions/crosswarp';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={crosswarp({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 4
  },

  // 17. Remotion Cross Zoom
  {
    id: 'fx_remotion_crosszoom_orig',
    name: 'Remotion Cross Zoom (strength: 0.4)',
    type: 'cinematic',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { crossZoom } from '@remotion/transitions/cross-zoom';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={crossZoom({ strength: 0.4 })}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 3
  },

  // 18. Remotion Swap
  {
    id: 'fx_remotion_swap_orig',
    name: 'Remotion Swap',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { swap } from '@remotion/transitions/swap';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={swap({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 2
  },

  // 19. Remotion Blur Slide
  {
    id: 'fx_remotion_blurslide_orig',
    name: 'Remotion Blur Slide (direction: from-left)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { blurSlide } from '@remotion/transitions/blur-slide';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={blurSlide({ direction: 'from-left' })}
        timing={linearTiming({ durationInFrames: 20 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1
  },

  // 7. Remotion Linear Blur
  {
    id: 'fx_remotion_linearblur_orig',
    name: 'Remotion Linear Blur (intensity: 0.1)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { linearBlur } from '@remotion/transitions/linear-blur';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={linearBlur({ intensity: 0.1 })}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 8
  },
  {
    id: 'fx_remotion_linearblur_rev',
    name: 'Remotion Linear Blur (Reverse: Right to Left)',
    type: 'transition',
    variant: 'reverse',
    code: `// Remotion Linear Blur Reverse
presentation={linearBlur({ intensity: 0.1, direction: 'from-right' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 7
  },

  // 8. Remotion Book Flip
  {
    id: 'fx_remotion_bookflip_orig',
    name: 'Remotion Book Flip (Original: linearTiming 30f)',
    type: '3d_motion',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { bookFlip } from '@remotion/transitions/book-flip';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={bookFlip({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 6
  },
  {
    id: 'fx_remotion_bookflip_rev',
    name: 'Remotion Book Flip (Reverse: Left to Right Turn)',
    type: '3d_motion',
    variant: 'reverse',
    code: `// Remotion Book Flip (Reverse page turn direction)
presentation={bookFlip({ direction: 'from-left' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 5.5
  },

  // 9. Remotion Zoom In-Out
  {
    id: 'fx_remotion_zoominout_orig',
    name: 'Remotion Zoom In-Out (Original: linearTiming 30f)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { zoomInOut } from '@remotion/transitions/zoom-in-out';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={zoomInOut({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 5
  },
  {
    id: 'fx_remotion_zoominout_rev',
    name: 'Remotion Zoom In-Out (Reverse)',
    type: 'transition',
    variant: 'reverse',
    code: `// Remotion Zoom Out-In (Reverse)
presentation={zoomInOut({ mode: 'out-in' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 4.5
  },

  // 10. Remotion Dissolve
  {
    id: 'fx_remotion_dissolve_orig',
    name: 'Remotion Dissolve (Original: linearTiming 30f)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { dissolve } from '@remotion/transitions/dissolve';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={dissolve({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 4
  },
  {
    id: 'fx_remotion_dissolve_rev',
    name: 'Remotion Dissolve (Reverse: Smooth Dip)',
    type: 'transition',
    variant: 'reverse',
    code: `// Remotion Dissolve (Reverse)
presentation={dissolve({ dipColor: '#ffffff' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 3.5
  },

  // 11. Remotion Ripple
  {
    id: 'fx_remotion_ripple_orig',
    name: 'Remotion Ripple (Original: linearTiming 30f)',
    type: 'cinematic',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { ripple } from '@remotion/transitions/ripple';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={ripple({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 3
  },
  {
    id: 'fx_remotion_ripple_rev',
    name: 'Remotion Ripple (Reverse: Inward Wave)',
    type: 'cinematic',
    variant: 'reverse',
    code: `// Remotion Ripple (Reverse concentric implosion)
presentation={ripple({ direction: 'inward' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 2.8
  },

  // 12. Remotion Crosswarp
  {
    id: 'fx_remotion_crosswarp_orig',
    name: 'Remotion Crosswarp (Original: linearTiming 30f)',
    type: '3d_motion',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { crosswarp } from '@remotion/transitions/crosswarp';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={crosswarp({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 2.5
  },
  {
    id: 'fx_remotion_crosswarp_rev',
    name: 'Remotion Crosswarp (Reverse: Inverse Spacetime Warp)',
    type: '3d_motion',
    variant: 'reverse',
    code: `// Remotion Crosswarp Reverse
presentation={crosswarp({ direction: 'counter-clockwise' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 2.3
  },

  // 13. Remotion Cross Zoom
  {
    id: 'fx_remotion_crosszoom_orig',
    name: 'Remotion Cross Zoom (strength: 0.4)',
    type: 'cinematic',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { crossZoom } from '@remotion/transitions/cross-zoom';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={crossZoom({ strength: 0.4 })}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 2.1
  },
  {
    id: 'fx_remotion_crosszoom_rev',
    name: 'Remotion Cross Zoom (Reverse: Dynamic Outward Rush)',
    type: 'cinematic',
    variant: 'reverse',
    code: `// Remotion Cross Zoom Reverse (strength: 0.4)
presentation={crossZoom({ strength: 0.4, direction: 'out' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 2.0
  },

  // 14. Remotion Swap
  {
    id: 'fx_remotion_swap_orig',
    name: 'Remotion Swap (Original: linearTiming 30f)',
    type: '3d_motion',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { swap } from '@remotion/transitions/swap';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={swap({})}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.9
  },
  {
    id: 'fx_remotion_swap_rev',
    name: 'Remotion Swap (Reverse: Depth Card Swap)',
    type: '3d_motion',
    variant: 'reverse',
    code: `// Remotion Swap Reverse
presentation={swap({ direction: 'from-right' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.8
  },

  // 15. Remotion Blur Slide
  {
    id: 'fx_remotion_blurslide_orig',
    name: 'Remotion Blur Slide (direction: from-left, 20f)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { blurSlide } from '@remotion/transitions/blur-slide';

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={blurSlide({ direction: 'from-left' })}
        timing={linearTiming({ durationInFrames: 20 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.7
  },
  {
    id: 'fx_remotion_blurslide_rev',
    name: 'Remotion Blur Slide (Reverse: from-right, 20f)',
    type: 'transition',
    variant: 'reverse',
    code: `// Remotion Blur Slide Reverse (from-right)
presentation={blurSlide({ direction: 'from-right' })}
timing={linearTiming({ durationInFrames: 20 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.6
  },

  // 16. Remotion Cube 3D
  {
    id: 'fx_remotion_cube_orig',
    name: 'Remotion Cube 3D (direction: from-left, 30f)',
    type: '3d_motion',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { cube } from "@remotion-dev/cube-presentation";

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={cube({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.5
  },
  {
    id: 'fx_remotion_cube_rev',
    name: 'Remotion Cube 3D (Reverse: from-right, 30f)',
    type: '3d_motion',
    variant: 'reverse',
    code: `// Remotion Cube 3D Reverse (from-right)
presentation={cube({ direction: "from-right" })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.4
  },

  // 17. Remotion Spring Timing Custom Presentation (User specification)
  {
    id: 'fx_remotion_spring_orig',
    name: 'Remotion Spring (springTiming: 45f, damping: 200)',
    type: '3d_motion',
    variant: 'original',
    code: `import { springTiming, TransitionSeries } from "@remotion/transitions";
import { customPresentation } from "./customPresentation";
import { useVideoConfig } from "remotion";

export const MyComp: React.FC = () => {
  const {width, height} = useVideoConfig();

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={70}>
        <Letter color="orange">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={customPresentation({width, height})}
        timing={springTiming({
          durationInFrames: 45,
          config: {
            damping: 200,
          },
          durationRestThreshold: 0.0001,
        })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.35
  },
  {
    id: 'fx_remotion_spring_rev',
    name: 'Remotion Spring (Reverse: Snap In, damping: 200)',
    type: '3d_motion',
    variant: 'reverse',
    code: `// Remotion Spring Timing Reverse (damping: 200, durationInFrames: 45)
presentation={customPresentation({ width, height, direction: 'reverse' })}
timing={springTiming({
  durationInFrames: 45,
  config: { damping: 200 },
  durationRestThreshold: 0.0001,
})}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.32
  },

  // Slide, LightLeak, Fade, PushCut, Wipe
  {
    id: 'fx_remotion_slide_orig',
    name: 'Remotion Slide (Original: linearTiming 30f)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide()}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.3
  },
  {
    id: 'fx_remotion_slide_rev',
    name: 'Remotion Slide (Reverse: Left to Right)',
    type: 'transition',
    variant: 'reverse',
    code: `// Remotion Slide Reverse Direction (Left to Right)
presentation={slide({ direction: 'from-left' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.25
  },
  {
    id: 'fx_remotion_lightleak_orig',
    name: 'Remotion Light Leak (Original: Overlay 20f)',
    type: 'cinematic',
    variant: 'original',
    code: `import { LightLeak } from '@remotion/light-leaks';
import { TransitionSeries } from '@remotion/transitions';

// 20-frame warm anamorphic Light Leak overlay sweeping across transition
<TransitionSeries.Overlay durationInFrames={20}>
  <LightLeak />
</TransitionSeries.Overlay>`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.2
  },
  {
    id: 'fx_remotion_fade_orig',
    name: 'Remotion Fade (Original: linearTiming 30f)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.1
  },
  {
    id: 'fx_remotion_fade_rev',
    name: 'Remotion Fade (Reverse: Dip to White)',
    type: 'transition',
    variant: 'reverse',
    code: `// Remotion Fade Reverse (Dip through white)
presentation={fade({ dipColor: '#ffffff' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.05
  },
  {
    id: 'fx_remotion_pushcut_orig',
    name: 'Remotion Push Cut (Original: cutProgress 5/11)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { pushCut } from '@remotion/transitions/push-cut';

// Outgoing punch frames = 5, total = 11, punch-in snap cut
presentation={pushCut({ cutProgress: 5 / 11 })}
timing={linearTiming({ durationInFrames: 11 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 1.0
  },
  {
    id: 'fx_remotion_wipe_orig',
    name: 'Remotion Wipe (Original: linearTiming 30f)',
    type: 'transition',
    variant: 'original',
    code: `import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";

const BasicTransition = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={40}>
        <Letter color="#0b84f3">A</Letter>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={wipe()}
        timing={linearTiming({ durationInFrames: 30 })}
      />
      <TransitionSeries.Sequence durationInFrames={60}>
        <Letter color="pink">B</Letter>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 0.9
  },
  {
    id: 'fx_remotion_wipe_rev',
    name: 'Remotion Wipe (Reverse: Right to Left)',
    type: 'transition',
    variant: 'reverse',
    code: `// Remotion Wipe Reverse (Linear wipe reveal right-to-left)
presentation={wipe({ direction: 'from-right' })}
timing={linearTiming({ durationInFrames: 30 })}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 0.85
  },

  // CSS Keyframe Animations: Delay, Iteration, Timing-Functions, Direction & Fill-Mode
  {
    id: 'fx_css_delay_orig',
    name: 'CSS Keyframes (animation-delay: -2s, 4-corner path)',
    type: 'animation',
    variant: 'original',
    code: `/* CSS animation-delay Property: negative value start offset (-2s) */
div {
  animation-name: myAnimation;
  animation-duration: 4s;
  animation-delay: -2s;
  position: relative;
}

@keyframes myAnimation {
  0%   { background-color: red; left: 0px; top: 0px; }
  25%  { background-color: yellow; left: 200px; top: 0px; }
  50%  { background-color: blue; left: 200px; top: 200px; }
  75%  { background-color: green; left: 0px; top: 200px; }
  100% { background-color: red; left: 0px; top: 0px; }
}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 0.8
  },
  {
    id: 'fx_css_iteration_orig',
    name: 'CSS Keyframes (animation-iteration-count: 3)',
    type: 'animation',
    variant: 'original',
    code: `/* CSS animation-iteration-count Property: runs 3 cycles before stopping */
div {
  animation-name: myAnimation;
  animation-duration: 4s;
  animation-iteration-count: 3;
}

@keyframes myAnimation {
  0%   { background-color: red; left: 0px; top: 0px; }
  25%  { background-color: yellow; left: 200px; top: 0px; }
  50%  { background-color: blue; left: 200px; top: 200px; }
  75%  { background-color: green; left: 0px; top: 200px; }
  100% { background-color: red; left: 0px; top: 0px; }
}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 0.7
  },
  {
    id: 'fx_css_timing_curves',
    name: 'CSS Keyframes (animation-timing-function: speed curves)',
    type: 'animation',
    variant: 'original',
    code: `/* CSS animation-timing-function: linear, ease, ease-in, ease-out, ease-in-out */
#div1 { animation-timing-function: linear; }
#div2 { animation-timing-function: ease; }
#div3 { animation-timing-function: ease-in; }
#div4 { animation-timing-function: ease-out; }
#div5 { animation-timing-function: ease-in-out; }

div {
  animation-name: myAnimation;
  animation-duration: 5s;
  animation-fill-mode: forwards;
}

@keyframes myAnimation {
  from { left: 0px; }
  to { left: 300px; }
}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 0.6
  },
  {
    id: 'fx_css_direction_reverse',
    name: 'CSS Keyframes (animation-direction: reverse)',
    type: 'animation',
    variant: 'reverse',
    code: `/* CSS animation-direction Property: reverse backwards motion */
div {
  animation-name: myAnimation;
  animation-duration: 4s;
  animation-direction: reverse;
}

@keyframes myAnimation {
  0%   { background-color: red; left: 0px; top: 0px; }
  25%  { background-color: yellow; left: 200px; top: 0px; }
  50%  { background-color: blue; left: 200px; top: 200px; }
  75%  { background-color: green; left: 0px; top: 200px; }
  100% { background-color: red; left: 0px; top: 0px; }
}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 0.5
  },
  {
    id: 'fx_css_fillmode_forwards',
    name: 'CSS Keyframes (animation-fill-mode: forwards)',
    type: 'animation',
    variant: 'original',
    code: `/* CSS animation-fill-mode Property: retain final keyframe styles */
div {
  animation-name: myAnimation;
  animation-duration: 3s;
  animation-fill-mode: forwards;
}

@keyframes myAnimation {
  from { top: 0px; }
  to { top: 200px; background-color: blue; }
}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 0.4
  },
  {
    id: 'fx_css_direction_alternate',
    name: 'CSS Keyframes (animation-direction: alternate)',
    type: 'animation',
    variant: 'original',
    code: `/* CSS animation-direction: alternate (back and forth motion) */
div {
  animation-name: myAnimation;
  animation-duration: 4s;
  animation-iteration-count: 3;
  animation-direction: alternate;
}

@keyframes myAnimation {
  0%   { background-color: red; left: 0px; top: 0px; }
  25%  { background-color: yellow; left: 200px; top: 0px; }
  50%  { background-color: blue; left: 200px; top: 200px; }
  75%  { background-color: green; left: 0px; top: 200px; }
  100% { background-color: red; left: 0px; top: 0px; }
}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 0.35
  },
  {
    id: 'fx_css_direction_alt_rev',
    name: 'CSS Keyframes (animation-direction: alternate-reverse)',
    type: 'animation',
    variant: 'reverse',
    code: `/* CSS animation-direction: alternate-reverse (backward start alternating) */
div {
  animation-name: myAnimation;
  animation-duration: 4s;
  animation-iteration-count: 3;
  animation-direction: alternate-reverse;
}

@keyframes myAnimation {
  0%   { background-color: red; left: 0px; top: 0px; }
  25%  { background-color: yellow; left: 200px; top: 0px; }
  50%  { background-color: blue; left: 200px; top: 200px; }
  75%  { background-color: green; left: 0px; top: 200px; }
  100% { background-color: red; left: 0px; top: 0px; }
}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 0.3
  },
  {
    id: 'fx_css_fillmode_both',
    name: 'CSS Keyframes (animation-fill-mode: both)',
    type: 'animation',
    variant: 'original',
    code: `/* CSS animation-fill-mode: both (extend styles in both directions) */
div {
  animation-name: myAnimation;
  animation-duration: 3s;
  animation-delay: 2s;
  animation-fill-mode: both;
}

@keyframes myAnimation {
  from { top: 0px; background-color: yellow; }
  to { top: 200px; background-color: blue; }
}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 0.25
  },
  {
    id: 'fx_css_shorthand',
    name: 'CSS Animation Shorthand (5s linear 2s infinite alternate)',
    type: 'animation',
    variant: 'original',
    code: `/* CSS animation Shorthand Property: name duration timing-function delay count direction */
div {
  animation: myAnimation 5s linear 2s infinite alternate;
}

@keyframes myAnimation {
  0%   { background-color: red; left: 0px; top: 0px; }
  25%  { background-color: yellow; left: 200px; top: 0px; }
  50%  { background-color: blue; left: 200px; top: 200px; }
  75%  { background-color: green; left: 0px; top: 200px; }
  100% { background-color: red; left: 0px; top: 0px; }
}`,
    validatorStatus: 'passed',
    createdAt: Date.now() - 3600000 * 0.2
  }
];

export class MotionFxStudioService {
  public static getSavedEffects(): CustomMotionFxItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Strictly deduplicate existing saved items by id and name
          const seenIds = new Set<string>();
          const seenNames = new Set<string>();
          const deduped: CustomMotionFxItem[] = [];

          for (const item of parsed) {
            if (item && item.id && !seenIds.has(item.id)) {
              const normName = (item.name || '').toLowerCase().trim();
              if (!seenNames.has(normName) || normName === '') {
                seenIds.add(item.id);
                if (normName) seenNames.add(normName);
                deduped.push(item);
              }
            }
          }

          // Add only elements that are NOT already added ("যেগুলো আগে থেকেই যুক্ত করা আছে সেগুলো যুক্ত হবে না যেগুলো আগে থেকে নেই সেগুলোকে যুক্ত করে দাও")
          let hasAddedNew = false;
          for (const def of DEFAULT_CUSTOM_FX_ITEMS) {
            const normDefName = def.name.toLowerCase().trim();
            if (!seenIds.has(def.id) && !seenNames.has(normDefName)) {
              seenIds.add(def.id);
              seenNames.add(normDefName);
              deduped.push(def);
              hasAddedNew = true;
            }
          }

          if (hasAddedNew || deduped.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
          }
          return deduped;
        }
      }
    } catch (_) {}
    return DEFAULT_CUSTOM_FX_ITEMS;
  }

  public static resetToDefaultCatalog(): CustomMotionFxItem[] {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CUSTOM_FX_ITEMS));
    } catch (_) {}
    return DEFAULT_CUSTOM_FX_ITEMS;
  }

  public static saveEffects(items: CustomMotionFxItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (_) {}
  }

  public static isCleanBackgroundEnabled(): boolean {
    try {
      const val = localStorage.getItem(CLEAN_BG_STORAGE_KEY);
      return val === 'true';
    } catch (_) {}
    return true; // Default true as requested ("শুধু পিকচার থাকবে পুরো স্ক্রিনটা জোরে")
  }

  public static setCleanBackgroundEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(CLEAN_BG_STORAGE_KEY, String(enabled));
    } catch (_) {}
  }

  public static addEffect(item: Omit<CustomMotionFxItem, 'id' | 'createdAt' | 'validatorStatus'>): CustomMotionFxItem[] {
    const items = this.getSavedEffects();
    
    let status: 'passed' | 'failed' = 'passed';
    let errMessage = '';

    try {
      const trimmed = item.code.trim();
      if (!trimmed.includes('function') && !trimmed.includes('=>') && !trimmed.includes('ctx')) {
        throw new Error('Code must contain valid JavaScript function or arrow function.');
      }
      const evaluated = new Function(`return ${item.code}`)();
      if (typeof evaluated !== 'function') {
        throw new Error('Code does not evaluate to a valid executable function.');
      }
    } catch (err: any) {
      status = 'failed';
      errMessage = err.message || 'Syntax or validation error.';
    }

    const baseId = `custom_fx_${Date.now()}`;
    const newItem: CustomMotionFxItem = {
      id: `${baseId}_${item.variant}`,
      name: `${item.name} (${item.variant.toUpperCase()})`,
      type: item.type || 'animation',
      variant: item.variant || 'original',
      code: item.code,
      validatorStatus: status,
      errorMsg: errMessage,
      createdAt: Date.now()
    };

    items.push(newItem);

    // Automatically generate Reverse version if variant is original and animation/transition
    if (item.variant === 'original' && status === 'passed') {
      const reverseCode = item.code.replace('progress', '(1.0 - progress)');
      const reverseItem: CustomMotionFxItem = {
        id: `${baseId}_reverse`,
        name: `${item.name} (REVERSE)`,
        type: item.type,
        variant: 'reverse',
        code: reverseCode,
        validatorStatus: 'passed',
        createdAt: Date.now() + 1
      };
      items.push(reverseItem);
    }

    this.saveEffects(items);
    return items;
  }

  public static deleteEffect(id: string): CustomMotionFxItem[] {
    const items = this.getSavedEffects().filter(i => i.id !== id);
    this.saveEffects(items);
    return items;
  }

  /**
   * 1-Click apply Remotion Motion FX Studio effects to all timeline slots
   * Assigns Remotion Transitions and Motion FX Animations in Original, Normal, and Reverse variants
   */
  public static applyMotionFxToSlots(slots: TimelineSlot[]): TimelineSlot[] {
    if (!slots || slots.length === 0) return [];
    const isCleanBg = this.isCleanBackgroundEnabled();

    let lastAnimId = '';
    let lastTrans: TransitionType = 'remotion_slide';

    return slots.map((slot, idx) => {
      const anim = getRandomMotionFxAnimation(lastAnimId);
      lastAnimId = anim.id;

      let trans = getRandomMotionFxTransition(lastTrans);
      lastTrans = trans;

      return {
        ...slot,
        animationId: anim.id,
        transitionType: idx === slots.length - 1 ? slot.transitionType : trans,
        transitionDuration: trans.includes('pushcut') ? 0.45 : 0.65,
        frameStyle: isCleanBg ? 'classic_modern' : slot.frameStyle,
        frameColor: isCleanBg ? 'transparent' : slot.frameColor,
        frameAccentColor: isCleanBg ? 'transparent' : slot.frameAccentColor
      };
    });
  }
}
