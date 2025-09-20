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

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  visibility: number;
  alerts: string[];
  forecast: {
    date: string;
    temp: number;
    condition: string;
    precipitation: number;
    windSpeed: number;
  }[];
}

interface WeatherWidgetProps {
  location?: string;
  showForecast?: boolean;
  compact?: boolean;
}

export function WeatherWidget({ location = "Auckland, NZ", showForecast = true, compact = false }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock weather data - in production this would fetch from OpenWeatherMap API
  useEffect(() => {
    const fetchWeather = () => {
      const conditions = ['sunny', 'partly-cloudy', 'cloudy', 'rainy', 'windy', 'stormy'];
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      
      const mockWeather: WeatherData = {
        temperature: Math.floor(Math.random() * 15) + 12, // 12-27°C
        condition,
        humidity: Math.floor(Math.random() * 40) + 45, // 45-85%
        windSpeed: Math.floor(Math.random() * 25) + 5, // 5-30 km/h
        precipitation: condition === 'rainy' || condition === 'stormy' 
          ? Math.floor(Math.random() * 70) + 20 
          : Math.floor(Math.random() * 10),
        visibility: condition === 'stormy' ? 3 : condition === 'rainy' ? 8 : 15,
        alerts: condition === 'stormy' 
          ? ['High Wind Warning', 'Work Suspension Recommended'] 
          : condition === 'windy' && Math.random() > 0.5
          ? ['Strong Wind Advisory']
          : [],
        forecast: Array.from({ length: 7 }, (_, i) => {
          const forecastCondition = conditions[Math.floor(Math.random() * conditions.length)];
          return {
            date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toLocaleDateString('en-NZ', { 
              weekday: 'short', 
              day: 'numeric' 
            }),
            temp: Math.floor(Math.random() * 15) + 10,
            condition: forecastCondition,
            precipitation: forecastCondition === 'rainy' || forecastCondition === 'stormy' ? 70 : 10,
            windSpeed: Math.floor(Math.random() * 20) + 5
          };
        })
      };
      
      setWeather(mockWeather);
      setLoading(false);
    };

    fetchWeather();
    // Refresh weather data every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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

  const getWorkSuitability = (weather: WeatherData) => {
    if (weather.alerts.some(alert => alert.includes('Work Suspension'))) {
      return { level: 'dangerous', text: 'Work Not Recommended', color: 'bg-red-500' };
    }
    if (weather.windSpeed > 20 || weather.precipitation > 50) {
      return { level: 'caution', text: 'Exercise Caution', color: 'bg-orange-500' };
    }
    if (weather.windSpeed > 15 || weather.precipitation > 20) {
      return { level: 'monitor', text: 'Monitor Conditions', color: 'bg-yellow-500' };
    }
    return { level: 'good', text: 'Good for Tree Work', color: 'bg-green-500' };
  };

  if (loading) {
    return (
      <Card className={compact ? "p-4" : ""}>
        <CardContent className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </CardContent>
      </Card>
    );
  }

  if (!weather) return null;

  const workSuitability = getWorkSuitability(weather);

  if (compact) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getWeatherIcon(weather.condition)}
              <div>
                <div className="text-2xl font-bold">{weather.temperature}°C</div>
                <div className="text-sm text-muted-foreground capitalize">{weather.condition}</div>
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
              <div className="text-muted-foreground capitalize">{weather.condition}</div>
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
            {weather.alerts.map((alert, index) => (
              <Alert key={index} className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{alert}</AlertDescription>
              </Alert>
            ))}
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
              {weather.forecast.map((day, index) => (
                <div key={index} className="text-center p-2 rounded-md bg-muted/50">
                  <div className="text-xs font-medium text-muted-foreground">{day.date}</div>
                  <div className="my-1">
                    {getWeatherIcon(day.condition)}
                  </div>
                  <div className="text-sm font-medium">{day.temp}°C</div>
                  <div className="text-xs text-blue-600">{day.precipitation}%</div>
                  <div className="text-xs text-gray-600">{day.windSpeed}km/h</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            View Alerts
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Weather Impact
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}