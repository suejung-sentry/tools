import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fetchSentryIssue } from './issue.js';
import { fetchEvents } from './trace.js'; // Assuming fetchEvents is exported from trace.js

const { Octokit } = await import('@octokit/rest');
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

export async function fetchProfile(organizationSlug, issueId) {
  try {
    const issueData = await fetchSentryIssue(organizationSlug, issueId);
    const issueDir = path.join(process.cwd(), 'more-context', 'data', `${issueId}`, 'profile');
    fs.mkdirSync(issueDir, { recursive: true });
    fs.writeFileSync(path.join(issueDir, 'issue.json'), JSON.stringify(issueData, null, 2));

    // Fetching events to get the transaction name
    const events = await fetchEvents(organizationSlug, issueId);
    let transactionName = 'default_transaction_name';
    if (events && events.length > 0 && events[0].tags) {
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
  
    const profile = await addCodeContextToProfile(flamegraphData.data.shared);
    fs.writeFileSync(path.join(issueDir, 'profile.json'), JSON.stringify(profile, null, 2));

  
  } catch (error) {
    console.error('Error fetching profiles:', error.message);
  }
}

async function fetchCodeFromFlameGraph(frame) {
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN
    });

    try {
        // Get file content from GitHub

        console.log("Fetching code for", frame.file);

        const response = await octokit.repos.getContent({
            owner: 'getsentry',
            repo: 'seer',
            path: 'src/' + frame.file,
        });

        // Decode content
        const content = Buffer.from(response.data.content, 'base64').toString();
        const lines = content.split('\n');

        // Get context around the line (10 lines before and after)
        const startLine = Math.max(0, frame.line - 10);
        const endLine = Math.min(lines.length, frame.line + 10);

        return {
            file: frame.file,
            line: frame.line,
            name: frame.name,
            code: lines.slice(startLine, endLine).join('\n'),
            lineRange: {start: startLine + 1, end: endLine},
            lines: lines
        };
    } catch (error) {
        console.error(`Error fetching code for ${frame.file}:${frame.line}:`, error.message);
        return null;
    }
}

export async function addCodeContextToProfile(profile) {
    console.log(profile);
    // Assuming profile has frames array
    const codePromises = profile.frames.map(frame => {
        if (frame.is_application) {
            try {
                return fetchCodeFromFlameGraph(frame);
            } catch (error) {
                console.error(`Error processing frame ${frame.name}:`, error);
                return null;
            }
        }
        return null;
    });

    const codeContexts = await Promise.all(codePromises);
    
    // Add code context to profile
    profile.frames = profile.frames.map((frame, index) => {
        if (codeContexts[index]) {
            return {
                ...frame,
                codeContext: codeContexts[index]
            };
        }
        return frame;
    });

    return profile;
}
