import { EraId } from '../eras';

/**
 * Returns an array of texture asset paths appropriate for the given era.
 * @param era The era ID
 * @returns Array of texture asset paths
 */
export function getTextureAssetsForEra(era: EraId): string[] {
  switch (era) {
    case '1945':
      // Post-War Era: muted colors, matte finishes, wartime austerity
      return [
        'textures/buildings/brick_1945',
        'textures/buildings/concrete_1945',
        'textures/buildings/wood_siding_1945',
        'textures/streets/asphalt_1945',
        'textures/streets/cobblestone_1945',
        'textures/props/window_glass_1945',
        'textures/props/metal_dull_1945',
        'textures/props/wood_crate_1945',
      ];
    case '1965':
      // Swinging Sixties: pastels, brighter colors, post-war boom
      return [
        'textures/buildings/stucco_pastel_1965',
        'textures/buildings/brick_1965',
        'textures/buildings/glass_reflective_1965',
        'textures/streets/asphalt_1965',
        'textures/streets/concrete_1965',
        'textures/props/window_glass_tinted_1965',
        'textures/props/metal_chrome_1965',
        'textures/props/plastic_colorful_1965',
      ];
    case '1985':
      // Neon Eighties: vibrant, glossy, neon
      return [
        'textures/buildings/glass_curtain_wall_1985',
        'textures/buildings/metal_panel_1985',
        'textures/buildings/concrete_panel_1985',
        'textures/streets/asphalt_1985',
        'textures/streets/concrete_1985',
        'textures/props/window_glass_reflective_1985',
        'textures/props/metal_brushed_1985',
        'textures/props/plastic_glossy_1985',
        'textures/props/neon_sign_1985',
      ];
    case '2005':
      // Digital Dawn: glossy, modern materials, beginnings eco-friendly
      return [
        'textures/buildings/glass_low_iron_2005',
        'textures/buildings/metal_panel_brushed_2005',
        'textures/buildings/concrete_finished_2005',
        'textures/streets/asphalt_2005',
        'textures/streets/concrete_sealed_2005',
        'textures/props/window_glass_low_e_2005',
        'textures/props/metal_aluminum_2005',
        'textures/props/plastic_recycled_2005',
        'textures/props/glass_solar_panel_2005',
      ];
    case '2025':
      // Near Future: electric vehicles, hybrids, futuristic designs, eco-friendly
      return [
        'textures/buildings/glass_smart_2025',
        'textures/buildings/concrete_photocatalytic_2025',
        'textures/buildings/metal_composite_2025',
        'textures/streets/asphalt_recycled_2025',
        'textures/streets/concrete_permeable_2025',
        'textures/props/window_glass_electrochromic_2025',
        'textures/props/metal_titanium_2025',
        'textures/props/bioplastic_2025',
        'textures/props/glass_solar_road_2025',
        'textures/props/eco_friendly_fabric_2025',
      ];
    default:
      throw new Error(`Unknown era: ${era}`);
  }
}