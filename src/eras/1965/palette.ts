/**
 * Era 1965: Palette & Lighting Grade Specification
 *
 * Captures the vibrant, optimistic post-war boom aesthetics:
 * - Saturated Technicolor film grading
 * - Clear blue-sky haze
 * - Cool fluorescent evening illumination
 * - Warm neon signage accents (ruby, cyan, electric amber)
 * - Porcelain enamel architectural facade accents (turquoise, coral, butter yellow)
 */

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface Era1965Palette {
  readonly year: 1965;
  readonly name: string;
  readonly description: string;
  readonly grading: {
    saturation: number;
    contrast: number;
    warmth: number;
    skyHaze: ColorRGB;
    sunDay: ColorRGB;
    sunEvening: ColorRGB;
    ambientDay: ColorRGB;
    ambientEvening: ColorRGB;
    coolFluorescent: ColorRGB;
    warmNeon: ColorRGB;
  };
  readonly architecture: {
    renovatedEnamelAqua: number;
    renovatedEnamelCoral: number;
    renovatedEnamelYellow: number;
    renovatedEnamelMint: number;
    curtainWallSteel: number;
    curtainWallGlass: number;
    googieCanopyWhite: number;
    googieAccentOrange: number;
    brickWarmRed: number;
    brickTerracotta: number;
    signBandWhite: number;
    chromeTrim: number;
  };
  readonly storefronts: {
    tvScreenGlow: number;
    tvCabinetWalnut: number;
    recordVinylBlack: number;
    recordCoverRed: number;
    recordCoverGold: number;
    dinerBoothTurquoise: number;
    dinerCounterChrome: number;
    jukeboxGlowAmber: number;
    tobacconistTeak: number;
    laundromatPorcelain: number;
    washerDrumChrome: number;
  };
  readonly neon: {
    openPink: number;
    dinerAmber: number;
    recordsCyan: number;
    tvElectricBlue: number;
    cocktailsMagenta: number;
    laundryBrightGreen: number;
  };
  readonly vehicles: {
    finnedSedanTurquoise: number;
    finnedSedanCherryRed: number;
    convertibleCanaryYellow: number;
    beetlePastelBlue: number;
    deliveryVanCream: number;
    chromeBumper: number;
    tireRubber: number;
  };
  readonly pedestrians: {
    suitNavy: number;
    suitCharcoal: number;
    tieSkinnyBlack: number;
    shiftDressCoral: number;
    shiftDressYellow: number;
    pillboxHatTeal: number;
    modStripesBlackWhite: number;
    transistorRadioSilver: number;
  };
}

export const ERA_1965_PALETTE: Era1965Palette = Object.freeze({
  year: 1965,
  name: 'Mid-Century Modern Boom',
  description: 'Technicolor-saturated optimism, enamel facades, neon, fluorescent streetlights, and finned cruisers.',
  grading: {
    saturation: 1.35,
    contrast: 1.15,
    warmth: 1.10,
    skyHaze: { r: 0.35, g: 0.65, b: 0.95 },
    sunDay: { r: 1.0, g: 0.98, b: 0.90 },
    sunEvening: { r: 0.98, g: 0.55, b: 0.35 },
    ambientDay: { r: 0.45, g: 0.52, b: 0.62 },
    ambientEvening: { r: 0.28, g: 0.32, b: 0.48 },
    coolFluorescent: { r: 0.72, g: 0.85, b: 0.98 },
    warmNeon: { r: 1.0, g: 0.42, b: 0.15 },
  },
  architecture: {
    renovatedEnamelAqua: 0x2ec4b6,
    renovatedEnamelCoral: 0xff6f59,
    renovatedEnamelYellow: 0xffd166,
    renovatedEnamelMint: 0xa8dadc,
    curtainWallSteel: 0x457b9d,
    curtainWallGlass: 0x70d6ff,
    googieCanopyWhite: 0xfaf9f6,
    googieAccentOrange: 0xf77f00,
    brickWarmRed: 0x9e2a2b,
    brickTerracotta: 0xb05d3b,
    signBandWhite: 0xf4f3ee,
    chromeTrim: 0xdce0e6,
  },
  storefronts: {
    tvScreenGlow: 0x7df9ff,
    tvCabinetWalnut: 0x5c3d2e,
    recordVinylBlack: 0x1a1a1a,
    recordCoverRed: 0xd90429,
    recordCoverGold: 0xf4a261,
    dinerBoothTurquoise: 0x00b4d8,
    dinerCounterChrome: 0xe0e5eb,
    jukeboxGlowAmber: 0xffb703,
    tobacconistTeak: 0x6f4e37,
    laundromatPorcelain: 0xebf4f6,
    washerDrumChrome: 0xced4da,
  },
  neon: {
    openPink: 0xff007f,
    dinerAmber: 0xffaa00,
    recordsCyan: 0x00f5d4,
    tvElectricBlue: 0x00b4d8,
    cocktailsMagenta: 0xf72585,
    laundryBrightGreen: 0x38b000,
  },
  vehicles: {
    finnedSedanTurquoise: 0x118ab2,
    finnedSedanCherryRed: 0xd90429,
    convertibleCanaryYellow: 0xffd000,
    beetlePastelBlue: 0x90e0ef,
    deliveryVanCream: 0xfdf0d5,
    chromeBumper: 0xdee2e6,
    tireRubber: 0x212529,
  },
  pedestrians: {
    suitNavy: 0x1d3557,
    suitCharcoal: 0x343a40,
    tieSkinnyBlack: 0x111111,
    shiftDressCoral: 0xff5d73,
    shiftDressYellow: 0xffe066,
    pillboxHatTeal: 0x2ec4b6,
    modStripesBlackWhite: 0xf8f9fa,
    transistorRadioSilver: 0xc8d6e5,
  },
});
