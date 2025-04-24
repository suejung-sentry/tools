import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fetchSentryIssue } from './issue.js';

async function fetchEvents(organizationSlug, issueId) {
  try {
    const response = await axios.get(`${SENTRY_API_URL}/organizations/${organizationSlug}/issues/${issueId}/events/`, {
      headers: {
        Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching Sentry events:', error.message);
    throw error;
  }
}

async function fetchEventById(organizationSlug, issueId, eventId) {
  try {
    const response = await axios.get(`${SENTRY_API_URL}/organizations/${organizationSlug}/issues/${issueId}/events/${eventId}/`, {
      headers: {
        Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching Sentry event details:', error.message);
    throw error;
  }
}

async function fetchTrace(organizationSlug, traceId) {
  try {
    const response = await axios.get(`https://us.sentry.io/api/0/organizations/${organizationSlug}/events-trace/${traceId}/?limit=10000&timestamp=1741647726&useSpans=1`, {
      headers: {
        Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching Sentry trace:', error.message);
    throw error;
  }
}

async function fetchTraceDetailsSummary(organizationSlug, projectName, eventId) {
  try {
    const response = await axios.get(`https://us.sentry.io/api/0/organizations/${organizationSlug}/events/${projectName}:${eventId}/?referrer=trace-details-summary`, {
      headers: {
        Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching event by ID:', error.message);
    throw error;
  }
}


async function fetchInterserviceContext(organizationSlug, issueId) {
  try {
    const issueData = await fetchSentryIssue(organizationSlug, issueId);
    const issueDir = path.join(process.cwd(), 'more-context', 'data', `${issueId}`, 'trace');
    fs.mkdirSync(issueDir, { recursive: true });
    fs.writeFileSync(path.join(issueDir, 'issue.json'), JSON.stringify(issueData, null, 2));

    const events = await fetchEvents(organizationSlug, issueId);
    if (events.length > 0) {
      const eventDetailsArray = [];
      for (const event of events) {
        console.log('Fetching event:', event.id);
        const eventDetails = await fetchEventById(organizationSlug, issueId, event.id);
        eventDetailsArray.push(eventDetails);
        fs.writeFileSync(path.join(issueDir, `event_${event.id}.json`), JSON.stringify(eventDetails, null, 2));
      }

      const firstEvent = eventDetailsArray[0];
      let trace;
      if (firstEvent && firstEvent.contexts && firstEvent.contexts.trace && firstEvent.contexts.trace.trace_id) {
        const traceId = firstEvent.contexts.trace.trace_id;
        console.log('Fetching trace:', traceId);
        trace = await fetchTrace(organizationSlug, traceId);
        fs.writeFileSync(path.join(issueDir, 'trace.json'), JSON.stringify(trace, null, 2));

        if (trace && trace.transactions && trace.transactions.length > 0) {
          const transactionEventId = trace.transactions[0].event_id;
          const projectName = trace.transactions[0].project_slug;
          console.log('Fetching event by transaction event ID:', transactionEventId);
          const transactionEventDetails = await fetchTraceDetailsSummary(organizationSlug, projectName, transactionEventId);
          fs.writeFileSync(path.join(issueDir, `transaction_event_${transactionEventId}.json`), JSON.stringify(transactionEventDetails, null, 2));
        } else {
          console.error('No transactions found in trace.');
        }
      } else {
        console.error('Trace ID not found in event details context.');
      }

      const llmData = {
        issue: issueData,
        events,
        trace
      };

      // const llmResponse = await callLLM(llmData);
      // console.log('LLM Response:', llmResponse);
    }
  } catch (error) {
    console.error('Error in main function:', error.message);
  }
}

export { fetchEvents, fetchEventById, fetchTrace, fetchTraceDetailsSummary, fetchInterserviceContext };
