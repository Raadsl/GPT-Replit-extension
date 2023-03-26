const submit = document.getElementById("send-button")
const stopButton = document.getElementById("stop-button");
let stopAI = false;
let voice = false;
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function add_message(x, id=null) {
  const chatMessages = document.getElementById('chat-messages');

  // Find the existing message div with the specified ID, or create a new one
  let messageDiv = null;
  if (id !== null) {
    messageDiv = document.getElementById(`message-${id}`);
  }
  if (messageDiv === null) {
    messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', x.type);
    if (id !== null) {
      messageDiv.id = `message-${id}`;
    }
    chatMessages.appendChild(messageDiv);
  }

  // Update the message content
  
  messageDiv.innerHTML = marked.parse(x.text);

  // Scroll to the bottom of the chat-messages div
  chatMessages.scrollTop = chatMessages.scrollHeight;
  hljs.highlightAll();
}

function clearMessages() {
  const chatMessages = document.getElementById('chat-messages');
  while (chatMessages.firstChild) {
    chatMessages.removeChild(chatMessages.firstChild);
  }
  // Reset the messageCounter
  messageCounter = 1;
  replit.messages.showConfirm("Cleared message history successfully!", 2000);
}

function startVoiceInput() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  voice = true;
  recognition.onresult = (event) => {
    const speechResult = event.results[0][0].transcript;
    document.getElementById('user-message').value = speechResult;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
  };

  recognition.start();
}

function speak(text) {
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  synth.speak(utterance);
}

// Check if the browser supports SpeechRecognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  console.error('Your browser does not support the Web Speech API. Please use a supported browser, such as Google Chrome or Microsoft Edge.');
  document.getElementById('voice-input-button').disabled = true;
  document.getElementById('voice-input-button').title = `Your browser does not support the Web Speech API. Please use a supported browser, such as Google Chrome or Microsoft Edge.`;
} else {
  document.getElementById('voice-input-button').addEventListener('click', startVoiceInput);
}
const clearMessagesButton = document.getElementById('clear-messages-button');
clearMessagesButton.addEventListener('click', clearMessages);

function getSelectedMode() {
  const selectElement = document.getElementById("mode");
  const selectedMode = selectElement.options[selectElement.selectedIndex].value;
  return selectedMode;
}

let messageCounter = 1;


async function fetchAssistantResponse(apiKey, mode, history) {
  return await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      'model': `gpt-${mode}`,
      'messages': history,
      'temperature': 0.7,
      'stream': true
    })
  });
}

async function getResp() {
  submit.disabled = true;
  stopButton.disabled = false;
  const file = await replit.me.filePath();
  const promptText = document.getElementById("user-message").value;
  messageCounter++;
  const messageId = messageCounter;
  add_message({ type: 'user-msg', text: escapeHtml(promptText) }, messageId);
  document.getElementById("user-message").value = "";
  const apiKey = document.getElementById("KEY").value;
  const history = extractMessages();
  // Add file content to history if available
  if (file) {
    let filecontent = await replit.fs.readFile(file, "utf8");
    if (filecontent.error) {
      await replit.messages.showError("Error reading file", 2000);
    }
    let newObj = {
      role: "system",
      content: `You are a helpful programming assistent called Replit-GPT. The user might ask something related to the contents of the file they opened you in (${file}). Here is the content:\n${filecontent.content}`
    };
    history.splice(1, 0, newObj);
  } else {
    let newObj = { role: "system", content: `You are a helpful programming assistent called Replit-GPT.` };
    history.splice(0, 0, newObj);
  }

  const mode = getSelectedMode();

  // Fetch response from API and process it
  try {
    const response = await fetchAssistantResponse(apiKey, mode, history);
    if(response.status != 200) {
      throw new Error('Response status is '+response.status); 
    }
    await processResponse(response, messageId);
  } catch (error) {
    console.error("Error fetching response:", error);
    
    messageCounter++;
    add_message({ type: 'error-msg', text: `Error fetching response` }, messageCounter);
  }
  submit.disabled = false;
  stopButton.disabled = true;
}

async function processResponse(response, messageId) {
  const reader = response.body.getReader();
  let resp = '';
  let chunks = '';
  messageCounter++;
  while (true) {
    // Check if stopAI flag is set to true
    if (stopAI) {
      stopAI = false; // Reset the stopAI flag
      stopButton.disabled = true;
      break;
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks = new TextDecoder().decode(value);

    if (chunks.includes('data: [DONE]')) {
      break;
    }
    const regex = /^data:\s*(.+?)\s*$/gm;
    const jsonMatches = chunks.matchAll(regex);

    for (const jsonMatch of jsonMatches) {
      const jsonStr = jsonMatch[0].replace(/^data:\s*|\s*$/g, '');
      const { choices } = JSON.parse(jsonStr);

      for (const { delta } of choices) {
        const token = delta?.content;
        if (token) {
          resp += token;
          add_message({ type: 'received-msg', text: resp }, messageCounter);
        }
      }
    }
  }
  if (voice) {
    speak(resp);
  }
}

function extractMessages() {
  const messageHistory = [];
  const chatMessages = document.getElementById('chat-messages');

  for (const messageElement of chatMessages.children) {
    const messageObject = {};

    if (messageElement.classList.contains('user-msg')) {
      messageObject.role = 'user';
    } else if (messageElement.classList.contains('received-msg')) {
      messageObject.role = 'assistant';
    } else if (messageElement.classList.contains('error-msg')) {
      messageObject.role = 'system';
    }

    messageObject.content = messageElement.textContent;
    messageHistory.push(messageObject);
  }


  console.log(messageHistory);
  return messageHistory;
}



submit.addEventListener("click", getResp);
var input = document.getElementById("user-message");

input.addEventListener("keypress", function(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submit.click();
  }
});
stopButton.addEventListener("click", () => {
  stopAI = true;
});

// Doesn't really work
const passwordInput = document.getElementById('KEY');
const savedPassword = localStorage.getItem('OPENAI-API-KEY_GPT-REPLIT|V1.1');
if (savedPassword) {
  passwordInput.value = savedPassword;
}
passwordInput.addEventListener('input', () => {
  localStorage.setItem('password', passwordInput.value);
});
