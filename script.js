//gl reading lol
const submit = document.getElementById("send-button")
const stopButton = document.getElementById("stop-button");
let maxContent = 4000 * 2
let stopAI = false;
let isGenerating = false;
let voice = false;
let lastID = {}
const useFiles = {};
const multiModals = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]
let chatMessageHistory = [];
const excludedFileExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.mp3', '.mp4', '.svg', '.pdf', '.xlsx', '.pptx', '.zip', '.rar', '.svg'];
const excludedDirectories = ['node_modules', '.git', 'venv', 'dist', 'build', "__pycache__", "var", "lib", "bin", "node_modules", "cpython_debug", "logs", "psd", "thumb", "sketch"];

let clickTimer = null;

function escapeHtml(unsafe) {
  let clean = unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  return DOMPurify.sanitize(clean, { USE_PROFILES: { html: true } });
}


async function copyCodeBlocks(codeBlock, event) {
  const textToCopy = codeBlock.textContent;
  const selection = window.getSelection();
  const range = document.createRange();

  range.selectNodeContents(codeBlock);
  selection.removeAllRanges();
  selection.addRange(range);

  try {
    if (document.hasFocus()) {
      await navigator.clipboard.writeText(textToCopy);
      triggerConfetti(event);
      if (lastID.copy) {
        await replit.messages.hideMessage(lastID.copy);
      }
      lastID.copy = await replit.messages.showConfirm("Codeblock copied!", 1500);
    } else {
      throw new Error('Document is not focused');
    }
  } catch (err) {
    console.error('Failed to copy text:', err);
    if (lastID.copy) {
      await replit.messages.hideMessage(lastID.copy);
    }
    lastID.copy = await replit.messages.showNotice("Failed to copy codeblock. Error: " + err.message, 1500);
  }
}




function triggerConfetti(event) {
  const origin = {
    y: (event.clientY / window.innerHeight),
    x: (event.clientX / window.innerWidth)
  };

  confetti({
    particleCount: 30,
    angle: 180,
    spread: 55,
    origin
  });
  confetti({
    particleCount: 30,
    angle: 0,
    spread: 55,
    origin
  });
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
  const messageHistory = chatMessageHistory
  const dataStr = JSON.stringify(messageHistory);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.download = 'messageHistory-GPTReplit.json';
  link.href = url;
  link.click();
}

async function importMessageHistory(event) {
  await clearMessages();
  messageCounter = 1;
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = (event) => {
    const messages = JSON.parse(event.target.result);

    messages.forEach(message => {
      if (message.role === "assistant") {
        const messageText = message.content.map(part => part.text).join(" ");
        addMessage({ type: "received-msg", text: messageText });
      } else {
        const messageText = message.content.map(part => part.text).join(" ");
        addMessage({ type: message.role + "-msg", text: messageText });
      }
    });
  };
  reader.readAsText(file);
  if (lastID.importmessage) {
    await replit.messages.hideMessage(lastID.clear)
  }
  lastID.importmessage = await replit.messages.showConfirm("Successfully imported a new message history", 1500);
}


document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').style.display = 'block';
});

document.getElementById('export-messages-button').addEventListener('click', exportMessageHistory);

document.getElementById('import-messages-button').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', importMessageHistory);


function addMessage(x, id = null) {
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
  if (!x.noMD) {
    messageDiv.innerHTML = DOMPurify.sanitize(marked.parse((x.text), { mangle: false, headerIds: false }), { USE_PROFILES: { html: true } });
  } else {
    messageDiv.innerHTML = DOMPurify.sanitize(x.text, { mangle: false, headerIds: false }, {USE_PROFILES: { html: true } });
  }

  MathJax.typesetPromise([messageDiv]);

  const codeBlocks = messageDiv.querySelectorAll('pre code');
  codeBlocks.forEach((codeBlock, index) => {
    const settings = loadRawSettings();
    const copyButtonSetting = settings && settings.copyButton;

    const copyButton = document.createElement('button');
    copyButton.innerHTML = '<i class="fa-solid fa-copy"></i>';
    copyButton.classList.add('button');
    copyButton.title = 'Click to copy';
    copyButton.style.position = 'absolute';
    copyButton.style.top = '0';
    copyButton.style.right = '0';

    const footer = document.createElement('div');
    footer.innerText = 'Double-click to copy';
    footer.style.fontSize = '0.8em';
    footer.style.textAlign = 'right';

    if (copyButtonSetting) {
      copyButton.addEventListener('click', (event) => copyCodeBlocks(codeBlock, event));
      codeBlock.parentNode.style.position = 'relative';
      codeBlock.parentNode.appendChild(copyButton);
    } else {
      codeBlock.addEventListener('dblclick', (event) => copyCodeBlocks(codeBlock, event));
      codeBlock.parentNode.appendChild(footer);
    }
  });

  const messageContents = [{ type: 'text', text: x.text }];

  if (x.image) {
    const img = document.createElement('img');
    img.src = x.image;
    img.classList.add("user-upload-image");
    img.alt = "User uploaded image";
    messageDiv.appendChild(img);
    messageContents.push({
      type: 'image_url',
      image_url: { url: img.src }
    });
    const container = document.getElementById('image-preview-container');
    container.style.display = 'none';
    base64Image = null;
    document.getElementById('image-preview').src = '';
  } else {
    const container = document.getElementById('image-preview-container');
    container.style.display = 'none';
    base64Image = null;
    document.getElementById('image-preview').src = '';
  }

  if (isNearBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  hljs.highlightAll();
  const index = chatMessageHistory.findIndex(msg => msg.id === id);
  if (index !== -1) {
    chatMessageHistory[index].content = messageContents;
  } else {
    chatMessageHistory.push({
      id: id,
      role: x.type === 'user-msg' ? 'user' : (x.type === 'system-msg' ? 'system' : 'assistant'),
      content: messageContents
    });
  }
}


function playAudio(audioUrl) {
  const audio = new Audio(audioUrl);
  audio.play();
}
//perf

function batchDOMUpdates(updates) {
  const fragment = document.createDocumentFragment();
  updates.forEach(update => {
    const element = document.createElement(update.tag);
    element.innerHTML = update.content;
    fragment.appendChild(element);
  });
  document.getElementById('chat-messages').appendChild(fragment);
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
  chatMessageHistory = [];

  messageCounter = 1;
  if (lastID.clear) {
    await replit.messages.hideMessage(lastID.clear)
  }
  lastID.clear = await replit.messages.showConfirm("Cleared message history successfully!", 1500);
}


async function startVoiceInput() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  voice = true;
  recognition.onresult = (event) => {
    const speechResult = event.results[0][0].transcript;
    document.getElementById('user-message').value = speechResult;
  };

  recognition.onerror = async (event) => {
    console.error('Speech recognition error:', event.error);
    if (lastID.voiceerror) {
      await replit.messages.hideMessage(lastID.voiceerror)
    }
    lastID.voiceerror = await replit.messages.showNotice(`Speech recognition error: ${event.error}`, 1234);
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
  document.getElementById('voice-input-button').addEventListener('click', async function() {
    await startVoiceInput();
  });
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


function toggleGenerating(value) {
  const headerBanner = document.getElementById("headerbanner")
  isGenerating = value
  if (value == true) {
    headerBanner.innerHTML = `<div id="loading-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  } else {
    headerBanner.innerHTML = `GPT-Replit`;
  }
}

async function fetchAssistantResponse(apiKey, mode, history, temperature, server, stream = true) {
  console.log(history)
  if (!server) {
    server = 'api.openai.com';
  }
  try {
    let response = await fetch(`https://${server}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: mode,
        messages: history,
        temperature: parseFloat(temperature),
        stream: stream
      })
    });

    // Check if the response is not ok
    console.log(response)
    if (!response.ok) {
      const errorResponse = await response.json();
      console.log(`HTTP error! status: ${response.status}`);
      throw new Error(errorResponse.error.message || `HTTP error! status: ${response.status}`);
    }

    return response;

  } catch (error) {
    console.error('There was a problem with the fetch operation: ' + error.message);
    toggleGenerating(false);
    throw error; // Re-throw the error to be handled by the caller
  }
}
  
async function getResp() {
  submit.disabled = true;
  stopButton.disabled = false;
  stopAI = false;
  toggleGenerating(true);
  closeAllOptions();

  const promptText = document.getElementById("user-message").value;
  if (promptText.trim() === "") {
    submit.disabled = false;
    stopButton.disabled = true;
    stopAI = false;
    toggleGenerating(false);
    return; 
  }

  messageCounter++;
  const selectedMode = await getSelectedMode();

  let messageContent = [{ type: 'text', text: escapeHtml(promptText) }];

  if (base64Image && multiModals.includes(selectedMode)) {
    messageContent.push({
      type: 'image_url',
      image_url: { url: base64Image }
    });
    console.log(messageContent);
    addMessage({ type: 'user-msg', text: promptText, noMD: true, image: base64Image });
  } else {
    addMessage({ type: 'user-msg', text: escapeHtml(promptText), noMD: true });
    base64Image = null; // Clear the image if not supported
  }

  document.getElementById("user-message").value = "";
  const apiKey = document.getElementById("KEY").value;
  const yapsettings = loadRawSettings();
  if (!apiKey) {
    alert('API key is missing. Please provide a valid API key.');
    return;
  }
  let systemMessage = `You are a helpful programming assistant called Replit-GPT.`;
  if (yapsettings && yapsettings.hasOwnProperty("noyap") && yapsettings.noyap) {
    systemMessage += `No yapping, so keep your answers as short as possible. `;
  }
  const fileContents = {};
  let history = [...chatMessageHistory];

  // Remove id fields from history
  history = history.map(({ id, ...rest }) => rest);

  if (Object.keys(useFiles).length > 0) {
    let filesInfo = [];
    for (const filePath in useFiles) {
      if (useFiles[filePath]) {
        if (filePath == "Directory Structure dont name your file like this bluid!") {
          fileContents[filePath] = await getDirectoryStructure('./');
          filesInfo.push('- File structure: \n' + fileContents[filePath]);
        } else {
          let fileContent = await replit.fs.readFile(filePath, "utf8");
          if (fileContent.error) {
            await replit.messages.showError(`Error reading file ${filePath}`, 2000);
          } else {
            fileContents[filePath] = fileContent.content;
            let previewLength = Math.floor((maxContent / Object.keys(fileContents).length) - 1000);
            filesInfo.push(`- File path: ${filePath}\n- File Content Preview: \`\`\`${fileContent.content.substring(0, previewLength)}\`\`\``);
          }
        }
      }
    }
    if (filesInfo.length > 0) {
      systemMessage += " The user might ask something related to the contents of the following file(s):\n" + filesInfo.join('\n');
    }
  }

  // Filter out images if the selected model is not multimodal
  if (!multiModals.includes(selectedMode)) {
    history = history.map(msg => {
      const filteredContent = msg.content.filter(part => part.type !== 'image_url');
      return { ...msg, content: filteredContent };
    });
  }

  history.unshift({ role: "system", content: systemMessage });

  const settings = loadRawSettings();
  const customTemperature = settings && settings.temperature ? parseFloat(settings.temperature) : 0.7;
  const disableStreaming = settings && settings.disableStreaming;
  let rawsettings = loadRawSettings();
  if (rawsettings == null) {
    rawsettings = {
      server: 'api.openai.com'
    };
  }
  if (disableStreaming) {
    messageCounter++;
    addMessage({ type: 'received-msg', text: `<div id="loading-dots" title='You are using the no streaming setting. The response is currently being cooked up.'><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`, noMD: true }, messageCounter);
  }

  try {
    const response = await fetchAssistantResponse(apiKey, selectedMode, history, customTemperature, rawsettings.server, !disableStreaming);
    if (disableStreaming) {
      const responseText = await response.text();
      try {
        const cleanedResponse = responseText.replaceAll("", "");
        const data = JSON.parse(cleanedResponse);
        addMessage({ type: 'received-msg', text: data.choices[0].message.content }, messageCounter);
        messageCounter++;
        toggleGenerating(false);
      } catch (jsonError) {
        console.error(`JSON parsing error: ${jsonError.message}`);
        addMessage({ type: 'error-msg', text: `Error parsing response JSON, ${jsonError.message}` });
        messageCounter++;
      }
    } else {
      await processResponse(response);
    }
  } catch (error) {
    console.error(`Error fetching response: ${error}`);
    toggleGenerating(false);
    addMessage({ type: 'error-msg', text: `Error fetching response, ${error.message}` });
  }

  submit.disabled = false;
  stopButton.disabled = true;
}






async function processResponse(response) {
  const reader = response.body.getReader();
  let result = '';
  
  messageCounter++
  if (voice) {
    playAudio("woosh.mp3")
  }
  while (true) {
    // Check if stopAI flag is set to true
    if (stopAI) {
      stopAI = false;
      toggleGenerating(false);
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
          addMessage({ type: 'received-msg', text: result }, messageCounter);
        } catch (error) {
          console.log(`Error parsing JSON: ${error}`);
        }
      }
    }
  }
  toggleGenerating(false)
  messageCounter++;
}





submit.addEventListener("click", getResp); //!!!!
var input = document.getElementById("user-message");

input.addEventListener("keypress", function(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    submit.click();
  }
});


stopButton.addEventListener("click", async () => {
  const settings = loadRawSettings();
  const disableStreaming = settings && settings.disableStreaming;
  if (!disableStreaming) {
    stopAI = true;
  } else {
    if (lastID.stopinnostream) {
      await replit.messages.hideMessage(lastID.stopinnostream)
    }
    lastID.stopinnostream = await replit.messages.showError("The response cannot be stopped in no streaming mode. Change the setting if you want to stop the response when it is not finished yet.", 5500)
  }
});

async function getEncryptionKey() {
  try {
    const { user } = await replit.data.currentUser({});
    return user.id.toString() + "GPT-REPLIT-SALT";
  } catch (error) {
    console.error("Error fetching user data (probably not opened as extension):", error);
    if (lastID.getencryption) {
      await replit.messages.hideMessage(lastID.getencryption)
    }
    lastID.getencryption = await replit.messages.showError("Error fetching user data using Replit's API. Please try again later. OPENAI API key may not be loaded correctly", 5500)
    return "DEFAULT-ENCRYPTION-KEY-GPTREPLSLT";
  }
}

async function encryptApiKey(apiKey) {
  const key = await getEncryptionKey();
  let encryptedKey = '';
  for (let i = 0; i < apiKey.length; i++) {
    const charCode = apiKey.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encryptedKey += String.fromCharCode(charCode);
  }
  return btoa(encryptedKey);
}

async function decryptApiKey(encryptedApiKey) {
  const key = await getEncryptionKey();
  const decodedKey = atob(encryptedApiKey);
  let decryptedKey = '';
  for (let i = 0; i < decodedKey.length; i++) {
    const charCode = decodedKey.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    decryptedKey += String.fromCharCode(charCode);
  }
  return decryptedKey;
}

async function getProjectName() {
  replname = await replit.data.currentRepl()
  return replname.repl.slug
}

async function getDirectoryStructure(path, indent = '  | ', isRoot = true) {
  try {
    const entries = await replit.fs.readDir(path);
    let structure = isRoot ? `${await getProjectName()}/\n` : '';

    for (const entry of entries.children) {
      if (entry.type === 'DIRECTORY' && !entry.filename.startsWith('.') && !excludedDirectories.includes(entry.filename)) {
        structure += `${indent}├── ${entry.filename}/\n`;
        structure += await getDirectoryStructure(`${path}${entry.filename}/`, indent + '  | ', false);
      } else if (entry.type === 'FILE') {
        structure += `${indent}├── ${entry.filename}\n`;
      }
    }

    return structure;
  } catch (err) {
    return err.toString();
  }
}



const passwordInput = document.getElementById('KEY');
const NEW_STORAGE_KEY = 'ENCRYPTED-OPENAI-API-KEY_GPT-REPLIT';
const OLD_STORAGE_KEY = 'OPENAI-API-KEY_GPT-REPLIT|V1.5.3';
const LEGACY_STORAGE_KEY = 'OPENAI-API-KEY_GPT-REPLIT';

async function loadApiKey() {
  // Try to load the encrypted key first
  const encryptedApiKey = localStorage.getItem(NEW_STORAGE_KEY);
  if (encryptedApiKey) {
    try {
      const decryptedApiKey = await decryptApiKey(encryptedApiKey);
      passwordInput.value = decryptedApiKey;
      replit.messages.showNotice("Loaded encrypted OpenAI API Key from previous session.", 1000);
      return;
    } catch (error) {
      console.error('Error decrypting API key:', error);
    }
  }

  // If no encrypted key, try to load the unencrypted key
  const unencryptedApiKey = localStorage.getItem(OLD_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (unencryptedApiKey) {
    passwordInput.value = unencryptedApiKey;
    replit.messages.showNotice("Loaded unencrypted OpenAI API Key from previous session. It will be encrypted for future use.", 5000);

    // Encrypt and save the key for future use
    await saveApiKey();

    // Remove the old unencrypted keys
    localStorage.removeItem(OLD_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

async function saveApiKey() {
  const apiKey = passwordInput.value;
  if (apiKey) {
    try {
      const encryptedApiKey = await encryptApiKey(apiKey);
      localStorage.setItem(NEW_STORAGE_KEY, encryptedApiKey);
    } catch (error) {
      console.error('Error encrypting API key:', error);
      replit.messages.showError("Failed to save encrypted API key.", 1500);
    }
  } else {
    localStorage.removeItem(NEW_STORAGE_KEY);
  }
}

// Add event listener to save the API key when it changes
passwordInput.addEventListener('change', saveApiKey);

function truncateFilename(filename, maxLength) {
  if (filename.length <= maxLength) {
    return filename;
  }

  const middle = maxLength / 2;
  const start = filename.slice(0, middle - 1);
  const end = filename.slice(-middle + 2);
  return `${start}...${end}`;
}

async function updateInputMaxLength() {
  const userMessageInput = document.getElementById("user-message");
  const selectedMode = await getSelectedMode();
  const uploadButton = document.getElementById('upload-image-button');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const deleteImageButton = document.getElementById('delete-image');

  // Reset image preview and hide container when model changes
  function resetImageUI() {
    imagePreviewContainer.style.display = 'none';
    deleteImageButton.style.display = 'none';
    base64Image = null;
    document.getElementById('image-preview').src = '';
    closeAllOptions();
  }

  if (selectedMode === "gpt-3.5-turbo") {
    userMessageInput.maxLength = 15000 * 3;
    maxContent = 15000 * 3;
    localStorage.setItem('selectedMode', selectedMode);
  } else if (selectedMode === "gpt-4") {
    userMessageInput.maxLength = 7500 * 3;
    maxContent = 7500 * 3;
    localStorage.setItem('selectedMode', selectedMode);
  } else if (selectedMode === "gpt-4-32k") {
    userMessageInput.maxLength = 31500 * 3;
    maxContent = 27000 * 3;
    localStorage.setItem('selectedMode', selectedMode);
  } else if (selectedMode === "gpt-4-turbo") {
    userMessageInput.maxLength = 125000 * 3;
    maxContent = 125000 * 3;
    localStorage.setItem('selectedMode', selectedMode);
  } else if (selectedMode === "gpt-4o-mini") {
    userMessageInput.maxLength = 200000 * 3;
    maxContent = 200000 * 3;
    localStorage.setItem('selectedMode', selectedMode);
  } else if (selectedMode === "gpt-4o") {
    userMessageInput.maxLength = 200000 * 3;
    maxContent = 200000 * 3;
    localStorage.setItem('selectedMode', selectedMode);
  }
  else {
    userMessageInput.maxLength = 15000 * 3; // Default case
    maxContent = 15000 * 3; // Default case
    localStorage.setItem('selectedMode', selectedMode);
  }
  if(multiModals.includes(selectedMode)) {
    uploadButton.style.display = 'block';
  } else {
    uploadButton.style.display = 'none';
    resetImageUI()
  }
}
document.getElementById('file-search-input').addEventListener('change', function() {
  filterFiles(false)
});



async function updateAvailableFiles(dropdown, path = './') {
  while (dropdown.options.length > 0) {
    dropdown.remove(0);
  }
  

  const option = document.createElement('option');
  option.text = 'Choose file';
  option.disabled = true;
  option.selected = true;
  dropdown.appendChild(option);

  const directoryStructureTabExists = useFiles["Directory Structure dont name your file like this bluid!"] == true
  if (!directoryStructureTabExists) {
    const dirStructureOption = document.createElement('option');
    dirStructureOption.value = 'directory-structure';
    dirStructureOption.text = 'Directory Structure';
    directoryStructure = await getDirectoryStructure("./")
    dirStructureOption.title = directoryStructure;
    dropdown.appendChild(dirStructureOption);
  }

  async function processDirectory(path) {
    const entries = await replit.fs.readDir(path);

    for (const entry of entries.children) {
      if (entry.type === 'DIRECTORY' && !entry.filename.startsWith(".") && !excludedDirectories.includes(entry.filename)) {
        await processDirectory(`${path}${entry.filename}/`);
      } else if (entry.type === 'FILE') {
        const fileExtension = entry.filename.slice(entry.filename.lastIndexOf(".")).toLowerCase();
        if (!excludedFileExtensions.includes(fileExtension) && !useFiles[`${path}${entry.filename}`]) {
          const option = document.createElement('option');
          option.value = `${path}${entry.filename}`;
          const displayPath = path.replace(/^\.\//, '') + entry.filename;
          const truncatedFilename = truncateFilename(displayPath, 20);
          option.text = truncatedFilename;
          dropdown.appendChild(option);
        }
      }
    }
  }
  await processDirectory(path);
  filterFiles();
}


function filterFiles(reset = false) {
  const searchInput = document.getElementById('file-search-input');
  if (reset) {
    searchInput.value = '';
  }
  const searchTerm = searchInput.value.toLowerCase();
  const dropdown = document.getElementById('file-dropdown');
  const options = dropdown.options;
  let matchFound = false;

  // Remove any existing "No matching files" option
  const noMatchOption = dropdown.querySelector('option[value="no-match"]');
  if (noMatchOption) {
    dropdown.removeChild(noMatchOption);
  }

  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    if (option.value === 'Choose file') continue; // Skip the default option
    const optionText = option.value.toLowerCase();
    if (searchTerm === '' || optionText.includes(searchTerm)) {
      option.style.display = '';
      matchFound = true;
    } else {
      option.style.display = 'none';
    }
  }

  // If no matches found, add a disabled "No matching files" option
  if (!matchFound && searchTerm !== '') {
    const noMatchOption = document.createElement('option');
    noMatchOption.textContent = 'No matching files';
    noMatchOption.value = 'no-match';
    noMatchOption.disabled = true;
    dropdown.appendChild(noMatchOption);
  }
}

function removeDuplicateFileTabs() {
  const tabsContainer = document.querySelector('.files-tabs-container');
  const fileTabs = tabsContainer.querySelectorAll('.file-tab');
  const seenTabs = new Set();

  fileTabs.forEach(tab => {
    const filename = tab.id.replace('file-tab-', '');
    if (seenTabs.has(filename)) {
      tabsContainer.removeChild(tab);
    } else {
      seenTabs.add(filename);
    }
  });
}
  
function updateFileTabTitles() {
  const tabsContainer = document.querySelector('.files-tabs-container');
  const fileTabs = tabsContainer.querySelectorAll('.file-tab');
  const numFiles = fileTabs.length;

  if (numFiles > 0) {
    const maxFileTabs = Math.floor((maxContent / numFiles) - 1000);
    fileTabs.forEach(tab => {
      if(tab.id !="file-directory-structure") {
      const filename = tab.id.replace('file-tab-', '');
      let disabledMessage = '';
      if (tab.classList.contains('disabled')) {
        disabledMessage = `, and since you opened the extension with this file it cannot be removed`;
      }
      tab.title = `GPT-Replit has opened the file '${filename}'${disabledMessage}. 
The AI only will read the first '${maxFileTabs}' characters'`;
      }
    });
  }
}

async function addFileTab(filename, disableDelete = false) {
  if (useFiles[filename]) {
    return;
  }
  const tabsContainer = document.querySelector('.files-tabs-container');
  const fileTab = document.createElement('div');
  fileTab.classList.add('file-tab');
  if (disableDelete) {
    fileTab.classList.add('disabled');
  }

  fileTab.id = `file-tab-${filename}`;
  fileTab.title = `GPT-replit has opened the file ${filename}`;
  
  
  if (!disableDelete) {
    fileTab.setAttribute('draggable', 'true');
  }
  const displayName = filename.replace(/^\.\//, '');
  const truncatedFilename = truncateFilename(displayName, 20);
  fileTab.textContent = truncatedFilename;
  if (filename == "Directory Structure dont name your file like this bluid!") {
    fileTab.id = `file-directory-structure`;
    fileTab.textContent = "Directory Structure";
    fileTab.title = await getDirectoryStructure("./")
  }
  // Handle dragging
  fileTab.addEventListener('dragstart', (event) => {
    if (!disableDelete) {
      event.dataTransfer.setData('text/plain', fileTab.id);
      document.getElementById('add-file-button').classList.add('trash');
      document.getElementById('add-file-button').innerHTML = '<i class="fas fa-trash-alt"></i>';
      fileTab.classList.add('dragging');
    }
  });

  fileTab.addEventListener('dragend', (event) => {
    if (!disableDelete) {
      document.getElementById('add-file-button').classList.remove('trash');
      document.getElementById('add-file-button').innerHTML = '<i class="fa-solid fa-plus"></i>';
      fileTab.classList.remove('dragging');
      updateUseFilesOrder();
    }
  });

  tabsContainer.addEventListener('dragover', (event) => {
    event.preventDefault();
    const draggingElement = document.querySelector('.dragging');
    const afterElement = getDragAfterElement(tabsContainer, event.clientX);
    if (afterElement == null || afterElement.classList.contains('disabled')) {
      tabsContainer.appendChild(draggingElement);
    } else {
      tabsContainer.insertBefore(draggingElement, afterElement);
    }
  });

  // Handle middle-click deletion
  fileTab.addEventListener('auxclick', function(event) {
    if (event.button === 1 && !disableDelete) { // middle-click
      fileTab.classList.add('delete-animation');
      setTimeout(() => tabsContainer.removeChild(fileTab), 500);
      useFiles[filename] = false;
      const dropdown = document.getElementById('file-dropdown');
      if (dropdown) {
        updateAvailableFiles(dropdown, "./");
      }
      updateFileTabTitles();
      filterFiles();
    }
  });

  const removeButton = document.createElement('button');
  removeButton.innerHTML = '&times;';
  removeButton.title = "Remove file.";
  removeButton.className = "remove-file-button";
  if (disableDelete) {
    removeButton.disabled = true;
    removeButton.title = "Cannot remove this file.";
  } else {
    removeButton.onclick = function() {
      fileTab.classList.add('delete-animation');
      setTimeout(() => tabsContainer.removeChild(fileTab), 500);
      useFiles[filename] = false;
      const dropdown = document.getElementById('file-dropdown');
      if (dropdown) {
        updateAvailableFiles(dropdown, "./");
      }
      updateFileTabTitles();
      filterFiles();
    };
  }

  // Handle middle-click deletion
  fileTab.addEventListener('auxclick', function(event) {
    if (event.button === 1 && !disableDelete) { // middle-click
      fileTab.classList.add('delete-animation');
      setTimeout(() => tabsContainer.removeChild(fileTab), 500);
      useFiles[filename] = false;
      const dropdown = document.getElementById('file-dropdown');
      if (dropdown) {
        updateAvailableFiles(dropdown, "./");
      }
      updateFileTabTitles();
      filterFiles();
    }
  });

  useFiles[filename] = true; //!!
  fileTab.appendChild(removeButton);
  tabsContainer.appendChild(fileTab); 
  updateFileTabTitles();  
}

function getDragAfterElement(container, x) {
  const draggableElements = [...container.querySelectorAll('.file-tab:not(.dragging):not(.disabled)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = x - box.left - box.width / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}


function updateUseFilesOrder() {
  const tabsContainer = document.querySelector('.files-tabs-container');
  const fileTabs = tabsContainer.querySelectorAll('.file-tab');
  const newUseFiles = {};

  fileTabs.forEach(tab => {
    const filename = tab.id.replace('file-tab-', '');
    newUseFiles[filename] = useFiles[filename];
  });

  Object.assign(useFiles, newUseFiles);
}

document.getElementById('add-file-button').addEventListener('dragover', function(event) {
  event.preventDefault();
});

document.getElementById('add-file-button').addEventListener('drop', function(event) {
  event.preventDefault();

  const id = event.dataTransfer.getData('text/plain');
  const fileTab = document.getElementById(id);

  if (fileTab) {
    const filename = fileTab.id.replace('file-tab-', '');
    useFiles[filename] = false;
    fileTab.parentNode.removeChild(fileTab);
    const dropdown = document.getElementById('file-dropdown');
    if (dropdown) {
      updateAvailableFiles(dropdown, "./");
    }
    updateFileTabTitles();
  }
});


function updateUseFilesOrder() {
  const tabsContainer = document.querySelector('.files-tabs-container');
  const fileTabs = tabsContainer.querySelectorAll('.file-tab');
  const newUseFiles = {};

  fileTabs.forEach(tab => {
    const filename = tab.id.replace('file-tab-', '');
    newUseFiles[filename] = useFiles[filename];
  });

  Object.assign(useFiles, newUseFiles);
}


document.getElementById('add-file-button').addEventListener('dragover', function(event) {
  event.preventDefault();
});

document.getElementById('add-file-button').addEventListener('drop', function(event) {
  event.preventDefault();

  const id = event.dataTransfer.getData('text/plain');
  const fileTab = document.getElementById(id);

  if (fileTab) {
    const filename = fileTab.id.replace('file-tab-', '');
    useFiles[filename] = false;
    fileTab.parentNode.removeChild(fileTab);
    const dropdown = document.getElementById('file-dropdown');
    if (dropdown) {
      updateAvailableFiles(dropdown, "./");
    }
    updateFileTabTitles();
  }
});


document.getElementById('file-dropdown').addEventListener('change', async function() {
  const selectedFile = this.value;
  if (selectedFile) {
    if (selectedFile === 'directory-structure') {
      addFileTab("Directory Structure dont name your file like this bluid!");
    } else {
      addFileTab(selectedFile);
    }
    toggleOptions('file-input-options');
    const dropdown = document.getElementById('file-dropdown');
    if (dropdown) {
      updateAvailableFiles(dropdown, "./");
      filterFiles();
    }
  }
});


function toggleOptions(sectionId) {
  const sections = ['image-input-options', 'file-input-options'];
  sections.forEach(id => {
    const element = document.getElementById(id);
    if (id === sectionId) {
      element.style.display = element.style.display === 'none' ? 'block' : 'none'; // Simplify toggle
      if (element.style.display === 'block') {
        element.classList.add('show-options');
        element.classList.remove('hide-options');
        if (id === 'file-input-options') {
          filterFiles(true);
        }
      } else {
        element.classList.remove('show-options');
        element.classList.add('hide-options');
      }
    } else {
      // Ensure other sections are closed
      element.style.display = 'none';
      element.classList.remove('show-options');
      element.classList.add('hide-options');
    }
  });
}



document.getElementById('add-file-button').addEventListener('dragover', function(event) {
  event.preventDefault();
});

document.getElementById('add-file-button').addEventListener('drop', function(event) {
  event.preventDefault();

  const id = event.dataTransfer.getData('text/plain');
  const fileTab = document.getElementById(id);

  if (fileTab) {
    const filename = fileTab.id.replace('file-tab-', '');
    useFiles[filename] = false;
    fileTab.parentNode.removeChild(fileTab);
    const dropdown = document.getElementById('file-dropdown');
    if (dropdown) {
      updateAvailableFiles(dropdown, "./");
    }
    updateFileTabTitles();
  }
});



document.getElementById('upload-image-button').addEventListener('click', () => toggleOptions('image-input-options'));
document.getElementById('add-file-button').addEventListener('click', () => toggleOptions('file-input-options'));

// If you want to programmatically close all fold-outs
function closeAllOptions() {
  ['image-input-options', 'file-input-options'].forEach(id => {
    const element = document.getElementById(id);
    element.classList.remove('show-options');
    element.style.display = 'none', 500;
  });
  filterFiles(true);
}


let base64Image = null;

async function compressToWebP(base64Data) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Data;

    img.onload = () => {
      let quality = 0.8;
      const maxFileSize = 20 * 1024 * 1024;

      const attemptCompression = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw the image onto the canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert the canvas content to WebP format and get new base64 string
        const webpDataUrl = canvas.toDataURL('image/webp', quality);

        // Calculate the approximate file size of the result
        const fileSize = Math.round((webpDataUrl.length * 3 / 4));

        if (fileSize > maxFileSize && quality > 0.1) {
          // Reduce quality and try again
          quality -= 0.1;
          attemptCompression();
        } else if (fileSize <= maxFileSize) {
          // Satisfies file size condition
          resolve(webpDataUrl);
        } else {
          // If the file size is still too large and quality is too low, reject
          reject('Unable to compress to desired file size');
        }
      };

      attemptCompression();
    };

    img.onerror = () => {
      reject('Failed to load image from base64 data. Please check the data and try again.');
    };
  });
}

document.getElementById('image-url-input').addEventListener('paste', async function(event) {
  const items = (event.clipboardData || event.originalEvent.clipboardData).items;
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      const base64String = await blobToBase64(blob);
      const compressedWebPBase64 = await compressToWebP(base64String);
      loadImagePreview(compressedWebPBase64);
      toggleOptions("image-input-options");
      if (lastID.pasteimage) {
        await replit.messages.hideMessage(lastID.pasteimage)
      }
      lastID.pasteimage = await replit.messages.showConfirm("Successfully uploaded image from clipboard", 2000)
      break; // We only handle one image at a time
    }
  }
});
let apiKeyTimerInterval = null;
document.getElementById('toggle-api-key-visibility').addEventListener('click', async function() {
  const apiKeyInput = document.getElementById('KEY');
  const viewApiKeyInput = document.getElementById('view-api-key-input');
  const apiKeyLabelAndInput = document.getElementById('api-key-label');
  const toggleButton = document.getElementById('toggle-api-key-visibility');

  let timer = 60; // Set the timer to 30 seconds initially

  viewApiKeyInput.value = apiKeyInput.value;
  apiKeyLabelAndInput.style.display = 'block';
  toggleButton.style.display = 'none';
  if (lastID.apiKeyVisibility) {
    replit.messages.hideMessage(lastID.apiKeyVisibility);
  }
  lastID.apiKeyVisibility = replit.messages.showNotice(`API key is now visible for ${timer} seconds`, 1500);
  // Update the timer every second
  apiKeyTimerInterval = setInterval(() => {
    timer--;
    viewApiKeyInput.title = `Input hides in ${timer} seconds`;

    if (timer <= 0) {
      clearInterval(apiKeyTimerInterval);
      apiKeyLabelAndInput.style.display = 'none';
      toggleButton.style.display = 'block';
      if (lastID.apiKeyVisibility) {
        replit.messages.hideMessage(lastID.apiKeyVisibility);
      }
      lastID.apiKeyVisibility = replit.messages.showNotice("API key is now hidden", 1500);
    }
  }, 1000);
});

document.getElementById('view-api-key-input').addEventListener('input', function() {
  const apiKeyInput = document.getElementById('KEY');
  apiKeyInput.value = this.value;
  saveApiKey();
});




async function useImageUrl() {
  const UrlButton = document.getElementById("use-image-url-button");
  const imageUrl = document.getElementById('image-url-input').value;
  if (!imageUrl) {
    UrlButton.disabled = true;
    UrlButton.innerText = "Please enter an URL";
    setTimeout(function() {
      UrlButton.disabled = false;
      UrlButton.innerText = "Use URL";
    }, 2500);
    return;
  }

  if (imageUrl.startsWith("replit://")) {
    const localFilePath = imageUrl.replace("replit://", "./");
    try {
      const fileContent = await replit.fs.readFile(localFilePath, "base64");

      if (fileContent.error) {
        throw new Error(fileContent.error);
      }

      const uint8Array = fileContent.content.asBuffer;
      const base64data = `data:image/png;base64,${arrayBufferToBase64(uint8Array)}`;
      const compressedWebPBase64 = await compressToWebP(base64data);

      loadImagePreview(compressedWebPBase64);

      if (typeof toggleOptions === "function") {
        toggleOptions("image-input-options");
      }
      document.getElementById('image-url-input').value = '';
      if (lastID.uplaodloccalfile) {
        await replit.messages.hideMessage(lastID.uplaodloccalfile)
      }
      lastID.uplaodloccalfile = await replit.messages.showConfirm("Successfully uploaded local iamge", 2000)
    } catch (error) {
      console.error("Failed to load or process local image:", error);

      UrlButton.disabled = true;
      UrlButton.innerText = "Failed loading image";
      setTimeout(function() {
        UrlButton.disabled = false;
        UrlButton.innerText = "Use URL";
      }, 2500);
      return;
    }
  } else {
    const regex = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)([^#\s]*)?$/i;
    if (!imageUrl.match(regex)) {
      const UrlButton = document.getElementById("use-image-url-button");
      UrlButton.disabled = true;
      UrlButton.innerText = "Invalid URL";
      setTimeout(function() {
        UrlButton.disabled = false;
        UrlButton.innerText = "Use URL";
      }, 1500);
      return;
    }

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const base64data = await blobToBase64(blob);
      const compressedWebPBase64 = await compressToWebP(base64data);

      loadImagePreview(compressedWebPBase64);

      if (typeof toggleOptions === "function") {
        toggleOptions("image-input-options");
      }
      document.getElementById('image-url-input').value = '';
      if (lastID.uplaodloccalfile) {
        await replit.messages.hideMessage(lastID.uplaodloccalfile)
      }
      lastID.uplaodloccalfile = await replit.messages.showConfirm("Successfully uploaded image", 2000)
    } catch (error) {
      console.error("Failed to load or process image:", error);
      const UrlButton = document.getElementById("use-image-url-button");
      UrlButton.disabled = true;
      UrlButton.innerText = "Failed loading image";
      setTimeout(function() {
        UrlButton.disabled = false;
        UrlButton.innerText = "Use URL";
      }, 2500);
      return;
    }
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}


function loadImagePreview(base64Src) {
  const uploadButton = document.getElementById('upload-image-button');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const deleteImageButton = document.getElementById('delete-image');
  const imgPreview = document.getElementById('image-preview');
  uploadButton.style.display = 'block';
  imagePreviewContainer.style.display = 'block';
  deleteImageButton.style.display = 'block';

  imgPreview.src = base64Src;
  document.getElementById('image-preview-container').style.display = 'block';
  base64Image = base64Src;
}


document.getElementById('delete-image').addEventListener('click', function() {
  const container = document.getElementById('image-preview-container');
  container.style.display = 'none';
  base64Image = null
  document.getElementById('image-preview').src = '';
});

document.getElementById('image-file-input').addEventListener('change', async function(event) {
  const file = event.target.files[0];
  if (!file) {
    console.log("No file chosen");
    return
  }
  try {
    const base64String = await blobToBase64(file)
    const compressedWebPBase64 = await compressToWebP(base64String)
    loadImagePreview(compressedWebPBase64)
    toggleOptions("image-input-options")
  } catch (error) {
    const UrlButton = document.getElementById("use-image-url-button")
    UrlButton.disabled = true
    UrlButton.innerText = "Failed loading image"
    setTimeout(function() {
      UrlButton.disabled = false
      UrlButton.innerText = "Use URL"
    }, 2500)
    return

  }
});

function scrollToBottom() {
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.getElementById('scroll-to-bottom-button').addEventListener('click', scrollToBottom);

function loadPreviousMode() {
  const previousMode = localStorage.getItem('selectedMode');
  if (previousMode) {
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
  return settings ? JSON.parse(settings) : null;
}

const modal = document.getElementById('settings-modal');
const span = document.getElementById('close-modal');

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
    document.getElementById('noyap-btn').checked = false;
    document.getElementById('custom-server').value = 'api.openai.com';
    document.getElementById('disable-streaming').checked = false;

    if (lastID.reset) {
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
    document.getElementById('noyap-btn').checked = settings.hasOwnProperty('noyap') ? settings.noyap : true;
    document.getElementById('disable-streaming').checked = settings.hasOwnProperty('disableStreaming') ? settings.disableStreaming : false;
    
    document.getElementById('temperature').disabled = !settings.used;
    document.getElementById('model').disabled = !settings.used;
    document.getElementById('custom-server').disabled = !settings.used;

    clearInterval(apiKeyTimerInterval);
    document.getElementById('api-key-label').style.display = 'none';
    document.getElementById('toggle-api-key-visibility').style.display = 'block';


  }
  document.getElementById('settings-modal').style.display = 'block';
});

document.getElementById('temperature').addEventListener('input', function() {
  document.getElementById('temperature-value').innerText = this.value;
});

document.getElementById('use').addEventListener('change', function() {
  const isChecked = this.checked;
  document.getElementById('temperature').disabled = !isChecked;
  document.getElementById('model').disabled = !isChecked;
  document.getElementById('custom-server').disabled = !isChecked;
});

// Ensure the slider value is saved correctly when settings are saved
document.getElementById('save-settings-button').addEventListener('click', async () => {
  const settings = {
    used: document.getElementById('use').checked,
    temp: document.getElementById('temperature').value,
    model: document.getElementById('model').value,
    copyButton: document.getElementById('copy-button').checked,
    noyap: document.getElementById('noyap-btn').checked,
    server: document.getElementById('custom-server').value,
    disableStreaming: document.getElementById('disable-streaming').checked,
  };
  saveSettings(settings);
  document.getElementById('temperature').disabled = !settings.used;
  document.getElementById('model').disabled = !settings.used;
  document.getElementById('custom-server').disabled = !settings.used;
  
  if (lastID.save) {
    await replit.messages.hideMessage(lastID.save);
  }
  lastID.save = await replit.messages.showNotice("Saved custom settings", 1500);
  modal.style.display = "none";
  await customModelUpdate();
});


function lazyLoadImages() {
  const lazyImages = document.querySelectorAll('img.lazy');
  lazyImages.forEach(img => {
    if (img.getBoundingClientRect().top < window.innerHeight) {
      img.src = img.dataset.src;
      img.onload = () => {
        img.classList.add('loaded');
      };
    }
  });
}

document.addEventListener('scroll', lazyLoadImages);




async function customModelUpdate() {
  const settings = loadSettings();
  const modelSelect = document.getElementById('mode');

  // Find the disabled option
  const disabledOption = Array.from(modelSelect.options).find(option => option.value === 'disabled');

  if (settings && settings.used) {
    if (!lastID.customModalWarning) {
      lastID.customModalWarning = await replit.messages.showNotice("Watch out, your now using a custom model. We have no character limit as we do not know the limit for custom models. It might error because you used more tokens that it can handle!", 8500)
    }
    if (!disabledOption) {
      const newDisabledOption = document.createElement('option');
      newDisabledOption.textContent = 'Disabled';
      newDisabledOption.value = 'disabled';
      modelSelect.appendChild(newDisabledOption);
    }
    modelSelect.value = 'disabled';  // Select the disabled option
    modelSelect.disabled = true;
    modelSelect.title = 'You are using custom variables'

  } else {
    // Remove the disabled option if it exists
    if (disabledOption) {
      modelSelect.removeChild(disabledOption);
    }
    
    modelSelect.title = 'select which GPT model you want to use.'
    modelSelect.disabled = false;
  }
}

function updateMemoryUsage() {
  if (performance.memory) {
    const memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024; // Convert bytes to MB
    document.getElementById('memory-usage').innerText = `Current Memory Usage: ${memoryUsage.toFixed(2)} MB`;
  } else {
    document.getElementById('memory-usage').innerText = '';
  }
}

setInterval(async function() {
  await customModelUpdate()
  const dropdown = document.getElementById('file-dropdown');
  if (dropdown) {
    updateAvailableFiles(dropdown, "./");
  }
  removeDuplicateFileTabs();
}, 60000);
setInterval(updateMemoryUsage, 1000);

window.onload = function() {
  customModelUpdate();
  loadPreviousMode();
  lazyLoadImages();
}

const modeSelector = document.getElementById("mode");
modeSelector.addEventListener("change", updateInputMaxLength);



 // Update every second