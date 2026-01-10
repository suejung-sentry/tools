import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Langfuse API configuration

};

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

async function fixDataset() {
  try {
    const response = await langfuseApi.get('/api/public/datasets/relevant-warnings-v2');
    if (response.data.name !== 'relevant-warnings-v2') {
      throw new Error('Dataset name mismatch: expected relevant-warnings-v2');
    }
    const items = response.data.items;
    for (const item of items) {
      if (!item.expectedOutput) {
        continue;
      }

      const newOutput = {
        expected_bugs: [{
          repos: item.expectedOutput.repos,
          description: item.expectedOutput.description,
          encoded_location: item.expectedOutput.encoded_location
        }]
      }


      if (item && item.id !== 'cmb03ob6t00fcietns5txv1fd' && item.id !== 'cmb03ob9200feietnjly2aje9') {
        try {
          const updateResponse = await langfuseApi.post('/api/trpc/datasets.updateDatasetItem', {
            json: {
              projectId: "clws5ue5q00006gkjq1d9c7l5",
              datasetId: item.datasetId,
              datasetItemId: item.id,
              input: JSON.stringify(item.input),
              expectedOutput: JSON.stringify(newOutput),
              metadata: "",
            }
          });
          console.log(`Updated item ${item.id}`);
        } catch (error) {
          console.error(`Error updating item ${item.id}:`, error.message);
          throw error;
        }
      }

    }
    return response.data;
  } catch (error) {
    console.error('Error fetching datasets:', error.message);
    throw error;
  }
}

export {
  createTrace, fetchTraces, fetchTracesByName, fixDataset, getTraceById, logGeneration
};

