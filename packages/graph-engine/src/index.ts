/* Public API for @atlas/graph-engine.
 *
 * Consumers wire up:
 *   <Canvas orthographic flat>
 *     <GraphScene positions={layout.positions} cameraRefCallback={…} />
 *   </Canvas>
 *   <FocusOverlay positionsRef={…} cameraRef={…}>{(id) => …}</FocusOverlay>
 *
 * Plus useLayout() + the graph store to drive it.
 */

export { GraphScene } from './scene/GraphScene';
export { FocusOverlay } from './overlay/FocusOverlay';
export { SpatialCamera, getCameraTargets } from './camera/SpatialCamera';
export { useCameraControls, flyTo } from './camera/useCameraControls';
export { useLayout, type LayoutHandle } from './layout/useLayout';
export { DEFAULT_FORCE_CONFIG, type ForceConfig } from './layout/workerProtocol';
export { graphStore, useGraph, readGraph } from './store/graphStore';
export { projectToScreen } from './overlay/projectToScreen';
export type { RenderNode, RenderEdge, GraphInput, CameraState } from './types';
