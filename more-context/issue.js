import axios from 'axios';

async function fetchSentryIssue(organizationSlug, issueId) {
  try {
    const response = await axios.get(`${SENTRY_API_URL}/organizations/${organizationSlug}/issues/${issueId}/`, {
      headers: {
        Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching Sentry issue:', error.message);
    throw error;
  }
}

export { fetchSentryIssue };
