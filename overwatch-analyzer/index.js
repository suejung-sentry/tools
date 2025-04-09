import axios from 'axios';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const RESULTS_DIR = 'results';

async function getTopRepos() {
  try {
    // Query GitHub API for top JS/TS repos
    const response = await axios.get('https://api.github.com/search/repositories', {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      params: {
        q: 'language:javascript language:typescript',
        sort: 'stars',
        order: 'desc',
        per_page: 10
      }
    });

    // Clone each repo and run eslint
    for (const repo of response.data.items) {
      const repoPath = path.join(RESULTS_DIR, repo.name);
      
      console.log(`Cloning ${repo.full_name}...`);
      
      if (fs.existsSync(repoPath)) {
        console.log(`${repo.name} already exists, skipping clone...`);
      } else {
        execSync(`git clone ${repo.clone_url} ${repoPath}`, { stdio: 'inherit' });
        console.log(`Successfully cloned ${repo.name}\n`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function runEslintOnRepo(repoPath, repoName) {
  console.log(`Running ESLint on ${repoName}...`);
  try {
    // Install ESLint and dependencies in the repo
    execSync('npm install eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-import eslint-plugin-unicorn eslint-plugin-sonarjs eslint-plugin-security eslint-plugin-prettier eslint-plugin-no-only-tests eslint-plugin-no-secrets eslint-config-prettier --save-dev', { cwd: repoPath, stdio: 'inherit' });
    
    // Copy over our ESLint config
    fs.copyFileSync(
      path.join(process.cwd(), 'configs', 'eslint.config.js'),
      path.join(repoPath, 'eslint.config.js')
    );

    // Run ESLint
    const eslintOutput = execSync('npx eslint .', { 
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Write results to file
    const resultsFile = path.join(process.cwd(), 'results.txt');
    fs.appendFileSync(resultsFile, `ESLint results for ${repoName}:\n${eslintOutput}\n----------------------------------------\n`);
  } catch (eslintError) {
    // ESLint usually exits with error code 1 if it finds issues
    const resultsFile = path.join(process.cwd(), 'results.txt');
    fs.appendFileSync(resultsFile, `Error found during eslint (${eslintError}; ESLint found issues in ${repoName}:\n${eslintError.stdout || eslintError.stderr}\n----------------------------------------\n`);
  }
}

async function run() {
  await getTopRepos();

  const repos = fs.readdirSync(RESULTS_DIR);
  for (const repo of repos) {
    const repoPath = path.join(RESULTS_DIR, repo);
    if (fs.statSync(repoPath).isDirectory()) {
      await runEslintOnRepo(repoPath, repo);
    }
  }
}

run();
