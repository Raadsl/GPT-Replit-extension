const submit = document.getElementById("send-button")
const stopButton = document.getElementById("stop-button");
let maxContent = 4000 * 2
let stopAI = false;
let isGenerating = false;
let voice = false;
let lastID = {}
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
  return currentFile
}
getCurrentFile()

let clickTimer = null;

async function copyCodeBlock(codeBlock) {
  const range = document.createRange();
  range.selectNodeContents(codeBlock);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  document.execCommand('copy');
  window.getSelection().removeAllRanges();
  confetti({
    particleCount: 30,
    angle: 180,
    spread: 55,
    origin: { y: (event.clientY / window.innerHeight), x: (event.clientX / window.innerWidth) } 
  })
  confetti({
    particleCount: 30,
    angle: 0,
    spread: 55,
    origin: { y: (event.clientY / window.innerHeight), x: (event.clientX / window.innerWidth) } 
  })
  if (lastID.copy) {
    await replit.messages.hideMessage(lastID.copy)
  }
  lastID.copy = await replit.messages.showConfirm('Code block copied!', 1500);
}

function getSelectedTextWithin(element) {
  let text = "";
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    // Check if the selection is within the specified element
    if (element.contains(range.commonAncestorContainer)) {
      text = selection.toString();
    }
  }
  return text;
}



function exportMessageHistory() {
  const messageHistory = extractMessages();
  const dataStr = JSON.stringify(messageHistory);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.download = 'messageHistory_GPT-Replit.json';
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
    
    messages.forEach(message => {
      if (message.role === "assistant") {
        add_message({ type: "received-msg", text: message.content });
      } else {
        add_message({ type: message.role + "-msg", text: message.content });
      }
    });  
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

  if(!x.noMD) {
    messageDiv.innerHTML = DOMPurify.sanitize(marked.parse((x.text), { mangle: false, headerIds: false }), { USE_PROFILES: { html: true } });
  } else {
    messageDiv.innerHTML = DOMPurify.sanitize(x.text, { USE_PROFILES: { html: true } });
  }

  MathJax.typesetPromise([messageDiv])
  
 const codeBlocks = messageDiv.querySelectorAll('pre code');
  codeBlocks.forEach((codeBlock, index) => {
    
    const settings = loadRawSettings();
    const copyButtonSetting = settings && settings.copyButton;

    const copyButton = document.createElement('button');
    copyButton.innerHTML= '<i class="fa-solid fa-copy"></i>';
    copyButton.classList.add('button');
    copyButton.title='Click to copy'
    copyButton.style.position = 'absolute';
    copyButton.style.top = '0';
    copyButton.style.right = '0';

    const footer = document.createElement('div');
    footer.innerText = 'Double-click to copy';
    footer.style.fontSize = '0.8em';
    footer.style.textAlign = 'right';
    

    if (copyButtonSetting) {
      copyButton.addEventListener('click', (event) => copyCodeBlock(codeBlock, event));
      codeBlock.parentNode.style.position = 'relative'; 
      codeBlock.parentNode.appendChild(copyButton);
    } else {
      codeBlock.addEventListener('dblclick', (event) => copyCodeBlock(codeBlock, event));
      codeBlock.parentNode.appendChild(footer);
    }

    
  });
  if (isNearBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  hljs.highlightAll();
}

function playWoosh() {
  const audio = new Audio('/woosh.mp3');
  audio.play();
}

async function clearMessages() {
  if (isGenerating) {
    replit.messages.showWarning("Cannot clear messages while generating a response!", 2000);
    return;
  }

  const chatMessages = document.getElementById('chat-messages');
  while (chatMessages.firstChild) {
    chatMessages.removeChild(chatMessages.firstChild);
  }

  messageCounter = 1;
  if(lastID.clear) {
    await replit.messages.hideMessage(lastID.clear)
  }
  lastID.clear = await replit.messages.showConfirm("Cleared message history successfully!", 1500);
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
  const settings = loadSettings();
  if (settings && settings.model) {
    return settings.model;
  } else {
    const selectElement = document.getElementById("mode");
    const selectedMode = selectElement.options[selectElement.selectedIndex].value;
    return selectedMode;
  }
}

let messageCounter = 1;

async function fetchAssistantResponse(apiKey, mode, history, temperature, server) {
  if(!server) { 
     server = 'api.openai.com' 
  }
  try {
    let response = await fetch(`https://${server}/v1/chat/completions`, {
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
    if (!response.ok) {
      console.log(`HTTP error! status: ${response.status}`)
    }
    return response;

  } catch(error) {
    console.log('There was a problem with the fetch operation: ' + error.message);
    console.log(error)
    isGenerating = false
  }
}

async function getResp() {
  submit.disabled = true;
  stopButton.disabled = false;
  stopAI = false
  isGenerating = true
  const file = await replit.me.filePath();
  const promptText = document.getElementById("user-message").value;
  if(promptText=="" || promptText==" ") {
    submit.disabled = false;
    stopButton.disabled = true;
    stopAI = false
    isGenerating = false
    return
  }
  messageCounter++;
  const messageId = messageCounter;
  add_message({ type: 'user-msg', text: escapeHtml(promptText), noMD: true }, messageId);
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
    
  } else if (await getCurrentFile() != null) {
    try {
      let filecontent = await replit.fs.readFile(await getCurrentFile());
      if (filecontent.error) {
        await replit.messages.showError("Error reading file: "+filecontent.error, 4000);
        let newObj = { role: "system", content: `You are a helpful programming assistent called Replit-GPT.` };
        history.splice(0, 0, newObj);
      }
      else {
      let newObj = {
        role: "system",
        content: `You are a helpful programming assistent called Replit-GPT. The user might ask something related to the contents of the file they opened most recently (${await getCurrentFile()}). Here is the first 4k characters of the content of '${await getCurrentFile()}':\n${filecontent.content.substring(0, 4000)}`
      };
      history.splice(1, 0, newObj);
      }
    } catch(err) {
      console.log(err)
      isGenerating = false
    }
  }
  else {
    let newObj = { role: "system", content: `You are a helpful programming assistent called Replit-GPT.` };
    history.splice(0, 0, newObj);
  }

  const mode = await getSelectedMode();
  const settings = loadSettings();
  const customTemperature = settings && settings.temperature ? parseFloat(settings.temperature) : 0.7;
  let rawsettings = loadRawSettings();
  if(rawsettings==null) {
    rawsettings = {
      server: 'api.openai.com'
    }
  }
  try {
   const response = await fetchAssistantResponse(apiKey, mode, history, customTemperature, rawsettings.server);
    console.log(response)
    if (response.status !== 200) {
      const errorResponse = await response.json();
      throw new Error(errorResponse.error.message);
    }
    await processResponse(response);
  } catch (error) {
    console.log(`Error fetching response: ${error}`);
    isGenerating = false
    messageCounter++;
    add_message({ type: 'error-msg', text: `Error fetching response, ${error.message}` }, messageCounter);
  }
  submit.disabled = false;
  stopButton.disabled = true;
}

async function processResponse(response) {
  const reader = response.body.getReader();
  let result = '';
  messageCounter++
  if(voice) {
    playWoosh()
  }
  while (true) {
    // Check if stopAI flag is set to true
    if (stopAI) {
      stopAI = false;
      isGenerating = false;
      stopButton.disabled = true;
      replit.messages.showWarning("Stopped generating!", 1000);
      break;
    }

    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = new TextDecoder().decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.includes('data: [DONE]')) {
        break;
      }
      if (line.startsWith('data:')) {
        const jsonStr = line.slice(5);
        try {
          const data = JSON.parse(jsonStr);
          if (data.choices) {
            for (const { delta } of data.choices) {
              if (delta.content) {
                result += delta.content;
              }
            }
          }
          add_message({ type: 'received-msg', text: result }, messageCounter); 
        } catch (error) {
          console.log(`Error parsing JSON: ${error}`);
        }
      }
    }
  }
  isGenerating = false;
  messageCounter++;
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
const savedPassword = localStorage.getItem('OPENAI-API-KEY_GPT-REPLIT|V1.5.3') || localStorage.getItem('OPENAI-API-KEY_GPT-REPLIT');
localStorage.setItem('OPENAI-API-KEY_GPT-REPLIT', savedPassword);

if (savedPassword && passwordInput.value != null) {
  passwordInput.value = savedPassword;
  replit.messages.showNotice("Loaded OpenAI API Key from previous session.", 1000)
}
passwordInput.addEventListener('change', () => {
  localStorage.setItem('OPENAI-API-KEY_GPT-REPLIT', passwordInput.value);
});

async function updateInputMaxLength() {
  const userMessageInput = document.getElementById("user-message");
  const selectedMode = await getSelectedMode();
  if (selectedMode === "gpt-3.5-turbo") { // times 3 because of the token limit, not character limit
    userMessageInput.maxLength = 3500 * 3;
    maxContent = 15000 * 3
    localStorage.setItem('selectedMode', selectedMode);
  } else if (selectedMode === "gpt-4") {
    userMessageInput.maxLength = 7500 * 3;
    maxContent = 7500 * 3
    localStorage.setItem('selectedMode', selectedMode);
  } else if (selectedMode === "gpt-4-32k") {
    userMessageInput.maxLength = 31500 * 3;
    maxContent = 27000 * 3
    localStorage.setItem('selectedMode', selectedMode);
  }
   else if (selectedMode === "gpt-4-1106-preview") {
    userMessageInput.maxLength = 125000 * 3;
    maxContent = 125000 * 3
    localStorage.setItem('selectedMode', selectedMode);
  }
  else {
    userMessageInput.maxLength = 15000 * 3;
    maxContent = 3700 * 3
  }
}

function loadPreviousMode() {
  const previousMode = localStorage.getItem('selectedMode');
  if(previousMode){
      modeSelector.value = previousMode;
  }
  updateInputMaxLength();
}

// Save settings to localStorage
function saveSettings(settings) {
  localStorage.setItem('settings', JSON.stringify(settings));
}

function loadSettings() {
  const settings = localStorage.getItem('settings');
  const parsedSettings = settings ? JSON.parse(settings) : null;
  if (parsedSettings && !parsedSettings.used) {
    return {};
  }
  return parsedSettings;
}

function loadRawSettings() {
  const settings = localStorage.getItem('settings');
  console.log(JSON.parse(settings))
  return settings ? JSON.parse(settings) : null;
}

const modal = document.getElementById('settings-modal');
const span = document.getElementsByClassName("close")[0];

window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}

span.onclick = function() {
  modal.style.display = "none";
}

document.getElementById('reset-settings-button').addEventListener('click', async () => {
  // Show confirm dialog
  if (confirm('Are you sure you want to reset the settings to their default values?')) {
    // Clear settings from local storage
    localStorage.removeItem('settings');

    // Reset inputs to default values
    document.getElementById('temperature').value = '0.7';
    document.getElementById('model').value = 'gpt-3.5-turbo';
    document.getElementById('copy-button').checked = false;
    document.getElementById('custom-server').value = 'api.openai.com';

    if(lastID.reset) {
      await replit.messages.hideMessage(lastID.reset)
    }
    lastID.reset = await replit.messages.showError("Reset settings to default", 5500)
  }
});


document.getElementById('settings-btn').addEventListener('click', async () => {
  const settings = loadRawSettings();
  if (settings) {
    document.getElementById('use').checked = settings.hasOwnProperty('used') ? settings.used : false;
    document.getElementById('temperature').value = settings.temp || '0.7';
    document.getElementById('custom-server').value = settings.server || 'api.openai.com';
    document.getElementById('model').value = settings.model || 'gpt-3.5-turbo';
    document.getElementById('copy-button').checked = settings.hasOwnProperty('copyButton') ? settings.copyButton : true;

  }
  document.getElementById('settings-modal').style.display = 'block';
});

document.getElementById('save-settings-button').addEventListener('click', async () => {
  const settings = {
    used: document.getElementById('use').checked,
    temp: document.getElementById('temperature').value,
    model: document.getElementById('model').value,
    copyButton: document.getElementById('copy-button').checked,
    server: document.getElementById('custom-server').value,
  };
  saveSettings(settings)
  if(lastID.save) {
    await replit.messages.hideMessage(lastID.save)
  }
  lastID.save = await replit.messages.showNotice("Saved custom settings", 1500)
  modal.style.display = "none";
  await customModelUpdate();
});

async function customModelUpdate() {
  const settings = loadSettings();
  const modelSelect = document.getElementById('mode');

  // Find the disabled option
  const disabledOption = Array.from(modelSelect.options).find(option => option.value === 'disabled');

  if (settings && settings.used) {
    if(!lastID.customModalWarning) {
      lastID.customModalWarning = await replit.messages.showNotice("Watch out, your now using a custom model. We have no system yet to limit the characters so it might error because you used more tokens that it can handle!", 8500)
    }
    if (!disabledOption) {
      const newDisabledOption = document.createElement('option');
      newDisabledOption.textContent = 'Disabled';
      newDisabledOption.value = 'disabled';
      modelSelect.appendChild(newDisabledOption);
    }
    modelSelect.value = 'disabled';  // Select the disabled option
    modelSelect.disabled = true;

  } else {
    // Remove the disabled option if it exists
    if (disabledOption) {
      modelSelect.removeChild(disabledOption);
    }
    modelSelect.disabled = false;
  }
}

setInterval(async function() {
  await customModelUpdate()
}, 60000); 

window.onload = function() {
  customModelUpdate()
}

const modeSelector = document.getElementById("mode");
modeSelector.addEventListener("change", updateInputMaxLength);

loadPreviousMode()