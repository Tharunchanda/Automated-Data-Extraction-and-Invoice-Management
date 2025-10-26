import axios from 'axios';

async function listModels() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not set');
    return;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;

  try {
    const response = await axios.get(url);
    console.log('Available models:', response.data);
  } catch (error) {
    console.error('Error fetching models:', error);
  }
}

listModels();
