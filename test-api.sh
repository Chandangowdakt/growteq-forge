#!/bin/bash
BASE="http://localhost:5000/api"

echo "=== Login ==="
RESP=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@growteq.com","password":"admin123"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "Login failed. Response: $RESP"
  exit 1
fi
echo "Token: ${TOKEN:0:20}..."

echo ""
echo "=== Dashboard Summary ==="
curl -s $BASE/dashboard/summary \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || curl -s $BASE/dashboard/summary -H "Authorization: Bearer $TOKEN"

echo ""
echo "=== Work in Progress ==="
curl -s $BASE/dashboard/work-in-progress \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || curl -s $BASE/dashboard/work-in-progress -H "Authorization: Bearer $TOKEN"

echo ""
echo "=== Farms ==="
curl -s $BASE/farms \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || curl -s $BASE/farms -H "Authorization: Bearer $TOKEN"

echo ""
echo "=== Proposals ==="
curl -s $BASE/proposals \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || curl -s $BASE/proposals -H "Authorization: Bearer $TOKEN"

echo ""
echo "=== All checks done ==="
