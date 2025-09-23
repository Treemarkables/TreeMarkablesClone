import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";
import { Link } from "wouter";

interface SettingsPlaceholderProps {
  title: string;
  description: string;
}

export function SettingsPlaceholder({ title, description }: SettingsPlaceholderProps) {
  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild data-testid="button-back-to-settings">
          <Link href="/settings" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>
        </Button>
      </div>

      {/* Main content */}
      <div className="flex items-center justify-center flex-1 max-w-2xl mx-auto">
        <Card className="w-full">
          <CardContent className="p-12 text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-amber-100 rounded-lg flex items-center justify-center">
              <Construction className="w-10 h-10 text-amber-600" />
            </div>
            
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">
                {title}
              </h1>
              <p className="text-gray-600" data-testid="text-page-description">
                {description}
              </p>
              <p className="text-sm text-amber-600 font-medium">
                This page is coming soon!
              </p>
            </div>

            <div className="pt-4">
              <Button asChild data-testid="button-return-settings">
                <Link href="/settings">
                  Return to Settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}