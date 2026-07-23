// SceneManager.js
// Handles transitions between different year scenes

class SceneManager {
  constructor() {
    this.currentYear = 1945;
    this.scenes = {
      1945: new Scene1945(),
      1965: new Scene1965(),
      1985: new Scene1985(),
      2005: new Scene2005(),
      2055: new Scene2055()
    };
  }

  switchYear(year) {
    if (this.currentYear !== year) {
      this.scenes[year].render();
      this.currentYear = year;
    }
  }
}

// Basic scene classes (to be expanded)
class SceneBase {
  render() {
    // Implementation specific to each year
  }
}