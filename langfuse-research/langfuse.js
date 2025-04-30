import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Langfuse API configuration
const LANGFUSE_BASE_URL = 'https://langfuse.getsentry.net';
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;

// Create headers with Basic Auth
const headers = {
  'Authorization': 'Basic ' + Buffer.from(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`).toString('base64'),
  'Content-Type': 'application/json',
<<<<<<< HEAD
  'Cookie': 'PASTE HERE - pulling from env has some parsing errors I couldnt figure out'
=======
>>>>>>> origin/main
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

export {
  createTrace, fetchTraces, fetchTracesByName, getTraceById, logGeneration
};

