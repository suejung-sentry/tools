import fs from 'fs';
import { fetchTracesByName, getTraceById } from './langfuse.js';

export async function analyzeAiPrReview() {
  try {
    const name = "Codegen - PR Review";
    // Fetch traces with "pr review" in the name
    const tracesResult = await fetchTracesByName(name, 100);

    if (!tracesResult.data || tracesResult.data.length === 0) {
      console.error('No traces found with "pr review" in the name');
      return;
    }
    
    console.log(`Fetched ${tracesResult.data.length} traces with "pr review" in the name`);
    
    // Track traces with tool calls
    const tracesWithToolCalls = [];
    // Track tool usage counts
    const toolUsageCounts = {};
    // Track tool result counts
    const toolResultCounts = {};
    
    for (const trace of tracesResult.data) {
      const traceDetails = await getTraceById(trace.id);

      if (!traceDetails.observations || traceDetails.observations.length === 0) {
        console.log(`No observations found for trace ${trace.id}`);
        continue;
      }

      // Check if any observation has a tool call
      const hasToolCall = traceDetails.observations.some(obs => {
        if (obs.output && obs.output.message && obs.output.message.tool_calls) {
          return true;
        }
        
        return false;
      });
      
      if (hasToolCall) {
        // Extract tool calls from observations
        const toolCalls = [];
        traceDetails.observations.forEach(obs => {
          if (obs.output && obs.output.message && obs.output.message.tool_calls) {
            toolCalls.push(...obs.output.message.tool_calls);
            
            // Count tool usage
            obs.output.message.tool_calls.forEach(toolCall => {
              const toolName = toolCall.function || 'unknown';
              toolUsageCounts[toolName] = (toolUsageCounts[toolName] || 0) + 1;
            });
          }
        });

        // For each tool call, find the corresponding result
        for (let i = 0; i < toolCalls.length; i++) {
          const toolCall = toolCalls[i];
          const resultObservation = traceDetails.observations.find(obs => {
            // Match the observation name with the function name from the tool call
            const functionName = toolCall.function;
            if (!functionName || !obs.name) return false;
            
            // Convert function names like "semantic_file_search" to "Semantic File Search"
            const formattedFunctionName = functionName
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
              
            return obs.name.includes(formattedFunctionName);
          });

          if (resultObservation) {
            toolCall.result = {
                level: resultObservation.level,
                statusMessage: resultObservation.statusMessage,
                output: resultObservation.output,
            }
            
            // Count tool results by level
            const toolName = toolCall.function || 'unknown';
            const resultLevel = resultObservation.level || 'unknown';
            
            if (!toolResultCounts[toolName]) {
              toolResultCounts[toolName] = {};
            }
            
            toolResultCounts[toolName][resultLevel] = (toolResultCounts[toolName][resultLevel] || 0) + 1;
          } else {
            toolCall.result = null;
            
            // Count null results
            const toolName = toolCall.function || 'unknown';
            
            if (!toolResultCounts[toolName]) {
              toolResultCounts[toolName] = {};
            }
            
            toolResultCounts[toolName]['null'] = (toolResultCounts[toolName]['null'] || 0) + 1;
          }
        }
        
        // Extract repo and org name from the first observation if available
        let repoName = null;
        let orgName = null;
        if (traceDetails && traceDetails.metadata && traceDetails.metadata.repo) {
          repoName = traceDetails.metadata.repo.name;
          orgName = traceDetails.metadata.repo.owner;
        }
        
        tracesWithToolCalls.push({
          repoName,
          orgName,
          traceId: trace.id,
          name: trace.name,
          timestamp: trace.timestamp,
          toolCalls: toolCalls,
          url: `https://langfuse.getsentry.net/project/clx9kma1k0001iebwrfw4oo0z/traces/${trace.id}`
        });
      }
    }
    
    if (tracesWithToolCalls.length > 0) {
      console.log(`Found ${tracesWithToolCalls.length} traces with tool calls:`);
      tracesWithToolCalls.forEach(trace => {
        console.log(`- ${trace.name} (${trace.traceId}), timestamp: ${new Date(trace.timestamp).toISOString()}`);
      });
      
      // Log tool usage statistics
      console.log('\nTool usage statistics:');
      Object.entries(toolUsageCounts).forEach(([tool, count]) => {
        console.log(`- ${tool}: ${count} calls`);
        
        // Log result counts for this tool
        if (toolResultCounts[tool]) {
          Object.entries(toolResultCounts[tool]).forEach(([level, levelCount]) => {
            console.log(`  - ${level}: ${levelCount}`);
          });
        }
      });
      
      // Save results to a file
      const nameLower = name.toLowerCase().replace(/\s+/g, '-');
      fs.writeFileSync(`./results/${nameLower}-tool-calls.json`, JSON.stringify(tracesWithToolCalls, null, 2));
      console.log(`Results saved to ${nameLower}-tool-calls.json`);
      
      // Save tool usage statistics to a file
      fs.writeFileSync(`./results/${nameLower}-tool-usage.json`, JSON.stringify({
        counts: toolUsageCounts,
        resultCounts: toolResultCounts
      }, null, 2));
      console.log(`Tool usage statistics saved to ${nameLower}-tool-usage.json`);
    } else {
      console.log('No traces with tool calls found');
    }
  } catch (error) {
    console.error('Error in main function:', error);
  }
}
