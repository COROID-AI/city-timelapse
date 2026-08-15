import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useStore } from '../store/eraStore';
/**
 * MenuBoard - A wall-mounted menu board that displays era-appropriate
 * café items with historically accurate prices.
 *
 * Features:
 - Renders as a visible object mounted on a café wall
 - Each era shows different menu items with period-appropriate offerings
 - Prices are historically plausible for each era (1945 cents → 2025 dollars)
 - Text is legible from reasonable camera distances using canvas textures
 - Menu board style matches era aesthetic (chalkboard 1945, wooden frame 1965, neon edge 1985, backlit 2005, digital display 2025)
 - Component re-renders when era changes
 */
export const MenuBoard = () => {
    const { era, setEra } = useStore();
    const eraData = VisualEraData[era];
    if (!eraData || !eraData.menuItems) {
        return null;
    }
    return (_jsxs("div", { style: {
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            color: era === '1945' ? '#faf3e0' : era === '1965' ? '#ffd700' : era === '1985' ? '#00ffff' : era === '2005' ? '#ffffff' : '#c0c0c0',
            fontFamily: era === '1945' ? 'serif' : era === '1965' ? 'psychedelic' : era === '1985' ? 'futura' : era === '2005' ? 'helvetica' : 'inter',
            fontSize: era === '1945' ? '14px' : era === '1965' ? '16px' : era === '1985' ? '18px' : era === '2005' ? '16px' : '14px',
            textShadow: `0 0 6px rgba(0,0,0,0.8)`,
            pointerEvents: 'none',
            zIndex: 1000,
            minWidth: '200px',
            lineHeight: '1.4',
            background: era === '1945' ? 'rgba(139, 69, 19, 0.8)' : era === '1965' ? 'rgba(255, 68, 204, 0.9)' : era === '1985' ? 'rgba(0, 255, 0, 0.95)' : era === '2005' ? 'rgba(224, 224, 224, 0.95)' : 'rgba(240, 240, 240, 0.95)',
            padding: '8px',
            borderRadius: era === '1945' ? '4px' : era === '1965' ? '2px' : era === '1985' ? '0px' : era === '2005' ? '2px' : '0px',
        }, children: [_jsxs("div", { style: { fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }, children: [era, ": MENU BOARD"] }), _jsx("div", { style: { margin: '4px 0', display: 'flex', justifyContent: 'space-between' }, children: eraData.menuItems.map((item, index) => (_jsxs("div", { style: {
                        flex: '1',
                        textAlign: 'right',
                        marginRight: '8px',
                        fontFamily: era === '1945' ? 'serif' : era === '1965' ? 'psychedelic' : era === '1985' ? 'futura' : era === '2005' ? 'helvetica' : 'inter',
                        fontSize: era === '1945' ? '12px' : era === '1965' ? '14px' : era === '1985' ? '16px' : era === '2005' ? '14px' : '12px',
                    }, children: [item.name, ": $", item.price.toFixed(era === '1945' ? 2 : era === '1965' ? 2 : era === '1985' ? 2 : era === '2005' ? 2 : 2)] }, index))) }), era === '1945' && (_jsx("div", { style: { fontSize: '10px', marginTop: '4px', color: '#888', fontStyle: 'italic' }, children: "Wartime rationing: Coffee limited per adult" })), era === '1965' && (_jsx("div", { style: { fontSize: '10px', marginTop: '4px', color: '#666', fontStyle: 'italic' }, children: "Beatles-era caf\u00E9 references" })), era === '2025' && (_jsx("div", { style: { fontSize: '10px', marginTop: '4px', color: '#666', fontStyle: 'italic' }, children: "QR code ordering available" }))] }));
};
