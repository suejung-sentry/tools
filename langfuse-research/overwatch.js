import { fetchTracesByName, getTraceById } from './langfuse.js';
import fs from 'fs';

export async function analyzeOverwatch() {
  try {
    // Fetch traces with specific name
    const traceName = "Codegen - Relevant Warnings Step";
    const tracesResult = await fetchTracesByName(traceName, 50);

    if (!tracesResult.data || tracesResult.data.length === 0) {
      console.error(`No traces found with name: ${traceName}`);
      return;
    }
    
    console.log(`Fetched ${tracesResult.data.length} traces with name: ${traceName}`);
    
    // Extract issues from all matching traces
    const issues = [];
    
    for (const trace of tracesResult.data) {
      const traceDetails = await getTraceById(trace.id);

      if (!traceDetails.observations || traceDetails.observations.length === 0) {
        console.log(`No observations found for trace ${trace.id}`);
        continue;
      }

      const llmInput = traceDetails.observations[traceDetails.observations.length - 1].input;
      
      // Check if trace has content between <issue></issue> tags
      if (llmInput && llmInput.kwargs && llmInput.kwargs.prompt) {
        const issueMatch = /<sentry_issue>([\s\S]*?)<\/sentry_issue>/g.exec(llmInput.kwargs.prompt);
        
        if (issueMatch && issueMatch[1]) {
          issues.push({
            traceId: trace.id,
            issue: issueMatch[1].trim(),
            prompt: llmInput.kwargs.prompt
          });
        }
      }
    }
    
    if (issues.length > 0) {
      console.log(`Found ${issues.length} traces with issues`);
      for (const issue of issues) {
        // Create a directory for each trace
        const dirPath = `./results/trace-${issue.traceId}`;
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // Save prompt to prompt.txt
        fs.writeFileSync(`${dirPath}/prompt.txt`, issue.prompt);
        
        // Save issue to issue.json
        fs.writeFileSync(`${dirPath}/issue.json`, JSON.stringify(issue.issue, null, 2));
        
        console.log(`Files saved to ${dirPath}`);
      }
    } else {
      console.log('No issues found in the traces');
    }
  } catch (error) {
    console.error('Error in main function:', error);
  }
}
