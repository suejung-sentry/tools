import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fetchSentryIssue } from './issue.js';
import { fetchEvents } from './trace.js'; // Assuming fetchEvents is exported from trace.js

export async function fetchProfile(organizationSlug, issueId) {
  try {
    const issueData = await fetchSentryIssue(organizationSlug, issueId);
    const issueDir = path.join(process.cwd(), 'more-context', 'data', `${issueId}`, 'profile');
    fs.mkdirSync(issueDir, { recursive: true });
    fs.writeFileSync(path.join(issueDir, 'issue.json'), JSON.stringify(issueData, null, 2));

    // Fetching events to get the transaction name
    const events = await fetchEvents(organizationSlug, issueId);
    let transactionName = 'default_transaction_name';
    if (events.length > 0 && events[0].tags) {
      const transactionTag = events[0].tags.find(tag => tag.key === 'transaction');
      if (transactionTag) {
        transactionName = transactionTag.value;
      }
    }

    // Fetching flamegraph data
    console.log('Fetching flamegraph data');
    const flamegraphData = await axios.get(`https://us.sentry.io/api/0/organizations/sentry/profiling/flamegraph/?project=6178942&query=transaction.op%3Aqueue.task.celery%20event.type%3Atransaction%20transaction%3A${encodeURIComponent(transactionName)}&statsPeriod=7d`, {
      headers: {
        Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`
      }
    });
    fs.writeFileSync(path.join(issueDir, 'flamegraph.json'), JSON.stringify(flamegraphData.data, null, 2));
  } catch (error) {
    console.error('Error fetching profiles:', error.message);
  }
}
