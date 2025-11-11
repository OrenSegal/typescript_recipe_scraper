#!/bin/bash
# Build TypeScript files for Supabase Functions
echo "Building TypeScript files..."
cd supabase/functions
tsc --project tsconfig.json
echo "Build completed!"
