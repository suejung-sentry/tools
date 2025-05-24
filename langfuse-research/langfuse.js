import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';


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
    const headers = [
      'id', 'org', 'repo', 'pr_id', 'commit_sha', 'link_to_pr', 'diff_num_files', 'diff_num_chars',
      'bug_description1', 'bug_encoded_location1',
      'bug_description2', 'bug_encoded_location2'
    ];
    csvRows.push(headers.join(','));

    // Add data rows
    for (const result of results) {
      const row = [
        result.id,
        result.org,
        result.repo,
        result.pr_id,
        result.commit_sha,
        result.link_to_pr,
        result.diff_num_files,
        result.diff_num_chars,
        `"${result.bug_description1?.replace(/"/g, '""') || ''}"`,
        result.bug_encoded_location1 || '',
        `"${result.bug_description2?.replace(/"/g, '""') || ''}"`,
        result.bug_encoded_location2 || ''
      ];
      csvRows.push(row.join(','));
    }

    // Write to file
    fs.writeFileSync('dataset_results.csv', csvRows.join('\n'), 'utf8');
    
    return results;
}

export {
  createTrace, fetchTraces, fetchTracesByName, fixDataset, getTraceById, logGeneration
};


const datasetItemIds = [
'8ef8d7e8-bde9-4557-8447-8ac408a99ece',
'6c95edc4-212c-40df-91d5-44c06fe39814',
'63066762-b383-4d63-b9b0-b02da070c3d9',
'6144ec83-5ce9-427f-bafb-d9a8fcd10dec',
'f7679a0d-8fc4-47d8-a205-496851434a68',
'b8873004-f93f-492a-b520-2e45a98d5c87',
'ff6fe211-aab4-44d4-9194-5105e1d76f2b',
'e4f4fa4f-5472-423a-933e-83f822c0715c',
'05f47e97-e85a-490b-a96b-58a48903b7de',
'ab8441b7-7c4b-4631-8b91-b1a3abf04508',
'e6703deb-deb8-4854-bd79-8847dd67a7be',
'b644ce32-c92d-4c78-bbcf-59383e69a1c9',
'7d273d8a-8d2b-4958-b413-c5c4c8845c43',
'573211ca-29ba-4c2a-aae4-4c5341c9cd2e',
'f7a15e66-c645-45ea-a3b8-ef60cd7f13f6',
'7eb99222-4a5f-4cde-896a-2c6af86aaf74',
'3a38bbf4-5363-405f-b552-e7be7e70c0aa',
'f2e83a82-ebc4-4d99-a65a-6e504a5f6834',
'4109f741-4b86-48cd-b80a-0e4359cd715c',
'3245b84c-1d66-46b4-a520-bbf7cfd5901a',
'6d799aff-2632-4b21-a4a5-87eda6fa9797',
'e1f6cdf0-4b92-4d18-9a80-d2059c64cea3',
'e9e5ea23-1f79-4907-b17a-2de867f1aca9',
'12a6b1d3-3f66-45fb-8600-1d87010694da',
'f7b5ce31-43e4-41d2-944d-9a7deb498fcd',
'c23a7f43-5977-4dbe-8b13-79350e37b4dc',
'abc4289e-bd18-41b1-8e13-15f1d5c5f33c',
'd83ce2a5-9377-4149-97c4-11638d9be8fc',
'e9d50ee2-9f68-4ca2-92ff-fabedf03aeb6',
'21b48bed-d902-41d3-b2a7-043665c3c093',
'996ddd8e-9829-4d58-80e5-13f895359956',
'a8db7cf1-8c47-4f64-a256-4f2f9b258d77',
'b6faf052-2332-40c1-941c-418d998be51e',
'c150561c-2e6d-4087-a27e-f7993b47b534',
'1e7021ea-a2a9-4499-a7e3-2041a4c17bc8',
'36ade162-2569-4c9e-8b2f-953226c475d6',
'31748d0a-4588-4f95-a67f-989d6e561402',
'5a02e967-9cb3-4165-b823-4b9c6f2dc4b6',
'927dadb5-aab0-4ecb-8e4b-8b8c32ec2eb7',
'fe201a74-a302-49a8-a968-db641301ad8f',
'b7e0bb36-c23c-4f5f-ac7b-9a34d8ef0fef',
'129bcd9e-641f-4ab1-83f4-7ab198a3c74f',
'e17aa437-17cf-4835-861b-07fdcacceddd',
'e83f8ec0-510a-42f1-8da7-67fb4b64cab8',
'979d0d08-9f9d-491f-9b3e-6eca2ecd65f2',
'8ee85cf9-81d3-471a-b74a-c7e979b4de85',
'3848c263-74b3-457c-9136-1eaf537646d2',
'697073f9-066f-499f-b103-84eed353486e',
'a034bf67-dcd8-452a-8155-70027ef760dd',
'3dc05c54-6dd5-4482-898c-2f2a3a855c2c',
'b6398eb3-265f-4ad2-babb-3344e94af81a',
'0a1b942a-74a2-4253-9bc5-134fa8b7af2f',
'cad2f42a-8a59-430e-b8b4-939a51dbee67',
'97b20106-7bd3-4da4-9ce4-b1c93b4d1ec2',
'5fed5c02-a659-4ad2-a625-400553d54ff2',
'427bed77-6c2f-42e2-9190-0367d9959a3d',
'1917f626-3fa6-42f0-bda6-dd6bf5160093',
'6113f83a-36b0-4485-a23b-5139e5793551',
'03f6a1d8-465a-434d-bd02-5f3aa78d5837',
'db49d44f-e5ff-4c99-8345-8aea59072340',
'150a685c-1e27-4ac8-a98e-e74511577fba',
'4bfe6c9e-495d-413a-bbcf-171e55f7492e',
'a0cfc6b9-c1e5-491c-a143-09e58fc12f26',
'07a5bf38-bd1a-4f8e-b538-803c43d3c991',
'73f21210-3b59-4aae-bce5-376e00656f4f',
'93b0f9f6-0ccc-4c32-bdd3-2570da6f30e0',
'a292be1c-7a26-481c-aaef-c5ae388b3b27',
'8177fe31-4df0-40c9-9486-3218ebb14048',
]