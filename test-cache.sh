#!/bin/bash

# Quick cache test script

echo "🧪 Testing OpenAI Prompt Cache"
echo "================================"
echo ""

# Create payload
PAYLOAD='{"provider":"openai","messages":[{"id":"system-0","role":"system","parts":[{"type":"text","text":"'
for i in {1..1200}; do
  PAYLOAD+="Guideline $i: Respond concisely while retaining key facts.\\n"
done
PAYLOAD+='"}]},{"id":"user-0","role":"user","parts":[{"type":"text","text":"Summarize the key themes in 5 bullets."}]}]}'

echo "📝 Making first request (cache MISS expected)..."
echo "---"
START1=$(date +%s%3N)
curl -sS http://localhost:3001/api/chat-cache \
  -X POST \
  -H 'content-type: application/json' \
  -d "$PAYLOAD" > /tmp/response1.txt
END1=$(date +%s%3N)
TIME1=$((END1 - START1))

echo "⏱️  First call: ${TIME1}ms"
echo "📄 Response length: $(wc -c < /tmp/response1.txt) bytes"
echo ""

echo "⏳ Waiting 3 seconds for cache to settle..."
sleep 3
echo ""

echo "📝 Making second request (cache HIT expected)..."
echo "---"
START2=$(date +%s%3N)
curl -sS http://localhost:3001/api/chat-cache \
  -X POST \
  -H 'content-type: application/json' \
  -d "$PAYLOAD" > /tmp/response2.txt
END2=$(date +%s%3N)
TIME2=$((END2 - START2))

echo "⏱️  Second call: ${TIME2}ms"
echo "📄 Response length: $(wc -c < /tmp/response2.txt) bytes"
echo ""

# Calculate improvement
IMPROVEMENT=$(awk "BEGIN {print 100 - ($TIME2 * 100 / $TIME1)}")

echo "================================"
echo "📊 Results:"
echo "  First call:  ${TIME1}ms"
echo "  Second call: ${TIME2}ms"
echo "  Improvement: ${IMPROVEMENT}% faster"
echo ""
echo "🔍 Check terminal logs above for:"
echo "  [CACHE] ✅ cachedPromptTokens: 0       ← First call (MISS)"
echo "  [CACHE] ✅ cachedPromptTokens: >0      ← Second call (HIT)"
echo ""

if (( $(echo "$IMPROVEMENT > 30" | bc -l) )); then
  echo "🎉 SUCCESS! Cache is working (${IMPROVEMENT}% improvement)"
else
  echo "⚠️  Cache might not be hitting (only ${IMPROVEMENT}% improvement)"
  echo "   Expected 40-80% improvement on cache hit"
fi
