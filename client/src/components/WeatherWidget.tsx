import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Cloud, 
  Sun, 
  CloudRain, 
  Wind, 
  Thermometer, 
  Droplets, 
  AlertTriangle,
  Eye,
  Calendar
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  windDirection?: string;
  precipitation: number;
  visibility: number;
  pressure?: number;
  uvIndex?: number;
  alerts: string[];
  forecast: {
    date: string;
    temp: number;
    condition: string;
    precipitation: number;
    windSpeed: number;
    humidity: number;
    visibility: number;
  }[];
  lastUpdated: string;
}

interface SafetyRecommendation {
  level: 'safe' | 'caution' | 'unsafe' | 'suspended';
  message: string;
  recommendations: string[];
}

interface WeatherApiResponse {
  success: boolean;
  data: WeatherData;
}

interface SafetyApiResponse {
  success: boolean;
  data: {
    weather: WeatherData;
    recommendation: SafetyRecommendation;
  };
}

interface WeatherWidgetProps {
  location?: string;
  showForecast?: boolean;
  compact?: boolean;
  showSafetyRecommendations?: boolean;
}

export function WeatherWidget({ 
  location = "Auckland, NZ", 
  showForecast = true, 
  compact = false, 
  showSafetyRecommendations = true 
}: WeatherWidgetProps) {
  // Fetch current weather data from API
  const { data: weatherResponse, isLoading, error } = useQuery<WeatherApiResponse>({
    queryKey: [`/api/weather/current?location=${encodeURIComponent(location)}`],
    refetchInterval: 30 * 60 * 1000, // Refresh every 30 minutes
  });

  // Fetch safety recommendations if requested
  const { data: safetyResponse } = useQuery<SafetyApiResponse>({
    queryKey: [`/api/weather/safety-recommendation?location=${encodeURIComponent(location)}`],
    enabled: showSafetyRecommendations,
    refetchInterval: 30 * 60 * 1000,
  });

  const weather = weatherResponse?.data;
  const safety = safetyResponse?.data?.recommendation;

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case 'sunny': return <Sun className="h-8 w-8 text-yellow-500" />;
      case 'partly-cloudy': return <Cloud className="h-8 w-8 text-gray-400" />;
      case 'cloudy': return <Cloud className="h-8 w-8 text-gray-500" />;
      case 'rainy': return <CloudRain className="h-8 w-8 text-blue-500" />;
      case 'windy': return <Wind className="h-8 w-8 text-gray-600" />;
      case 'stormy': return <CloudRain className="h-8 w-8 text-red-500" />;
      default: return <Sun className="h-8 w-8 text-yellow-500" />;
    }
  };

  const getWorkSuitability = (weather: WeatherData, safety?: SafetyRecommendation) => {
    if (safety) {
      switch (safety.level) {
        case 'suspended':
          return { level: 'suspended', text: 'Work Suspended', color: 'bg-red-600' };
        case 'unsafe':
          return { level: 'unsafe', text: 'Unsafe Conditions', color: 'bg-red-500' };
        case 'caution':
          return { level: 'caution', text: 'Exercise Caution', color: 'bg-orange-500' };
        case 'safe':
          return { level: 'safe', text: 'Good for Tree Work', color: 'bg-green-500' };
      }
    }
    
    // Fallback logic
    if (weather.alerts.some(alert => alert.includes('suspension') || alert.includes('warning'))) {
      return { level: 'dangerous', text: 'Work Not Recommended', color: 'bg-red-500' };
    }
    if (weather.windSpeed > 25 || weather.precipitation > 50) {
      return { level: 'caution', text: 'Exercise Caution', color: 'bg-orange-500' };
    }
    if (weather.windSpeed > 20 || weather.precipitation > 30) {
      return { level: 'monitor', text: 'Monitor Conditions', color: 'bg-yellow-500' };
    }
    return { level: 'good', text: 'Good for Tree Work', color: 'bg-green-500' };
  };

  if (isLoading) {
    return (
      <Card className={compact ? "p-4" : ""}>
        <CardContent className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={compact ? "p-4" : ""}>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load weather data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!weather) return null;

  const workSuitability = getWorkSuitability(weather, safety);

  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getWeatherIcon(weather.condition)}
              <div>
                <div className="text-2xl font-bold">{weather.temperature}°C</div>
                <div className="text-sm text-muted-foreground capitalize">{weather.condition.replace('-', ' ')}</div>
                {weather.windDirection && (
                  <div className="text-xs text-muted-foreground">{weather.windSpeed} km/h {weather.windDirection}</div>
                )}
              </div>
            </div>
            <Badge className={`${workSuitability.color} text-white`}>
              {workSuitability.text}
            </Badge>
          </div>
          {weather.alerts.length > 0 && (
            <Alert className="mt-2 border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {weather.alerts[0]}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Weather Conditions - {location}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Weather */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-4">
            {getWeatherIcon(weather.condition)}
            <div>
              <div className="text-3xl font-bold">{weather.temperature}°C</div>
              <div className="text-muted-foreground capitalize">{weather.condition.replace('-', ' ')}</div>
              {weather.windDirection && (
                <div className="text-sm text-muted-foreground">{weather.windSpeed} km/h {weather.windDirection}</div>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Badge className={`${workSuitability.color} text-white w-full justify-center`}>
              {workSuitability.text}
            </Badge>
            <div className="text-xs text-muted-foreground text-center">
              Tree Work Safety Status
            </div>
          </div>
        </div>

        {/* Weather Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{weather.windSpeed} km/h</div>
              <div className="text-xs text-muted-foreground">Wind Speed</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium">{weather.humidity}%</div>
              <div className="text-xs text-muted-foreground">Humidity</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <CloudRain className="h-4 w-4 text-blue-600" />
            <div>
              <div className="text-sm font-medium">{weather.precipitation}%</div>
              <div className="text-xs text-muted-foreground">Rain Chance</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-gray-500" />
            <div>
              <div className="text-sm font-medium">{weather.visibility} km</div>
              <div className="text-xs text-muted-foreground">Visibility</div>
            </div>
          </div>
        </div>

        {/* Weather Alerts */}
        {weather.alerts.length > 0 && (
          <div className="space-y-2">
            {weather.alerts.map((alert: string, index: number) => {
              const alertLevel = alert.includes('suspension') || alert.includes('warning') ? 'error' : 'warning';
              return (
                <Alert key={index} className={alertLevel === 'error' ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-200'}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="capitalize">{alert.replace(/_/g, ' ')}</AlertDescription>
                </Alert>
              );
            })}
          </div>
        )}
        
        {/* Safety Recommendations */}
        {safety && showSafetyRecommendations && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Safety Recommendations</h4>
            <Alert className={safety.level === 'suspended' || safety.level === 'unsafe' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">{safety.message}</p>
                  <ul className="text-xs space-y-1">
                    {safety.recommendations.slice(0, 3).map((rec: string, index: number) => (
                      <li key={index} className="flex items-center gap-1">
                        <span className="w-1 h-1 bg-current rounded-full flex-shrink-0"></span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* 7-Day Forecast */}
        {showForecast && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              7-Day Forecast
            </h4>
            <div className="grid grid-cols-7 gap-1">
              {weather.forecast.map((day: any, index: number) => (
                <div key={index} className="text-center p-2 rounded-md bg-muted/50">
                  <div className="text-xs font-medium text-muted-foreground">{day.date}</div>
                  <div className="my-1">
                    {getWeatherIcon(day.condition)}
                  </div>
                  <div className="text-sm font-medium">{day.temp}°C</div>
                  <div className="text-xs text-blue-600">{day.precipitation}%</div>
                  <div className="text-xs text-gray-600">{day.windSpeed}km/h</div>
                  <div className="text-xs text-muted-foreground">{day.visibility}km vis</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-xs text-muted-foreground text-center pt-2">
          Last updated: {new Date(weather.lastUpdated).toLocaleTimeString('en-NZ', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </CardContent>
    </Card>
  );
}