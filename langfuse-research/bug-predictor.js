import fs from 'fs';
import { fetchTracesByName, getDatasetItems } from './langfuse.js';

export async function analyzeBugPredictor() {
  try {
    const name = "Codegen - Bug Prediction Step";
    // Fetch traces with "pr review" in the name
    const tracesResult = await fetchTracesByName(name, 100);

    if (!tracesResult.data || tracesResult.data.length === 0) {
      console.error('No traces found with "Codegen - Bug Prediction Step" in the name');
      return;
    }
    
    console.log(`Fetched ${tracesResult.data.length} traces with "Codegen - Bug Prediction Step" in the name`);

    // Create directory for trace details if it doesn't exist
    const traceDetailsDir = './results/trace-details';
    if (!fs.existsSync(traceDetailsDir)) {
      fs.mkdirSync(traceDetailsDir, { recursive: true });
    }

    // // Write trace details to separate files in the directory
    // for (const trace of tracesResult.data) {
    //   const traceDetails = await getTraceById(trace.id);
    //   const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    //   fs.writeFileSync(
    //     `${traceDetailsDir}/trace-${trace.id}-${timestamp}.json`, 
    //     JSON.stringify(traceDetails, null, 2)
    //   );
    //   console.log(`Trace details saved for ${trace.id}`);
    // }

    await writeDatasetItems();

    // Load trace details from files
    const traceDetails = [];
    const traceFiles = fs.readdirSync(traceDetailsDir);
    for (const file of traceFiles) {
      if (file.endsWith('.json')) {
        const filePath = `${traceDetailsDir}/${file}`;
        const traceData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        traceDetails.push(traceData);
      }
    }
    console.log(`Loaded ${traceDetails.length} trace details from files`);

    // Do analysis
    // await analyzeAndWriteToolCalls(traceDetails);
    // console.log('Analyze and Write Tool Calls complete');

    await findDropoffPoints(traceDetails);

  } catch (error) {
    console.error('Error analyzing bug predictor:', error);
  }
}

async function writeDatasetItems() {
    const datasetDir = './results/dataset-items';
    if (!fs.existsSync(datasetDir)) {
      fs.mkdirSync(datasetDir, { recursive: true });
    }
      // Call Langfuse API to create dataset item
      try {
        const response = await getDatasetItems();
        console.log(`Fetched ${response.data.length} dataset items`);
        
        for (const item of response.data) {
          console.log(`Writing dataset item:`, item.id);
          fs.writeFileSync(
            `${datasetDir}/${item.id}.json`,
            JSON.stringify(item, null, 2)
          );
        }
      } catch (error) {
        console.error(`Failed to fetch dataset items:`, error.message);
      }

}

async function getDatasetItemsMap() {
    
}

async function findDropoffPoints(traceDetails) {
    console.log('Finding dropoff points');

    let inputCount = 0;
    let outputCount = 0;
    let mismatchCount = 0;
    let matchCount = 0;
    let subdetails = [];

    for (const trace of traceDetails) {
        const formatterStep = trace.observations?.find(obs => 
            obs.name === "Codegen - Bug Prediction - Formatter Component"
        );

        if (formatterStep) {
            const inputLength = formatterStep.input?.args?.[0]?.located_followups?.length || formatterStep.input?.kwargs?.request?.followups?.length || 0;
            const outputLength = formatterStep.output?.bug_predictions?.length || 0;

            inputCount += inputLength;
            outputCount += outputLength;

            if (inputLength !== outputLength) {
                mismatchCount++;

            } else {
                matchCount++;
            }

            subdetails.push({
                repo: trace.metadata?.repo?.name,
                pr_id: trace.tags?.find(tag => tag.startsWith('pr_id:'))?.split(':')[1],
                traceId: trace.id,
                inputLength,
                outputLength,
                difference: inputLength - outputLength
            });
        }
    }

    // Prepare analysis results
    const analysisResults = {
        summary: {
            totalInputItems: inputCount,
            totalOutputItems: outputCount,
            matchCount,
            mismatchCount
        },
        mismatchDetails: subdetails.sort((a, b) => a.inputLength - b.inputLength)
    };

    // Log to console
    console.log('\nFormatter Component Analysis:');
    console.log(`Total items in input arrays: ${inputCount}`);
    console.log(`Total items in output arrays: ${outputCount}`);
    console.log(`Number of matches: ${matchCount}`);
    console.log(`Number of mismatches: ${mismatchCount}`);
    
    if (mismatchCount > 0) {
        console.log('\nMismatch Details:');
        subdetails.forEach(detail => {
            if (detail.difference >= 0) {
                console.log(`Trace ${detail.traceId} (${detail.repo}): Input ${detail.inputLength} -> Output ${detail.outputLength} (Diff: ${detail.difference})`);
            }
        });
    }

    // Write results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = `./results/bug-predictor-dropoff-analysis-${timestamp}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(analysisResults, null, 2));
    console.log(`\nAnalysis results written to: ${outputPath}`);
}


async function analyzeAndWriteToolCalls(traceDetailsList) {
  try {
    // Track traces with tool calls
    const tracesWithToolCalls = [];
    // Track tool usage counts
    const toolUsageCounts = {};
    // Track tool result counts
    const toolResultCounts = {};
    
    for (const traceDetails of traceDetailsList) {
      if (!traceDetails.observations || traceDetails.observations.length === 0) {
        console.log(`No observations found for trace ${traceDetails.id}`);
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
          traceId: traceDetails.id,
          name: traceDetails.name,
          timestamp: traceDetails.timestamp,
          toolCalls: toolCalls,
          url: `https://langfuse.getsentry.net/project/clx9kma1k0001iebwrfw4oo0z/traces/${traceDetails.id}`
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
      const nameLower = "bug-predictor";
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.writeFileSync(`./results/${nameLower}-tool-calls-${timestamp}.json`, JSON.stringify(tracesWithToolCalls, null, 2));
      console.log(`Results saved to ${nameLower}-tool-calls-${timestamp}.json`);
      
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