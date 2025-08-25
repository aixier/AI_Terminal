#!/bin/bash

# Test script for cardplanet-Sandra-json template
# This script tests the /api/generate/card endpoint with the new template

API_URL="http://localhost:3456/api/generate/card"
TOPIC="时间管理的艺术"
TEMPLATE="cardplanet-Sandra-json"

echo "========================================="
echo "Testing cardplanet-Sandra-json template"
echo "========================================="
echo "Topic: $TOPIC"
echo "Template: $TEMPLATE"
echo "API URL: $API_URL"
echo ""

echo "Sending POST request..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"topic\": \"$TOPIC\",
    \"templateName\": \"$TEMPLATE\"
  }" \
  -v 2>&1 | tee cardplanet-sandra-json-test.log

echo ""
echo "========================================="
echo "Test completed. Check cardplanet-sandra-json-test.log for details"
echo "========================================="