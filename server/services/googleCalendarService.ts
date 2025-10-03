import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

interface CalendarEventData {
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
}

class GoogleCalendarService {
  
  // Create a calendar event
  async createEvent(eventData: CalendarEventData): Promise<string | null> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      const event = {
        summary: eventData.summary,
        description: eventData.description || '',
        location: eventData.location || '',
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'Pacific/Auckland',
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'Pacific/Auckland',
        },
        attendees: eventData.attendees?.map(email => ({ email })) || [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      console.log(`✅ Google Calendar event created: ${response.data.htmlLink}`);
      return response.data.id || null;
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      return null;
    }
  }

  // Update a calendar event
  async updateEvent(eventId: string, eventData: Partial<CalendarEventData>): Promise<boolean> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      const updateData: any = {};
      
      if (eventData.summary) updateData.summary = eventData.summary;
      if (eventData.description) updateData.description = eventData.description;
      if (eventData.location) updateData.location = eventData.location;
      if (eventData.startTime) {
        updateData.start = {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'Pacific/Auckland',
        };
      }
      if (eventData.endTime) {
        updateData.end = {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'Pacific/Auckland',
        };
      }
      if (eventData.attendees) {
        updateData.attendees = eventData.attendees.map(email => ({ email }));
      }

      await calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: updateData,
      });

      console.log(`✅ Google Calendar event updated: ${eventId}`);
      return true;
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      return false;
    }
  }

  // Delete a calendar event
  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      console.log(`✅ Google Calendar event deleted: ${eventId}`);
      return true;
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      return false;
    }
  }

  // Sync a job to Google Calendar
  async syncJobToCalendar(job: any, staffAssignments?: any[]): Promise<string | null> {
    try {
      if (!job.scheduledDate || !staffAssignments || staffAssignments.length === 0) {
        return null;
      }

      // Get staff emails for attendees
      const attendees: string[] = [];
      
      const summary = `🌳 ${job.title || 'Tree Service Job'}`;
      const description = `
Job #${job.jobNumber || 'N/A'}
Customer: ${job.customerName || 'N/A'}
${job.description ? '\n' + job.description : ''}
${job.notes ? '\nNotes: ' + job.notes : ''}

View in Treemarkables Dashboard
      `.trim();

      const location = job.address || '';
      const startTime = new Date(staffAssignments[0].startTime);
      const endTime = new Date(staffAssignments[0].endTime);

      const googleEventId = await this.createEvent({
        summary,
        description,
        location,
        startTime,
        endTime,
        attendees,
      });

      return googleEventId;
    } catch (error) {
      console.error('Error syncing job to Google Calendar:', error);
      return null;
    }
  }

  // Sync a schedule event to Google Calendar
  async syncScheduleEventToCalendar(scheduleEvent: any): Promise<string | null> {
    try {
      const summary = scheduleEvent.title;
      const description = scheduleEvent.description || '';
      const location = scheduleEvent.location || scheduleEvent.address || '';
      const startTime = new Date(scheduleEvent.startDate);
      const endTime = new Date(scheduleEvent.endDate);

      const googleEventId = await this.createEvent({
        summary,
        description,
        location,
        startTime,
        endTime,
      });

      return googleEventId;
    } catch (error) {
      console.error('Error syncing schedule event to Google Calendar:', error);
      return null;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
