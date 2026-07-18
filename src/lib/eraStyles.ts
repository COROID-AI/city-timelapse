import { Color } from 'three'

export type Era = '1945' | '1965' | '1985' | '2005' | '2025' | '2055'

export interface EraStyles {
  buildingColors: string[]
  windowColors: string[]
  vehicleColors: string[]
  groundColor: string
  roadColor: string
  roadLineColor: string
  pedestrianColors: string[]
  advertisementStyles: {
    fonts: string[]
    colors: string[]
  }
  lighting: {
    ambient: number
    directional: number
    colorTemp: number
  }
  architecturalStyle: 'traditional' | 'modernist' | 'brutalist' | 'postmodern' | 'contemporary' | 'futuristic'
  vehicleStyle: 'vintage' | 'classic' | 'boxy' | 'sleek' | 'electric' | 'autonomous'
}

export function getEraStyles(era: Era): EraStyles {
  const styles: Record<Era, EraStyles> = {
    '1945': {
      buildingColors: ['#8B4513', '#A0522D', '#654321', '#CD853F', '#D2691E'],
      windowColors: ['#87CEEB', '#ADD8E6'],
      vehicleColors: ['#2F4F4F', '#8B4513', '#696969'],
      groundColor: '#556B2F',
      roadColor: '#2F4F4F',
      roadLineColor: '#FFFF00',
      pedestrianColors: ['#000080', '#8B0000', '#228B22', '#4B0082'],
      advertisementStyles: { fonts: ['Georgia', 'Times New Roman'], colors: ['#FFFFFF', '#FFFF00', '#FF6347'] },
      lighting: { ambient: 0.4, directional: 0.8, colorTemp: 3200 },
      architecturalStyle: 'traditional',
      vehicleStyle: 'vintage'
    },
    '1965': {
      buildingColors: ['#C0C0C0', '#D3D3D3', '#A9A9A9', '#B0B0B0'],
      windowColors: ['#4169E1', '#1E90FF'],
      vehicleColors: ['#FF6347', '#32CD32', '#4169E1', '#FFD700'],
      groundColor: '#228B22',
      roadColor: '#696969',
      roadLineColor: '#FFFFFF',
      pedestrianColors: ['#FF69B4', '#00CED1', '#FF4500', '#9370DB'],
      advertisementStyles: { fonts: ['Arial', 'Helvetica'], colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'] },
      lighting: { ambient: 0.5, directional: 0.9, colorTemp: 4000 },
      architecturalStyle: 'modernist',
      vehicleStyle: 'classic'
    },
    '1985': {
      buildingColors: ['#2F4F4F', '#696969', '#808080', '#708090'],
      windowColors: ['#00FFFF', '#00BFFF'],
      vehicleColors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'],
      groundColor: '#696969',
      roadColor: '#2F4F4F',
      roadLineColor: '#FFFFFF',
      pedestrianColors: ['#FF1493', '#00FF7F', '#1E90FF', '#FF4500'],
      advertisementStyles: { fonts: ['Arial Black', 'Impact'], colors: ['#FF0000', '#00FF00', '#FFFF00', '#0000FF'] },
      lighting: { ambient: 0.6, directional: 1.0, colorTemp: 4500 },
      architecturalStyle: 'brutalist',
      vehicleStyle: 'boxy'
    },
    '2005': {
      buildingColors: ['#708090', '#778899', '#808080', '#2F4F4F'],
      windowColors: ['#87CEFA', '#B0E0E6'],
      vehicleColors: ['#000000', '#FFFFFF', '#0000FF', '#FF0000', '#00FF00'],
      groundColor: '#808080',
      roadColor: '#2F4F4F',
      roadLineColor: '#FFFF00',
      pedestrianColors: ['#000000', '#FFFFFF', '#808080'],
      advertisementStyles: { fonts: ['Verdana', 'Tahoma'], colors: ['#FFFFFF', '#0000FF', '#FF0000'] },
      lighting: { ambient: 0.5, directional: 1.1, colorTemp: 5000 },
      architecturalStyle: 'postmodern',
      vehicleStyle: 'sleek'
    },
    '2025': {
      buildingColors: ['#FFFFFF', '#F5F5F5', '#E0E0E6', '#BDBDBD'],
      windowColors: ['#81D4FA', '#B3E5FC'],
      vehicleColors: ['#000000', '#FFFFFF', '#FF0000', '#00C853', '#2962FF'],
      groundColor: '#9E9E9E',
      roadColor: '#424242',
      roadLineColor: '#FFFFFF',
      pedestrianColors: ['#212121', '#FAFAFA', '#E0E0E0'],
      advertisementStyles: { fonts: ['Roboto', 'Open Sans'], colors: ['#2196F3', '#4CAF50', '#FF5722', '#FFFFFF'] },
      lighting: { ambient: 0.6, directional: 1.2, colorTemp: 5500 },
      architecturalStyle: 'contemporary',
      vehicleStyle: 'electric'
    },
    '2055': {
      buildingColors: ['#000000', '#0A0A0A', '#1A1A2E', '#16213E'],
      windowColors: ['#00BCD4', '#4DD0E1', '#E91E63'],
      vehicleColors: ['#00BCD4', '#4DD0E1', '#9C27B0', '#FFEB3B'],
      groundColor: '#212121',
      roadColor: '#000000',
      roadLineColor: '#00BCD4',
      pedestrianColors: ['#00BCD4', '#4DD0E1', '#9C27B0', '#FFEB3B'],
      advertisementStyles: { fonts: ['Orbitron', 'Share Tech Mono'], colors: ['#00BCD4', '#4DD0E1', '#E91E63', '#FFEB3B'] },
      lighting: { ambient: 0.4, directional: 0.8, colorTemp: 6500 },
      architecturalStyle: 'futuristic',
      vehicleStyle: 'autonomous'
    }
  }
  return styles[era]
}

// Interpolate between two colors
export function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = new Color(color1)
  const c2 = new Color(color2)
  const result = new Color()
  result.lerpColors(c1, c2, factor)
  return '#' + result.getHexString()
}

// Interpolate between two era styles
export function interpolateStyles(style1: EraStyles, style2: EraStyles, factor: number): EraStyles {
  return {
    buildingColors: style1.buildingColors.map((c, i) => 
      interpolateColor(c, style2.buildingColors[i % style2.buildingColors.length], factor)),
    windowColors: style1.windowColors.map((c, i) => 
      interpolateColor(c, style2.windowColors[i % style2.windowColors.length], factor)),
    vehicleColors: style1.vehicleColors.map((c, i) => 
      interpolateColor(c, style2.vehicleColors[i % style2.vehicleColors.length], factor)),
    groundColor: interpolateColor(style1.groundColor, style2.groundColor, factor),
    roadColor: interpolateColor(style1.roadColor, style2.roadColor, factor),
    roadLineColor: interpolateColor(style1.roadLineColor, style2.roadLineColor, factor),
    pedestrianColors: style1.pedestrianColors.map((c, i) => 
      interpolateColor(c, style2.pedestrianColors[i % style2.pedestrianColors.length], factor)),
    advertisementStyles: {
      fonts: style1.advertisementStyles.fonts,
      colors: style1.advertisementStyles.colors.map((c, i) => 
        interpolateColor(c, style2.advertisementStyles.colors[i % style2.advertisementStyles.colors.length], factor))
    },
    lighting: {
      ambient: style1.lighting.ambient + (style2.lighting.ambient - style1.lighting.ambient) * factor,
      directional: style1.lighting.directional + (style2.lighting.directional - style1.lighting.directional) * factor,
      colorTemp: style1.lighting.colorTemp + (style2.lighting.colorTemp - style1.lighting.colorTemp) * factor
    },
    architecturalStyle: factor > 0.5 ? style2.architecturalStyle : style1.architecturalStyle,
    vehicleStyle: factor > 0.5 ? style2.vehicleStyle : style1.vehicleStyle
  }
}