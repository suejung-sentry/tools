

async function callLLM(data) {
  try {
    const response = await axios.post(LLM_API_URL, data, {
      headers: {
        Authorization: `Bearer ${LLM_AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error calling LLM:', error.message);
    throw error;
  }
}
