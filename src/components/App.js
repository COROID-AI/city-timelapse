import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { GridHelper } from 'three';
import { TablewareLighting } from './TablewareLighting';
import { Patrons } from './Patrons';
import { CafeShell } from './CafeShell';
import { SfxMixer } from '../audio/mixer';
import { AtmosphereSystem } from '../systems/AtmosphereSystem';
import { useEraTransition } from '../systems/TransitionManager';
import { useEraStore } from '../store/eraStore';
import { TimelineSlider } from './TimelineSlider';
import { Stats } from '@react-three/drei';
export const App = () => {
    const [muted, setMuted] = useState(SfxMixer.isMuted());
    const currentEra = useEraStore(s => s.currentEra);
    const currentEraRef = useRef(currentEra);
    useEffect(() => {
        currentEraRef.current = currentEra;
    }, [currentEra]);
    // Consume TransitionManager so visual transitions animate
    // over the same ~1.5s window as audio crossfade.
    const { ambientLightColor } = useEraTransition();
    useEffect(() => {
        // Document body overflow hidden to prevent scrollbars
        document.body.style.overflow = 'hidden';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        return () => {
            document.body.style.overflow = '';
            document.body.style.margin = '';
            document.body.style.padding = '';
        };
    }, []);
    // Unlock audio context on first user gesture (autoplay policy)
    useEffect(() => {
        let didUnlock = false;
        const onFirstGesture = async () => {
            if (didUnlock)
                return;
            didUnlock = true;
            // Idempotent: safe to call multiple times.
            const startedFromPending = await SfxMixer.unlock();
            // If no era was queued before unlock, start current era now.
            if (!startedFromPending) {
                SfxMixer.setEra(currentEraRef.current, 1500);
            }
            document.removeEventListener('pointerdown', onFirstGesture, true);
        };
        document.addEventListener('pointerdown', onFirstGesture, { capture: true });
        return () => {
            document.removeEventListener('pointerdown', onFirstGesture, true);
        };
    }, []);
    // Keep UI in sync with mute state
    useEffect(() => {
        return SfxMixer.subscribeMute(setMuted);
    }, []);
    return (_jsx(_Fragment, { children: _jsxs(Canvas, { style: {
                width: '100%',
                height: '100%',
            }, children: [_jsx(OrbitControls, { enableDamping: true, dampingFactor: 0.08, minDistance: 1.5, maxDistance: 15, minPolarAngle: Math.PI / 6, maxPolarAngle: (5 * Math.PI) / 6, enablePan: false, screenSpacePanning: false }),  _jsx(AtmosphereSystem, {}), _jsx(CafeShell, {}), _jsx(TablewareLighting, {}), _jsx(Patrons, {}), _jsx(TimelineSlider, {}), _jsx(Stats, { position: "top-left", fps: true, ms: false, memory: true })] }) }));
};
