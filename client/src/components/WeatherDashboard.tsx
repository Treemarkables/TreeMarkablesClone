import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Cloud, 
  Sun, 
  CloudRain, 
  Wind, 
  Thermometer, 
  Droplets, 
  AlertTriangle,
  Eye,
  Calendar,
  MapPin,
  RefreshCw,
  Clock,
  Shield,
  TrendingUp,
  Gauge
} from 'lucide-react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { WeatherWidget } from './WeatherWidget';

interface WeatherLocation {
  name: string;
  coordinates?: string;
  isDefault?: boolean;
}

interface WeatherDashboardProps {
  locations?: WeatherLocation[];
  showJobImpact?: boolean;
  compact?: boolean;
}

export function WeatherDashboard({ 
  locations = [
    { name: "Auckland, NZ", isDefault: true },
    { name: "Wellington, NZ" },
    { name: "Christchurch, NZ" },
    { name: "Hamilton, NZ" }
  ], 
  showJobImpact = true,
  compact = false 
}: WeatherDashboardProps) {
  const defaultLocation = locations.find(loc => loc.isDefault) || locations[0];

  // Fetch weather data for multiple locations
  const weatherQueries = useQueries({
    queries: locations.map(location => ({
      queryKey: [`/api/weather/current?location=${encodeURIComponent(location.name)}`],
      refetchInterval: 30 * 60 * 1000, // 30 minutes
    }))
  });

  // Fetch safety recommendations for default location
  const { data: safetyData } = useQuery({
    queryKey: [`/api/weather/safety-recommendation?location=${encodeURIComponent(defaultLocation?.name || '')}`],
    refetchInterval: 30 * 60 * 1000,
  });

  const allWeatherData = weatherQueries.map(query => query.data?.data).filter(Boolean);
  const isLoading = weatherQueries.some(query => query.isLoading);
  const hasError = weatherQueries.some(query => query.error);

  const getOperationalStatus = () => {
    if (!safetyData?.data?.recommendation) return null;
    
    const recommendation = safetyData.data.recommendation;
    switch (recommendation.level) {
      case 'suspended':
        return { 
          status: 'Suspended', 
          color: 'bg-red-600 text-white',
          icon: <Shield className="h-4 w-4" />,
          message: 'All operations suspended'
        };
      case 'unsafe':
        return { 
          status: 'Restricted', 
          color: 'bg-red-500 text-white',
          icon: <AlertTriangle className="h-4 w-4" />,
          message: 'Emergency work only'
        };
      case 'caution':
        return { 
          status: 'Caution', 
          color: 'bg-orange-500 text-white',
          icon: <AlertTriangle className="h-4 w-4" />,
          message: 'Extra safety measures required'
        };
      case 'safe':
        return { 
          status: 'Normal', 
          color: 'bg-green-500 text-white',
          icon: <Shield className="h-4 w-4" />,
          message: 'All operations cleared'
        };
      default:
        return null;
    }
  };

  const getRegionalOverview = () => {
    if (allWeatherData.length === 0) return null;
    
    const avgTemp = Math.round(allWeatherData.reduce((sum, w) => sum + w.temperature, 0) / allWeatherData.length);
    const maxWind = Math.max(...allWeatherData.map(w => w.windSpeed));
    const alertCount = allWeatherData.reduce((sum, w) => sum + w.alerts.length, 0);
    const unsafeCount = allWeatherData.filter(w => w.windSpeed > 25 || w.alerts.length > 0).length;
    
    return { avgTemp, maxWind, alertCount, unsafeCount, totalLocations: allWeatherData.length };
  };

  const operationalStatus = getOperationalStatus();
  const regionalStats = getRegionalOverview();

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-500" />
              Weather Overview
            </CardTitle>
            {operationalStatus && (
              <Badge className={operationalStatus.color} data-testid="weather-operational-status">
                {operationalStatus.icon}
                {operationalStatus.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <WeatherWidget 
            location={defaultLocation?.name} 
            compact={true} 
            showSafetyRecommendations={true}
            data-testid="weather-compact-widget"
          />
          
          {regionalStats && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1" data-testid="regional-temp">
                <Thermometer className="h-3 w-3 text-orange-500" />
                <span>{regionalStats.avgTemp}°C avg</span>
              </div>
              <div className="flex items-center gap-1" data-testid="regional-wind">
                <Wind className="h-3 w-3 text-gray-500" />
                <span>{regionalStats.maxWind} km/h max</span>
              </div>
              {regionalStats.alertCount > 0 && (
                <div className="flex items-center gap-1 text-orange-600 col-span-2" data-testid="regional-alerts">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{regionalStats.alertCount} active alerts</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="weather-dashboard-full">
      {/* Operational Status Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-6 w-6 text-blue-500" />
                Weather Operations Dashboard
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time weather monitoring for tree removal operations
              </p>
            </div>
            <div className="text-right">
              {operationalStatus && (
                <Badge className={operationalStatus.color} data-testid="weather-operations-badge">
                  {operationalStatus.icon}
                  {operationalStatus.status}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Updated: {new Date().toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </CardHeader>
        
        {operationalStatus && (
          <CardContent className="pt-0">
            <Alert className={
              operationalStatus.status === 'Suspended' ? 'border-red-200 bg-red-50' :
              operationalStatus.status === 'Restricted' ? 'border-red-200 bg-red-50' :
              operationalStatus.status === 'Caution' ? 'border-orange-200 bg-orange-50' :
              'border-green-200 bg-green-50'
            }>
              {operationalStatus.icon}
              <AlertDescription>
                <strong>{operationalStatus.message}</strong>
                {safetyData?.data?.recommendation && (
                  <p className="text-sm mt-1">{safetyData.data.recommendation.message}</p>
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Regional Overview */}
      {regionalStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-600" />
              Regional Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50" data-testid="overview-locations">
                <div className="text-2xl font-bold text-blue-600">{regionalStats.totalLocations}</div>
                <div className="text-sm text-muted-foreground">Locations</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50" data-testid="overview-avg-temp">
                <div className="text-2xl font-bold text-orange-600">{regionalStats.avgTemp}°C</div>
                <div className="text-sm text-muted-foreground">Avg Temp</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50" data-testid="overview-max-wind">
                <div className="text-2xl font-bold text-gray-600">{regionalStats.maxWind}</div>
                <div className="text-sm text-muted-foreground">Max Wind (km/h)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50" data-testid="overview-unsafe-locations">
                <div className={`text-2xl font-bold ${regionalStats.unsafeCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {regionalStats.unsafeCount}
                </div>
                <div className="text-sm text-muted-foreground">Unsafe Areas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Weather by Location */}
      <Tabs defaultValue={defaultLocation?.name} className="space-y-4">
        <TabsList className="grid grid-cols-4 gap-1">
          {locations.map(location => (
            <TabsTrigger 
              key={location.name} 
              value={location.name} 
              className="text-sm"
              data-testid={`tab-location-${location.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {location.name.split(',')[0]}
            </TabsTrigger>
          ))}
        </TabsList>

        {locations.map(location => (
          <TabsContent key={location.name} value={location.name} className="mt-4">
            <WeatherWidget 
              location={location.name}
              showForecast={true}
              showSafetyRecommendations={true}
              data-testid={`weather-detail-${location.name.toLowerCase().replace(/\s+/g, '-')}`}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Job Impact Analysis */}
      {showJobImpact && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Job Impact Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Today's Recommendations</h4>
                {safetyData?.data?.recommendation ? (
                  <ul className="space-y-1 text-sm">
                    {safetyData.data.recommendation.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-current rounded-full flex-shrink-0 mt-2"></span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading recommendations...</p>
                )}
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Equipment Considerations</h4>
                <div className="space-y-1 text-sm">
                  {regionalStats && regionalStats.maxWind > 25 && (
                    <div className="flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span>High winds - secure all equipment</span>
                    </div>
                  )}
                  {regionalStats && regionalStats.alertCount > 0 && (
                    <div className="flex items-center gap-2 text-red-600">
                      <Shield className="h-3 w-3" />
                      <span>Active weather alerts - review safety protocols</span>
                    </div>
                  )}
                  {(!regionalStats || (regionalStats.maxWind <= 25 && regionalStats.alertCount === 0)) && (
                    <div className="flex items-center gap-2 text-green-600">
                      <Shield className="h-3 w-3" />
                      <span>Normal operating conditions</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}