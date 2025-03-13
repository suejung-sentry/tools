import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const BASE_URL = 'https://langfuse.getsentry.net/api/public';
const headers = {
  'Authorization': 'Basic ' + Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`).toString('base64'),
  'Cookie': process.env.LANGFUSE_COOKIE
};

const api = axios.create({
  baseURL: BASE_URL,
  headers
});

const MAX_RESULTS = 500;
const PAGE_SIZE = 20;

let traces = [];
let page = 1;

while (traces.length < MAX_RESULTS) {
  const queryParams = new URLSearchParams({ 
    name: 'Codegen - Relevant Warnings Step', 
    page: page, 
    limit: PAGE_SIZE,
    orderBy: 'timestamp.desc',
  });

  const response = await api.get(`/traces?${queryParams}`);
  const newTraces = response.data.data;
  
  if (newTraces.length === 0) {
    break; // No more results
  }
  
  traces = traces.concat(newTraces);
  page++;
}

// Trim to max results if we went over
traces = traces.slice(0, MAX_RESULTS);

// Get details for traces with usage > 0
const detailedTraces = [];
for (const trace of traces) {
  if (trace.totalCost > 0) {
    const detailResponse = await api.get(`/traces/${trace.id}`);
    detailedTraces.push(detailResponse.data);
  }
}

// Extract and write the latest observation from each trace to files
import fs from 'fs';

if (!fs.existsSync('./results')) {
  fs.mkdirSync('./results');
}

for (const trace of detailedTraces) {
  const sentryRepoData = trace.input.kwargs.sentry_data;

  if (trace.observations && trace.observations.length > 0) {
    // Sort by startTime in descending order and take first
    const latestObservation = trace.observations.sort((a, b) => 
      new Date(b.startTime) - new Date(a.startTime)
    )[0];

    const name = `${sentryRepoData.repo.name}-${sentryRepoData.run_id}`;
    const filename = `./results/${name}.json`;
    
    try {
      const prompt = latestObservation.input.kwargs.prompt;
      const issue = prompt.split("Here is an issue we had in our codebase:")[1].split("Here is a warning that surfaced somewhere in our codebase:")[0];
      const warning = prompt.split("Here is a warning that surfaced somewhere in our codebase:")[1].split("We have no idea if the warning is relevant to the issue.")[0];

      const content = JSON.stringify({        
        sentry_data: sentryRepoData,
        warning: warning.trim(),
        output: latestObservation.output,
        issue: issue.trim(),
      }, null, 2);
      
      fs.writeFileSync(filename, content);
      console.log(`Wrote results for trace ${trace.id} to ${filename}`);
    } catch (err) {
      console.log(`Skipping trace ${trace.id} due to prompt parsing error`);
    }
  }
}
