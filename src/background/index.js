import ExpiryMap from "expiry-map";
import { v4 as uuidv4 } from "uuid";
import { fetchSSE } from "./fetch-sse.js";

const KEY_ACCESS_TOKEN = "accessToken";

let prompt =
  "You are acting as a summarization AI, and for the input text please summarize it to the most important 3 to 5 bullet points for brevity: ";
let apiKey = "";
let suffix = "Please briefly summarize it to the most important 3 to 5 bullet points in English.";

async function getStorageData() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["prompt", "apiKey", "suffix"], function (items) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        if (items && items.prompt) {
          prompt = items.prompt;
        }
        if (items && items.apiKey) {
          apiKey = items.apiKey;
        }
        if (items && items.suffix) {
          suffix = items.suffix;
        }
        resolve();
      }
    });
  });
}
getStorageData();

const cache = new ExpiryMap(10 * 1000);

async function getAccessToken() {
  if (cache.get(KEY_ACCESS_TOKEN)) {
    return cache.get(KEY_ACCESS_TOKEN);
  }
  const resp = await fetch("https://chat.openai.com/api/auth/session")
    .then((r) => r.json())
    .catch(() => ({}));
  if (!resp.accessToken) {
    throw new Error("UNAUTHORIZED");
  }
  cache.set(KEY_ACCESS_TOKEN, resp.accessToken);
  return resp.accessToken;
}

async function getSummary(question, callback) {
  const accessToken = await getAccessToken();
  await getStorageData();
  // console.log("accessToken", accessToken);
  await fetchSSE("https://chat.openai.com/backend-api/conversation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: "next",
      messages: [
        {
          id: uuidv4(),
          role: "user",
          content: {
            content_type: "text",
            parts: [question],
          },
        },
      ],
      model: "text-davinci-002-render",
      parent_message_id: uuidv4(),
    }),
    onMessage(message) {
      // console.log("sse message", message);
      if (message === "[DONE]") {
        return;
      }
      try {
        const data = JSON.parse(message);
        const text = data.message?.content?.parts?.[0];
        if (text) {
          callback(text);
        }
      } catch (error) {
        console.error(error);
      }
    },
  });
}

let preventInstance = {};
function executeScripts(tab) {
  const tabId = tab.id;
  // return if we've already created the summary for this website
  if (preventInstance[tabId]) return;

  preventInstance[tabId] = true;
  setTimeout(() => delete preventInstance[tabId], 10000);

  // Add a badge to signify the extension is in use
  chrome.action.setBadgeBackgroundColor({ color: [242, 38, 19, 230] });
  chrome.action.setBadgeText({ text: "GPT" });

  chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.bundle.js"],
  });

  setTimeout(function () {
    chrome.action.setBadgeText({ text: "" });
  }, 1000);
}

// Load on clicking the extension icon
chrome.action.onClicked.addListener(executeScripts);

// Listen for messages
chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async (request, sender, sendResponse) => {
    console.debug("received msg ", request.content);
    try {
      const maxLength = 3000;
      const text = request.content;
      const chunks = splitTextIntoChunks(text, maxLength);
      const summaries = [];

      let currentSummary = "";
      for (const chunk of chunks) {
        const gptQuestion = prompt + `\n\n${chunk}` + `\n\n${suffix}`;
        let currentAnswer = "";
        await getSummary(gptQuestion, (answer) => {
          currentAnswer = answer;
          port.postMessage({
            answer: combineSummaries([currentSummary, answer]),
          });
        });
        currentSummary =
          combineSummaries([currentSummary, currentAnswer]) + "\n\n";
      }
    } catch (err) {
      console.error(err);
      port.postMessage({ error: err.message });
      cache.delete(KEY_ACCESS_TOKEN);
    }
  });
});

function splitTextIntoChunks(text, maxLength) {
  const chunks = [];
  const words = text.split(/\s+/);
  let currentChunk = "";

  for (const word of words) {
    if (currentChunk.length + word.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? " " : "") + word;
    } else {
      chunks.push(currentChunk);
      currentChunk = word;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function combineSummaries(summaries) {
  let combinedSummary = "";
  for (const summary of summaries) {
    combinedSummary += (combinedSummary ? " " : "") + summary;
  }

  return combinedSummary;
}
