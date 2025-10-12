/**
 * Browser notification service for showing desktop notifications
 * Uses the Notifications API for cross-browser support
 */

export class NotificationService {
  private static instance: NotificationService;
  private permissionGranted: boolean = false;

  private constructor() {
    this.checkPermission();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Check current notification permission status
   */
  private checkPermission(): void {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return;
    }

    this.permissionGranted = Notification.permission === 'granted';
  }

  /**
   * Request notification permission from the user
   */
  public async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission was previously denied');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permissionGranted = permission === 'granted';
      
      if (this.permissionGranted) {
        console.log('✅ Notification permission granted');
      } else {
        console.warn('❌ Notification permission denied');
      }
      
      return this.permissionGranted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Show a browser notification
   */
  public async showNotification(
    title: string,
    options?: {
      body?: string;
      icon?: string;
      badge?: string;
      tag?: string;
      data?: any;
      requireInteraction?: boolean;
      silent?: boolean;
    }
  ): Promise<void> {
    if (!this.permissionGranted) {
      console.warn('Cannot show notification: permission not granted');
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: options?.icon || '/favicon.ico',
        badge: options?.badge,
        body: options?.body,
        tag: options?.tag,
        data: options?.data,
        requireInteraction: options?.requireInteraction || false,
        silent: options?.silent || false,
      });

      // Auto-close notification after 5 seconds unless requireInteraction is true
      if (!options?.requireInteraction) {
        setTimeout(() => notification.close(), 5000);
      }

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        
        // Navigate to the URL if provided in data
        if (options?.data?.url) {
          window.location.href = options.data.url;
        }
        
        notification.close();
      };
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Check if notifications are supported and permission is granted
   */
  public isEnabled(): boolean {
    return this.permissionGranted;
  }

  /**
   * Get current permission status
   */
  public getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }
}

export const notificationService = NotificationService.getInstance();
