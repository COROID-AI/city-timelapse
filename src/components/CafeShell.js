import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CounterTechnology } from './CounterTechnology';
/** CafeShell - Café architectural shell - permanent container
 * Renders the café floor, walls, windows, and counter structure.
 * Era-independent architectural container that wraps era-specific
 * tableware and patron equipment via CounterTechnology.
 *
 * The shell provides:
 * - Floor plane (8m × 12m in XZ plane)
 * - Ceiling at y=3.5m
 * - Four walls forming the café boundary
 * - Window frames and glass on left and right walls
 * - Counter base along back wall
 * - Era-specific CounterTechnology component for POS equipment
 */
export const CafeShell = () => {
    return (_jsxs(_Fragment, { children: [_jsxs("mesh", { rotation: { x: -Math.PI / 2 }, children: [_jsx("planeGeometry", { args: [8, 12] }), _jsx("meshStandardMaterial", { color: "#8B4513" })] }), _jsxs("mesh", { children: [_jsx("planeGeometry", { args: [8, 12] }), _jsx("position", { y: 3.5 }), _jsx("meshStandardMaterial", { color: "#D2B48C" })] }), _jsxs("mesh", { children: [_jsx("boxGeometry", { args: [3.55, 3.5, 0.2] }), _jsx("position", { x: -2.275, y: 0, z: -6 }), _jsx("meshStandardMaterial", { color: "#8B4513" })] }), _jsxs("mesh", { children: [_jsx("boxGeometry", { args: [3.55, 3.5, 0.2] }), _jsx("position", { x: 2.275, y: 0, z: -6 }), _jsx("meshStandardMaterial", { color: "#8B4513" })] }), _jsxs("mesh", { children: [_jsx("boxGeometry", { args: [1.2, 3.5, 0.2] }), _jsx("position", { x: -4, y: 0, z: 0 }), _jsx("meshStandardMaterial", { color: "#8B4513" })] }), _jsxs("mesh", { children: [_jsx("boxGeometry", { args: [1.2, 3.5, 0.2] }), _jsx("position", { x: 4, y: 0, z: 0 }), _jsx("meshStandardMaterial", { color: "#8B4513" })] }), _jsxs("mesh", { children: [_jsx("boxGeometry", { args: [0.1, 1.5, 0.1] }), _jsx("position", { x: -4, y: 2.25, z: 0.05 }), _jsx("meshStandardMaterial", { color: "#000000" })] }), _jsxs("mesh", { children: [_jsx("boxGeometry", { args: [0.1, 1.5, 0.1] }), _jsx("position", { x: 4, y: 2.25, z: 0.05 }), _jsx("meshStandardMaterial", { color: "#000000" })] }), _jsxs("mesh", { children: [_jsx("planeGeometry", { args: [0.8, 1.5] }), _jsx("position", { x: -4, y: 2.25, z: 0.1 }), _jsx("meshBasicMaterial", { transparent: true, opacity: 0.3, color: "#0000ffff" })] }), _jsxs("mesh", { children: [_jsx("planeGeometry", { args: [0.8, 1.5] }), _jsx("position", { x: 4, y: 2.25, z: 0.1 }), _jsx("meshBasicMaterial", { transparent: true, opacity: 0.3, color: "#0000ffff" })] }), _jsxs("mesh", { children: [_jsx("boxGeometry", { args: [4, 1.1, 0.7] }), _jsx("position", { x: 0, y: 0.55, z: 5.35 }), _jsx("meshStandardMaterial", { color: "#A0522D" })] }), _jsx(CounterTechnology, {})] }));
};
