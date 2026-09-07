
import { CityBlockLayout } from '../../layout/cityBlockLayout';

export interface StorefrontWindowDecal {
 readonly text: string;
}

export interface EraStorefront {
 readonly id: string;
 readonly lotIndex: number;
 readonly name: string;
 readonly kind:
 | 'coffee_chain'
 | 'mobile_phone'
 | 'atm'
 | 'dry_cleaner'
 | 'discount_variety'
 | 'gym';
 /** Branded apron / staff uniform colour. */
 readonly apronColor: string;
 /** Menu boards / equipment posters present. */
 readonly menuBoards: boolean;
 readonly equipmentPosters: boolean;
 /** Storefront window decals (SALE / OPEN 24h). */
 readonly windowDecals: readonly string[];
}

export interface EraStorefronts {
 readonly storefronts: readonly EraStorefront[];
 /** The internet-cafe poster (street-level ad). */
 readonly internetCafePoster: boolean;
}

export function createEra2005Storefronts(
 layout: CityBlockLayout,
): EraStorefronts {
 const storefronts: EraStorefront[] = [];
 const lotCount = layout.lots.length; void lotCount;
 // Coffee chain on lot 0, mobile phone on lot 1, ATM in wall lot 2,
 // dry cleaner lot 3, discount variety lot 5, gym lot 6.

 const plan: Array<[number, EraStorefront['kind'], string, string[]]> = [
 [0, 'coffee_chain', 'Bean &amp; Roast', ['OPEN 24h']],
 [1, 'mobile_phone', 'CellWave Phones', ['SALE']],
 [2, 'atm', 'CityBank ATM', []],
 [3, 'dry_cleaner', 'Press &amp; Fold Cleaners', ['OPEN 24h']],
 [5, 'discount_variety', 'Dollar Deals', ['SALE']],
 [6, 'gym', 'IronCore Fitness', []],
 ];
 for (const [lotIndex, kind, name, decals] of plan) {
 storefronts.push({
 id: `era2005-storefront-${lotIndex}`,
 lotIndex,
 name,
 kind,
 apronColor: kind === 'coffee_chain' ? '#1c3a5e' : kind === 'mobile_phone' ? '#004f9e' : '#333',
 menuBoards: kind === 'coffee_chain' || kind === 'mobile_phone',
 equipmentPosters: kind === 'gym',
 windowDecals: decals,
 });
 }
 return {
 storefronts,
 internetCafePoster: true,
 };
}
