#!/bin/bash
cd /Users/bard/Code/brain

echo "Running TypeScript build..."
npm run build 2>&1 | tee build-output.log

echo ""
echo "Build complete. Exit code: ${PIPESTATUS[0]}"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "Build failed. Check build-output.log for details."
    exit 1
fi

echo "Build successful!"
