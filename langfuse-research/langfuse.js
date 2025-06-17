import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();



// Create axios instance for Langfuse API
const langfuseApi = axios.create({
  baseURL: LANGFUSE_BASE_URL,
  headers
});

// Function to fetch traces with pagination
async function fetchTraces(params = {}) {
  try {
    const response = await langfuseApi.get('/api/public/traces', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching traces:', error.message);
    throw error;
  }
}

// Function to get trace details by ID
async function getTraceById(traceId) {
  try {
    const response = await langfuseApi.get(`/api/public/traces/${traceId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching trace ${traceId}:`, error.message);
    throw error;
  }
}

// Function to create a new trace
async function createTrace(traceData) {
  try {
    const response = await langfuseApi.post('/api/public/traces', traceData);
    return response.data;
  } catch (error) {
    console.error('Error creating trace:', error.message);
    throw error;
  }
}

// Function to log a generation
async function logGeneration(generationData) {
  try {
    const response = await langfuseApi.post('/api/public/generations', generationData);
    return response.data;
  } catch (error) {
    console.error('Error logging generation:', error.message);
    throw error;
  }
}

// Function to fetch traces by name
async function fetchTracesByName(name, limit = 10) {
  try {
    const response = await langfuseApi.get('/api/public/traces', { 
      params: {
        name: name,
        limit: limit,
        orderBy: 'timestamp.desc'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching traces with name ${name}:`, error.message);
    throw error;
  }
}

export async function getDatasetItems() {
  try {
    const response = await langfuseApi.get('/api/public/dataset-items?datasetName=relevant-warnings');
    return response.data;
  } catch (error) {
    console.error('Error getting dataset items:', error.message);
    throw error;
  }
}

async function fixDataset() {



    const ids = datasetItemIds

    const results = []

    for (const id of ids) {
      const response = await langfuseApi.get(`/api/public/dataset-items/${id}`);
      const item = response.data;

      const org = item.input.repo.owner === 'sentry' ? 'getsentry' : item.input.repo.owner
      const repo = item.input.repo.name
      const pr_id = item.input.pr_id

      const diffResponse = await fetch(`https://github.com/${org}/${repo}/pull/${pr_id}.diff`);
      const diffText = await diffResponse.text();
      const diffNumFiles = diffText.split('diff --git').length - 1;
      const diffNumChars = diffText.length;

      const result_base = {
        id: item.id,
        org: org,
        repo: repo,
        pr_id: pr_id,
        commit_sha: item.input.commit_sha,
        link_to_pr: `https://github.com/${org}/${repo}/pull/${pr_id}/files`,
        diff_num_files: diffNumFiles,
        diff_num_chars: diffNumChars,
      }
      if (Array.isArray(item.expectedOutput)) {
        const result = {
          ...result_base,
          bug_description1: item.expectedOutput[0].description,
          bug_encoded_location1: item.expectedOutput[0].encoded_location,
          bug_description2: item.expectedOutput[1].description,
          bug_encoded_location2: item.expectedOutput[1].encoded_location,
        }
        results.push(result)
      } else {
        const result = {
          ...result_base,
          link_to_pr: `https://github.com/${item.input.repo.owner}/${item.input.repo.name}/pull/${item.input.pr_id}/files`,
          bug_description1: item.expectedOutput.description,
          bug_encoded_location1: item.expectedOutput.encoded_location,
        }
        results.push(result)
      }
    }

    // Convert results to CSV format
    const csvRows = [];
    
    // Add header row
    const headers = ['diff_num_files', 
    ];
    csvRows.push(headers.join(','));

    // Add data rows
    for (const result of results) {
      const row = [
        result.diff_num_files
      ];
      csvRows.push(row.join(','));
    }

    // Write to file
    fs.writeFileSync('dataset_results.csv', csvRows.join('\n'), 'utf8');
    
    return results;
}

export {
  createTrace, fetchTraces, fetchTracesByName, getTraceById, logGeneration
};

