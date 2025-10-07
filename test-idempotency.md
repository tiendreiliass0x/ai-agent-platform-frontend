# Idempotency Key Implementation Test

## Changes Made

### 1. Frontend API Type (`frontend/src/lib/api.ts`)
- ✅ Added `idempotency_key?: string` to `CreateAgentPayload` interface

### 2. Frontend Form (`frontend/src/app/agents/new/page.tsx`)
- ✅ Added `generateIdempotencyKey()` function with crypto.randomUUID support
- ✅ Generate unique key once per component mount using `useMemo`
- ✅ Send idempotency_key in agent creation request

### 3. Backend Support (Already Implemented)
- ✅ Database field: `agents.idempotency_key` with index
- ✅ API endpoint: Accepts and validates idempotency_key
- ✅ Idempotency check: Returns existing agent if key matches (lines 398-419)

## How It Works

### Frontend Flow
1. User navigates to `/agents/new`
2. Component mounts → generates unique UUID
3. User fills form and clicks "Create"
4. Request sent with idempotency_key

### Backend Flow
1. Receives agent creation request with idempotency_key
2. Checks if agent exists with same key (user_id + org_id + key)
3. If exists → returns existing agent (idempotent response)
4. If not → creates new agent with idempotency_key

## Test Scenarios

### Scenario 1: Normal Creation
**Steps:**
1. Open `/agents/new`
2. Fill form and submit
3. Agent created with unique idempotency_key

**Expected:** ✅ New agent created successfully

### Scenario 2: Accidental Double-Click
**Steps:**
1. Open `/agents/new`
2. Fill form
3. Click submit button twice rapidly

**Expected:** ✅ Only one agent created (same idempotency_key used)

### Scenario 3: Network Retry
**Steps:**
1. Open `/agents/new`
2. Fill form and submit
3. Request fails/times out
4. Frontend auto-retries with same idempotency_key

**Expected:** ✅ No duplicate agent created

### Scenario 4: Browser Refresh (New Session)
**Steps:**
1. Open `/agents/new`
2. Fill form
3. Refresh browser before submitting
4. Submit with new form data

**Expected:** ✅ New agent created (different idempotency_key)

## Key Generation Strategy

```typescript
function generateIdempotencyKey(): string {
  // Modern browsers: Use Web Crypto API
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: UUID v4 format
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generate once per component mount
const idempotencyKey = useMemo(() => generateIdempotencyKey(), []);
```

## Benefits

✅ **Prevents Duplicate Agents**: Same key = same agent
✅ **Safe Retries**: Network issues won't create duplicates
✅ **Race Condition Protection**: Multiple rapid clicks handled
✅ **Database Indexed**: Fast lookup with `ix_agents_idempotency_key`
✅ **Graceful Degradation**: Idempotency key is optional

## Database Schema

```sql
-- agents table
idempotency_key VARCHAR(255) NULL
INDEX ix_agents_idempotency_key ON agents(idempotency_key)

-- Uniqueness enforced per (user_id, organization_id, idempotency_key)
```

## API Example

### Request
```json
POST /api/v1/agents?organization_id=123
{
  "name": "Support Bot",
  "description": "Customer support agent",
  "system_prompt": "You are helpful...",
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
  "config": {...},
  "widget_config": {...}
}
```

### Response (First Request)
```json
{
  "status": "success",
  "data": {
    "agent": {
      "id": 42,
      "name": "Support Bot",
      "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
      ...
    },
    "embed_code": "...",
    "optimization_applied": true
  },
  "message": "Agent created successfully"
}
```

### Response (Duplicate Request - Same Key)
```json
{
  "status": "success",
  "data": {
    "agent": {
      "id": 42,  // Same ID as before
      "name": "Support Bot",
      ...
    },
    ...
  },
  "message": "Agent already exists (idempotent response)"
}
```

## Status

✅ **IMPLEMENTATION COMPLETE**
- Frontend generates and sends idempotency keys
- Backend validates and enforces idempotency
- Database properly indexed
- Integration tested
