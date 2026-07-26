import { useTimeline } from '../context/TimelineContext';
import './EraInfoPanel.css';

export const EraInfoPanel = () => {
  const { currentEra, targetEra, isTransitioning, transitionProgress, currentConfig, targetConfig } = useTimeline();

  const eraData = targetConfig.era;
  const displayYear = isTransitioning ? targetEra : currentEra;

  return (
    <div className="era-info-panel">
      <div className="era-info-content">
        <div className="era-year-display">
          <span className="year-number" style={{ color: eraData.color }}>
            {displayYear}
          </span>
          <span className="year-label">{eraData.description}</span>
        </div>

        {isTransitioning && (
          <div className="transition-bar">
            <div
              className="transition-fill"
              style={{
                width: `${transitionProgress * 100}%`,
                background: `linear(90deg, ${currentConfig.era.color}, ${targetConfig.era.color})`,
              }}
            />
          </div>
        )}

        <div className="era-details">
          <div className="detail-row">
            <span className="detail-label">Architecture</span>
            <span className="detail-value">{targetConfig.buildingStyle}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Vehicles</span>
            <span className="detail-value">{targetConfig.vehicleType}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Transport</span>
            <span className="detail-value">{targetConfig.hasFlyingCars ? 'Flying Cars' : 'Ground'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Ads</span>
            <span className="detail-value">{targetConfig.adStyle}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
