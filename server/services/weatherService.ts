import { z } from 'zod';

// Weather data schemas
export const WeatherCondition = z.enum([
  'sunny', 'partly-cloudy', 'cloudy', 'rainy', 'windy', 'stormy', 'fog', 'snow'
]);

export const WeatherAlert = z.enum([
  'high_wind_warning', 'work_suspension_recommended', 'strong_wind_advisory',
  'storm_warning', 'heavy_rain_warning', 'fog_advisory', 'heat_warning'
]);

export const ForecastDay = z.object({
  date: z.string(),
  temp: z.number(),
  condition: WeatherCondition,
  precipitation: z.number(), // percentage
  windSpeed: z.number(), // km/h
  humidity: z.number(), // percentage
  visibility: z.number(), // km
});

export const WeatherData = z.object({
  location: z.string(),
  temperature: z.number(), // °C
  condition: WeatherCondition,
  humidity: z.number(), // percentage
  windSpeed: z.number(), // km/h
  windDirection: z.string().optional(),
  precipitation: z.number(), // mm or percentage
  visibility: z.number(), // km
  pressure: z.number().optional(), // hPa
  uvIndex: z.number().optional(),
  alerts: z.array(WeatherAlert),
  forecast: z.array(ForecastDay),
  lastUpdated: z.date(),
});

export type WeatherConditionType = z.infer<typeof WeatherCondition>;
export type WeatherAlertType = z.infer<typeof WeatherAlert>;
export type ForecastDayType = z.infer<typeof ForecastDay>;
export type WeatherDataType = z.infer<typeof WeatherData>;

// Tree work safety thresholds
export const SAFETY_THRESHOLDS = {
  WIND_SPEED: {
    CAUTION: 25, // km/h - exercise caution
    UNSAFE: 40,  // km/h - suspend work
    CRITICAL: 60, // km/h - emergency conditions
  },
  VISIBILITY: {
    POOR: 5,     // km - poor visibility
    UNSAFE: 2,   // km - unsafe conditions
  },
  PRECIPITATION: {
    LIGHT: 20,   // % - light rain
    MODERATE: 50, // % - moderate rain
    HEAVY: 70,   // % - heavy rain
  }
};

export class WeatherService {
  private static instance: WeatherService;
  
  static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  async getCurrentWeather(location: string = "Auckland, NZ"): Promise<WeatherDataType> {
    // In production, this would call a real weather API like OpenWeatherMap
    // For now, return enhanced mock data that's more realistic for New Zealand
    
    const conditions: WeatherConditionType[] = ['sunny', 'partly-cloudy', 'cloudy', 'rainy', 'windy'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    
    const temperature = this.getSeasonalTemp();
    const windSpeed = Math.floor(Math.random() * 35) + 5; // 5-40 km/h
    const humidity = Math.floor(Math.random() * 40) + 50; // 50-90% (NZ is humid)
    const visibility = condition === 'stormy' ? 3 : condition === 'rainy' ? 8 : 15;
    const precipitation = this.getPrecipitationForCondition(condition);
    
    const alerts = this.generateSafetyAlerts({
      condition,
      windSpeed,
      visibility,
      precipitation: precipitation
    });

    const forecast = this.generateForecast();

    return {
      location,
      temperature,
      condition,
      humidity,
      windSpeed,
      windDirection: this.getRandomWindDirection(),
      precipitation,
      visibility,
      pressure: Math.floor(Math.random() * 50) + 1000, // 1000-1050 hPa
      uvIndex: condition === 'sunny' ? Math.floor(Math.random() * 6) + 5 : Math.floor(Math.random() * 4) + 1,
      alerts,
      forecast,
      lastUpdated: new Date(),
    };
  }

  private getSeasonalTemp(): number {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    
    // New Zealand seasons (Southern Hemisphere)
    if (month >= 11 || month <= 2) { // Summer: Dec, Jan, Feb
      return Math.floor(Math.random() * 12) + 18; // 18-30°C
    } else if (month >= 3 && month <= 5) { // Autumn: Mar, Apr, May
      return Math.floor(Math.random() * 10) + 12; // 12-22°C
    } else if (month >= 6 && month <= 8) { // Winter: Jun, Jul, Aug
      return Math.floor(Math.random() * 8) + 8; // 8-16°C
    } else { // Spring: Sep, Oct, Nov
      return Math.floor(Math.random() * 10) + 14; // 14-24°C
    }
  }

  private getPrecipitationForCondition(condition: WeatherConditionType): number {
    switch (condition) {
      case 'stormy':
        return Math.floor(Math.random() * 30) + 70; // 70-100%
      case 'rainy':
        return Math.floor(Math.random() * 50) + 40; // 40-90%
      case 'cloudy':
        return Math.floor(Math.random() * 20) + 10; // 10-30%
      default:
        return Math.floor(Math.random() * 10); // 0-10%
    }
  }

  private getRandomWindDirection(): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.floor(Math.random() * directions.length)];
  }

  private generateSafetyAlerts(weather: {
    condition: WeatherConditionType;
    windSpeed: number;
    visibility: number;
    precipitation: number;
  }): WeatherAlertType[] {
    const alerts: WeatherAlertType[] = [];

    // Wind-based alerts
    if (weather.windSpeed >= SAFETY_THRESHOLDS.WIND_SPEED.CRITICAL) {
      alerts.push('work_suspension_recommended');
    } else if (weather.windSpeed >= SAFETY_THRESHOLDS.WIND_SPEED.UNSAFE) {
      alerts.push('high_wind_warning');
    } else if (weather.windSpeed >= SAFETY_THRESHOLDS.WIND_SPEED.CAUTION) {
      alerts.push('strong_wind_advisory');
    }

    // Weather condition alerts
    if (weather.condition === 'stormy') {
      alerts.push('storm_warning');
      if (!alerts.includes('work_suspension_recommended')) {
        alerts.push('work_suspension_recommended');
      }
    }

    // Precipitation alerts
    if (weather.precipitation >= SAFETY_THRESHOLDS.PRECIPITATION.HEAVY) {
      alerts.push('heavy_rain_warning');
    }

    // Visibility alerts
    if (weather.visibility <= SAFETY_THRESHOLDS.VISIBILITY.UNSAFE) {
      alerts.push('fog_advisory');
    }

    return alerts;
  }

  private generateForecast(): ForecastDayType[] {
    const conditions: WeatherConditionType[] = ['sunny', 'partly-cloudy', 'cloudy', 'rainy', 'windy'];
    
    return Array.from({ length: 7 }, (_, i) => {
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      const temp = this.getSeasonalTemp();
      
      return {
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toLocaleDateString('en-NZ', { 
          weekday: 'short', 
          day: 'numeric',
          month: 'short'
        }),
        temp,
        condition,
        precipitation: this.getPrecipitationForCondition(condition),
        windSpeed: Math.floor(Math.random() * 30) + 5,
        humidity: Math.floor(Math.random() * 40) + 50,
        visibility: condition === 'stormy' ? 3 : condition === 'rainy' ? 8 : 15,
      };
    });
  }

  // Get work safety recommendation based on weather
  getWorkSafetyRecommendation(weather: WeatherDataType): {
    level: 'safe' | 'caution' | 'unsafe' | 'suspended';
    message: string;
    recommendations: string[];
  } {
    const { windSpeed, condition, visibility, precipitation } = weather;
    
    // Critical conditions - work suspension
    if (windSpeed >= SAFETY_THRESHOLDS.WIND_SPEED.UNSAFE || 
        condition === 'stormy' ||
        visibility <= SAFETY_THRESHOLDS.VISIBILITY.UNSAFE ||
        precipitation >= SAFETY_THRESHOLDS.PRECIPITATION.HEAVY) {
      return {
        level: 'suspended',
        message: 'Work suspension recommended due to unsafe conditions',
        recommendations: [
          'Suspend all tree removal operations',
          'Secure equipment and materials',
          'Monitor weather conditions hourly',
          'Notify customers of delays',
          'Review safety protocols with crew'
        ]
      };
    }

    // Unsafe but not critical
    if (windSpeed >= SAFETY_THRESHOLDS.WIND_SPEED.CAUTION ||
        precipitation >= SAFETY_THRESHOLDS.PRECIPITATION.MODERATE ||
        visibility <= SAFETY_THRESHOLDS.VISIBILITY.POOR) {
      return {
        level: 'unsafe',
        message: 'Unsafe conditions - consider postponing non-urgent work',
        recommendations: [
          'Only emergency work should proceed',
          'Use additional safety equipment',
          'Increase crew supervision',
          'Limit work to ground level only',
          'Monitor conditions continuously'
        ]
      };
    }

    // Caution required
    if (windSpeed >= 20 || precipitation >= SAFETY_THRESHOLDS.PRECIPITATION.LIGHT) {
      return {
        level: 'caution',
        message: 'Exercise caution - conditions require extra safety measures',
        recommendations: [
          'Brief crew on current conditions',
          'Use appropriate PPE for weather',
          'Take frequent safety breaks',
          'Monitor weather updates hourly',
          'Have contingency plans ready'
        ]
      };
    }

    // Safe conditions
    return {
      level: 'safe',
      message: 'Good conditions for tree removal operations',
      recommendations: [
        'Normal safety protocols apply',
        'Optimal conditions for productivity',
        'Good visibility for equipment operation',
        'Continue monitoring weather updates'
      ]
    };
  }
}

export const weatherService = WeatherService.getInstance();