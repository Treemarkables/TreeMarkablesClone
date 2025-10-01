# Mobile App API Documentation

## Overview

This document describes the REST API endpoints available for the native mobile app integration. The API enables call recording uploads, transcription, customer matching, and job creation directly from the mobile app.

## Authentication

All mobile endpoints require API key authentication via the `Authorization` header using Bearer token format.

```http
Authorization: Bearer your-api-key-here
```

API keys are SHA-256 hashed and validated on each request. Contact your administrator to obtain an API key.

## Base URL

```
https://your-domain.replit.app/api/mobile
```

## Endpoints

### 1. Upload Call Recording

Upload an audio recording of a customer call.

**Endpoint:** `POST /api/mobile/calls/upload`

**Headers:**
- `Authorization`: Bearer token with your API key
- `Content-Type`: `multipart/form-data`

**Request Body:**
- `audio` (file, required): Audio file (supports .mp3, .wav, .m4a, .ogg, .webm)
- `phoneNumber` (string, required): Customer phone number
- `duration` (number, optional): Call duration in seconds
- `callType` (string, optional): Type of call (e.g., "incoming", "outgoing")

**Example Request:**
```javascript
const formData = new FormData();
formData.append('audio', audioFile);
formData.append('phoneNumber', '+1-555-0123');
formData.append('duration', '180');
formData.append('callType', 'incoming');

fetch('https://your-domain.replit.app/api/mobile/calls/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key-here'
  },
  body: formData
});
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "phoneNumber": "+15550123",
    "recordingUrl": "/uploads/recordings/filename.mp3",
    "duration": 180,
    "callType": "incoming",
    "createdAt": "2025-10-01T22:00:00.000Z"
  },
  "message": "Call recording uploaded successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "No audio file uploaded or phone number missing"
}
```

---

### 2. Transcribe Call

Transcribe a call recording using OpenAI Whisper API.

**Endpoint:** `POST /api/mobile/calls/:callId/transcribe`

**Headers:**
- `Authorization`: Bearer token with your API key

**URL Parameters:**
- `callId`: UUID of the call record to transcribe

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "phoneNumber": "+15550123",
    "transcript": "Hello, I need to schedule a tree removal service for next week...",
    "recordingUrl": "/uploads/recordings/filename.mp3",
    "duration": 180,
    "createdAt": "2025-10-01T22:00:00.000Z"
  },
  "message": "Call transcribed successfully"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Call not found"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "No recording URL found for this call"
}
```

---

### 3. Match Customer by Phone

Search for existing customers by phone number. Uses indexed normalized phone matching for optimal performance.

**Endpoint:** `GET /api/mobile/customers/match/:phoneNumber`

**Headers:**
- `Authorization`: Bearer token with your API key

**URL Parameters:**
- `phoneNumber`: Phone number to search (any format accepted, e.g., +1-555-0123, (555) 012-3456, 5550123456)

**Example Request:**
```javascript
fetch('https://your-domain.replit.app/api/mobile/customers/match/+1-555-0123', {
  headers: {
    'Authorization': 'Bearer your-api-key-here'
  }
});
```

**Success Response (200) - Customer Found:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "uuid-here",
      "name": "John Smith",
      "email": "john@example.com",
      "phone": "+1-555-0123",
      "normalizedPhone": "15550123",
      "address": "123 Main St",
      "createdAt": "2025-09-01T10:00:00.000Z"
    }
  },
  "message": "Customer found"
}
```

**Success Response (200) - No Match:**
```json
{
  "success": true,
  "data": {
    "customer": null
  },
  "message": "No customer found with this phone number"
}
```

**Notes:**
- Phone number normalization strips all non-digit characters for matching
- International formats are supported
- Uses indexed database column for O(log N) lookup performance

---

### 4. Create Job from Call

Create a new job with customer information, attach call recording, and automatically create job diary entry. All operations are performed atomically within a database transaction.

**Endpoint:** `POST /api/mobile/jobs/create-from-call`

**Headers:**
- `Authorization`: Bearer token with your API key
- `Content-Type`: `application/json`

**Request Body:**
```json
{
  "callId": "uuid-of-call-record",
  "customerName": "John Smith",
  "customerPhone": "+1-555-0123",
  "customerEmail": "john@example.com",
  "customerAddress": "123 Main St, City, State 12345",
  "jobTitle": "Tree Removal - Oak Trees",
  "jobDescription": "Customer needs two large oak trees removed from backyard",
  "jobAddress": "123 Main St, City, State 12345"
}
```

**Required Fields:**
- `callId`: UUID of the uploaded call
- `customerName`: Customer's full name
- `jobTitle`: Brief title for the job

**Optional Fields:**
- `customerPhone`: Phone number (defaults to call's phone number if not provided)
- `customerEmail`: Customer email address
- `customerAddress`: Customer's physical address
- `jobDescription`: Detailed job description
- `jobAddress`: Job site address (if different from customer address)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "job": {
      "id": "uuid-here",
      "customerId": "customer-uuid",
      "title": "Tree Removal - Oak Trees",
      "description": "Customer needs two large oak trees removed from backyard",
      "address": "123 Main St, City, State 12345",
      "leadSource": "phone",
      "status": "quote",
      "createdAt": "2025-10-01T22:00:00.000Z"
    },
    "customer": {
      "id": "customer-uuid",
      "name": "John Smith",
      "email": "john@example.com",
      "phone": "+1-555-0123",
      "normalizedPhone": "15550123",
      "address": "123 Main St, City, State 12345",
      "source": "phone"
    },
    "call": {
      "id": "uuid-here",
      "phoneNumber": "+15550123",
      "customerId": "customer-uuid",
      "jobId": "uuid-here",
      "transcript": "Hello, I need to schedule a tree removal...",
      "recordingUrl": "/uploads/recordings/filename.mp3",
      "duration": 180,
      "createdAt": "2025-10-01T22:00:00.000Z"
    }
  },
  "message": "Job created successfully from call"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Missing required fields: callId, customerName, jobTitle"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Call not found"
}
```

**Notes:**
- Job is created with status 'quote' and leadSource 'phone'
- If customerPhone matches an existing customer (via normalized phone lookup), that customer is used instead of creating a new one
- A diary entry is automatically created for the job with the call transcript/recording details

**Transaction Guarantees:**
- Customer creation/lookup
- Call-to-customer linking
- Job creation
- Call-to-job linking
- Diary entry creation

All operations succeed together or roll back entirely. No partial state is possible.

---

### 5. Attach Call to Existing Job

Link an existing call recording to an existing job and create a diary entry. Uses a database transaction for atomicity.

**Endpoint:** `POST /api/mobile/calls/:callId/attach-to-job/:jobId`

**Headers:**
- `Authorization`: Bearer token with your API key

**URL Parameters:**
- `callId`: UUID of the call record
- `jobId`: UUID of the job

**Example Request:**
```javascript
fetch('https://your-domain.replit.app/api/mobile/calls/call-uuid/attach-to-job/job-uuid', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key-here'
  }
});
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "call": {
      "id": "call-uuid",
      "phoneNumber": "+15550123",
      "jobId": "job-uuid",
      "transcript": "Follow-up call regarding the tree removal...",
      "recordingUrl": "/uploads/recordings/filename.mp3",
      "createdAt": "2025-10-01T22:00:00.000Z"
    },
    "diaryEntry": {
      "id": "diary-uuid",
      "jobId": "job-uuid",
      "entryType": "note",
      "title": "Phone Call - 10/1/2025, 10:00:00 PM",
      "description": "Call recording and transcript from +15550123\n\nTranscript:\nFollow-up call regarding the tree removal...",
      "authorName": "Mobile App",
      "createdAt": "2025-10-01T22:00:00.000Z"
    }
  },
  "message": "Call attached to job successfully"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Call not found"
}
```

```json
{
  "success": false,
  "message": "Job not found"
}
```

**Transaction Guarantees:**
- Call update (jobId linking)
- Diary entry creation

Both operations succeed together or roll back entirely.

---

### 6. Get Job Call History

Retrieve all call recordings associated with a specific job, ordered by newest first.

**Endpoint:** `GET /api/mobile/jobs/:jobId/calls`

**Headers:**
- `Authorization`: Bearer token with your API key

**URL Parameters:**
- `jobId`: UUID of the job

**Example Request:**
```javascript
fetch('https://your-domain.replit.app/api/mobile/jobs/job-uuid/calls', {
  headers: {
    'Authorization': 'Bearer your-api-key-here'
  }
});
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "call-uuid-2",
      "phoneNumber": "+15550123",
      "customerId": "customer-uuid",
      "jobId": "job-uuid",
      "transcript": "Follow-up call - customer wants to add another tree",
      "recordingUrl": "/uploads/recordings/filename2.mp3",
      "duration": 120,
      "callType": "incoming",
      "createdAt": "2025-10-02T14:30:00.000Z"
    },
    {
      "id": "call-uuid-1",
      "phoneNumber": "+15550123",
      "customerId": "customer-uuid",
      "jobId": "job-uuid",
      "transcript": "Initial call - customer needs tree removal",
      "recordingUrl": "/uploads/recordings/filename1.mp3",
      "duration": 180,
      "callType": "incoming",
      "createdAt": "2025-10-01T22:00:00.000Z"
    }
  ],
  "message": "Calls retrieved successfully"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Job not found"
}
```

**Notes:**
- Results are ordered by `createdAt` descending (newest first)
- Empty array returned if job has no associated calls
- Includes all call metadata (transcript, recording URL, duration, etc.)

---

## Common Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request - Invalid or missing parameters |
| 401 | Unauthorized - Invalid or missing API key |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Description of what went wrong"
}
```

For validation errors (400), additional details may be included:

```json
{
  "success": false,
  "message": "Invalid diary entry data",
  "errors": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

---

## Best Practices

### 1. Workflow for New Customer Call

```javascript
// Step 1: Upload the recording
const uploadResponse = await uploadRecording(audioFile, phoneNumber);
const callId = uploadResponse.data.id;

// Step 2: Transcribe the call
const transcriptResponse = await transcribeCall(callId);

// Step 3: Check if customer exists
const matchResponse = await matchCustomer(phoneNumber);

// Step 4: Create job with customer info
const jobResponse = await createJobFromCall({
  callId,
  customerName: matchResponse.data.customer?.name || "New Customer",
  customerPhone: phoneNumber,
  jobTitle: "Tree Service Request",
  jobDescription: transcriptResponse.data.transcript
});
```

### 2. Workflow for Follow-up Call

```javascript
// Step 1: Upload the recording
const uploadResponse = await uploadRecording(audioFile, phoneNumber);
const callId = uploadResponse.data.id;

// Step 2: Transcribe the call
await transcribeCall(callId);

// Step 3: Attach to existing job
await attachCallToJob(callId, existingJobId);
```

### 3. Phone Number Formats

The API accepts phone numbers in any format and normalizes them automatically:
- `+1-555-012-3456`
- `(555) 012-3456`
- `555.012.3456`
- `5550123456`

All formats are converted to digits-only for matching: `15550123456`

### 4. Audio File Requirements

- **Supported formats:** MP3, WAV, M4A, OGG, WebM
- **Max file size:** 50 MB
- **Recommended:** Use compressed formats (MP3, M4A) to reduce upload time

### 5. Transcription Accuracy

- Best results with clear audio and minimal background noise
- OpenAI Whisper supports multiple languages automatically
- Average transcription time: 10-30 seconds per minute of audio

### 6. API Key Security

- **Never** commit API keys to source control
- Store keys securely in your mobile app's keychain/keystore
- Rotate keys periodically
- Monitor key usage via `lastUsedAt` field

---

## Support

For API support, contact your system administrator or refer to the main application documentation.

**Version:** 1.0.0  
**Last Updated:** October 1, 2025
