import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEraStore } from '../store/eraStore';
import { useThree } from '@react-three/fiber';
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const Hair = ({ style, color, scale }) => {
    // Base head center (relative to head group)
    const headY = 0;
    switch (style) {
        case 'hat':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0, headY + 0.19 * scale, 0], children: [_jsx("cylinderGeometry", { args: [0.14 * scale, 0.16 * scale, 0.06 * scale, 16] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.5, metalness: 0.05 })] }), _jsxs("mesh", { position: [0, headY + 0.155 * scale, 0], rotation: [0, 0, 0], children: [_jsx("cylinderGeometry", { args: [0.19 * scale, 0.2 * scale, 0.02 * scale, 24] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.6, metalness: 0.05 })] })] }));
        case 'headscarf':
            return (_jsx("group", { children: _jsxs("mesh", { position: [0, headY + 0.05 * scale, 0], rotation: [0.2, 0, 0], children: [_jsx("sphereGeometry", { args: [0.16 * scale, 14, 14] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.95 })] }) }));
        case 'short_cut':
            return (_jsx("group", { children: _jsxs("mesh", { position: [0, headY + 0.18 * scale, 0], children: [_jsx("sphereGeometry", { args: [0.1 * scale, 14, 14] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.7 })] }) }));
        case 'afro':
            return (_jsx("group", { children: _jsxs("mesh", { position: [0, headY + 0.18 * scale, 0], children: [_jsx("sphereGeometry", { args: [0.14 * scale, 16, 16] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.75 })] }) }));
        case 'beehive':
            return (_jsx("group", { children: _jsxs("mesh", { position: [0, headY + 0.18 * scale, 0], children: [_jsx("coneGeometry", { args: [0.11 * scale, 0.14 * scale, 18] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.7 })] }) }));
        case 'mullet':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0, headY + 0.19 * scale, 0.04 * scale], children: [_jsx("boxGeometry", { args: [0.18 * scale, 0.12 * scale, 0.12 * scale] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.7 })] }), _jsxs("mesh", { position: [0, headY + 0.16 * scale, -0.08 * scale], children: [_jsx("boxGeometry", { args: [0.2 * scale, 0.1 * scale, 0.24 * scale] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.7 })] })] }));
        case 'perm':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0, headY + 0.18 * scale, 0], children: [_jsx("sphereGeometry", { args: [0.14 * scale, 14, 14] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.65 })] }), [
                        { x: -0.1, z: 0.06 },
                        { x: 0.1, z: 0.06 },
                        { x: -0.09, z: -0.06 },
                        { x: 0.09, z: -0.06 },
                    ].map((p, i) => (_jsxs("mesh", { position: [p.x * scale, headY + 0.15 * scale, p.z * scale], children: [_jsx("sphereGeometry", { args: [0.06 * scale, 10, 10] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.6 })] }, i)))] }));
        case 'high_top_fade':
            return (_jsx("group", { children: _jsxs("mesh", { position: [0, headY + 0.23 * scale, 0], children: [_jsx("cylinderGeometry", { args: [0.1 * scale, 0.12 * scale, 0.16 * scale, 14] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.7 })] }) }));
        case 'spiked':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0, headY + 0.14 * scale, 0], children: [_jsx("sphereGeometry", { args: [0.08 * scale, 12, 12] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.7 })] }), [-1, -0.5, 0, 0.5, 1].map((t, i) => (_jsxs("mesh", { position: [t * 0.06 * scale, headY + 0.26 * scale, (0.02 + i * 0.01) * scale], rotation: [0, 0, 0], children: [_jsx("boxGeometry", { args: [0.03 * scale, 0.08 * scale, 0.03 * scale] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.6 })] }, i)))] }));
        case 'bob':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0, headY + 0.18 * scale, 0.02 * scale], children: [_jsx("boxGeometry", { args: [0.22 * scale, 0.1 * scale, 0.14 * scale] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.7 })] }), _jsxs("mesh", { position: [0, headY + 0.2 * scale, -0.01 * scale], children: [_jsx("sphereGeometry", { args: [0.11 * scale, 12, 12] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.75 })] })] }));
        case 'buzz':
            return (_jsx("group", { children: _jsxs("mesh", { position: [0, headY + 0.2 * scale, 0], children: [_jsx("sphereGeometry", { args: [0.095 * scale, 12, 12] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.8 })] }) }));
        case 'pony':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0, headY + 0.18 * scale, 0], children: [_jsx("sphereGeometry", { args: [0.12 * scale, 14, 14] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.7 })] }), _jsxs("mesh", { position: [0.05 * scale, headY + 0.14 * scale, -0.12 * scale], rotation: [0, 0, 0], children: [_jsx("cylinderGeometry", { args: [0.03 * scale, 0.03 * scale, 0.22 * scale, 10] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.65 })] })] }));
        case 'undercut':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0, headY + 0.12 * scale, 0], children: [_jsx("sphereGeometry", { args: [0.1 * scale, 12, 12] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.9 })] }), _jsxs("mesh", { position: [0, headY + 0.24 * scale, 0], children: [_jsx("boxGeometry", { args: [0.18 * scale, 0.06 * scale, 0.18 * scale] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.65 })] })] }));
        case 'long_woven':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0, headY + 0.2 * scale, 0], children: [_jsx("sphereGeometry", { args: [0.11 * scale, 14, 14] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.7 })] }), _jsxs("mesh", { position: [0, headY + 0.09 * scale, -0.15 * scale], children: [_jsx("boxGeometry", { args: [0.18 * scale, 0.18 * scale, 0.26 * scale] }), _jsx("meshStandardMaterial", { color: color, roughness: 0.7 })] })] }));
        default:
            return null;
    }
};
const Accessory = ({ type, secondary, accent, scale }) => {
    const s = scale;
    switch (type) {
        case 'newspaper':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0.26 * s, 0.62 * s, 0.12 * s], rotation: [0.1, 0, -0.25], children: [_jsx("boxGeometry", { args: [0.18 * s, 0.04 * s, 0.26 * s] }), _jsx("meshStandardMaterial", { color: secondary, roughness: 0.9 })] }), _jsxs("mesh", { position: [0.27 * s, 0.63 * s, 0.22 * s], children: [_jsx("boxGeometry", { args: [0.16 * s, 0.01 * s, 0.2 * s] }), _jsx("meshStandardMaterial", { color: '#ffffff', roughness: 1 })] })] }));
        case 'pipe':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0.17 * s, 0.93 * s, 0.21 * s], rotation: [0.3, 0, -0.2], children: [_jsx("cylinderGeometry", { args: [0.01 * s, 0.015 * s, 0.18 * s, 10] }), _jsx("meshStandardMaterial", { color: '#3b2b1f', roughness: 0.6 })] }), _jsxs("mesh", { position: [0.13 * s, 0.89 * s, 0.2 * s], children: [_jsx("sphereGeometry", { args: [0.03 * s, 12, 12] }), _jsx("meshStandardMaterial", { color: '#2a1f16', roughness: 0.55 })] }), _jsxs("mesh", { position: [0.12 * s, 1.0 * s, 0.26 * s], children: [_jsx("coneGeometry", { args: [0.03 * s, 0.1 * s, 8] }), _jsx("meshStandardMaterial", { color: '#d0d0d0', transparent: true, opacity: 0.7, roughness: 1 })] })] }));
        case 'vinylRecord':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [-0.22 * s, 0.57 * s, 0.12 * s], rotation: [0, 0.8, 0], children: [_jsx("torusGeometry", { args: [0.095 * s, 0.015 * s, 12, 18] }), _jsx("meshStandardMaterial", { color: '#111111', roughness: 0.35, metalness: 0.2 })] }), _jsxs("mesh", { position: [-0.22 * s, 0.57 * s, 0.12 * s], children: [_jsx("ringGeometry", { args: [0.055 * s, 0.065 * s, 20] }), _jsx("meshStandardMaterial", { color: '#444444', roughness: 0.6 })] })] }));
        case 'brickPhone':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0.25 * s, 0.58 * s, 0.13 * s], rotation: [0, 0, -0.25], children: [_jsx("boxGeometry", { args: [0.08 * s, 0.12 * s, 0.02 * s] }), _jsx("meshStandardMaterial", { color: '#202020', roughness: 0.6, metalness: 0.2 })] }), _jsxs("mesh", { position: [0.255 * s, 0.59 * s, 0.132 * s], children: [_jsx("boxGeometry", { args: [0.06 * s, 0.09 * s, 0.01 * s] }), _jsx("meshBasicMaterial", { color: '#2a7fff' })] }), _jsxs("mesh", { position: [0.285 * s, 0.67 * s, 0.14 * s], children: [_jsx("boxGeometry", { args: [0.02 * s, 0.02 * s, 0.02 * s] }), _jsx("meshStandardMaterial", { color: '#4a4a4a', roughness: 0.4 })] })] }));
        case 'walkman':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0, 1.01 * s, 0.01 * s], rotation: [0, 0, 0], children: [_jsx("cylinderGeometry", { args: [0.16 * s, 0.16 * s, 0.02 * s, 10] }), _jsx("meshStandardMaterial", { color: '#1f1f1f', roughness: 0.5 })] }), _jsxs("mesh", { position: [-0.17 * s, 1.0 * s, 0.02 * s], children: [_jsx("boxGeometry", { args: [0.04 * s, 0.05 * s, 0.02 * s] }), _jsx("meshStandardMaterial", { color: '#1f1f1f', roughness: 0.5 })] }), _jsxs("mesh", { position: [0.17 * s, 1.0 * s, 0.02 * s], children: [_jsx("boxGeometry", { args: [0.04 * s, 0.05 * s, 0.02 * s] }), _jsx("meshStandardMaterial", { color: '#1f1f1f', roughness: 0.5 })] }), _jsxs("mesh", { position: [0.0 * s, 0.34 * s, 0.16 * s], rotation: [0.15, 0, 0], children: [_jsx("boxGeometry", { args: [0.22 * s, 0.05 * s, 0.11 * s] }), _jsx("meshStandardMaterial", { color: accent || '#00ffff', roughness: 0.45, metalness: 0.2 })] }), _jsxs("mesh", { position: [0.05 * s, 0.34 * s, 0.2 * s], children: [_jsx("boxGeometry", { args: [0.04 * s, 0.02 * s, 0.03 * s] }), _jsx("meshBasicMaterial", { color: '#ffffff' })] })] }));
        case 'flipPhone':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0.26 * s, 0.58 * s, 0.13 * s], rotation: [0, 0, -0.25], children: [_jsx("boxGeometry", { args: [0.09 * s, 0.12 * s, 0.03 * s] }), _jsx("meshStandardMaterial", { color: '#303030', roughness: 0.6, metalness: 0.15 })] }), _jsxs("mesh", { position: [0.26 * s, 0.60 * s, 0.14 * s], children: [_jsx("boxGeometry", { args: [0.06 * s, 0.08 * s, 0.012 * s] }), _jsx("meshBasicMaterial", { color: '#1d7dff' })] }), _jsxs("mesh", { position: [0.21 * s, 0.62 * s, 0.145 * s], children: [_jsx("boxGeometry", { args: [0.03 * s, 0.01 * s, 0.02 * s] }), _jsx("meshStandardMaterial", { color: '#121212', roughness: 0.7 })] })] }));
        case 'laptop':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [-0.05 * s, 0.47 * s, 0.22 * s], rotation: [0.15, 0.1, 0], children: [_jsx("boxGeometry", { args: [0.22 * s, 0.03 * s, 0.14 * s] }), _jsx("meshStandardMaterial", { color: '#121212', roughness: 0.4, metalness: 0.15 })] }), _jsxs("mesh", { position: [-0.05 * s, 0.53 * s, 0.24 * s], rotation: [0.15, 0.1, 0], children: [_jsx("boxGeometry", { args: [0.18 * s, 0.02 * s, 0.12 * s] }), _jsx("meshBasicMaterial", { color: '#0f1b2e' })] }), _jsxs("mesh", { position: [-0.05 * s, 0.535 * s, 0.24 * s], children: [_jsx("boxGeometry", { args: [0.16 * s, 0.016 * s, 0.1 * s] }), _jsx("meshBasicMaterial", { color: '#4aa3ff', transparent: true, opacity: 0.25 })] })] }));
        case 'ipod':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0.18 * s, 0.49 * s, 0.22 * s], rotation: [0.08, 0, -0.2], children: [_jsx("boxGeometry", { args: [0.08 * s, 0.12 * s, 0.02 * s] }), _jsx("meshStandardMaterial", { color: '#6c6c6c', roughness: 0.5, metalness: 0.1 })] }), _jsxs("mesh", { position: [0.18 * s, 0.49 * s, 0.221 * s], children: [_jsx("sphereGeometry", { args: [0.015 * s, 10, 10] }), _jsx("meshStandardMaterial", { color: '#2b2b2b', roughness: 0.5 })] }), _jsxs("mesh", { position: [-0.1 * s, 0.93 * s, 0.1 * s], children: [_jsx("sphereGeometry", { args: [0.02 * s, 10, 10] }), _jsx("meshStandardMaterial", { color: '#e0e0e0', roughness: 0.8 })] }), _jsxs("mesh", { position: [0.1 * s, 0.93 * s, 0.1 * s], children: [_jsx("sphereGeometry", { args: [0.02 * s, 10, 10] }), _jsx("meshStandardMaterial", { color: '#e0e0e0', roughness: 0.8 })] }), _jsxs("mesh", { position: [0.0 * s, 0.9 * s, 0.09 * s], rotation: [0, 0, 0], children: [_jsx("cylinderGeometry", { args: [0.004 * s, 0.004 * s, 0.12 * s, 8] }), _jsx("meshStandardMaterial", { color: accent || '#1e90ff', roughness: 0.8 })] })] }));
        case 'smartphone':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0.28 * s, 0.6 * s, 0.13 * s], rotation: [0, 0, -0.25], children: [_jsx("boxGeometry", { args: [0.07 * s, 0.12 * s, 0.01 * s] }), _jsx("meshStandardMaterial", { color: '#0b0b0b', roughness: 0.4, metalness: 0.2 })] }), _jsxs("mesh", { position: [0.285 * s, 0.61 * s, 0.131 * s], children: [_jsx("boxGeometry", { args: [0.045 * s, 0.085 * s, 0.006 * s] }), _jsx("meshBasicMaterial", { color: accent || '#35d6ff' })] }), _jsxs("mesh", { position: [0.3 * s, 0.73 * s, 0.135 * s], children: [_jsx("sphereGeometry", { args: [0.005 * s, 8, 8] }), _jsx("meshStandardMaterial", { color: '#2c2c2c', roughness: 0.5 })] })] }));
        case 'earbuds':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [-0.12 * s, 0.95 * s, 0.1 * s], children: [_jsx("sphereGeometry", { args: [0.016 * s, 10, 10] }), _jsx("meshStandardMaterial", { color: '#f3f3f3', roughness: 0.7 })] }), _jsxs("mesh", { position: [0.12 * s, 0.95 * s, 0.1 * s], children: [_jsx("sphereGeometry", { args: [0.016 * s, 10, 10] }), _jsx("meshStandardMaterial", { color: '#f3f3f3', roughness: 0.7 })] }), _jsxs("mesh", { position: [0.0 * s, 0.93 * s, 0.085 * s], children: [_jsx("cylinderGeometry", { args: [0.004 * s, 0.004 * s, 0.12 * s, 8] }), _jsx("meshStandardMaterial", { color: accent || '#a6a6a6', roughness: 0.8 })] })] }));
        case 'smartwatch':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [-0.18 * s, 0.52 * s, 0.12 * s], rotation: [0, 0, 0.25], children: [_jsx("boxGeometry", { args: [0.05 * s, 0.03 * s, 0.012 * s] }), _jsx("meshStandardMaterial", { color: '#111111', roughness: 0.5, metalness: 0.35 })] }), _jsxs("mesh", { position: [-0.176 * s, 0.52 * s, 0.121 * s], children: [_jsx("boxGeometry", { args: [0.04 * s, 0.02 * s, 0.006 * s] }), _jsx("meshBasicMaterial", { color: accent || '#53ff9a' })] })] }));
        case 'tablet':
            return (_jsxs("group", { children: [_jsxs("mesh", { position: [0.0 * s, 0.46 * s, 0.23 * s], rotation: [0.12, 0.0, 0.0], children: [_jsx("boxGeometry", { args: [0.22 * s, 0.03 * s, 0.14 * s] }), _jsx("meshStandardMaterial", { color: '#0a0a0a', roughness: 0.5, metalness: 0.1 })] }), _jsxs("mesh", { position: [0.0 * s, 0.47 * s, 0.245 * s], children: [_jsx("boxGeometry", { args: [0.2 * s, 0.02 * s, 0.125 * s] }), _jsx("meshBasicMaterial", { color: accent || '#2f9bff' })] })] }));
        default:
            return null;
    }
};
// Full-detail PatronFigure component
const FullPatronFigure = ({ config }) => {
    const { position, rotationY, scale, colors, hair, accessories, outfit } = config;
    const s = clamp(scale, 0.65, 1.35);
    // Body proportions
    const feetY = position.y;
    const legH = 0.25 * s;
    const hipY = feetY + legH;
    const torsoH = 0.55 * s;
    const torsoW = outfit.includes('dress') || outfit.includes('hoodie') ? 0.3 * s : 0.28 * s;
    const shoulderW = outfit === 'power_suit_brick_phone' || outfit === 'tracksuit_mullet_phone' ? 0.34 * s : 0.32 * s;
    const headR = 0.12 * s;
    const leftArmX = -0.22 * s;
    const rightArmX = 0.22 * s;
    const pantsFlared = outfit === 'jeans_tee_afro' || outfit === 'mod_dress_vinyl';
    const primary = colors.primary;
    const secondary = colors.secondary;
    const accent = colors.accent;
    return (_jsxs("group", { position: [position.x, 0, position.z], rotation: [0, rotationY, 0], scale: [s, s, s], children: [_jsxs("mesh", { position: [0, feetY + legH / 2, 0.02 * s], children: [_jsx("boxGeometry", { args: [0.12 * (pantsFlared ? 1.15 : 1), legH, 0.18 * (pantsFlared ? 1.15 : 1)] }), _jsx("meshStandardMaterial", { color: primary, roughness: 0.75, metalness: 0.05 })] }), _jsxs("mesh", { position: [0.12 * s, feetY + legH / 2, 0.02 * s], children: [_jsx("boxGeometry", { args: [0.12 * (pantsFlared ? 1.15 : 1), legH, 0.18 * (pantsFlared ? 1.15 : 1)] }), _jsx("meshStandardMaterial", { color: primary, roughness: 0.75, metalness: 0.05 })] }), outfit === 'dress_apron_headscarf' || outfit === 'mod_dress_vinyl' ? (_jsxs(_Fragment, { children: [_jsxs("mesh", { position: [0, hipY + torsoH * 0.45, 0], children: [_jsx("boxGeometry", { args: [torsoW, torsoH, 0.22 * s] }), _jsx("meshStandardMaterial", { color: primary, roughness: 0.7, metalness: 0.04 })] }), _jsxs("mesh", { position: [0, hipY + torsoH * 0.38, 0.12 * s], children: [_jsx("boxGeometry", { args: [torsoW * 0.55, torsoH * 0.55, 0.08 * s] }), _jsx("meshStandardMaterial", { color: secondary, roughness: 0.9, metalness: 0 })] }), _jsxs("mesh", { position: [0, hipY + torsoH * 0.7, 0.01 * s], children: [_jsx("boxGeometry", { args: [torsoW * 1.12, torsoH * 0.55, 0.24 * s] }), _jsx("meshStandardMaterial", { color: primary, roughness: 0.72, metalness: 0.02 })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("mesh", { position: [0, hipY + torsoH / 2, 0], children: [_jsx("boxGeometry", { args: [shoulderW, torsoH, 0.22 * s] }), _jsx("meshStandardMaterial", { color: primary, roughness: 0.65, metalness: 0.05 })] }), _jsxs("mesh", { position: [0, hipY + torsoH * 0.72, 0.11 * s], children: [_jsx("boxGeometry", { args: [shoulderW * 0.65, 0.07 * s, 0.08 * s] }), _jsx("meshStandardMaterial", { color: secondary, roughness: 0.6, metalness: 0.1 })] }), outfit === 'power_suit_brick_phone' || outfit === 'tracksuit_mullet_phone' ? (_jsxs(_Fragment, { children: [_jsxs("mesh", { position: [-shoulderW * 0.42, hipY + torsoH * 0.78, 0.03 * s], children: [_jsx("boxGeometry", { args: [0.12 * s, 0.08 * s, 0.08 * s] }), _jsx("meshStandardMaterial", { color: secondary, roughness: 0.45, metalness: 0.3 })] }), _jsxs("mesh", { position: [shoulderW * 0.42, hipY + torsoH * 0.78, 0.03 * s], children: [_jsx("boxGeometry", { args: [0.12 * s, 0.08 * s, 0.08 * s] }), _jsx("meshStandardMaterial", { color: secondary, roughness: 0.45, metalness: 0.3 })] })] })) : null] })), _jsxs("mesh", { position: [leftArmX, hipY + torsoH * 0.55, 0.08 * s], rotation: [0, 0, 0.1], children: [_jsx("boxGeometry", { args: [0.06 * s, torsoH * 0.45, 0.1 * s] }), _jsx("meshStandardMaterial", { color: secondary, roughness: 0.8, metalness: 0.02 })] }), _jsxs("mesh", { position: [rightArmX, hipY + torsoH * 0.55, 0.08 * s], rotation: [0, 0, -0.1], children: [_jsx("boxGeometry", { args: [0.06 * s, torsoH * 0.45, 0.1 * s] }), _jsx("meshStandardMaterial", { color: secondary, roughness: 0.8, metalness: 0.02 })] }), _jsxs("mesh", { position: [0, hipY + torsoH + headR, 0], children: [_jsx("sphereGeometry", { args: [headR, 18, 18] }), _jsx("meshStandardMaterial", { color: colors.skin, roughness: 0.85, metalness: 0.02 })] }), _jsx("group", { position: [0, hipY + torsoH + headR, 0], children: _jsx(Hair, { style: hair, color: colors.hair, scale: s }) }), accessories.map((acc, i) => (_jsx(Accessory, { type: acc, secondary: secondary, accent: accent, scale: s }, acc + i))), _jsxs("mesh", { position: [0, hipY + 0.02 * s, -0.12 * s], children: [_jsx("boxGeometry", { args: [0.08 * s, 0.03 * s, 0.12 * s] }), _jsx("meshStandardMaterial", { color: outfit === 'dress_apron_headscarf' ? secondary : '#1b1b1b', roughness: 1, opacity: 0, transparent: true })] })] }));
};
// Simplified PatronFigure for LOD - reduced geometry
const SimplifiedPatronFigure = ({ config }) => {
    const { position, rotationY, scale, colors } = config;
    const s = clamp(scale, 0.65, 1.35);
    // Simple box body + basic hair approximation
    return (_jsxs("mesh", { children: [_jsx("boxGeometry", { args: [0.3 * s, 0.6 * s, 0.2 * s] }), _jsx("meshStandardMaterial", { color: colors.primary, roughness: 0.8 }), _jsx("group", { position: [0, 0.6 * s, 0], rotation: [0, rotationY, 0], children: _jsx("sphereGeometry", { args: [0.1 * s, 12, 12] }) })] }));
};
// Tiny representative marker for far range
const TinyPatronMarker = ({ position, rotationY, color }) => (_jsxs("mesh", { position: [position.x, position.y, position.z], rotation: [0, rotationY, 0], children: [_jsx("boxGeometry", { args: [0.05, 0.05, 0.05] }), _jsx("meshStandardMaterial", { color: color.primary, opacity: 0.3, transparent: true })] }));
export const Patrons = () => {
    const currentEra = useEraStore((state) => state.currentEra);
    const configs = getPatronConfigsForEra(currentEra);
    const { camera } = useThree();
    // Calculate camera distance for LOD
    const cameraRef = useRef(0);
    useEffect(() => {
        const updateDistance = () => {
            if (camera && camera.position) {
                // Use camera z-distance as approximation
                const camZ = Math.abs(camera.position.z);
                cameraRef.current = camZ;
            }
        };
        updateDistance();
        const handleResize = () => {
            updateDistance();
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [camera]);
    // LOD thresholds
    const NEAR_THRESHOLD = 8; // Full detail within 8 units
    const FAR_THRESHOLD = 20; // Simplified within 8-20 units
    return (_jsx("group", { children: configs.map((config, idx) => (_jsxs("group", { children: [cameraRef.current < NEAR_THRESHOLD && _jsx(FullPatronFigure, { config: config }), cameraRef.current >= NEAR_THRESHOLD && cameraRef.current < FAR_THRESHOLD && _jsx(SimplifiedPatronFigure, { config: config }), cameraRef.current >= FAR_THRESHOLD && _jsx(TinyPatronMarker, { position: config.position, rotationY: config.rotationY, color: config.colors })] }, currentEra + '-patron-' + idx))) }));
};
const getPatronConfigsForEra = (era) => {
    // Positions are in café-local meter-ish units within an 8m × 12m footprint.
    switch (era) {
        case '1945':
            return [
                {
                    position: { x: -2.2, y: 0, z: 1.6 },
                    rotationY: 0.6,
                    scale: 1.0,
                    hair: 'hat',
                    outfit: 'suit_hat',
                    colors: { skin: '#f2c7a2', hair: '#3b2b1f', primary: '#1f2a44', secondary: '#d9c27a', accent: '#b87335' },
                    accessories: ['newspaper', 'pipe'],
                },
                {
                    position: { x: 0.9, y: 0, z: 2.1 },
                    rotationY: -0.3,
                    scale: 1.0,
                    hair: 'headscarf',
                    outfit: 'dress_apron_headscarf',
                    colors: { skin: '#e9b995', hair: '#2c1f17', primary: '#7b2f2f', secondary: '#f5f5f0', accent: '#6b4f2a' },
                    accessories: [],
                },
                {
                    position: { x: 2.35, y: 0, z: 1.0 },
                    rotationY: 1.0,
                    scale: 0.95,
                    hair: 'hat',
                    outfit: 'overalls_cap',
                    colors: { skin: '#f2c7a2', hair: '#2b1f15', primary: '#2f4b5a', secondary: '#d0d0d0', accent: '#8b4513' },
                    accessories: ['newspaper'],
                },
                {
                    position: { x: -0.6, y: 0, z: 0.5 },
                    rotationY: -1.0,
                    scale: 0.98,
                    hair: 'hat',
                    outfit: 'coat_hat_newspaper',
                    colors: { skin: '#deb38f', hair: '#3b2b1f', primary: '#4b3b32', secondary: '#e7e0d0', accent: '#b87335' },
                    accessories: ['newspaper'],
                },
            ];
        case '1965':
            return [
                {
                    position: { x: -2.6, y: 0, z: 0.9 },
                    rotationY: 0.8,
                    scale: 1.02,
                    hair: 'beehive',
                    outfit: 'mod_dress_vinyl',
                    colors: { skin: '#e9b995', hair: '#2a1a12', primary: '#ff44cc', secondary: '#7bdff2', accent: '#ffd700' },
                    accessories: ['vinylRecord'],
                },
                {
                    position: { x: -0.8, y: 0, z: 2.0 },
                    rotationY: -0.2,
                    scale: 1.0,
                    hair: 'afro',
                    outfit: 'jeans_tee_afro',
                    colors: { skin: '#caa27a', hair: '#0f0f0f', primary: '#0088ff', secondary: '#ffd700', accent: '#ff66aa' },
                    accessories: ['newspaper'],
                },
                {
                    position: { x: 1.9, y: 0, z: 1.25 },
                    rotationY: 1.1,
                    scale: 0.98,
                    hair: 'short_cut',
                    outfit: 'psychedelic_shirt_newspaper',
                    colors: { skin: '#f2c7a2', hair: '#2b1f15', primary: '#7a3cff', secondary: '#d9c27a', accent: '#33ff99' },
                    accessories: ['newspaper'],
                },
                {
                    position: { x: 0.2, y: 0, z: 0.7 },
                    rotationY: -1.2,
                    scale: 0.94,
                    hair: 'afro',
                    outfit: 'jeans_tee_afro',
                    colors: { skin: '#caa27a', hair: '#0f0f0f', primary: '#ff6600', secondary: '#ffffff', accent: '#0088ff' },
                    accessories: ['vinylRecord'],
                },
            ];
        case '1985':
            return [
                {
                    position: { x: -2.3, y: 0, z: 1.2 },
                    rotationY: 0.6,
                    scale: 1.02,
                    hair: 'mullet',
                    outfit: 'power_suit_brick_phone',
                    colors: { skin: '#f2c7a2', hair: '#111111', primary: '#111111', secondary: '#00ffff', accent: '#00ff00' },
                    accessories: ['brickPhone'],
                },
                {
                    position: { x: 0.8, y: 0, z: 2.2 },
                    rotationY: -0.3,
                    scale: 1.0,
                    hair: 'perm',
                    outfit: 'leather_jacket_walkman',
                    colors: { skin: '#e7b892', hair: '#2a1a12', primary: '#2a2a2a', secondary: '#ff00ff', accent: '#00ffff' },
                    accessories: ['walkman', 'brickPhone', 'flipPhone'],
                },
                {
                    position: { x: 2.35, y: 0, z: 0.85 },
                    rotationY: 1.1,
                    scale: 0.98,
                    hair: 'mullet',
                    outfit: 'tracksuit_mullet_phone',
                    colors: { skin: '#caa27a', hair: '#0f0f0f', primary: '#00ff00', secondary: '#111111', accent: '#ff44cc' },
                    accessories: ['brickPhone'],
                },
            ];
        case '2005':
            return [
                {
                    position: { x: -2.1, y: 0, z: 1.1 },
                    rotationY: 0.65,
                    scale: 1.02,
                    hair: 'bob',
                    outfit: 'hoodie_flip_phone',
                    colors: { skin: '#e9b995', hair: '#1f1f1f', primary: '#2b2b2b', secondary: '#6c8cff', accent: '#ff66aa' },
                    accessories: ['flipPhone'],
                },
                {
                    position: { x: 0.9, y: 0, z: 2.1 },
                    rotationY: -0.25,
                    scale: 1.0,
                    hair: 'bob',
                    outfit: 'graphic_tee_ipod',
                    colors: { skin: '#f2c7a2', hair: '#2b1f15', primary: '#4169E1', secondary: '#ffffff', accent: '#ff69b4' },
                    accessories: ['ipod'],
                },
                {
                    position: { x: 2.2, y: 0, z: 1.0 },
                    rotationY: 1.05,
                    scale: 0.98,
                    hair: 'bob',
                    outfit: 'casual_modern_laptop_flip',
                    colors: { skin: '#deb38f', hair: '#3b2b1f', primary: '#6b6b6b', secondary: '#d9c27a', accent: '#4aa3ff' },
                    accessories: ['laptop', 'flipPhone'],
                },
                {
                    position: { x: -0.2, y: 0, z: 0.6 },
                    rotationY: -1.2,
                    scale: 0.94,
                    hair: 'bob',
                    outfit: 'hoodie_flip_phone',
                    colors: { skin: '#e7b892', hair: '#2a1a12', primary: '#1f2937', secondary: '#22c55e', accent: '#fbbf24' },
                    accessories: ['flipPhone'],
                },
            ];
        case '2025':
            return [
                {
                    position: { x: -2.4, y: 0, z: 1.25 },
                    rotationY: 0.7,
                    scale: 1.02,
                    hair: 'pony',
                    outfit: 'athleisure_smartphone',
                    colors: { skin: '#e9b995', hair: '#141414', primary: '#3b82f6', secondary: '#e5e7eb', accent: '#35d6ff' },
                    accessories: ['smartphone', 'earbuds'],
                },
                {
                    position: { x: 0.95, y: 0, z: 2.15 },
                    rotationY: -0.35,
                    scale: 1.0,
                    hair: 'undercut',
                    outfit: 'minimalist_smartwatch_tablet',
                    colors: { skin: '#f2c7a2', hair: '#111111', primary: '#d1d5db', secondary: '#111827', accent: '#53ff9a' },
                    accessories: ['smartwatch', 'tablet'],
                },
                {
                    position: { x: 2.25, y: 0, z: 0.9 },
                    rotationY: 1.05,
                    scale: 0.98,
                    hair: 'long_woven',
                    outfit: 'tech_wear_smartphone_earbuds',
                    colors: { skin: '#caa27a', hair: '#2a1a12', primary: '#0f766e', secondary: '#e5e7eb', accent: '#2f9bff' },
                    accessories: ['smartphone', 'earbuds', 'laptop'],
                },
                {
                    position: { x: -0.3, y: 0, z: 0.6 },
                    rotationY: -1.1,
                    scale: 0.94,
                    hair: 'buzz',
                    outfit: 'athleisure_smartphone',
                    colors: { skin: '#deb38f', hair: '#0f0f0f', primary: '#ef4444', secondary: '#ffffff', accent: '#35d6ff' },
                    accessories: ['smartphone', 'smartwatch'],
                },
            ];
        default:
            return [];
    }
};
