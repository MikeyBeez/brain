#!/bin/bash
# Archive obsolete Brain documentation
# Run from /Users/bard/Code/brain/

echo "Archiving obsolete documentation..."

# Create archive directory if it doesn't exist
mkdir -p archive/pre-consolidation

# Move obsolete documents
mv ARCHITECTURE_MCP_MODULAR.md archive/pre-consolidation/ 2>/dev/null
mv ARCHITECTURE_MODULAR_STABLE.md archive/pre-consolidation/ 2>/dev/null
mv ATOMIC_JOB_CLAIMING.md archive/pre-consolidation/ 2>/dev/null
mv BOOT_PROCESS_DESIGN.md archive/pre-consolidation/ 2>/dev/null
mv BRAIN_PROPOSAL.md archive/pre-consolidation/ 2>/dev/null
mv CENTRAL_INDEX.md archive/pre-consolidation/ 2>/dev/null
mv CLEANUP_MIGRATION_PLAN.md archive/pre-consolidation/ 2>/dev/null
mv CODING_GUIDELINES.md archive/pre-consolidation/ 2>/dev/null
mv CONTEXT_ASSEMBLY.md archive/pre-consolidation/ 2>/dev/null
mv DEVELOPMENT_JOURNAL_TEMPLATE.md archive/pre-consolidation/ 2>/dev/null
mv DEVELOPMENT_SUMMARY.md archive/pre-consolidation/ 2>/dev/null
mv DISCOVERABILITY.md archive/pre-consolidation/ 2>/dev/null
mv ENDPOINT_INTEGRATION_STRATEGY.md archive/pre-consolidation/ 2>/dev/null
mv ENGINEERING_SPEC_V1.md archive/pre-consolidation/ 2>/dev/null
mv EXECUTION_MODEL_BACKGROUND.md archive/pre-consolidation/ 2>/dev/null
mv INDEX_TOOL_SPEC.md archive/pre-consolidation/ 2>/dev/null
mv IPC_STRATEGY.md archive/pre-consolidation/ 2>/dev/null
mv MEMORY_MANAGEMENT_STRATEGY.md archive/pre-consolidation/ 2>/dev/null
mv NOTE_TOOL_SPEC.md archive/pre-consolidation/ 2>/dev/null
mv OUTPUT_BUFFERING_STRATEGY.md archive/pre-consolidation/ 2>/dev/null
mv SESSION_MANAGEMENT_SPEC.md archive/pre-consolidation/ 2>/dev/null
mv STORAGE_OPTIONS_ANALYSIS.md archive/pre-consolidation/ 2>/dev/null
mv SYSTEM_MESSAGE_INTEGRATION.md archive/pre-consolidation/ 2>/dev/null
mv TOOL_KNOWLEDGE.md archive/pre-consolidation/ 2>/dev/null
mv WHY_DIRECT_MCP.md archive/pre-consolidation/ 2>/dev/null

echo "Archive complete. Current documentation:"
ls -la *.md

echo ""
echo "Archived documents can be found in: archive/pre-consolidation/"
