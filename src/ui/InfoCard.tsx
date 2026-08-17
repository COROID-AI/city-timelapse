import type { EraInfo } from '../eras/types';
import { useStore } from '../state/store';

export function InfoCard() {
  const selectedPOI = useStore(state => state.selectedPOI);
  const currentEraKey = useStore(state => state.currentEra);

  if (!selectedPOI) return null;

  const poiData: Record<string, { name: string; desc: string; year: number }> = {
    'city-center': {
      name: 'City Center',
      desc: `The heart of the city block as it was in ${currentEraKey}.`,
      year: Number(currentEraKey),
    },
  };

  const data = poiData[selectedPOI];
  if (!data) return null;

  return (
    <div className="info-card">
      <h3>{data.name}</h3>
      <p>{data.desc}</p>
      <span className="info-year">{data.year}</span>
      <button className="close-info" onClick={() => useStore.getState().setSelectedPOI(null)}>✕</button>
    </div>
  );
}
