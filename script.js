const submit = document.getElementById("send-button")
const stopButton = document.getElementById("stop-button");
let maxContent = 4000
let stopAI = false;
let voice = false;
function escapeHtml(unsafe) {
  let clean = unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  return DOMPurify.sanitize(clean, { USE_PROFILES: { html: true } });
}
let currentFile = null
async function getCurrentFile() {
  const file = await replit.session.getActiveFile()
  if(file !== null) {
    currentFile = file
  }
  return Currentfile
}
getCurrentFile()

let clickTimer = null;

function onCodeBlockMouseDown(e) {
  const codeBlock = e.target;
  if (clickTimer === null) {
    clickTimer = setTimeout(() => {
      clickTimer = null;
    }, 300);
  } else {
    clearTimeout(clickTimer);
    clickTimer = null;
    copyCodeBlock(codeBlock);
  }
}

function exportMessageHistory() {
  const messageHistory = extractMessages();
  const dataStr = JSON.stringify(messageHistory);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.download = 'messageHistory-GPT-Replit.json';
  link.href = url;
  link.click();
}

function importMessageHistory(event) {
  const chatMessages = document.getElementById('chat-messages');
  while (chatMessages.firstChild) {
    chatMessages.removeChild(chatMessages.firstChild);
  }
  messageCounter = 1;
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = (event) => {
    const messages = JSON.parse(event.target.result);
    
    messages.forEach(message => add_message({ type: message.role + '-msg', text: message.content }));
  };
  reader.readAsText(file);
}

document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').style.display = 'block';
});

document.getElementById('export-messages-button').addEventListener('click', exportMessageHistory);

document.getElementById('import-messages-button').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', importMessageHistory);

function copyCodeBlock(codeBlock) {
  const range = document.createRange();
  range.selectNodeContents(codeBlock);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  document.execCommand('copy');
  window.getSelection().removeAllRanges();
  replit.messages.showConfirm('Code block copied!', 1500);
}


function add_message(x, id=null) {
  const chatMessages = document.getElementById('chat-messages');
  const isNearBottom = chatMessages.scrollHeight - chatMessages.clientHeight - chatMessages.scrollTop < 60;
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

  
  messageDiv.innerHTML = marked.parse((x.text), { mangle: false, headerIds: false });

  messageDiv.querySelectorAll('pre code').forEach((codeBlock) => {
    codeBlock.style.cursor = 'pointer';
    codeBlock.title = 'Double-click to copy';
    codeBlock.addEventListener('mousedown', onCodeBlockMouseDown);
  });
  // Scroll to the bottom of the chat-messages div
  if (isNearBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  hljs.highlightAll();
}

function clearMessages() {
  const chatMessages = document.getElementById('chat-messages');
  while (chatMessages.firstChild) {
    chatMessages.removeChild(chatMessages.firstChild);
  }

  messageCounter = 1;
  replit.messages.showConfirm("Cleared message history successfully!", 1500);
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

async function getSelectedMode() {
  const settings = await parseSettingsFile();
  if (settings && settings.model) {
    return settings.model;
  } else {
    const selectElement = document.getElementById("mode");
    const selectedMode = selectElement.options[selectElement.selectedIndex].value;
    return selectedMode;
  }
}

let messageCounter = 1;


async function fetchAssistantResponse(apiKey, mode, history, temperature) {
  return await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
    'model': mode,
    'messages': history,
    'temperature': parseFloat(temperature), 
    'stream': true
  })
  });
}
async function parseSettingsFile() {
  try {
    const settingsContent = await replit.fs.readFile('settings.gptreplit', 'utf8');
    
    if (settingsContent.error) {
      return null;
    }
    
    const settingsLines = settingsContent.content.split('\n');
    const settings = {};

    for (const line of settingsLines) {
      const [key, value] = line.split(':');
      settings[key] = value;
    }

    return settings;
  } catch (error) {
    console.error('Error reading settings.gptreplit file:', error);
    return null;
  }
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

  if (file) {
    let filecontent = await replit.fs.readFile(file, "utf8");
    if (filecontent.error) {
      await replit.messages.showError("Error reading file", 2000);
    }
    let newObj = {
      role: "system",
      content: `You are a helpful programming assistent called Replit-GPT. The user might ask something related to the contents of the file they opened you in (${file}). Here is the content:\n${filecontent.content.substring(0, maxContent)}`
    };
    history.splice(1, 0, newObj);
  } else if (getCurrentFile()) {
    let filecontent = await replit.fs.readFile(getCurrentFile(),);
    if (filecontent.error) {
      await replit.messages.showError("Error reading file: "+filecontent.error, 3000);
    }
    let newObj = {
      role: "system",
      content: `You are a helpful programming assistent called Replit-GPT. The user might ask something related to the contents of the file they opened recently (${getCurrentFile()}). Here is the content:\n${filecontent.content.substring(0, 4000)}`
    };
    history.splice(1, 0, newObj);
  }
  else {
    let newObj = { role: "system", content: `You are a helpful programming assistent called Replit-GPT.` };
    history.splice(0, 0, newObj);
  }

  const mode = await getSelectedMode();
  const settings = await parseSettingsFile();
  const customTemperature = settings && settings.temperature ? parseFloat(settings.temperature) : 0.7;

  try {
   const response = await fetchAssistantResponse(apiKey, mode, history, customTemperature);
    if (response.status !== 200) {
      const errorResponse = await response.json();
      throw new Error(errorResponse.error.message);
    }
    await processResponse(response, messageId);
  } catch (error) {
    console.error('Error fetching response:', error.message);
    
    messageCounter++;
    add_message({ type: 'error-msg', text: `Error fetching response, ${error.message} , ${mode}` }, messageCounter);
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
      replit.messages.showWarning("Stopped generating!", 1000)
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


const passwordInput = document.getElementById('KEY');
const savedPassword = localStorage.getItem('OPENAI-API-KEY_GPT-REPLIT|V1.5');
if (savedPassword) {
  passwordInput.value = savedPassword;
  replit.messages.showNotice("Loaded OpenAI API Key from previous session.", 2000)
}
passwordInput.addEventListener('change', () => {
  localStorage.setItem('OPENAI-API-KEY_GPT-REPLIT|V1.5', passwordInput.value);
});

function updateInputMaxLength() {
  const userMessageInput = document.getElementById("user-message");
  const selectedMode = getSelectedMode();

  if (selectedMode === "3.5-turbo") {
    userMessageInput.maxLength = 4000;
    maxContent = 4000
  } else if (selectedMode === "4") {
    userMessageInput.maxLength = 8000;
    maxContent = 32000
  } else if (selectedMode === "4-32k") {
    userMessageInput.maxLength = 32000;
    maxContent = 32000
  }
}

async function showSettings() {
  const file = await replit.fs.readFile("settings.gptreplit")
  if(!file.error) {
    document.getElementById("settings-btn").hidden = false
    await replit.messages.showNotice("Additional settings for GPT-Replit activated!",1500)
  }
  else {
    document.getElementById("settings-btn").hidden = true
  }
}
showSettings()

function updateSettingsInputFields(settings) {
  if (settings) {
    document.getElementById('temperature').value = settings.temp || '';
    document.getElementById('model').value = settings.model || '';
  }
}
var modal = document.getElementById('settings-modal');

var span = document.getElementsByClassName("close")[0];

window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

span.onclick = function() {
  modal.style.display = "none";
}
document.getElementById('settings-btn').addEventListener('click', async () => {
  const settings = await parseSettingsFile();
  if (settings) {
      document.getElementById('temperature').value = settings.temp || '';
      document.getElementById('model').value = settings.model || '';
  }
  document.getElementById('settings-modal').style.display = 'block';
});

document.getElementById('save-settings-button').addEventListener('click', async () => {
  const settings = {
    temp: document.getElementById('temperature').value,
    model: document.getElementById('model').value,
  };
  const settingsStr = Object.entries(settings).map(([key, value]) => `${key}:${value}`).join('\n');

  navigator.clipboard.writeText(settingsStr).then(function() {
    console.log('Copying to clipboard was successful!');
    alert("New settings have been copied to your clipboard. Please paste them into the settings.gptreplit file.\nThe extension can't do it due permissions.");
    modal.style.display = "none";
  }, function(err) {
    console.error('Could not copy text: ', err);
  });
});

window.addEventListener('load', async () => {
  const settings = await parseSettingsFile();
  updateSettingsInputFields(settings);
});

document.getElementById('settings-btn').addEventListener('click', async () => {
  const settings = await parseSettingsFile();
  updateSettingsInputFields(settings);
  document.getElementById('settings-modal').style.display = 'block';
});

const modeSelector = document.getElementById("mode");
modeSelector.addEventListener("change", updateInputMaxLength);
updateInputMaxLength();