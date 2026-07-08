import type { EraId, EraSpec } from '../eras.js';
import { ERA_REGISTRY } from '../eras.js';

/**
 * Timeline UI interface
 */
export interface TimelineUI {
  setEra(eraId: EraId): void;
  dispose(): void;
}

/**
 * Creates the timeline UI component that renders at the top of the screen
 * Provides buttons for each era year (1945, 1965, 1985, 2005, 2025)
 */
export function createTimelineUI(onEraChange: (eraId: EraId) => void): TimelineUI {
  // No-op for hover preview (can be extended for preview on hover)
  void onEraChange;
  // Create container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = 'max(10px, env(safe-area-inset-top))';
  container.style.left = '50%';
  container.style.transform = 'translateX(-50%)';
  container.style.zIndex = '1000';
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '8px';
  container.style.padding = '10px 15px';
  container.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
  container.style.borderRadius = '8px';
  container.style.backdropFilter = 'blur(5px)';
  container.style.maxWidth = '95vw';
  container.style.minWidth = 'min(280px, 95vw)';
  container.style.boxSizing = 'border-box';

  // Create buttons for each era
  const buttons: Map<string, HTMLButtonElement> = new Map();
  const buttonElements: HTMLButtonElement[] = [];

  ERA_REGISTRY.forEach((era: EraSpec) => {
    const button = document.createElement('button');
    button.textContent = era.label;
    button.style.padding = '8px 12px';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.backgroundColor = era.id === '2025' ? '#4a90d9' : '#333';
    button.style.color = 'white';
    button.style.cursor = 'pointer';
    button.style.fontSize = '13px';
    button.style.fontWeight = 'bold';
    button.style.transition = 'all 0.2s ease';
    button.style.minWidth = 'auto';
    button.style.flex = '1 1 auto';

    button.addEventListener('mouseenter', () => {
      if (button.style.backgroundColor !== 'rgb(74, 144, 217)') {
        button.style.backgroundColor = '#555';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (button.style.backgroundColor !== 'rgb(74, 144, 217)') {
        button.style.backgroundColor = '#333';
      }
    });

    button.addEventListener('click', () => {
      // Reset all buttons
      buttons.forEach((btn) => {
        btn.style.backgroundColor = '#333';
      });
      // Highlight selected button
      button.style.backgroundColor = '#4a90d9';
      onEraChange(era.id);
    });

    buttons.set(era.id, button);
    buttonElements.push(button);
    container.appendChild(button);
  });

  // Add title
  const title = document.createElement('div');
  title.textContent = 'Time Period';
  title.style.color = 'white';
  title.style.fontSize = '13px';
  title.style.fontWeight = 'bold';
  title.style.marginRight = '8px';
  title.style.marginLeft = '2px';
  title.style.display = 'flex';
  title.style.alignItems = 'center';
  title.style.flexShrink = '0';
  // Get first button or use a placeholder node
  const firstButton = buttonElements[0] || document.createElement('div');
  container.insertBefore(title, firstButton);

  document.body.appendChild(container);

  return {
    setEra: (eraId: EraId) => {
      buttons.forEach((btn, id) => {
        btn.style.backgroundColor = id === eraId ? '#4a90d9' : '#333';
      });
    },

    dispose: () => {
      document.body.removeChild(container);
    }
  };
}