import fs from 'fs';
import jwt from 'jsonwebtoken';
import axios from 'axios';

/**
 * Get a GitHub App installation access token.
 */
async function getInstallationToken(appId, installationId, privateKeyPath) {
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const now = Math.floor(Date.now() / 1000);

  // Create JWT for GitHub App authentication
  const payload = {
    iat: now - 60,
    exp: now + (10 * 60),
    iss: appId
  };

  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

  // Exchange JWT for installation access token
  const url = `https://api.github.com/app/installations/${installationId}/access_tokens`;
  const res = await axios.post(url, {}, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });

  return res.data.token;
}

// Calls the GitHub GraphQL API to minimize a comment.
async function minimizeComment(token, subjectId, reason = "OFF_TOPIC") {
  const graphqlUrl = "https://api.github.com/graphql";
  const query = `
    mutation MinimizeComment($subjectId: ID!, $classifier: ReportedContentClassifiers!) {
      minimizeComment(input: {subjectId: $subjectId, classifier: $classifier}) {
        minimizedComment {
          isMinimized
          minimizedReason
        }
      }
    }
  `;
  const variables = {
    subjectId,
    classifier: reason
  };

  const res = await axios.post(
    graphqlUrl,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  if (res.data.errors) {
    throw new Error(`GitHub API error: ${JSON.stringify(res.data.errors)}`);
  }

  return res.data.data.minimizeComment.minimizedComment;
}

// Resolves a pull request review thread using the GitHub GraphQL API.
async function resolveReviewThread(token, threadId) {
  const graphqlUrl = "https://api.github.com/graphql";
  const query = `
    mutation ResolveReviewThread($threadId: ID!) {
      resolveReviewThread(input: {threadId: $threadId}) {
        thread {
          isResolved
        }
      }
    }
  `;
  const variables = {
    threadId
  };

  const res = await axios.post(
    graphqlUrl,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  if (res.data.errors) {
    throw new Error(`GitHub API error: ${JSON.stringify(res.data.errors)}`);
  }

  return res.data.data.resolveReviewThread.thread;
}

// Fetches regular PR comments (issue comments) from the conversation tab
async function getPRCommentsREST(token, ownerRepo, prNumber) {
  const url = `https://api.github.com/repos/${ownerRepo}/issues/${prNumber}/comments`;
  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    }
  });

  // The node_id field in REST API response is the subjectId for GraphQL
  return res.data.map(comment => ({
    subjectId: comment.node_id,
    body: comment.body,
    author: comment.user.login,
    created_at: comment.created_at,
    url: comment.html_url
  }));
}

// Fetches PR review comments (those on code diffs, not conversation tab) and their review threads using only the GraphQL API
async function getPRReviewCommentsGraphQL(token, ownerRepo, prNumber) {
  const graphqlUrl = "https://api.github.com/graphql";
  const [owner, repo] = ownerRepo.split("/");

  // This query fetches review threads and their comments for a PR
  const query = `
    query($owner: String!, $repo: String!, $prNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              comments(first: 100) {
                nodes {
                  id
                  body
                  author {
                    login
                  }
                  createdAt
                  url
                  path
                  position
                  commit {
                    oid
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables = { owner, repo, prNumber: Number(prNumber) };

  const res = await axios.post(
    graphqlUrl,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  const threads =
    res.data?.data?.repository?.pullRequest?.reviewThreads?.nodes || [];

  // Flatten all review comments, attaching their thread id and isResolved
  const reviewComments = [];
  for (const thread of threads) {
    for (const comment of thread.comments.nodes) {
      reviewComments.push({
        subjectId: comment.id,
        body: comment.body,
        author: comment.author?.login,
        created_at: comment.createdAt,
        url: comment.url,
        path: comment.path,
        position: comment.position,
        commit_id: comment.commit?.oid,
        thread_id: thread.id,
        thread_isResolved: thread.isResolved
      });
    }
  }

  return reviewComments;
}

  
// Posts a regular issue comment on a PR (appears in the conversation tab)
async function postPRComment(token, ownerRepo, prNumber, body) {
  const url = `https://api.github.com/repos/${ownerRepo}/issues/${prNumber}/comments`;
  const res = await axios.post(
    url,
    { body },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    }
  );
  return {
    id: res.data.id,
    body: res.data.body,
    author: res.data.user.login,
    created_at: res.data.created_at,
    url: res.data.html_url
  };
}

// Posts a review comment on a PR (appears on a specific line in the diff)
async function postPRReviewComment(token, ownerRepo, prNumber, body, commitId, path, position) {
  // commitId: SHA of the commit to comment on
  // path: file path to comment on
  // position: line index in the diff to comment on (1-based)
  const url = `https://api.github.com/repos/${ownerRepo}/pulls/${prNumber}/comments`;
  const res = await axios.post(
    url,
    {
      body,
      commit_id: commitId,
      path,
      position
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    }
  );
  return {
    id: res.data.id,
    body: res.data.body,
    author: res.data.user.login,
    created_at: res.data.created_at,
    url: res.data.html_url,
    path: res.data.path,
    position: res.data.position,
    // The REST API does not return the thread id directly.
    // To get the thread id, use getThreadIdForReviewComment with the node_id of this comment.
    node_id: res.data.node_id
  };
}


async function main() {
    const APP_ID = "1056123";
    const INSTALLATION_ID = "88050356";
    const PRIVATE_KEY_PATH = "/Users/suejungshin/code/suejung-sentry/tools/suejung-app.2025-10-02.private-key.pem";
    const token = await getInstallationToken(APP_ID, INSTALLATION_ID, PRIVATE_KEY_PATH);

    const ownerRepo = "suejung-org/hello-vite";
    const prNumber = 1;

    // Example: post a review comment and get its thread id
    const num = 9;
    const body = "This is a test review comment" + num;
    const commitId = "44d0f477b53dbb61232c1d63d2b76b57a88d1c14";
    const path = "src/App.tsx";
    const position = 1;
    const comment = await postPRReviewComment(token, ownerRepo, prNumber, body, commitId, path, position);
    console.log('Comment:', comment);

    
    const allComments = [];

    // const comments = await getPRCommentsREST(token, ownerRepo, prNumber);
    // console.log('Comments:', comments);
    // allComments.push(...comments);

    const reviewComments = await getPRReviewCommentsGraphQL(token, ownerRepo, prNumber);
    console.log('Review Comments with thread ids:', reviewComments);
    allComments.push(...reviewComments);

    let subjectId = null;
    let foundThreadId = null;
    for (const comment of reviewComments) {
        if (comment.body.includes("This is a test review comment" + num)) {
            subjectId = comment.subjectId;
            foundThreadId = comment.thread_id;
            break;
        }
    }
    console.log('Subject ID:', subjectId);
    console.log('Thread ID:', foundThreadId);

    // const minimizedComment = await minimizeComment(token, subjectId, "OUTDATED");
    // console.log('Minimized Comment:', minimizedComment);

    if (foundThreadId) {
      const resolvedThread = await resolveReviewThread(token, foundThreadId);
      console.log('Resolved Thread:', resolvedThread);
    }


} 

main();
