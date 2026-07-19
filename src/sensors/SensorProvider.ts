export interface SensorConfig {
  samplingIntervalMs: number;
  batchSize: number;
}

export interface SensorReading {
  timestamp: Date;
  sensorType: 'ambient_light' | 'geolocation' | 'device_motion';
  value: number | GeolocationCoordinates;
  unit: string;
  source: 'hardware' | 'user_input' | 'simulated';
}

export abstract class SensorProvider {
  protected config: SensorConfig;
  protected readings: SensorReading[] = [];
  protected running = false;
  
  constructor(config: SensorConfig) {
    this.config = config;
  }
  
  abstract start(): Promise<void>;
  abstract stop(): void;
  abstract isAvailable(): boolean;
  
  getLatest(): SensorReading | null {
    return this.readings[this.readings.length - 1] || null;
  }
  
  getHistory(since: Date): SensorReading[] {
    return this.readings.filter(r => r.timestamp >= since);
  }
}

// Real geolocation provider
export class GeolocationProvider extends SensorProvider {
  private watchId: number | null = null;
  
  async start(): Promise<void> {
    if (!navigator.geolocation) return;
    this.running = true;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.readings.push({
          timestamp: new Date(),
          sensorType: 'geolocation',
          value: pos.coords,
          unit: 'degrees',
          source: 'hardware'
        });
        // Keep last 100 readings
        if (this.readings.length > 100) this.readings.shift();
      },
      (err) => console.error('Geolocation error:', err),
      { enableHighAccuracy: false, maximumAge: 300000 } // 5 min cache
    );
  }
  
  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.running = false;
  }
  
  isAvailable(): boolean {
    return 'geolocation' in navigator;
  }
}

// Real ambient light (Chrome/Android only, behind flag)
export class AmbientLightProvider extends SensorProvider {
  private sensor: any = null;
  
  async start(): Promise<void> {
    try {
      // @ts-ignore
      const AmbientLightSensor = window.AmbientLightSensor;
      if (!AmbientLightSensor) return;
      
      this.sensor = new AmbientLightSensor({ frequency: 1 });
      this.sensor.addEventListener('reading', () => {
        this.readings.push({
          timestamp: new Date(),
          sensorType: 'ambient_light',
          value: this.sensor.illuminance,
          unit: 'lux',
          source: 'hardware'
        });
        if (this.readings.length > 1000) this.readings.shift();
      });
      this.sensor.start();
      this.running = true;
    } catch (e) {
      console.error('Ambient light sensor failed:', e);
    }
  }
  
  stop(): void {
    if (this.sensor) {
      this.sensor.stop();
      this.sensor = null;
    }
    this.running = false;
  }
  
  isAvailable(): boolean {
    // @ts-ignore
    return 'AmbientLightSensor' in window;
  }
}

// User input fallback
export class UserInputProvider extends SensorProvider {
  async start(): Promise<void> {
    this.running = true;
  }
  
  stop(): void {
    this.running = false;
  }
  
  isAvailable(): boolean {
    return true; // always available
  }
  
  // Called from check-in flow
  submitLightLevel(level: 'Direct' | 'Indirect' | 'Low'): void {
    const luxMap = { Direct: 10000, Indirect: 1000, Low: 100 };
    this.readings.push({
      timestamp: new Date(),
      sensorType: 'ambient_light',
      value: luxMap[level],
      unit: 'lux',
      source: 'user_input'
    });
  }
  
  submitLocation(lat: number, lon: number): void {
    this.readings.push({
      timestamp: new Date(),
      sensorType: 'geolocation',
      value: { latitude: lat, longitude: lon } as any,
      unit: 'degrees',
      source: 'user_input'
    });
  }
}

// Simulated provider for testing
export class SimulatedProvider extends SensorProvider {
  private intervalId: any = null;
  
  async start(): Promise<void> {
    this.running = true;
    this.intervalId = setInterval(() => {
      this.readings.push({
        timestamp: new Date(),
        sensorType: 'ambient_light',
        value: 500 + Math.random() * 500,
        unit: 'lux',
        source: 'simulated'
      });
    }, this.config.samplingIntervalMs);
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.running = false;
  }
  
  isAvailable(): boolean {
    return true;
  }
}

// Factory
export function createSensorProvider(
  type: 'ambient_light' | 'geolocation',
  preferHardware: boolean = true
): SensorProvider {
  if (preferHardware) {
    if (type === 'geolocation') {
      const geo = new GeolocationProvider({ samplingIntervalMs: 300000, batchSize: 1 });
      if (geo.isAvailable()) return geo;
    }
    if (type === 'ambient_light') {
      const light = new AmbientLightProvider({ samplingIntervalMs: 1000, batchSize: 60 });
      if (light.isAvailable()) return light;
    }
  }
  
  // Fallback chain: user input > simulated
  return new UserInputProvider({ samplingIntervalMs: Infinity, batchSize: 1 });
}
