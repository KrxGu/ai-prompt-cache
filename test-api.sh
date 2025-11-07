#!/bin/bash

# Test the API endpoints directly

echo "Testing /api/chat-cache endpoint..."
echo ""

curl -N http://localhost:3000/api/chat-cache \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "messages": [
      {
        "id": "system-0",
        "role": "system",
        "parts": [{"type": "text", "text": "You are a helpful assistant."}]
      },
      {
        "id": "user-0",
        "role": "user",
        "parts": [{"type": "text", "text": "Say hello in 5 words."}]
      }
    ]
  }'

echo ""
echo ""
echo "Done!"
