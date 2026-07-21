import { Environment } from './Environment';
import { Ground } from './Ground';
import { Buildings } from './Buildings';
import { Vehicles } from './Vehicles';
import { Pedestrians } from './Pedestrians';
import { StreetProps } from './StreetProps';
import { SceneDriver } from './SceneDriver';
import { AudioDriver } from './AudioDriver';
import { PostFX } from './PostFX';

// ---------------------------------------------------------------------------
// Scene — assembles every 3D element into one coherent city block. The
// SceneDriver advances eraFloat; AudioDriver morphs the soundscape; all
// visible components read eraFloat per-frame and update in place.
// ---------------------------------------------------------------------------

export function Scene() {
  return (
    <>
      <SceneDriver />
      <AudioDriver />
      <Environment />
      <Ground />
      <Buildings />
      <Vehicles />
      <Pedestrians />
      <StreetProps />
      <PostFX />
    </>
  );
}
