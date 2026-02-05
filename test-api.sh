#!/bin/bash

# Test script for Calendar Manager API
# Usage: ./test-api.sh

API_URL="http://localhost:3000"
TOKEN="clawbot-token-12345"

echo "=== Calendar Manager API Test ==="
echo ""

echo "1. Health Check"
curl -s "$API_URL/health" | jq .
echo -e "\n"

echo "2. Create a calendar slot"
curl -s -X POST "$API_URL/calendar/slots" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Morning Meeting",
    "start_time": "2024-01-15T09:00:00Z",
    "end_time": "2024-01-15T10:00:00Z",
    "type": "meeting"
  }' | jq .
echo -e "\n"

echo "3. Create another slot"
curl -s -X POST "$API_URL/calendar/slots" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Focus Time",
    "start_time": "2024-01-15T14:00:00Z",
    "end_time": "2024-01-15T16:00:00Z",
    "type": "focus"
  }' | jq .
echo -e "\n"

echo "4. Get all slots"
curl -s "$API_URL/calendar/slots" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo -e "\n"

echo "5. Check availability"
curl -s "$API_URL/calendar/availability?from=2024-01-15T00:00:00Z&to=2024-01-15T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo -e "\n"

echo "6. Try to create overlapping slot (should fail)"
curl -s -X POST "$API_URL/calendar/slots" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Conflicting Meeting",
    "start_time": "2024-01-15T09:30:00Z",
    "end_time": "2024-01-15T10:30:00Z",
    "type": "meeting"
  }' | jq .
echo -e "\n"

echo "=== Test Complete ==="
