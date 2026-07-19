import { CheckIn, StressorType, Prediction } from '../types';

/**
 * PhytoGuard Heuristic Advice Engine
 * Static rules matched against check-in telemetry to predict stress
 * and suggest clinical interventions.
 */
export const RuleEngine = {
  /**
   * Evaluates a check-in against botanical heuristics
   */
  assessStress(checkIn: CheckIn): Partial<Prediction> {
    const reasoning: string[] = [];
    let riskScore = 0;
    let primaryStressor: StressorType = 'Unknown';

    // Rule 1: Desiccation Check
    if (checkIn.soilMoisture === 'Dry' && (checkIn.weatherTemp || 0) > 28) {
      riskScore += 45;
      primaryStressor = 'Water';
      reasoning.push('Critical soil desiccation detected during high-temperature phase.');
    }

    // Rule 2: Photosynthesis Saturation
    if (checkIn.lightLevel === 'Direct' && checkIn.changes.includes('dropped_leaf')) {
      riskScore += 30;
      primaryStressor = 'Light';
      reasoning.push('Potential photo-inhibition or leaf scorch from high-intensity UV exposure.');
    }

    // Rule 3: Fungal Environment
    if (checkIn.soilMoisture === 'Wet' && (checkIn.weatherHumidity || 0) > 80) {
      riskScore += 40;
      primaryStressor = 'Humidity';
      reasoning.push('Combination of stagnant soil moisture and high humidity increases fungal pathogen risk.');
    }

    // Rule 4: Metabolic Slowdown
    if ((checkIn.weatherTemp || 0) < 10) {
      riskScore += 25;
      primaryStressor = 'Temperature';
      reasoning.push('Thermal threshold breached; physiological processes entering dormancy or cold stress.');
    }

    // Default: Healthy Baseline
    if (reasoning.length === 0) {
      riskScore = 5;
      reasoning.push('Specifications remain within expected physiological boundaries.');
    }

    return {
      riskScore: Math.min(100, riskScore),
      primaryStressor,
      reasoning,
      confidence: 85,
      predictedAt: new Date(),
      triggeredAlert: riskScore > 40 ? 1 : 0
    };
  },

  /**
   * Generates a clinical protocol based on predicted stressor
   */
  getProtocol(stressor: StressorType): string[] {
    switch (stressor) {
      case 'Water':
        return [
          'Hydrate at base level immediately.',
          'Implement bottom-watering for deep root penetration.',
          'Consider moisture-retentive topping (mulch).'
        ];
      case 'Light':
        return [
          'Relocate to filtered/indirect sanctuary.',
          'Prune scorched specimens to conserve energy.',
          'Apply silica-based foliar strengthening.'
        ];
      case 'Humidity':
        return [
          'Increase atmospheric circulation.',
          'Cease foliar misting protocols.',
          'Monitor for powdery mildew or leaf spot.'
        ];
      default:
        return ['Maintain current observation schedule.', 'Monitor for phenotypic shifts.'];
    }
  }
};
