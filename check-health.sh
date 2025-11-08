#\!/bin/bash

echo "=== ChatKut Health Check ==="
echo ""

echo "1. Checking Convex URL..."
if grep -q "NEXT_PUBLIC_CONVEX_URL" .env.local; then
  echo "   ✓ Convex URL is set"
else
  echo "   ✗ Convex URL missing in .env.local"
fi

echo ""
echo "2. Checking if Next.js is running..."
if lsof -ti:3001 > /dev/null 2>&1; then
  echo "   ✓ Next.js running on port 3001"
else
  echo "   ✗ Next.js NOT running on port 3001"
fi

echo ""
echo "3. Checking if Convex types are generated..."
if [ -d "convex/_generated" ]; then
  echo "   ✓ Convex types generated"
else
  echo "   ✗ Convex types NOT generated (run: npx convex dev)"
fi

echo ""
echo "4. Checking node_modules..."
if [ -d "node_modules" ]; then
  echo "   ✓ Dependencies installed"
else
  echo "   ✗ Dependencies NOT installed (run: npm install)"
fi

echo ""
echo "=== Next Steps ==="
echo "If Convex types are missing:"
echo "  1. Run: npx convex dev"
echo "  2. Keep it running in one terminal"
echo "  3. Run: npm run dev in another terminal"
echo ""
