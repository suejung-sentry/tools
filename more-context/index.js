import dotenv from 'dotenv';
import { fetchProfile as fetchIntraserviceContext } from './profile.js';
import { fetchInterserviceContext } from './trace.js';

dotenv.config();

global.SENTRY_API_URL = 'https://sentry.io/api/0';
global.SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;


const ORGANIZATION_SLUG = 'sentry'; // Replace with the actual organization slug
const ISSUE_ID = '6382411120'; // Replace with the actual issue ID


//fetchInterserviceContext(ORGANIZATION_SLUG, ISSUE_ID);

fetchIntraserviceContext(ORGANIZATION_SLUG, ISSUE_ID);
