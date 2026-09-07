
import { CityBlockLayout } from '../../layout/cityBlockLayout';

export type AdSurface =
  | 'vinyl_banner'
  | 'bus_shelter_posters'
  | 'construction_hoarding'
  | 'storefront_window_decal'
  | 'internet_cafe_poster';

export interface EraAd {
  readonly id: string;
  readonly surface: AdSurface;
  readonly headline: string;
  readonly lotIndex?: number;
}

export interface EraAds {
  readonly ads: readonly EraAd[];
}

export function createEra2005Ads(
  _layout: CityBlockLayout,
): EraAds {
  const ads: EraAd[] = [];
  ads.push({ id: 'ad-banner-1', surface: 'vinyl_banner', headline: 'SKYLINE CONDOS — NOW SELLING' });
  ads.push({ id: 'ad-banner-2', surface: 'vinyl_banner', headline: 'CITY WIRELESS — SWITCH &amp; SAVE' });
  ads.push({ id: 'ad-banner-3', surface: 'vinyl_banner', headline: 'METROBANK — OUR CITY, OUR FUTURE' });
  ads.push({ id: 'ad-bus-shelter-1', surface: 'bus_shelter_posters', headline: 'MOBILE 3G — EVERYONE IS CONNECTED' });
  ads.push({ id: 'ad-bus-shelter-2', surface: 'bus_shelter_posters', headline: 'BODYSHOP GYM — NEW MEMBERS WELCOME' });
  ads.push({ id: 'ad-hoarding-1', surface: 'construction_hoarding', headline: 'COMING 2007: THE RESERVE CONDOS' });
  ads.push({ id: 'ad-hoarding-2', surface: 'construction_hoarding', headline: 'NOW LEASING — RETAIL SPACE' });
  ads.push({ id: 'ad-window-1', surface: 'storefront_window_decal', headline: 'SALE' });
  ads.push({ id: 'ad-window-2', surface: 'storefront_window_decal', headline: 'OPEN 24h' });
  ads.push({ id: 'ad-internet-cafe', surface: 'internet_cafe_poster', headline: 'CYBERCAFE — 1 HR FREE WI-FI' });
  return { ads };
}
